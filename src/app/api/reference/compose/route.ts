import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callVision } from "@/lib/vision/call-vision";
import { ensureFalUrl } from "@/lib/fal-helpers";
import type { Recipe } from "@/types/recipes";

/**
 * Composes the single `@Image1..N` prompt for a reference group, using a
 * `video_reference` recipe as the "director" brief. The vision LLM sees the
 * reference images (so it can ground camera/lighting choices) plus a text
 * manifest of each image's token, role and description, and returns one
 * cohesive Seedance reference-to-video prompt.
 *
 * The vision cost is absorbed (no credit debit) — only the eventual video
 * generation debits credits. Auth is still required to avoid anonymous abuse.
 *
 * Request:  { recipeId, images: [{ label, role, description, url }], guidance? }
 * Response: { prompt, cost, mode }
 */

export const maxDuration = 60;

type ComposeImage = {
  label: string;
  role: string;
  description: string;
  url: string;
};

type ComposeBody = {
  recipeId?: string;
  images?: unknown;
  guidance?: string;
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function parseImages(raw: unknown): ComposeImage[] {
  if (!Array.isArray(raw)) return [];
  const out: ComposeImage[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url : "";
    if (!url) return;
    out.push({
      label: typeof o.label === "string" && o.label.trim() ? o.label.trim() : `@Image${i + 1}`,
      role: typeof o.role === "string" ? o.role : "environment",
      description: typeof o.description === "string" ? o.description.trim() : "",
      url,
    });
  });
  return out;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ComposeBody;
  try {
    body = (await req.json()) as ComposeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const recipeId = typeof body.recipeId === "string" ? body.recipeId : "";
  const images = parseImages(body.images);
  const guidance = typeof body.guidance === "string" ? body.guidance.trim() : "";

  if (!recipeId) {
    return NextResponse.json({ error: "recipeId required" }, { status: 400 });
  }
  if (images.length === 0) {
    return NextResponse.json(
      { error: "images (array with at least one url) is required" },
      { status: 400 },
    );
  }

  // Admin client to read the recipe regardless of RLS (guard is on auth).
  const admin = createAdminClient();
  const { data: recipeRow, error: recipeError } = await admin
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .eq("scope", "video_reference")
    .eq("active", true)
    .single();

  if (recipeError || !recipeRow) {
    return NextResponse.json(
      { error: recipeError?.message ?? "Reference preset not found" },
      { status: 404 },
    );
  }

  const recipe = recipeRow as Recipe;

  // Manifest the LLM reads to know which token maps to which reference.
  const refsManifest = images
    .map((im) => `${im.label} (${im.role}): ${im.description || "no description"}`)
    .join("; ");

  const templateVars: Record<string, string> = {
    refs_manifest: refsManifest,
    user_hint: guidance,
  };

  // Template presets need no LLM round-trip.
  if (recipe.processing_mode === "template") {
    const prompt = applyTemplate(recipe.prompt_template, templateVars).trim();
    return NextResponse.json({ prompt, cost: 0, mode: "template" });
  }

  if (!recipe.vision_system_prompt || recipe.vision_system_prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "Recipe vision_system_prompt is empty" },
      { status: 500 },
    );
  }

  try {
    // Seedance can't ingest blob:/data: URLs and neither can the vision model —
    // normalize every reference to a fal-hosted https URL, keeping order so the
    // @ImageN tokens stay aligned with the visual indices.
    const falUrls: string[] = [];
    for (const im of images) {
      const falUrl = await ensureFalUrl(im.url);
      if (falUrl) falUrls.push(falUrl);
    }

    if (falUrls.length === 0) {
      return NextResponse.json(
        { error: "Failed to prepare any reference image URL" },
        { status: 500 },
      );
    }

    const manifestLines = images
      .map((im) => `${im.label} [${im.role}]: ${im.description || "(no description)"}`)
      .join("\n");

    const userPromptParts: string[] = [
      `Reference images (provided in this exact order — @Image1 is the first image, @Image2 the second, and so on):\n${manifestLines}`,
    ];
    if (guidance) {
      userPromptParts.push(`User creative guidance: ${guidance}`);
    }
    userPromptParts.push(
      'Respond ONLY with strict JSON: {"prompt": "..."}. Reference images by their exact @ImageN tokens. No markdown, no explanation.',
    );

    // The shared base director prompt (hidden `ref-base` recipe) carries the
    // craft rules; each preset only supplies its STYLE line. Concatenate
    // base + preset so global rules are tuned in one place. Falls back to just
    // the preset when the base is absent (e.g. migration not yet applied).
    const { data: baseRow } = await admin
      .from("recipes")
      .select("vision_system_prompt")
      .eq("slug", "ref-base")
      .eq("scope", "video_reference")
      .maybeSingle();
    const basePrompt =
      baseRow && typeof (baseRow as { vision_system_prompt?: unknown }).vision_system_prompt === "string"
        ? (baseRow as { vision_system_prompt: string }).vision_system_prompt.trim()
        : "";
    const systemPrompt = basePrompt
      ? `${basePrompt}\n\n${recipe.vision_system_prompt}`
      : recipe.vision_system_prompt;

    const visionResult = await callVision({
      imageUrls: falUrls,
      systemPrompt,
      userPrompt: userPromptParts.join("\n\n"),
      tier: "smart",
      maxTokens: 700,
    });

    const data = visionResult.data as { prompt?: unknown };
    const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";

    if (!prompt) {
      const fallback = applyTemplate(recipe.prompt_template, templateVars).trim();
      return NextResponse.json({
        prompt: fallback,
        cost: visionResult.cost,
        mode: "vision-fallback",
        warning: "Vision model returned empty prompt, used template fallback",
      });
    }

    return NextResponse.json({ prompt, cost: visionResult.cost, mode: "vision" });
  } catch (err) {
    console.error("[reference/compose]", err);
    const fallback = applyTemplate(recipe.prompt_template, templateVars).trim();
    return NextResponse.json({
      prompt: fallback,
      cost: 0,
      mode: "vision-error-fallback",
      warning: err instanceof Error ? err.message : "Vision call failed",
    });
  }
}
