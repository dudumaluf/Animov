import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Optimistic-concurrency window for the project document. The client passes
 * the `updated_at` value it last observed; if the row in the DB has moved on
 * since then (because another tab / device saved in the meantime), we refuse
 * the write with 409 instead of silently overwriting.
 *
 * The check is implemented via `.eq("updated_at", expected)` on the projects
 * UPDATE — atomically gated by Postgres. The `handle_updated_at` trigger
 * (00001_initial_schema.sql) bumps `updated_at` on every successful UPDATE,
 * so a subsequent GET will reflect the new value and the next save will pass.
 *
 * Bypass: `force: true` in the body skips the check (used when the user
 * explicitly chose to overwrite a conflicting remote state via the modal).
 * System updates (executors persisting model output) also pass force=true
 * via a `system: true` hint that additionally suppresses snapshot creation.
 */

type PatchBody = {
  name?: string;
  metadata?: Record<string, unknown>;
  scenes?: ScenePayload[];
  transitions?: TransitionPayload[];
  expected_updated_at?: string | null;
  force?: boolean;
  /** Hint from server-side executors: skip snapshot creation to avoid noise. */
  system?: boolean;
};

type ScenePayload = {
  id?: string;
  photo_url: string;
  preset_key: string;
  duration: number;
  status: string;
  video_url?: string;
  cost_credits: number;
  video_versions?: unknown[];
  active_version?: number;
  source_type?: string;
  audio_volume?: number | null;
  trim_start?: number | null;
  trim_end?: number | null;
  generation_target_seconds?: number | null;
  image_transform?: unknown;
  guidance_prompt?: string | null;
};

type TransitionPayload = {
  from_scene_id: string;
  to_scene_id: string;
  video_url?: string;
  status: string;
  cost_credits?: number;
  duration_seconds?: number | null;
  sprite_json?: unknown;
  staging_status?: string | null;
  guidance_prompt?: string | null;
};

/** Decide whether the change set warrants a fresh auto snapshot. */
function shouldCreateAutoSnapshot(
  lastAutoCreatedAt: string | null,
  previousSceneIds: string[],
  nextSceneIds: string[],
): boolean {
  // Structural change always wins (add/remove/reorder triggers a snapshot
  // even if a previous one was recent — these are the most destructive
  // operations and we want a recovery point right before them).
  if (previousSceneIds.length !== nextSceneIds.length) return true;
  const prevSet = new Set(previousSceneIds);
  if (nextSceneIds.some((id) => !prevSet.has(id))) return true;

  // Otherwise, throttle by time: at most one auto snapshot per 10 minutes.
  if (!lastAutoCreatedAt) return true;
  const ageMs = Date.now() - new Date(lastAutoCreatedAt).getTime();
  return ageMs > 10 * 60 * 1000;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 404 });
  }

  const { data: scenes } = await supabase
    .from("scenes")
    .select("*")
    .eq("project_id", params.id)
    .order("order_index", { ascending: true });

  const { data: transitions } = await supabase
    .from("transitions")
    .select("*")
    .eq("project_id", params.id)
    .order("order_index", { ascending: true });

  return NextResponse.json({ project, scenes: scenes ?? [], transitions: transitions ?? [] });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as PatchBody;
  const force = body.force === true;
  const isSystem = body.system === true;
  const expected =
    typeof body.expected_updated_at === "string" && body.expected_updated_at.length > 0
      ? body.expected_updated_at
      : null;

  // ─── Snapshot the BEFORE state so structural-change detection has a
  // baseline AND so we can persist a pre-overwrite snapshot if needed.
  // Single SELECT — cheap, runs even when nothing changed.
  const { data: before } = await supabase
    .from("projects")
    .select("id, updated_at, metadata, name")
    .eq("id", params.id)
    .single();

  if (!before) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ─── Optimistic concurrency check (skipped when force=true)
  if (!force && expected && before.updated_at !== expected) {
    return NextResponse.json(
      {
        error: "conflict",
        currentUpdatedAt: before.updated_at,
      },
      { status: 409 },
    );
  }

  // ─── If a user explicitly forced overwrite of a stale state, persist a
  // "pre-overwrite" snapshot of what we're about to clobber. This gives them
  // a recovery point in the version-history UI. Skipped for system updates.
  if (force && !isSystem && expected && before.updated_at !== expected) {
    const { data: beforeScenes } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", params.id)
      .order("order_index", { ascending: true });
    const { data: beforeTransitions } = await supabase
      .from("transitions")
      .select("*")
      .eq("project_id", params.id)
      .order("order_index", { ascending: true });

    await supabase.from("project_snapshots").insert({
      project_id: params.id,
      user_id: user.id,
      snapshot: {
        project: { name: before.name, metadata: before.metadata, updated_at: before.updated_at },
        scenes: beforeScenes ?? [],
        transitions: beforeTransitions ?? [],
      },
      reason: "pre-overwrite",
    });
  }

  // ─── Project UPDATE (always runs so the trigger bumps updated_at, which
  // also serves as our concurrency gate via .eq when applicable).
  const projectUpdate: Record<string, unknown> = {};
  if (body.name) projectUpdate.name = body.name;
  if (body.metadata !== undefined) projectUpdate.metadata = body.metadata;

  // Always touch updated_at so a no-op metadata save still moves the
  // version forward and downstream concurrency checks stay consistent.
  // The trigger will overwrite this with now(), but Supabase requires at
  // least one column in the UPDATE set.
  projectUpdate.updated_at = new Date().toISOString();

  let projectQuery = supabase
    .from("projects")
    .update(projectUpdate)
    .eq("id", params.id);

  if (!force && expected) {
    projectQuery = projectQuery.eq("updated_at", expected);
  }

  const { data: updatedRow, error: projectErr } = await projectQuery
    .select("updated_at")
    .maybeSingle();

  if (projectErr) {
    console.error("[projects/update-project]", projectErr);
    return NextResponse.json({ error: projectErr.message }, { status: 500 });
  }

  // .eq("updated_at", expected) returned 0 rows — concurrency collision
  // happened in the tiny window between our SELECT and our UPDATE.
  if (!updatedRow) {
    const { data: latest } = await supabase
      .from("projects")
      .select("updated_at")
      .eq("id", params.id)
      .single();
    return NextResponse.json(
      { error: "conflict", currentUpdatedAt: latest?.updated_at ?? null },
      { status: 409 },
    );
  }

  // ─── Scenes upsert (no longer deletes missing scenes — use the
  // dedicated DELETE endpoint at /api/projects/[id]/scenes/[sceneId]).
  if (Array.isArray(body.scenes) && body.scenes.length > 0) {
    const scenesToUpsert = body.scenes.map((s, i) => ({
      ...(s.id ? { id: s.id } : {}),
      project_id: params.id,
      order_index: i,
      photo_url: s.photo_url,
      prompt_generated: s.preset_key,
      video_url: s.video_url ?? null,
      duration: s.duration,
      status: s.status === "idle" ? "pending" : s.status,
      cost_credits: s.cost_credits,
      video_versions: s.video_versions ?? [],
      active_version: s.active_version ?? 0,
      source_type: s.source_type ?? "image",
      audio_volume: typeof s.audio_volume === "number" ? s.audio_volume : 1,
      trim_start: typeof s.trim_start === "number" ? s.trim_start : null,
      trim_end: typeof s.trim_end === "number" ? s.trim_end : null,
      generation_target_seconds:
        typeof s.generation_target_seconds === "number"
          ? s.generation_target_seconds
          : null,
      image_transform: s.image_transform ?? null,
      guidance_prompt:
        typeof s.guidance_prompt === "string" && s.guidance_prompt.trim()
          ? s.guidance_prompt
          : null,
    }));

    const { error } = await supabase.from("scenes").upsert(scenesToUpsert, {
      onConflict: "id",
    });
    if (error) {
      console.error("[projects/save-scenes]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // ─── Transitions upsert (also no longer prunes missing pairs in PATCH —
  // use the dedicated DELETE endpoint at
  // /api/projects/[id]/transitions/[transitionId]).
  if (Array.isArray(body.transitions) && body.transitions.length > 0) {
    const transToUpsert = body.transitions.map((t, i) => ({
      project_id: params.id,
      from_scene_id: t.from_scene_id,
      to_scene_id: t.to_scene_id,
      order_index: i,
      video_url: t.video_url ?? null,
      status: t.status === "idle" ? "pending" : t.status,
      cost_credits: t.cost_credits ?? 0,
      duration_seconds:
        typeof t.duration_seconds === "number" ? t.duration_seconds : null,
      sprite_json: t.sprite_json ?? null,
      staging_status: t.staging_status ?? null,
      guidance_prompt:
        typeof t.guidance_prompt === "string" && t.guidance_prompt.trim()
          ? t.guidance_prompt
          : null,
    }));

    const { error } = await supabase.from("transitions").upsert(transToUpsert, {
      onConflict: "project_id,from_scene_id,to_scene_id",
    });
    if (error) {
      console.error("[projects/save-transitions]", error);
    }
  }

  // ─── Auto-snapshot — runs AFTER scenes/transitions persist so the
  // snapshot reflects the new state, not the pre-save state.
  if (!isSystem && Array.isArray(body.scenes)) {
    const { data: lastAuto } = await supabase
      .from("project_snapshots")
      .select("created_at")
      .eq("project_id", params.id)
      .eq("reason", "auto")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevIds = (await supabase
      .from("scenes")
      .select("id")
      .eq("project_id", params.id)).data?.map((s) => s.id) ?? [];
    const nextIds = body.scenes.map((s) => s.id).filter((id): id is string => !!id);

    if (shouldCreateAutoSnapshot(lastAuto?.created_at ?? null, prevIds, nextIds)) {
      const { data: snapScenes } = await supabase
        .from("scenes")
        .select("*")
        .eq("project_id", params.id)
        .order("order_index", { ascending: true });
      const { data: snapTransitions } = await supabase
        .from("transitions")
        .select("*")
        .eq("project_id", params.id)
        .order("order_index", { ascending: true });

      await supabase.from("project_snapshots").insert({
        project_id: params.id,
        user_id: user.id,
        snapshot: {
          project: {
            name: body.name ?? before.name,
            metadata: body.metadata ?? before.metadata,
            updated_at: updatedRow.updated_at,
          },
          scenes: snapScenes ?? [],
          transitions: snapTransitions ?? [],
        },
        reason: "auto",
      });

      // Opportunistic cleanup keeps the table from growing unboundedly.
      await supabase.rpc("cleanup_old_snapshots", { p_project_id: params.id });
    }
  }

  return NextResponse.json({ ok: true, updatedAt: updatedRow.updated_at });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
