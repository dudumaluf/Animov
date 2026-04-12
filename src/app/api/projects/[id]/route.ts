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

  if (body.scenes) {
    await supabase.from("scenes").delete().eq("project_id", params.id);

    const scenesToInsert = body.scenes.map((s: { photo_url: string; preset_key: string; duration: number; status: string; video_url?: string; cost_credits: number }, i: number) => ({
      project_id: params.id,
      order_index: i,
      photo_url: s.photo_url,
      prompt_generated: s.preset_key,
      video_url: s.video_url ?? null,
      duration: s.duration,
      status: s.status === "idle" ? "pending" : s.status,
      cost_credits: s.cost_credits,
    }));

    if (scenesToInsert.length > 0) {
      const { error } = await supabase.from("scenes").insert(scenesToInsert);
      if (error) console.error("[projects/save-scenes]", error);
    }
  }

  return NextResponse.json({ ok: true });
}
