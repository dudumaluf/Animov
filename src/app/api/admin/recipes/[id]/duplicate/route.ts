import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { slugify } from "@/lib/recipes/validate";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: original, error: fetchError } = await admin
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !original) {
    return NextResponse.json(
      { error: fetchError?.message ?? "Recipe not found" },
      { status: 404 },
    );
  }

  const baseSlug = slugify(`${original.slug}-copy`);
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const { data: existing } = await admin
      .from("recipes")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
    if (attempt > 20) break;
  }

  const {
    id: _originalId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...rest
  } = original as Record<string, unknown> & { id: string };
  void _originalId;
  void _createdAt;
  void _updatedAt;

  const payload = {
    ...rest,
    slug,
    display_name: `${original.display_name} (copia)`,
    active: false,
    user_visible: false,
  };

  const { data, error } = await admin
    .from("recipes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipe: data }, { status: 201 });
}
