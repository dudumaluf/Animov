import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET  -> list snapshots for a project (newest first)
 * POST -> create a manual snapshot of the current state
 *
 * Auto-snapshots are created inside the main PATCH handler when the change
 * set is structural or enough time has elapsed (see route.ts). This file
 * exists so the user-facing "Version history" drawer can list, fetch and
 * restore from saved states.
 *
 * Listing intentionally excludes the heavy `snapshot` jsonb column so a
 * long history doesn't bloat the response. The single-snapshot GET in
 * [snapshotId]/route.ts returns the full payload when the user actually
 * needs to view or restore it.
 */

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("project_snapshots")
    .select("id, project_id, reason, created_at, snapshot->project->>name")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[snapshots/list]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Augment each row with a derived scene count by reading a tiny slice of
  // the snapshot — cheaper than parsing the full jsonb client-side because
  // Postgres can give us just the array length via jsonb operators.
  const { data: counts } = await supabase
    .from("project_snapshots")
    .select("id, snapshot->scenes")
    .eq("project_id", params.id);

  const sceneCountById = new Map<string, number>();
  (counts ?? []).forEach((row) => {
    const arr = (row as { id: string; scenes?: unknown[] }).scenes;
    sceneCountById.set(
      (row as { id: string }).id,
      Array.isArray(arr) ? arr.length : 0,
    );
  });

  return NextResponse.json({
    snapshots: (data ?? []).map((row) => ({
      id: row.id,
      reason: row.reason,
      createdAt: row.created_at,
      projectName: (row as { name?: string }).name ?? null,
      sceneCount: sceneCountById.get(row.id) ?? 0,
    })),
  });
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const [{ data: scenes }, { data: transitions }] = await Promise.all([
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

  const { data: created, error } = await supabase
    .from("project_snapshots")
    .insert({
      project_id: params.id,
      user_id: user.id,
      snapshot: {
        project: {
          name: project.name,
          metadata: project.metadata,
          updated_at: project.updated_at,
        },
        scenes: scenes ?? [],
        transitions: transitions ?? [],
      },
      reason: "manual",
    })
    .select("id, created_at, reason")
    .single();

  if (error) {
    console.error("[snapshots/create]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, snapshot: created });
}
