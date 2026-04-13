import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = createAdminClient();

  const { data: transactions } = await admin
    .from("credit_transactions")
    .select("id, delta, reason, admin_id, created_at")
    .eq("user_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json(transactions ?? []);
}
