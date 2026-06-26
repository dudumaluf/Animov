import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callVision } from "@/lib/vision/call-vision";
import { configureFal } from "@/lib/fal-key";

/**
 * Multi-image reference analysis for the Reference Studio (Seedance
 * reference-to-video). In ONE vision call (Claude Sonnet 4.5, `smart` tier) it:
 *   1. classifies each image's role (environment / person / detail) and writes
 *      a concise, generation-ready description, and
 *   2. composes one ready-to-use `@Image1..N` video prompt for EACH active
 *      reference preset (base director rules + that preset's style line).
 *
 * Doing both together means selecting a preset is instant — no per-preset
 * round-trip. The user can still regenerate a single preset later via
 * /api/reference/compose.
 *
 * The vision cost is absorbed (no credit debit). Auth required.
 *
 * Returns: { images: [{ index, role, description }], prompts: [{ recipeId, slug, prompt }], cost }
 */

export const maxDuration = 90;

type AnalyzeRole = "environment" | "person" | "detail" | "product";

const VALID_ROLES = new Set<AnalyzeRole>([
  "environment",
  "person",
  "detail",
  "product",
]);

const ANALYZE_RULES = `PART A — ANALYZE each image. Classify its role and write a vivid, concise description focused on what matters for video generation.
ROLES:
- "environment": a room or exterior of a property (living room, bedroom, kitchen, bathroom, hallway/entrance, balcony, facade, garden, pool, office, etc.). Describe the space: room type, architectural style, key features, materials, color palette, lighting and mood.
- "person": a human (realtor, resident, model). Describe appearance so identity stays consistent: approximate age range, build, hair, skin tone, clothing (colors + style), accessories, posture, expression. NEVER invent a name.
- "detail": a close-up of a finish, material, object, fixture, texture, appliance, or decorative element.
- "product": a sellable / staged item — furniture, appliance, decor object, or a featured amenity being highlighted; describe it concretely so it stays consistent.
Each description is one or two sentences, present tense, concrete and visual.`;

const DEFAULT_DIRECTOR_RULES = `You are a senior video director creating a short, premium real-estate promo from REFERENCE IMAGES. Reference each image by its EXACT token (@Image1 = first image, @Image2 = second, ...). Preserve real architecture, layout, materials and any person's identity — add motion, light and atmosphere; never invent rooms or features, never morph people. Give a clear shot grammar (establishing beat, smooth reveals, confident hero shot) with concrete camera moves and explicit transitions between images. English, present tense, one paragraph, under ~120 words.`;

type PresetRow = {
  id: string;
  slug: string;
  display_name: string;
  vision_system_prompt: string;
};

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await configureFal();

  let body: { imageUrls?: unknown };
  try {
    body = (await req.json()) as { imageUrls?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    : [];

  if (imageUrls.length === 0) {
    return NextResponse.json(
      { error: "imageUrls (array of https URLs) is required" },
      { status: 400 },
    );
  }

  // Pull the base director prompt + visible presets so we can seed every
  // preset's prompt in this same call. Best-effort: if it fails we still return
  // the analysis (prompts just get composed on demand later).
  let basePrompt = DEFAULT_DIRECTOR_RULES;
  let presets: PresetRow[] = [];
  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("recipes")
      .select("id, slug, display_name, vision_system_prompt, sort_order, active, user_visible")
      .eq("scope", "video_reference")
      .eq("active", true);
    const all = (rows ?? []) as (PresetRow & {
      sort_order: number;
      active: boolean;
      user_visible: boolean;
    })[];
    const base = all.find((r) => r.slug === "ref-base");
    if (base?.vision_system_prompt) basePrompt = base.vision_system_prompt;
    presets = all
      .filter((r) => r.slug !== "ref-base" && r.user_visible)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        display_name: r.display_name,
        vision_system_prompt: r.vision_system_prompt,
      }));
  } catch (err) {
    console.error("[reference/analyze] recipe fetch failed", err);
  }

  const stylesBlock =
    presets.length > 0
      ? presets
          .map(
            (p, i) =>
              `${i + 1}. slug "${p.slug}" (${p.display_name}): ${p.vision_system_prompt}`,
          )
          .join("\n")
      : "";

  const systemPrompt = [
    `You are a cinematographer's assistant AND video director working from a set of REFERENCE IMAGES provided IN ORDER (index 0, 1, 2, ...). Image at index 0 is @Image1, index 1 is @Image2, and so on.`,
    ANALYZE_RULES,
    presets.length > 0
      ? `PART B — For EACH STYLE listed by the user, COMPOSE one cohesive video prompt that references the images by their exact @ImageN tokens, following these DIRECTOR RULES:\n${basePrompt}`
      : "",
    presets.length > 0
      ? `OUTPUT — STRICT JSON only, no markdown:\n{ "images": [ { "index": 0, "role": "environment|person|detail|product", "description": "..." } ], "prompts": [ { "slug": "<style-slug>", "prompt": "..." } ] }\nProvide exactly one prompts[] entry per style, using the style's exact slug.`
      : `OUTPUT — STRICT JSON only, no markdown:\n{ "images": [ { "index": 0, "role": "environment|person|detail|product", "description": "..." } ] }`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt =
    presets.length > 0
      ? `Analyze the ${imageUrls.length} reference image(s), then compose one prompt for each of these styles:\n${stylesBlock}`
      : `Analyze the ${imageUrls.length} reference image(s).`;

  try {
    const { data, cost } = await callVision({
      imageUrls,
      tier: "smart",
      systemPrompt,
      userPrompt,
      maxTokens: Math.min(8000, 700 + imageUrls.length * 220 + presets.length * 240),
    });

    const rawImages = Array.isArray((data as { images?: unknown }).images)
      ? (data as { images: unknown[] }).images
      : [];

    const byIndex = new Map<number, { role: AnalyzeRole; description: string }>();
    for (const item of rawImages) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const index = typeof o.index === "number" ? o.index : Number(o.index);
      if (!Number.isInteger(index) || index < 0 || index >= imageUrls.length) continue;
      const role =
        typeof o.role === "string" && VALID_ROLES.has(o.role as AnalyzeRole)
          ? (o.role as AnalyzeRole)
          : "environment";
      const description = typeof o.description === "string" ? o.description.trim() : "";
      byIndex.set(index, { role, description });
    }

    const images = imageUrls.map((_, index) => ({
      index,
      role: byIndex.get(index)?.role ?? ("environment" as AnalyzeRole),
      description: byIndex.get(index)?.description ?? "",
    }));

    // Map returned prompts (keyed by slug) back to recipe ids.
    const rawPrompts = Array.isArray((data as { prompts?: unknown }).prompts)
      ? (data as { prompts: unknown[] }).prompts
      : [];
    const promptBySlug = new Map<string, string>();
    for (const item of rawPrompts) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const slug = typeof o.slug === "string" ? o.slug : "";
      const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
      if (slug && prompt) promptBySlug.set(slug, prompt);
    }
    const prompts = presets
      .map((p) => ({ recipeId: p.id, slug: p.slug, prompt: promptBySlug.get(p.slug) ?? "" }))
      .filter((p) => p.prompt.length > 0);

    return NextResponse.json({ images, prompts, cost });
  } catch (err) {
    console.error("[reference/analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
