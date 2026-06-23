import Stripe from "stripe";

/**
 * Server-only Stripe client (lazy singleton).
 * -------------------------------------------
 * Instantiated on first use rather than at module load so importing this file
 * during `next build` (which can pull route modules in for analysis) never
 * throws when the secret isn't present in that context. Every billing route
 * runs with `runtime = "nodejs"`, so the key is always available at call time.
 *
 * NEVER import this from a client component — it reads STRIPE_SECRET_KEY.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  client = new Stripe(key);
  return client;
}
