import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callVision } from "@/lib/vision/call-vision";
import { ensureFalUrl } from "@/lib/fal-helpers";
import type { Recipe } from "@/types/recipes";

type MarkerPayload = {
  index: number;
  name: string;
};

type ComposeBody = {
  recipeId: string;
  targetImageUrl: string;
  referenceUrls?: string[];
  markers?: MarkerPayload[];
  userHint?: string;
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

export async function POST(req: NextRequest) {
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

  const { recipeId, targetImageUrl, referenceUrls = [], markers = [], userHint = "" } = body;

  if (!recipeId) {
    return NextResponse.json({ error: "recipeId required" }, { status: 400 });
  }
  if (!targetImageUrl && referenceUrls.length === 0) {
    return NextResponse.json(
      { error: "targetImageUrl or referenceUrls required" },
      { status: 400 },
    );
  }

  // Admin client to bypass RLS for recipe lookup (recipes might be
  // scope='asset' and still readable — but we use admin here for simplicity
  // and speed since guard is on auth).
  const admin = createAdminClient();
  const { data: recipeRow, error: recipeError } = await admin
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .eq("active", true)
    .single();

  if (recipeError || !recipeRow) {
    return NextResponse.json(
      { error: recipeError?.message ?? "Recipe not found" },
      { status: 404 },
    );
  }

  const recipe = recipeRow as Recipe;

  const markerSummary = markers.length
    ? markers
        .map((m) => `#${m.index} ${m.name}`)
        .join(", ")
    : "";

  const templateVars: Record<string, string> = {
    user_hint: userHint.trim() || "",
    target_context: markerSummary,
    refs_summary: markerSummary,
  };

  if (recipe.processing_mode === "template") {
    const prompt = applyTemplate(recipe.prompt_template, templateVars).trim();
    return NextResponse.json({ prompt, cost: 0, mode: "template" });
  }

  // Vision mode
  if (!recipe.vision_system_prompt || recipe.vision_system_prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "Recipe vision_system_prompt is empty" },
      { status: 500 },
    );
  }

  try {
    const imageUrls: string[] = [];
    if (targetImageUrl) {
      const falTarget = await ensureFalUrl(targetImageUrl);
      if (falTarget) imageUrls.push(falTarget);
    }
    for (const refUrl of referenceUrls) {
      if (!refUrl) continue;
      const falRef = await ensureFalUrl(refUrl);
      if (falRef) imageUrls.push(falRef);
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Failed to prepare any image URL" },
        { status: 500 },
      );
    }

    const userPromptParts: string[] = [];
    if (userHint.trim()) {
      userPromptParts.push(`User hint: ${userHint.trim()}`);
    }
    if (markerSummary) {
      userPromptParts.push(`Markers in scene: ${markerSummary}`);
    }
    userPromptParts.push(
      'Respond ONLY with strict JSON: {"prompt": "..."}. No markdown, no explanation.',
    );

    const visionResult = await callVision({
      imageUrls,
      systemPrompt: recipe.vision_system_prompt,
      userPrompt: userPromptParts.join("\n\n"),
      tier: "fast",
      maxTokens: 500,
    });

    const data = visionResult.data as { prompt?: unknown };
    const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";

    if (!prompt) {
      // Fallback: use the raw template with vars substituted.
      const fallback = applyTemplate(recipe.prompt_template, templateVars).trim();
      return NextResponse.json({
        prompt: fallback,
        cost: visionResult.cost,
        mode: "vision-fallback",
        warning: "Vision model returned empty prompt, used template fallback",
      });
    }

    return NextResponse.json({
      prompt,
      cost: visionResult.cost,
      mode: "vision",
    });
  } catch (err) {
    console.error("[compose-from-recipe]", err);
    // Graceful fallback to the literal template when vision call fails.
    const fallback = applyTemplate(recipe.prompt_template, templateVars).trim();
    return NextResponse.json({
      prompt: fallback,
      cost: 0,
      mode: "vision-error-fallback",
      warning: err instanceof Error ? err.message : "Vision call failed",
    });
  }
}
