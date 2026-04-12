import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, amount, reason } = body;

  if (!userId || !amount || !reason) {
    return NextResponse.json({ error: "userId, amount, reason required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: credits } = await admin
    .from("credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!credits) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await admin
    .from("credits")
    .update({ balance: credits.balance + amount })
    .eq("user_id", userId);

  await admin.from("credit_transactions").insert({
    user_id: userId,
    delta: amount,
    reason,
    admin_id: user.id,
  });

  return NextResponse.json({ balance: credits.balance + amount });
}
