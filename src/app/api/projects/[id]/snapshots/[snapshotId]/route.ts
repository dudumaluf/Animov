import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ScenesRow = {
  id: string;
  project_id: string;
  order_index: number;
  photo_url: string;
  prompt_generated: string | null;
  video_url: string | null;
  duration: number;
  status: string;
  cost_credits: number;
  video_versions: unknown[] | null;
  active_version: number | null;
  source_type: string | null;
  audio_volume: number | null;
  trim_start: number | null;
  trim_end: number | null;
  generation_target_seconds: number | null;
  image_transform: unknown;
};

type TransitionsRow = {
  id: string;
  project_id: string;
  from_scene_id: string;
  to_scene_id: string;
  order_index: number;
  video_url: string | null;
  status: string;
  cost_credits: number;
  duration_seconds: number | null;
  sprite_json: unknown;
  staging_status: string | null;
};

type SnapshotPayload = {
  project: { name: string; metadata: Record<string, unknown>; updated_at: string };
  scenes: ScenesRow[];
  transitions: TransitionsRow[];
};

/**
 * GET  -> fetch full snapshot payload (used by "Visualizar" before restore)
 * POST -> apply snapshot to the project (?action=restore).
 *
 * Restore semantics: before applying, we capture a `pre-restore` snapshot of
 * the current state so the user can undo. Then we replace the project's
 * scenes/transitions with the snapshot's rows. This is the only operation
 * in the codebase that legitimately needs to bulk-delete + bulk-insert in
 * one shot — the user explicitly asked for a known prior state.
 */

export async function GET(
  _req: Request,
  { params }: { params: { id: string; snapshotId: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("project_snapshots")
    .select("*")
    .eq("id", params.snapshotId)
    .eq("project_id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  return NextResponse.json({ snapshot: data });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string; snapshotId: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "restore") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  // Verify project ownership and capture current state for the
  // pre-restore safety snapshot.
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name, metadata, updated_at, user_id")
    .eq("id", params.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch the snapshot we want to restore.
  const { data: snapRow, error: snapErr } = await supabase
    .from("project_snapshots")
    .select("snapshot")
    .eq("id", params.snapshotId)
    .eq("project_id", params.id)
    .single();

  if (snapErr || !snapRow) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  const payload = snapRow.snapshot as SnapshotPayload;
  if (!payload?.project || !Array.isArray(payload.scenes)) {
    return NextResponse.json({ error: "Malformed snapshot" }, { status: 400 });
  }

  // Capture the current state as a pre-restore snapshot — even if the user
  // changes their mind we keep a recovery point.
  const [{ data: currentScenes }, { data: currentTransitions }] = await Promise.all([
    supabase
      .from("scenes")
      .select("*")
      .eq("project_id", params.id)
      .order("order_index", { ascending: true }),
    supabase
      .from("transitions")
      .select("*")
      .eq("project_id", params.id)
      .order("order_index", { ascending: true }),
  ]);

  await supabase.from("project_snapshots").insert({
    project_id: params.id,
    user_id: user.id,
    snapshot: {
      project: {
        name: project.name,
        metadata: project.metadata,
        updated_at: project.updated_at,
      },
      scenes: currentScenes ?? [],
      transitions: currentTransitions ?? [],
    },
    reason: "pre-restore",
  });

  // Apply the snapshot. This IS a destructive bulk replace, but the user
  // explicitly asked for the prior state — and the pre-restore snapshot
  // above is the undo hatch.
  await supabase.from("transitions").delete().eq("project_id", params.id);
  await supabase.from("scenes").delete().eq("project_id", params.id);

  if (payload.scenes.length > 0) {
    const scenesToInsert = payload.scenes.map((s, i) => ({
      id: s.id,
      project_id: params.id,
      order_index: i,
      photo_url: s.photo_url,
      prompt_generated: s.prompt_generated,
      video_url: s.video_url,
      duration: s.duration,
      status: s.status,
      cost_credits: s.cost_credits,
      video_versions: s.video_versions ?? [],
      active_version: s.active_version ?? 0,
      source_type: s.source_type ?? "image",
      audio_volume: typeof s.audio_volume === "number" ? s.audio_volume : 1,
      trim_start: s.trim_start,
      trim_end: s.trim_end,
      generation_target_seconds: s.generation_target_seconds,
      image_transform: s.image_transform,
    }));
    const { error } = await supabase.from("scenes").insert(scenesToInsert);
    if (error) {
      console.error("[snapshots/restore/scenes]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(payload.transitions) && payload.transitions.length > 0) {
    const transToInsert = payload.transitions.map((t, i) => ({
      project_id: params.id,
      from_scene_id: t.from_scene_id,
      to_scene_id: t.to_scene_id,
      order_index: i,
      video_url: t.video_url,
      status: t.status,
      cost_credits: t.cost_credits,
      duration_seconds: t.duration_seconds,
      sprite_json: t.sprite_json,
      staging_status: t.staging_status,
    }));
    const { error } = await supabase.from("transitions").insert(transToInsert);
    if (error) {
      console.error("[snapshots/restore/transitions]", error);
    }
  }

  // Touch the project so concurrency caches refresh.
  await supabase
    .from("projects")
    .update({
      name: payload.project.name,
      metadata: payload.project.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  const { data: refreshed } = await supabase
    .from("projects")
    .select("updated_at")
    .eq("id", params.id)
    .single();

  await supabase.rpc("cleanup_old_snapshots", { p_project_id: params.id });

  return NextResponse.json({
    ok: true,
    updatedAt: refreshed?.updated_at ?? null,
  });
}
