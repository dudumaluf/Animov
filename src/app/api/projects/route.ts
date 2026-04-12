import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = body.name ?? "Novo Projeto";

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, status: "draft" })
    .select("id, name, status, created_at")
    .single();

  if (error) {
    console.error("[projects/create]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(project);
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[projects/list]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(projects);
}
