import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter, DEFAULT_MODEL_ID } from "@/lib/adapters";
import { ensureFalUrl } from "@/lib/fal-helpers";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { startImageUrl, endImageUrl, duration: rawDur = 5, modelId: rawModelId } = body;
  const modelId = rawModelId || DEFAULT_MODEL_ID;
  const adapter = getAdapter(modelId);
  const duration = Number(rawDur) || 5;
  const creditCost = duration;

  if (!startImageUrl || !endImageUrl) {
    return NextResponse.json(
      { error: "startImageUrl and endImageUrl are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  let debited = false;
  try {
    const { data: newBalance, error: debitError } = await admin.rpc("debit_credit", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_reason: `Transição AI: duration=${duration}s, model=${modelId}, cost=${creditCost}cr`,
    });

    if (debitError) {
      if (debitError.message.includes("Insufficient")) {
        return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
      }
      return NextResponse.json({ error: debitError.message }, { status: 500 });
    }

    debited = true;

    const [falStartUrl, falEndUrl] = await Promise.all([
      ensureFalUrl(startImageUrl),
      ensureFalUrl(endImageUrl),
    ]);

    const prompt =
      "Smooth cinematic camera transition between two interior spaces. " +
      "Continuous fluid movement, photorealistic, locked architecture, " +
      "preserve all visible surfaces exactly. No new elements, no scene morphing, natural camera flow.";

    const result = await adapter.generateTransition({
      startFrameUrl: falStartUrl,
      endFrameUrl: falEndUrl,
      prompt,
      duration,
    });

    await admin.from("generation_logs").insert({
      user_id: user.id,
      generation_type: "transition",
      duration_seconds: result.durationSeconds,
      cost: adapter.costPerSecond * result.durationSeconds,
      final_positive_prompt: prompt,
      request_payload: { startImageUrl: falStartUrl, endImageUrl: falEndUrl, duration, modelId },
      response_payload: { videoUrl: result.videoUrl },
    });

    return NextResponse.json({
      videoUrl: result.videoUrl,
      duration: result.durationSeconds,
      creditsCost: creditCost,
      creditsRemaining: newBalance,
    });
  } catch (err: unknown) {
    if (debited) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: creditCost,
        p_reason: `Reembolso: erro na transição (${creditCost}cr)`,
        p_admin_id: null,
      });
    }

    const falBody = (err as Record<string, unknown>)?.body;
    const detail = falBody && typeof falBody === "object" ? JSON.stringify(falBody) : undefined;
    console.error("[generate-transition]", err, detail ? `fal body: ${detail}` : "");

    const message = err instanceof Error ? err.message : "Transition generation failed";
    return NextResponse.json(
      { error: message, detail: detail ?? null },
      { status: 500 },
    );
  }
}
