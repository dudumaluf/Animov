import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getCatalogEntry, getOrCreateCustomer } from "@/lib/billing/catalog";

// Creates a Stripe hosted Checkout session for either a subscription plan or a
// one-time credit pack. The mode is inferred from the catalog entry (kind), and
// we only accept price IDs that exist + are active in our billing_catalog so a
// caller can't check out against an arbitrary price.
export const runtime = "nodejs";

type Body = { priceId?: string };

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let priceId: string;
  try {
    const body = (await req.json()) as Body;
    priceId = (body.priceId ?? "").trim();
    if (!priceId) {
      return NextResponse.json({ error: "priceId is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const entry = await getCatalogEntry(priceId);
  if (!entry || !entry.active) {
    return NextResponse.json({ error: "Preço indisponível" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  try {
    const customerId = await getOrCreateCustomer(user.id, user.email);
    const mode = entry.kind === "subscription" ? "subscription" : "payment";

    const session = await getStripe().checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/conta?success=1`,
      cancel_url: `${appUrl}/conta?canceled=1`,
      // Surfaced on the session/event so the webhook can resolve the user even
      // if the customer mapping somehow drifts.
      metadata: { supabase_user_id: user.id, price_id: priceId },
      ...(mode === "subscription"
        ? { subscription_data: { metadata: { supabase_user_id: user.id } } }
        : { payment_intent_data: { metadata: { supabase_user_id: user.id } } }),
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe não retornou URL" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("[billing:checkout]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
