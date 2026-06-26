import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureFalUrl } from "@/lib/fal-helpers";
import {
  submitReferenceVideo,
  referenceCreditCost,
  clampReferenceDuration,
  clampResolutionForTier,
  REFERENCE_MAX_IMAGES,
  type ReferenceTier,
  type ReferenceResolution,
  type ReferenceAspectRatio,
} from "@/lib/adapters/seedance-reference";
import { configureFal } from "@/lib/fal-key";

// This route only SUBMITS to the fal queue and returns the request id — the
// heavy render happens on fal and the client polls /status. A short ceiling is
// plenty (auth + image URL checks + enqueue) and avoids holding the function
// open, which previously 504'd and stranded the user's credits.
export const runtime = "nodejs";
export const maxDuration = 60;

type JsonBody = {
  prompt?: string;
  imageUrls?: unknown;
  duration?: number;
  generateAudio?: boolean;
  presetId?: string;
  sceneId?: string;
  tier?: string;
  resolution?: string;
  aspectRatio?: string;
};

const VALID_TIERS = new Set<ReferenceTier>(["standard", "fast"]);
const VALID_RESOLUTIONS = new Set<ReferenceResolution>(["480p", "720p", "1080p"]);
const VALID_ASPECTS = new Set<ReferenceAspectRatio>([
  "auto",
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
]);

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await configureFal();

  let prompt: string;
  let imageUrls: string[];
  let duration = 8;
  let generateAudio = false;
  let presetId: string | undefined;
  let sceneId: string | undefined;
  let tier: ReferenceTier = "standard";
  let resolution: ReferenceResolution = "720p";
  let aspectRatio: ReferenceAspectRatio = "auto";

  try {
    const body = (await req.json()) as JsonBody;

    prompt = (body.prompt ?? "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    if (!Array.isArray(body.imageUrls)) {
      return NextResponse.json({ error: "imageUrls is required" }, { status: 400 });
    }
    imageUrls = body.imageUrls.filter(
      (u): u is string => typeof u === "string" && u.trim().length > 0,
    );
    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one reference image is required" },
        { status: 400 },
      );
    }
    if (imageUrls.length > REFERENCE_MAX_IMAGES) {
      return NextResponse.json(
        { error: `No máximo ${REFERENCE_MAX_IMAGES} imagens por geração` },
        { status: 400 },
      );
    }

    duration = clampReferenceDuration(Number(body.duration ?? duration));
    generateAudio = body.generateAudio === true;
    presetId = typeof body.presetId === "string" ? body.presetId : undefined;
    sceneId = typeof body.sceneId === "string" ? body.sceneId : undefined;
    if (VALID_TIERS.has(body.tier as ReferenceTier)) tier = body.tier as ReferenceTier;
    if (VALID_RESOLUTIONS.has(body.resolution as ReferenceResolution)) {
      resolution = body.resolution as ReferenceResolution;
    }
    // fast doesn't support 1080p — clamp so we never submit an invalid combo.
    resolution = clampResolutionForTier(tier, resolution);
    if (VALID_ASPECTS.has(body.aspectRatio as ReferenceAspectRatio)) {
      aspectRatio = body.aspectRatio as ReferenceAspectRatio;
    }
  } catch (err) {
    console.error("[generate-reference:submit] parse body", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const creditCost = referenceCreditCost(duration, tier, resolution);
  const admin = createAdminClient();

  let debited = false;
  try {
    const { data: newBalance, error: debitError } = await admin.rpc("debit_credit", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_reason: `Referência: preset=${presetId ?? "—"}, ${tier}/${resolution}, imgs=${imageUrls.length}, duration=${duration}s, cost=${creditCost}cr`,
    });

    if (debitError) {
      if (debitError.message.includes("Insufficient")) {
        return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
      }
      return NextResponse.json({ error: debitError.message }, { status: 500 });
    }

    debited = true;

    // Make sure fal can read every reference image. Supabase public URLs pass
    // through unchanged; data:/blob:/non-https URLs are re-uploaded server-side.
    const falImageUrls = await Promise.all(imageUrls.map((u) => ensureFalUrl(u)));

    // Enqueue on fal (returns fast — no waiting for the render).
    const requestId = await submitReferenceVideo({
      prompt,
      imageUrls: falImageUrls,
      duration,
      tier,
      resolution,
      aspectRatio,
      generateAudio,
    });

    // Persist what /status needs to finalize safely (refund amount, log data,
    // and the tier so it polls the matching fal endpoint).
    const { error: insertError } = await admin.from("reference_jobs").insert({
      request_id: requestId,
      user_id: user.id,
      scene_id: sceneId ?? null,
      preset_id: presetId ?? null,
      prompt,
      image_urls: falImageUrls,
      duration,
      generate_audio: generateAudio,
      credit_cost: creditCost,
      model_tier: tier,
      resolution,
      aspect_ratio: aspectRatio,
      status: "pending",
    });
    if (insertError) throw new Error(`reference_jobs insert: ${insertError.message}`);

    return NextResponse.json({
      requestId,
      creditsCost: creditCost,
      creditsRemaining: newBalance,
    });
  } catch (err: unknown) {
    if (debited) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: creditCost,
        p_reason: `Reembolso: falha ao enfileirar geração de referência (${creditCost}cr)`,
        p_admin_id: null,
      });
    }

    const falBody = (err as Record<string, unknown>)?.body;
    const detail = falBody && typeof falBody === "object" ? JSON.stringify(falBody) : undefined;
    console.error("[generate-reference:submit]", err, detail ? `fal body: ${detail}` : "");

    const message = err instanceof Error ? err.message : "Submit failed";
    return NextResponse.json({ error: message, detail: detail ?? null }, { status: 500 });
  }
}
