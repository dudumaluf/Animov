import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AdminGuardSuccess = { ok: true; userId: string };
type AdminGuardFailure = { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<
  AdminGuardSuccess | AdminGuardFailure
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin only" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
