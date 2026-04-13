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

  if (body.name) {
    await supabase
      .from("projects")
      .update({ name: body.name })
      .eq("id", params.id);
  }

  if (Array.isArray(body.scenes) && body.scenes.length > 0) {
    const scenesToUpsert = body.scenes.map((s: { id?: string; photo_url: string; preset_key: string; duration: number; status: string; video_url?: string; cost_credits: number }, i: number) => ({
      ...(s.id ? { id: s.id } : {}),
      project_id: params.id,
      order_index: i,
      photo_url: s.photo_url,
      prompt_generated: s.preset_key,
      video_url: s.video_url ?? null,
      duration: s.duration,
      status: s.status === "idle" ? "pending" : s.status,
      cost_credits: s.cost_credits,
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
