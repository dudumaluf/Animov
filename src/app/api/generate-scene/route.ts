import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import { getAdapter } from "@/lib/adapters";
import { buildPromptForScene } from "@/lib/presets/build-prompt";

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: credits } = await supabase
    .from("credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  if (!credits || credits.balance < 1) {
    return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
  }

  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;
  const presetId = (formData.get("presetId") as string) ?? "push_in_serene";
  const duration = Number(formData.get("duration") ?? "5");
  const modelId = (formData.get("modelId") as string) ?? "kling-o1-pro";

  if (!photo) {
    return NextResponse.json({ error: "photo is required" }, { status: 400 });
  }

  try {
    const adapter = getAdapter(modelId);
    const photoUrl = await fal.storage.upload(photo);

    const { positive, visionData, visionCost } = await buildPromptForScene({
      photoUrl,
      presetId,
      adapter,
    });

    console.log(`[generate-scene] user=${user.id} preset=${presetId}`);
    console.log(`[generate-scene] prompt="${positive.slice(0, 100)}..."`);

    const result = await adapter.generateScene({
      photoUrl,
      prompt: positive,
      duration,
    });

    const { error: debitError } = await supabase
      .from("credits")
      .update({ balance: credits.balance - 1 })
      .eq("user_id", user.id);

    if (debitError) {
      console.error("[generate-scene] debit failed:", debitError);
    } else {
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        delta: -1,
        reason: `Geração: preset=${presetId}, duration=${duration}s`,
      });
    }

    return NextResponse.json({
      videoUrl: result.videoUrl,
      duration: result.durationSeconds,
      visionData,
      prompt: positive,
      visionCost,
      creditsRemaining: credits.balance - 1,
    });
  } catch (err) {
    console.error("[generate-scene]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
