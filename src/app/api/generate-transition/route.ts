import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeKlingO1DurationSeconds } from "@/lib/adapters/kling-o1";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "fal-ai/kling-video/o1/image-to-video";

async function ensureFalUrl(url: string): Promise<string> {
  if (url.startsWith("https://") && !url.startsWith("data:")) {
    return url;
  }
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], "frame.jpg", { type: blob.type || "image/jpeg" });
  return fal.storage.upload(file);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { startImageUrl, endImageUrl, duration: rawDur = 5 } = body;
  const duration = normalizeKlingO1DurationSeconds(Number(rawDur) || 5);

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
      p_amount: 1,
      p_reason: `Transição AI: duration=${duration}s`,
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

    const prompt = "Smooth cinematic camera transition between two interior spaces. Continuous fluid movement, photorealistic, locked architecture, preserve all visible surfaces exactly. No new elements, no scene morphing, natural camera flow.";

    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt,
        start_image_url: falStartUrl,
        end_image_url: falEndUrl,
        duration: String(duration) as never,
      },
      logs: true,
    }) as unknown as { data: { video: { url: string } } };

    await admin.from("generation_logs").insert({
      user_id: user.id,
      generation_type: "transition",
      duration_seconds: duration,
      cost: 0.112 * duration,
      final_positive_prompt: prompt,
      request_payload: { startImageUrl: falStartUrl, endImageUrl: falEndUrl, duration, rawDuration: rawDur },
      response_payload: { videoUrl: result.data.video.url },
    });

    return NextResponse.json({
      videoUrl: result.data.video.url,
      duration,
      creditsRemaining: newBalance,
    });
  } catch (err) {
    if (debited) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: 1,
        p_reason: "Reembolso: erro na transição",
        p_admin_id: null,
      });
    }

    console.error("[generate-transition]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transition generation failed" },
      { status: 500 },
    );
  }
}
