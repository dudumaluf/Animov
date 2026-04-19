import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter, DEFAULT_MODEL_ID } from "@/lib/adapters";
import { buildPromptForScene } from "@/lib/presets/build-prompt";
import { ensureFalUrl } from "@/lib/fal-helpers";

fal.config({ credentials: process.env.FAL_KEY! });

type JsonBody = {
  photoUrl?: string;
  presetId?: string;
  duration?: number;
  modelId?: string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Accept both JSON (preferred — URL-based, no body size limit) and
  // multipart/form-data (legacy — raw File, bounded by Vercel's 4.5MB cap).
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let photoUrl: string;
  let presetId = "push_in_serene";
  let duration = 5;
  let modelId = DEFAULT_MODEL_ID;

  try {
    if (isJson) {
      const body = (await req.json()) as JsonBody;
      if (!body.photoUrl) {
        return NextResponse.json(
          { error: "photoUrl is required" },
          { status: 400 },
        );
      }
      photoUrl = body.photoUrl;
      presetId = body.presetId ?? presetId;
      duration = Number(body.duration ?? duration);
      modelId = body.modelId ?? modelId;
    } else {
      const formData = await req.formData();
      const photo = formData.get("photo") as File | null;
      if (!photo) {
        return NextResponse.json(
          { error: "photo is required" },
          { status: 400 },
        );
      }
      photoUrl = await fal.storage.upload(photo);
      presetId = (formData.get("presetId") as string) ?? presetId;
      duration = Number(formData.get("duration") ?? duration);
      modelId = (formData.get("modelId") as string) || modelId;
    }
  } catch (err) {
    console.error("[generate-scene] parse body", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const adapter = getAdapter(modelId);
  const creditCost = duration;

  const admin = createAdminClient();

  let debited = false;
  try {
    const { data: newBalance, error: debitError } = await admin.rpc("debit_credit", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_reason: `Cena: preset=${presetId}, duration=${duration}s, model=${modelId}, cost=${creditCost}cr`,
    });

    if (debitError) {
      if (debitError.message.includes("Insufficient")) {
        return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
      }
      return NextResponse.json({ error: debitError.message }, { status: 500 });
    }

    debited = true;

    // Make sure fal has a URL it can read. Supabase public URLs pass through
    // unchanged; data:/blob:/non-https URLs would be re-uploaded server-side.
    const falPhotoUrl = await ensureFalUrl(photoUrl);

    const { positive, negative, visionData, visionCost } = await buildPromptForScene({
      photoUrl: falPhotoUrl,
      presetId,
      adapter,
    });

    const result = await adapter.generateScene({
      photoUrl: falPhotoUrl,
      prompt: positive,
      duration,
    });

    await admin.from("generation_logs").insert({
      user_id: user.id,
      model_id: null,
      generation_type: "scene",
      preset_id: presetId,
      vision_data: visionData,
      final_positive_prompt: positive,
      final_negative_prompt: negative,
      duration_seconds: result.durationSeconds,
      cost: adapter.costPerSecond * result.durationSeconds,
      request_payload: { photoUrl: falPhotoUrl, presetId, duration, modelId },
      response_payload: { videoUrl: result.videoUrl },
    });

    return NextResponse.json({
      videoUrl: result.videoUrl,
      duration: result.durationSeconds,
      creditsCost: creditCost,
      visionData,
      prompt: positive,
      visionCost,
      creditsRemaining: newBalance,
    });
  } catch (err: unknown) {
    if (debited) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: creditCost,
        p_reason: `Reembolso: erro na geração (${creditCost}cr)`,
        p_admin_id: null,
      });
    }

    const falBody = (err as Record<string, unknown>)?.body;
    const detail = falBody && typeof falBody === "object" ? JSON.stringify(falBody) : undefined;
    console.error("[generate-scene]", err, detail ? `fal body: ${detail}` : "");

    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json(
      { error: message, detail: detail ?? null },
      { status: 500 },
    );
  }
}
