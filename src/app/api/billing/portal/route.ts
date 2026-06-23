import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getOrCreateCustomer } from "@/lib/billing/catalog";

// Opens the Stripe Customer Portal so a user can manage / cancel a subscription
// and update payment methods. Requires the Customer Portal to be configured in
// the Stripe dashboard (test mode) — if it isn't, Stripe throws and we surface
// a clear message instead of a 500.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  try {
    const customerId = await getOrCreateCustomer(user.id, user.email);
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/conta`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal failed";
    console.error("[billing:portal]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
