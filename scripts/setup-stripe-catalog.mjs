// ============================================================
// Animov.ai — Stripe catalog bootstrap (idempotent, TEST mode)
// ------------------------------------------------------------
// Creates (or reuses) the subscription + one-time-pack Prices in Stripe and
// upserts the resulting price IDs into Supabase `billing_catalog`. Safe to
// re-run: each Price is keyed by a stable `lookup_key`, so a second run finds
// the existing Price instead of creating a duplicate. Credit amounts / labels
// in `billing_catalog` are the admin-editable source of truth at runtime —
// this script only seeds sensible defaults.
//
// Usage (from animov/):
//   node --env-file=.env.local scripts/setup-stripe-catalog.mjs
//
// Reads: STRIPE_SECRET_KEY (must be sk_test_… here), NEXT_PUBLIC_SUPABASE_URL,
//        SUPABASE_SERVICE_ROLE_KEY.
// ============================================================

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeKey) {
  console.error("✗ STRIPE_SECRET_KEY missing (set it in .env.local)");
  process.exit(1);
}
if (!stripeKey.startsWith("sk_test_")) {
  console.error(
    `✗ Refusing to run: STRIPE_SECRET_KEY is not a TEST key (got ${stripeKey.slice(0, 8)}…). ` +
      "This bootstrap is TEST-mode only.",
  );
  process.exit(1);
}
if (!supabaseUrl || !serviceKey) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CURRENCY = "brl";

// Default catalog. `credits`/`label`/`display_price` are admin-editable later
// from the panel; the charged amount lives in Stripe (immutable per Price).
const CATALOG = [
  // ── Subscriptions (recurring monthly) ──
  {
    lookupKey: "animov_sub_starter",
    productName: "Animov Starter",
    kind: "subscription",
    plan: "starter",
    amount: 7900,
    credits: 20,
    label: "Starter",
    displayPrice: "R$ 79/mês",
    interval: "month",
    sortOrder: 10,
  },
  {
    lookupKey: "animov_sub_pro",
    productName: "Animov Pro",
    kind: "subscription",
    plan: "pro",
    amount: 19900,
    credits: 60,
    label: "Pro",
    displayPrice: "R$ 199/mês",
    interval: "month",
    sortOrder: 20,
  },
  {
    lookupKey: "animov_sub_team",
    productName: "Animov Team",
    kind: "subscription",
    plan: "team",
    amount: 49900,
    credits: 200,
    label: "Team",
    displayPrice: "R$ 499/mês",
    interval: "month",
    sortOrder: 30,
  },
  // ── One-time credit packs ──
  {
    lookupKey: "animov_pack_20",
    productName: "Animov 20 créditos",
    kind: "pack",
    plan: "pack_20",
    amount: 8900,
    credits: 20,
    label: "20 créditos",
    displayPrice: "R$ 89",
    interval: null,
    sortOrder: 110,
  },
  {
    lookupKey: "animov_pack_50",
    productName: "Animov 50 créditos",
    kind: "pack",
    plan: "pack_50",
    amount: 19900,
    credits: 50,
    label: "50 créditos",
    displayPrice: "R$ 199",
    interval: null,
    sortOrder: 120,
  },
  {
    lookupKey: "animov_pack_120",
    productName: "Animov 120 créditos",
    kind: "pack",
    plan: "pack_120",
    amount: 42900,
    credits: 120,
    label: "120 créditos",
    displayPrice: "R$ 429",
    interval: null,
    sortOrder: 130,
  },
];

async function resolvePrice(item) {
  // Idempotency: a Price's lookup_key is unique among active prices, so a
  // re-run finds the same Price instead of duplicating it.
  const existing = await stripe.prices.list({
    lookup_keys: [item.lookupKey],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });

  if (existing.data.length > 0) {
    const price = existing.data[0];
    console.log(`• reuse  ${item.lookupKey} → ${price.id} (${item.displayPrice})`);
    return price;
  }

  const price = await stripe.prices.create({
    currency: CURRENCY,
    unit_amount: item.amount,
    lookup_key: item.lookupKey,
    ...(item.interval ? { recurring: { interval: item.interval } } : {}),
    metadata: { plan: item.plan, credits: String(item.credits), kind: item.kind },
    product_data: {
      name: item.productName,
      metadata: { animov_catalog: "true", plan: item.plan, kind: item.kind },
    },
  });
  console.log(`✓ create ${item.lookupKey} → ${price.id} (${item.displayPrice})`);
  return price;
}

async function main() {
  console.log("Animov · Stripe catalog bootstrap (TEST mode)\n");

  const rows = [];
  for (const item of CATALOG) {
    const price = await resolvePrice(item);
    rows.push({
      stripe_price_id: price.id,
      kind: item.kind,
      plan: item.plan,
      credits: item.credits,
      label: item.label,
      display_price: item.displayPrice,
      active: true,
      sort_order: item.sortOrder,
    });
  }

  const { error } = await supabase
    .from("billing_catalog")
    .upsert(rows, { onConflict: "stripe_price_id" });

  if (error) {
    console.error("\n✗ billing_catalog upsert failed:", error.message);
    process.exit(1);
  }

  console.log("\n✓ Seeded billing_catalog with", rows.length, "rows:");
  for (const r of rows) {
    console.log(
      `   ${r.kind.padEnd(12)} ${r.plan.padEnd(10)} ${String(r.credits).padStart(3)}cr  ${r.display_price.padEnd(10)}  ${r.stripe_price_id}`,
    );
  }
  console.log(
    "\nNext: enable card + Pix in the Stripe TEST dashboard (Settings → Payment methods).",
  );
}

main().catch((err) => {
  console.error("\n✗ Bootstrap failed:", err?.message ?? err);
  process.exit(1);
});
