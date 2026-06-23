import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCatalogEntry } from "@/lib/billing/catalog";

// Stripe webhook (public, nodejs). Verifies the signature against the RAW body,
// dedupes every event via `stripe_events` (so a Stripe retry never double-
// grants), then grants credits / upserts subscription state through the same
// add_credit RPC + service-role client the admin tools use. Money paths are
// idempotent: pack credits land on checkout.session.completed, subscription
// credits land on invoice.paid (first + renewals), subscription rows mirror
// customer.subscription.*.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Resolve a Supabase user id from event metadata, else by Stripe customer. */
async function resolveUserId(
  admin: AdminClient,
  metadataUserId: string | null | undefined,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  if (customerId) {
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }
  return null;
}

/** Grant credits via the shared RPC; ensures a credits row exists first. */
async function grantCredits(
  admin: AdminClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<void> {
  if (amount <= 0) return;
  // Safety net: a credits row may not exist for very old accounts — add_credit
  // raises if it's missing, so insert a zero-balance row first (no-op if set).
  await admin
    .from("credits")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  const { error } = await admin.rpc("add_credit", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_admin_id: null,
  });
  if (error) {
    console.error("[webhook] add_credit failed:", error.message);
    throw new Error(error.message);
  }
}

/** Best-effort founder ping on a successful purchase (optional). */
function notifyFounder(text: string): void {
  const url = process.env.FOUNDER_NOTIFY_WEBHOOK;
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {
    /* non-blocking */
  });
}

function periodEndToIso(sub: Stripe.Subscription): string | null {
  // current_period_end moved onto items in recent API versions — read either.
  const loose = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts = loose.current_period_end ?? loose.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;
}

async function upsertSubscription(
  admin: AdminClient,
  sub: Stripe.Subscription,
): Promise<void> {
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const metaUserId = (sub.metadata?.supabase_user_id as string | undefined) ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const userId = await resolveUserId(admin, metaUserId, customerId);
  if (!userId) {
    console.error("[webhook] subscription upsert: no user for", sub.id);
    return;
  }

  let plan: string | null = null;
  if (priceId) {
    const entry = await getCatalogEntry(priceId);
    plan = entry?.plan ?? null;
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan,
      status: sub.status,
      current_period_end: periodEndToIso(sub),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("[webhook] subscription upsert:", error.message);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[webhook] signature verify failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: atomically claim the event id. A duplicate delivery (Stripe
  // retry of an already-handled event) hits the primary-key conflict and we
  // exit early without re-processing — no double-grant. If the handler below
  // then fails, we release the claim so a genuine retry can reprocess cleanly.
  const { error: dedupeError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (dedupeError) {
    if (dedupeError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[webhook] dedupe insert error:", dedupeError.message);
    // Fall through — better to risk a (rare) reprocess than to drop the event.
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Subscriptions are credited on invoice.paid; only one-time packs grant
        // here so we never double-count the first subscription cycle.
        if (session.mode !== "payment") break;

        const priceId = (session.metadata?.price_id as string | undefined) ?? null;
        const metaUserId =
          (session.metadata?.supabase_user_id as string | undefined) ?? null;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const userId = await resolveUserId(admin, metaUserId, customerId);

        if (!userId || !priceId) {
          console.error("[webhook] checkout.completed: missing user/price", {
            userId,
            priceId,
          });
          break;
        }
        const entry = await getCatalogEntry(priceId);
        const credits = entry?.credits ?? 0;
        await grantCredits(
          admin,
          userId,
          credits,
          `Compra de pacote: ${entry?.label ?? priceId} (+${credits}cr)`,
        );
        notifyFounder(`💸 Animov: pacote ${entry?.label ?? priceId} comprado (+${credits}cr).`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const line = invoice.lines?.data?.[0] as
          | { price?: { id?: string }; pricing?: { price_details?: { price?: string } } }
          | undefined;
        const priceId =
          line?.price?.id ?? line?.pricing?.price_details?.price ?? null;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        if (!priceId) break;
        const entry = await getCatalogEntry(priceId);
        // Only subscription prices grant here (packs are handled above).
        if (!entry || entry.kind !== "subscription") break;

        const userId = await resolveUserId(admin, null, customerId);
        if (!userId) {
          console.error("[webhook] invoice.paid: no user for customer", customerId);
          break;
        }
        await grantCredits(
          admin,
          userId,
          entry.credits,
          `Assinatura ${entry.label ?? entry.plan ?? priceId} (+${entry.credits}cr)`,
        );
        notifyFounder(
          `🔁 Animov: assinatura ${entry.label ?? entry.plan} renovada/ativada (+${entry.credits}cr).`,
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(admin, sub);
        break;
      }

      default:
        // Unhandled event types are acked so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error("[webhook] handler error:", err);
    // Release the dedupe claim so Stripe's retry reprocesses this event. The
    // grant (add_credit) is the last meaningful await in each handler, so a
    // failure means it hasn't run — reprocessing is safe, not a double-grant.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
