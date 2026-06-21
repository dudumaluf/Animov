import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callVision } from "@/lib/vision/call-vision";
import { ensureFalUrl } from "@/lib/fal-helpers";

/**
 * Polishes an existing `@Image1..N` reference video prompt: richer camera
 * language and flow, while preserving every image token and real-estate
 * faithfulness. Optional vision context from the reference images.
 *
 * Request:  { prompt, images: [{ label, role, description, url }] }
 * Response: { prompt, cost, mode }
 */

export const maxDuration = 60;

const ENHANCE_SYSTEM_PROMPT = `You are an expert video prompt editor for premium real-estate reference-to-video (Seedance model).

The user gives you a DRAFT prompt that references images as @Image1, @Image2, etc. Your job is to ENHANCE it — clearer cinematography, smoother shot order, concrete camera moves and transitions, vivid but faithful language — without changing the story intent.

STRICT rules:
- Preserve EVERY @ImageN token from the draft exactly (@Image1 spelling and numbering). Do not drop, rename, or renumber tokens that appear in the draft.
- You may add camera/transition detail around existing tokens; do not invent rooms, people, or features not implied by the draft or image manifest.
- Real-estate faithfulness: no warping, morphing, invented architecture, text/watermarks.
- One cohesive paragraph, English, present tense, under ~140 words. No markdown, no bullet lists.
- Return STRICT JSON only: {"prompt": "..."}.`;

type EnhanceImage = {
  label: string;
  role: string;
  description: string;
  url: string;
};

type EnhanceBody = {
  prompt?: string;
  images?: unknown;
};

function parseImages(raw: unknown): EnhanceImage[] {
  if (!Array.isArray(raw)) return [];
  const out: EnhanceImage[] = [];
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

  let body: EnhanceBody;
  try {
    body = (await req.json()) as EnhanceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draft = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const images = parseImages(body.images);

  if (!draft) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (images.length === 0) {
    return NextResponse.json(
      { error: "images (array with at least one url) is required" },
      { status: 400 },
    );
  }

  const manifestLines = images
    .map((im) => `${im.label} [${im.role}]: ${im.description || "(no description)"}`)
    .join("\n");

  const userPrompt = [
    `Reference image manifest (@Image1 = first image, etc.):\n${manifestLines}`,
    `Draft prompt to enhance (keep all @ImageN tokens):\n${draft}`,
    'Respond ONLY with strict JSON: {"prompt": "..."}.',
  ].join("\n\n");

  try {
    const falUrls: string[] = [];
    for (const im of images) {
      const falUrl = await ensureFalUrl(im.url);
      if (falUrl) falUrls.push(falUrl);
    }

    if (falUrls.length === 0) {
      return NextResponse.json(
        { error: "Failed to prepare reference image URLs" },
        { status: 500 },
      );
    }

    const visionResult = await callVision({
      imageUrls: falUrls,
      systemPrompt: ENHANCE_SYSTEM_PROMPT,
      userPrompt,
      tier: "smart",
      maxTokens: 600,
    });

    const data = visionResult.data as { prompt?: unknown };
    const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "Enhancement returned an empty prompt" },
        { status: 500 },
      );
    }

    return NextResponse.json({ prompt, cost: visionResult.cost, mode: "vision" });
  } catch (err) {
    console.error("[reference/enhance-prompt]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enhancement failed" },
      { status: 500 },
    );
  }
}
