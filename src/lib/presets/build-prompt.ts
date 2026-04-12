import { callVision } from "@/lib/vision/call-vision";
import { getPreset, buildPromptFromTemplate } from "./catalog";
import type { VideoModelAdapter } from "@/lib/adapters/types";

export async function buildPromptForScene({
  photoUrl,
  presetId,
  adapter,
}: {
  photoUrl: string;
  presetId: string;
  adapter: VideoModelAdapter;
}): Promise<{
  positive: string;
  negative: string | null;
  visionData: Record<string, unknown>;
  visionCost: number;
}> {
  const preset = getPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  let visionData: Record<string, unknown>;
  let visionCost = 0;

  try {
    const visionResult = await callVision({
      imageUrl: photoUrl,
      systemPrompt: preset.visionSystemPrompt,
      tier: preset.visionTier,
    });
    visionData = visionResult.data;
    visionCost = visionResult.cost;
  } catch (err) {
    console.error(`[vision] Failed for preset ${presetId}:`, err);

    if (preset.fallbackPresetId) {
      console.log(`[vision] Falling back to ${preset.fallbackPresetId}`);
      return buildPromptForScene({
        photoUrl,
        presetId: preset.fallbackPresetId,
        adapter,
      });
    }
    throw err;
  }

  const positive = buildPromptFromTemplate(preset, visionData);

  const negative = adapter.supportsNegativePrompt
    ? "new objects, new rooms, new furniture, morphing walls, warping geometry, hallucinated architecture, people appearing, text overlays, watermarks, camera passing through walls, distorted perspective, scene changes, different lighting, color shifts, blurry, low quality"
    : null;

  return { positive, negative, visionData, visionCost };
}
