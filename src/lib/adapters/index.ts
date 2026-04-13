import type { VideoModelAdapter } from "./types";
import { klingO1Adapter } from "./kling-o1";
import { klingV3Adapter } from "./kling-v3";

export const DEFAULT_MODEL_ID = "kling-v3-pro";

const adapters: Record<string, VideoModelAdapter> = {
  [klingO1Adapter.id]: klingO1Adapter,
  [klingV3Adapter.id]: klingV3Adapter,
};

export function getAdapter(modelId: string): VideoModelAdapter {
  const adapter = adapters[modelId];
  if (!adapter) throw new Error(`Unknown model: ${modelId}`);
  return adapter;
}

export function listAdapters(): VideoModelAdapter[] {
  return Object.values(adapters);
}

export { type VideoModelAdapter, type SceneInput, type TransitionInput, type ClipResult } from "./types";
