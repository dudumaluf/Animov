import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getAdapter } from "@/lib/adapters";
import { buildPromptForScene } from "@/lib/presets/build-prompt";

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;
  const presetId = (formData.get("presetId") as string) ?? "push_in_serene";
  const duration = Number(formData.get("duration") ?? "5");
  const modelId = (formData.get("modelId") as string) ?? "kling-o1-pro";

  if (!photo) {
    return NextResponse.json(
      { error: "photo is required" },
      { status: 400 },
    );
  }

  try {
    const adapter = getAdapter(modelId);
    const photoUrl = await fal.storage.upload(photo);

    const { positive, visionData, visionCost } = await buildPromptForScene({
      photoUrl,
      presetId,
      adapter,
    });

    console.log(`[generate-scene] preset=${presetId} prompt="${positive.slice(0, 100)}..."`);
    console.log(`[generate-scene] visionData=`, JSON.stringify(visionData));
    console.log(`[generate-scene] visionCost=$${visionCost.toFixed(4)}`);

    const result = await adapter.generateScene({
      photoUrl,
      prompt: positive,
      duration,
    });

    return NextResponse.json({
      videoUrl: result.videoUrl,
      duration: result.durationSeconds,
      visionData,
      prompt: positive,
      visionCost,
    });
  } catch (err) {
    console.error("[generate-scene]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
