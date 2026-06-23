import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Allowlist so the editor can only touch known knobs — never create junk keys.
const INTEGER_SETTING_KEYS = new Set([
  "free_credits",
  "fal_max_concurrent",
  "max_photos_per_project",
  "min_photos_per_project",
]);
const STRING_SETTING_KEYS = new Set(["default_model"]);

type SettingBody = { kind: "system_setting"; key?: string; value?: unknown };
type CatalogBody = {
  kind: "catalog";
  stripePriceId?: string;
  credits?: unknown;
  label?: unknown;
};
type Body = SettingBody | CatalogBody;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (body.kind === "system_setting") {
    const key = String(body.key ?? "");

    if (INTEGER_SETTING_KEYS.has(key)) {
      const value = Number(body.value);
      if (!Number.isInteger(value) || value < 0) {
        return NextResponse.json(
          { error: "Valor deve ser um inteiro ≥ 0" },
          { status: 400 },
        );
      }
      const { error } = await admin
        .from("system_settings")
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, key, value });
    }

    if (STRING_SETTING_KEYS.has(key)) {
      const value = String(body.value ?? "").trim();
      if (!value) {
        return NextResponse.json({ error: "Valor obrigatório" }, { status: 400 });
      }
      const { error } = await admin
        .from("system_settings")
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, key, value });
    }

    return NextResponse.json(
      { error: `Configuração não editável: ${key}` },
      { status: 400 },
    );
  }

  if (body.kind === "catalog") {
    const stripePriceId = String(body.stripePriceId ?? "");
    if (!stripePriceId) {
      return NextResponse.json(
        { error: "stripePriceId obrigatório" },
        { status: 400 },
      );
    }

    const patch: { credits?: number; label?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (body.credits !== undefined) {
      const credits = Number(body.credits);
      if (!Number.isInteger(credits) || credits < 0) {
        return NextResponse.json(
          { error: "Créditos deve ser um inteiro ≥ 0" },
          { status: 400 },
        );
      }
      patch.credits = credits;
    }

    if (body.label !== undefined) {
      const label = String(body.label).trim().slice(0, 80);
      patch.label = label || null;
    }

    if (patch.credits === undefined && patch.label === undefined) {
      return NextResponse.json(
        { error: "Nada para atualizar" },
        { status: 400 },
      );
    }

    const { error } = await admin
      .from("billing_catalog")
      .update(patch)
      .eq("stripe_price_id", stripePriceId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "kind inválido" }, { status: 400 });
}
