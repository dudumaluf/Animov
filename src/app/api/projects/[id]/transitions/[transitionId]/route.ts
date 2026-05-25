import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Dedicated transition-deletion endpoint.
 *
 * Mirrors the rationale of scenes/[sceneId]/route.ts: PATCH no longer
 * silently prunes transitions that aren't in the payload, so explicit
 * removal happens here. The client-side `transitionId` follows the
 * `t-${fromSceneId}-${toSceneId}` convention used in the store; we accept
 * either that pair-derived id or the actual `transitions.id` UUID.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; transitionId: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Two id shapes accepted:
  //   - "t-<fromSceneId>-<toSceneId>" : the client-side convention used by
  //     project-store / film-strip when keying transitions in memory.
  //   - "<uuid>" : the DB row id (used by future admin or import paths).
  const pairMatch = params.transitionId.match(/^t-([0-9a-f-]+)-([0-9a-f-]+)$/i);

  let deleteQuery = supabase
    .from("transitions")
    .delete()
    .eq("project_id", params.id);

  if (pairMatch) {
    deleteQuery = deleteQuery
      .eq("from_scene_id", pairMatch[1])
      .eq("to_scene_id", pairMatch[2]);
  } else {
    deleteQuery = deleteQuery.eq("id", params.transitionId);
  }

  const { error } = await deleteQuery;

  if (error) {
    console.error("[transitions/delete]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.id);

  const { data: refreshed } = await supabase
    .from("projects")
    .select("updated_at")
    .eq("id", params.id)
    .single();

  void req; // silence unused parameter warning while keeping a uniform signature

  return NextResponse.json({ ok: true, updatedAt: refreshed?.updated_at ?? null });
}
