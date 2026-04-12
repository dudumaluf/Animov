import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("credits")
    .update({ balance: 100 })
    .eq("user_id", user.id);

  await admin.from("credit_transactions").insert({
    user_id: user.id,
    delta: 100,
    reason: "Dev: credit refill",
  });

  return NextResponse.json({ balance: 100, message: "Credits set to 100" });
}
