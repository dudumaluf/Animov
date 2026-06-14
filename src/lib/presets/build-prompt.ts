import { callVision } from "@/lib/vision/call-vision";
import { getPreset, buildPromptFromTemplate } from "./catalog";
import type { VideoModelAdapter } from "@/lib/adapters/types";

export async function buildPromptForScene({
  photoUrl,
  presetId,
  adapter,
  guidancePrompt,
}: {
  photoUrl: string;
  presetId: string;
  adapter: VideoModelAdapter;
  /**
   * Optional free-text the user attached to steer the result. Appended after
   * the preset-built prompt so the curated template still provides structure
   * (camera grammar, "locked architecture", etc.) while the user's intent
   * gets the last word.
   */
  guidancePrompt?: string;
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
      console.warn(`[vision] Falling back to ${preset.fallbackPresetId}`);
      return buildPromptForScene({
        photoUrl,
        presetId: preset.fallbackPresetId,
        adapter,
        guidancePrompt,
      });
    }
    throw err;
  }

  const basePositive = buildPromptFromTemplate(preset, visionData);
  const guidance = guidancePrompt?.trim();
  const positive = guidance
    ? `${basePositive} Director's note: ${guidance}`
    : basePositive;

  const negative = adapter.supportsNegativePrompt
    ? "new objects, new rooms, new furniture, morphing walls, warping geometry, hallucinated architecture, people appearing, text overlays, watermarks, camera passing through walls, distorted perspective, scene changes, different lighting, color shifts, blurry, low quality"
    : null;

  return { positive, negative, visionData, visionCost };
}
