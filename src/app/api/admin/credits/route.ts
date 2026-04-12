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

  const { data: newBalance, error } = await admin.rpc("add_credit", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_admin_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ balance: newBalance });
}
