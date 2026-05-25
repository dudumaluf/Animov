import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Dedicated scene-deletion endpoint.
 *
 * Why this exists separately from PATCH /api/projects/[id]: the project PATCH
 * used to delete "missing" scenes silently (anything not present in the
 * payload was wiped). That allowed a race condition where a scene still in
 * the middle of uploading its photo got filtered from the save payload and
 * then deleted — silently losing user data. PATCH now only upserts; removing
 * a scene must be done explicitly through this endpoint.
 *
 * RLS on `scenes` already restricts to the owning user, but we also bind to
 * `project_id` here so a probe with someone else's scene id can't even fish
 * for existence.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; sceneId: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the project belongs to the requesting user before touching scenes.
  // (RLS does this too, but the explicit check yields a clearer 404 instead
  // of an opaque "0 rows affected".)
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("scenes")
    .delete()
    .eq("id", params.sceneId)
    .eq("project_id", params.id);

  if (error) {
    console.error("[scenes/delete]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Touch the project so the next concurrency check on the client picks up
  // the change (otherwise the client's cached `lastKnownUpdatedAt` would
  // still match and it'd think nothing changed remotely).
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.id);

  // Also clean up any orphaned transitions that referenced the deleted scene.
  // PATCH no longer prunes them, so we do it here at the natural moment.
  await supabase
    .from("transitions")
    .delete()
    .eq("project_id", params.id)
    .or(`from_scene_id.eq.${params.sceneId},to_scene_id.eq.${params.sceneId}`);

  // Return the new updated_at so the client can advance its cached value
  // without a separate GET round-trip.
  const { data: refreshed } = await supabase
    .from("projects")
    .select("updated_at")
    .eq("id", params.id)
    .single();

  return NextResponse.json({ ok: true, updatedAt: refreshed?.updated_at ?? null });
}
