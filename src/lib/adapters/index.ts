import type {
  VideoModelAdapter,
  SceneResolution,
  SceneAspectRatio,
  GenerationOptions,
} from "./types";
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

/**
 * Credits debited for a generation of `durationSeconds` with the given model.
 * Resolution-aware: models that expose a `creditCostFor` hook (Seedance) scale
 * the cost by resolution off their 720p anchor, while flat-rate models (Kling)
 * keep `duration × creditsPerSecond`. `opts.resolution` is ignored by models
 * that don't support resolution, so passing it is always safe.
 */
export function creditCostFor(
  modelId: string,
  durationSeconds: number,
  opts?: { resolution?: SceneResolution },
): number {
  const adapter = getAdapter(modelId);
  const d = Math.max(1, Math.round(durationSeconds));
  if (adapter.creditCostFor) return adapter.creditCostFor(d, opts);
  return Math.max(1, d * adapter.creditsPerSecond);
}

/** Curated duration chips for the inspector / transition picker. */
export function curatedDurationsFor(modelId: string): number[] {
  return getAdapter(modelId).curatedDurations;
}

const VALID_ASPECTS: ReadonlySet<SceneAspectRatio> = new Set<SceneAspectRatio>([
  "auto",
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
]);

/**
 * Server-side validation/clamp for the optional generation knobs against a
 * model's REAL capabilities. Anything the model doesn't support (or an invalid
 * enum) is dropped, so the adapter only ever receives fields its fal endpoint
 * accepts. Used by the scene/transition routes and the queue dispatcher.
 */
export function sanitizeGenerationOptions(
  modelId: string,
  raw: {
    resolution?: unknown;
    aspectRatio?: unknown;
    generateAudio?: unknown;
    negativePrompt?: unknown;
  },
): GenerationOptions {
  const adapter = getAdapter(modelId);
  const out: GenerationOptions = {};

  if (adapter.resolutions && adapter.resolutions.length > 0) {
    const r = raw.resolution;
    if (typeof r === "string" && adapter.resolutions.includes(r as SceneResolution)) {
      out.resolution = r as SceneResolution;
    }
  }

  if (adapter.supportsAspectRatio) {
    const a = raw.aspectRatio;
    if (typeof a === "string" && VALID_ASPECTS.has(a as SceneAspectRatio)) {
      out.aspectRatio = a as SceneAspectRatio;
    }
  }

  if (adapter.supportsGenerateAudio && typeof raw.generateAudio === "boolean") {
    out.generateAudio = raw.generateAudio;
  }

  if (adapter.supportsNegativePrompt && typeof raw.negativePrompt === "string") {
    const neg = raw.negativePrompt.trim();
    if (neg) out.negativePrompt = neg;
  }

  return out;
}

/** Rough USD estimate for UI hints (uses adapter costPerSecond @ default resolution). */
export function usdEstimateFor(modelId: string, durationSeconds: number): number {
  const adapter = getAdapter(modelId);
  return adapter.costPerSecond * Math.max(1, durationSeconds);
}

export {
  type VideoModelAdapter,
  type SceneInput,
  type TransitionInput,
  type ClipResult,
  type SceneResolution,
  type SceneAspectRatio,
  type GenerationOptions,
  DEFAULT_SCENE_RESOLUTION,
} from "./types";
