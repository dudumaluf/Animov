import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: user } = await admin
    .from("users")
    .select("id, email, name, role")
    .eq("email", email)
    .single();

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: credits } = await admin
    .from("credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    ...user,
    balance: credits?.balance ?? 0,
  });
}
