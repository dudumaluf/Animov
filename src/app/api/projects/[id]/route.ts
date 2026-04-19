import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const body = await req.json();

  const projectUpdate: Record<string, unknown> = {};
  if (body.name) projectUpdate.name = body.name;
  if (body.metadata !== undefined) projectUpdate.metadata = body.metadata;

  if (Object.keys(projectUpdate).length > 0) {
    const { error } = await supabase
      .from("projects")
      .update(projectUpdate)
      .eq("id", params.id);
    if (error) {
      console.error("[projects/update-project]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.scenes) && body.scenes.length > 0) {
    const scenesToUpsert = body.scenes.map((s: { id?: string; photo_url: string; preset_key: string; duration: number; status: string; video_url?: string; cost_credits: number; video_versions?: unknown[]; active_version?: number; source_type?: string; trim_start?: number | null; trim_end?: number | null }, i: number) => ({
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
      trim_start: typeof s.trim_start === "number" ? s.trim_start : null,
      trim_end: typeof s.trim_end === "number" ? s.trim_end : null,
    }));

    const existingIds = scenesToUpsert.filter((s: { id?: string }) => s.id).map((s: { id: string }) => s.id);

    if (existingIds.length > 0) {
      await supabase
        .from("scenes")
        .delete()
        .eq("project_id", params.id)
        .not("id", "in", `(${existingIds.join(",")})`);
    }

    const { error } = await supabase.from("scenes").upsert(scenesToUpsert, {
      onConflict: "id",
    });
    if (error) {
      console.error("[projects/save-scenes]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.transitions) && body.transitions.length > 0) {
    const transToUpsert = body.transitions.map((t: { from_scene_id: string; to_scene_id: string; video_url?: string; status: string; cost_credits?: number }, i: number) => ({
      project_id: params.id,
      from_scene_id: t.from_scene_id,
      to_scene_id: t.to_scene_id,
      order_index: i,
      video_url: t.video_url ?? null,
      status: t.status === "idle" ? "pending" : t.status,
      cost_credits: t.cost_credits ?? 0,
    }));

    const { error } = await supabase.from("transitions").upsert(transToUpsert, {
      onConflict: "project_id,from_scene_id,to_scene_id",
    });
    if (error) {
      console.error("[projects/save-transitions]", error);
    }

    const validPairs = transToUpsert.map((t: { from_scene_id: string; to_scene_id: string }) => `(${t.from_scene_id},${t.to_scene_id})`);
    const { data: allTrans } = await supabase
      .from("transitions")
      .select("id, from_scene_id, to_scene_id")
      .eq("project_id", params.id);
    if (allTrans) {
      const toDelete = allTrans.filter(
        (t) => !validPairs.includes(`(${t.from_scene_id},${t.to_scene_id})`)
      );
      if (toDelete.length > 0) {
        await supabase
          .from("transitions")
          .delete()
          .in("id", toDelete.map((t) => t.id));
      }
    }
  } else if (body.transitions !== undefined) {
    await supabase
      .from("transitions")
      .delete()
      .eq("project_id", params.id);
  }

  return NextResponse.json({ ok: true });
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
