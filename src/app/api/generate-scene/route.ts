import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "@/lib/adapters";
import { normalizeKlingO1DurationSeconds } from "@/lib/adapters/kling-o1";
import { buildPromptForScene } from "@/lib/presets/build-prompt";

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;
  const presetId = (formData.get("presetId") as string) ?? "push_in_serene";
  const rawDuration = Number(formData.get("duration") ?? "5");
  const modelId = (formData.get("modelId") as string) ?? "kling-o1-pro";
  const duration =
    modelId === "kling-o1-pro"
      ? normalizeKlingO1DurationSeconds(rawDuration)
      : rawDuration;

  if (!photo) {
    return NextResponse.json({ error: "photo is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  let debited = false;
  try {
    const { data: newBalance, error: debitError } = await admin.rpc("debit_credit", {
      p_user_id: user.id,
      p_amount: 1,
      p_reason: `Cena: preset=${presetId}, duration=${duration}s`,
    });

    if (debitError) {
      if (debitError.message.includes("Insufficient")) {
        return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
      }
      return NextResponse.json({ error: debitError.message }, { status: 500 });
    }

    debited = true;

    const adapter = getAdapter(modelId);
    const photoUrl = await fal.storage.upload(photo);

    const { positive, negative, visionData, visionCost } = await buildPromptForScene({
      photoUrl,
      presetId,
      adapter,
    });

    const result = await adapter.generateScene({
      photoUrl,
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
      duration_seconds: duration,
      cost: adapter.costPerSecond * duration,
      request_payload: { photoUrl, presetId, duration, rawDuration, modelId },
      response_payload: { videoUrl: result.videoUrl },
    });

    return NextResponse.json({
      videoUrl: result.videoUrl,
      duration: result.durationSeconds,
      visionData,
      prompt: positive,
      visionCost,
      creditsRemaining: newBalance,
    });
  } catch (err: unknown) {
    if (debited) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: 1,
        p_reason: "Reembolso: erro na geração",
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
