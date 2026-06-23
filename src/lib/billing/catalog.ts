import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/**
 * Billing catalog + customer helpers (server-only).
 * -------------------------------------------------
 * The `billing_catalog` table is the admin-editable source of truth for how
 * many credits a Stripe price grants and how it's labelled. Reads here bypass
 * RLS via the service role so they work from the webhook (no user session) and
 * from server components alike. When a price row is missing (e.g. a brand-new
 * price not yet seeded), we fall back to the Stripe price's `metadata.credits`
 * so a purchase still grants the right amount.
 */

export type CatalogKind = "subscription" | "pack";

export type CatalogEntry = {
  stripePriceId: string;
  kind: CatalogKind;
  plan: string | null;
  credits: number;
  label: string | null;
  displayPrice: string | null;
  active: boolean;
  sortOrder: number;
};

type CatalogRow = {
  stripe_price_id: string;
  kind: CatalogKind;
  plan: string | null;
  credits: number;
  label: string | null;
  display_price: string | null;
  active: boolean;
  sort_order: number;
};

function rowToEntry(row: CatalogRow): CatalogEntry {
  return {
    stripePriceId: row.stripe_price_id,
    kind: row.kind,
    plan: row.plan,
    credits: row.credits,
    label: row.label,
    displayPrice: row.display_price,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

/** Active catalog entries (for the account page / pricing UI), sorted. */
export async function listActiveCatalog(): Promise<CatalogEntry[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_catalog")
    .select(
      "stripe_price_id, kind, plan, credits, label, display_price, active, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalog] listActiveCatalog:", error.message);
    return [];
  }
  return (data as CatalogRow[]).map(rowToEntry);
}

/**
 * Resolve a single price → catalog entry. Prefers the DB row (admin-editable);
 * falls back to the live Stripe price's `metadata.credits` + recurring flag so
 * a freshly-created price still resolves before it's seeded into the catalog.
 * Returns null only when the price can't be found in Stripe at all.
 */
export async function getCatalogEntry(priceId: string): Promise<CatalogEntry | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_catalog")
    .select(
      "stripe_price_id, kind, plan, credits, label, display_price, active, sort_order",
    )
    .eq("stripe_price_id", priceId)
    .maybeSingle();

  if (data) return rowToEntry(data as CatalogRow);

  // Fallback: read straight off the Stripe price metadata.
  try {
    const price = await getStripe().prices.retrieve(priceId);
    const credits = Number(price.metadata?.credits ?? 0);
    return {
      stripePriceId: price.id,
      kind: price.recurring ? "subscription" : "pack",
      plan: price.metadata?.plan ?? null,
      credits: Number.isFinite(credits) ? credits : 0,
      label: price.nickname ?? null,
      displayPrice: null,
      active: price.active,
      sortOrder: 0,
    };
  } catch (err) {
    console.error("[catalog] getCatalogEntry fallback:", err);
    return null;
  }
}

/**
 * Returns the Supabase user's Stripe customer id, creating the customer on
 * first use and persisting it to `users.stripe_customer_id`. Idempotent enough
 * for our low-concurrency checkout flow: reads first, only creates when absent.
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string | null | undefined,
): Promise<string> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id as string;
  }

  const customer = await getStripe().customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  const { error } = await admin
    .from("users")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (error) {
    console.error("[catalog] persist stripe_customer_id:", error.message);
  }

  return customer.id;
}
