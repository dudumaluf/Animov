import type { VideoModelAdapter } from "./types";
import { klingO1Adapter } from "./kling-o1";

const adapters: Record<string, VideoModelAdapter> = {
  [klingO1Adapter.id]: klingO1Adapter,
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
