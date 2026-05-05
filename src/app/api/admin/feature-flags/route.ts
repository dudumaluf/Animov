import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/feature-flags
 * ----------------------------
 * Returns the full admin_feature_flags table as a `{ key: value }` map.
 * Read-only for authenticated clients; write access is gated via RLS and is
 * performed out-of-band (service role / SQL admin only).
 *
 * Returns an empty map when the request is unauthenticated or the table is
 * missing / empty — the client hook has hardcoded defaults so the UI still
 * renders a sensible layout either way.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ flags: {} }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("admin_feature_flags")
      .select("key,value");

    if (error) {
      // Missing table / RLS issue → return empty map. The hook falls back to
      // hardcoded defaults so the editor boots without depending on this
      // table being present.
      return NextResponse.json({ flags: {}, error: error.message }, { status: 200 });
    }

    const flags: Record<string, unknown> = {};
    for (const row of data ?? []) {
      flags[row.key as string] = row.value;
    }
    return NextResponse.json({ flags }, { status: 200 });
  } catch (err) {
    // Swallow errors into an empty response — never block boot on a flag fetch.
    console.warn("[api/feature-flags]", err);
    return NextResponse.json({ flags: {} }, { status: 200 });
  }
}
