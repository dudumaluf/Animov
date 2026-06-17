import type { VideoModelAdapter } from "./types";
import { klingO1Adapter } from "./kling-o1";
import { klingV3Adapter } from "./kling-v3";
import { seedanceI2vAdapter } from "./seedance-i2v";

export const DEFAULT_MODEL_ID = "kling-v3-pro";

const adapters: Record<string, VideoModelAdapter> = {
  [klingO1Adapter.id]: klingO1Adapter,
  [klingV3Adapter.id]: klingV3Adapter,
  [seedanceI2vAdapter.id]: seedanceI2vAdapter,
};

export function getAdapter(modelId: string): VideoModelAdapter {
  const adapter = adapters[modelId];
  if (!adapter) throw new Error(`Unknown model: ${modelId}`);
  return adapter;
}

export function listAdapters(): VideoModelAdapter[] {
  return Object.values(adapters);
}

/** Credits debited for a generation of `durationSeconds` with the given model. */
export function creditCostFor(modelId: string, durationSeconds: number): number {
  const adapter = getAdapter(modelId);
  const d = Math.max(1, Math.round(durationSeconds));
  return Math.max(1, d * adapter.creditsPerSecond);
}

/** Curated duration chips for the inspector / transition picker. */
export function curatedDurationsFor(modelId: string): number[] {
  return getAdapter(modelId).curatedDurations;
}

/** Rough USD estimate for UI hints (uses adapter costPerSecond @ default resolution). */
export function usdEstimateFor(modelId: string, durationSeconds: number): number {
  const adapter = getAdapter(modelId);
  return adapter.costPerSecond * Math.max(1, durationSeconds);
}

export { type VideoModelAdapter, type SceneInput, type TransitionInput, type ClipResult } from "./types";
