import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callVision } from "@/lib/vision/call-vision";

/**
 * Single-image reference analysis for the Reference Studio assets panel. Used
 * when the user re-analyzes ONE image (after editing/replacing it) without
 * disturbing the rest of the group or the composed preset prompts. In one
 * vision call (Claude Sonnet 4.5, `smart` tier) it classifies the image's role
 * and writes a concise, generation-ready description.
 *
 * The vision cost is absorbed (no credit debit). Auth required.
 *
 * Returns: { role, description, cost }
 */

export const maxDuration = 60;

type AnalyzeRole = "environment" | "person" | "detail" | "product";

const VALID_ROLES = new Set<AnalyzeRole>([
  "environment",
  "person",
  "detail",
  "product",
]);

// Kept in sync with /api/reference/analyze (duplicated so the routes stay
// independent). Same taxonomy → consistent roles across group + per-image runs.
const ANALYZE_RULES = `ANALYZE this single reference image. Classify its role and write a vivid, concise description focused on what matters for video generation.
ROLES:
- "environment": a room or exterior of a property (living room, bedroom, kitchen, bathroom, hallway/entrance, balcony, facade, garden, pool, office, etc.). Describe the space: room type, architectural style, key features, materials, color palette, lighting and mood.
- "person": a human (realtor, resident, model). Describe appearance so identity stays consistent: approximate age range, build, hair, skin tone, clothing (colors + style), accessories, posture, expression. NEVER invent a name.
- "detail": a close-up of a finish, material, object, fixture, texture, appliance, or decorative element.
- "product": a sellable / staged item — furniture, appliance, decor object, or a featured amenity being highlighted; describe it concretely so it stays consistent.
The description is one or two sentences, present tense, concrete and visual.`;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { imageUrl?: unknown };
  try {
    body = (await req.json()) as { imageUrl?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl =
    typeof body.imageUrl === "string" && body.imageUrl.startsWith("http")
      ? body.imageUrl
      : "";
  if (!imageUrl) {
    return NextResponse.json(
      { error: "imageUrl (https URL) is required" },
      { status: 400 },
    );
  }

  const systemPrompt = [
    `You are a cinematographer's assistant classifying ONE reference image for a premium real-estate video.`,
    ANALYZE_RULES,
    `OUTPUT — STRICT JSON only, no markdown:\n{ "role": "environment|person|detail|product", "description": "..." }`,
  ].join("\n\n");

  try {
    const { data, cost } = await callVision({
      imageUrl,
      tier: "smart",
      systemPrompt,
      userPrompt: "Analyze this single reference image.",
      maxTokens: 400,
    });

    const rawRole = (data as { role?: unknown }).role;
    const role =
      typeof rawRole === "string" && VALID_ROLES.has(rawRole as AnalyzeRole)
        ? (rawRole as AnalyzeRole)
        : "environment";
    const rawDescription = (data as { description?: unknown }).description;
    const description =
      typeof rawDescription === "string" ? rawDescription.trim() : "";

    return NextResponse.json({ role, description, cost });
  } catch (err) {
    console.error("[reference/describe-one]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
