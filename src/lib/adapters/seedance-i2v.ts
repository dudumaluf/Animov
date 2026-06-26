import { fal } from "@fal-ai/client";
import type {
  VideoModelAdapter,
  SceneInput,
  TransitionInput,
  ClipResult,
  QueueState,
  SceneResolution,
  SceneAspectRatio,
} from "./types";
import { DEFAULT_SCENE_RESOLUTION } from "./types";
import {
  SEEDANCE_STANDARD_USD_PER_SECOND,
  seedanceCreditsPerSecondFromUsd,
} from "./seedance-reference";

const MODEL_ID = "bytedance/seedance-2.0/image-to-video";

/**
 * Default resolution — balances quality vs the ~$0.30/s price point and keeps
 * the credit cost identical to the pre-options behavior (3 cr/s @ 720p).
 */
const DEFAULT_RESOLUTION = DEFAULT_SCENE_RESOLUTION;

/**
 * Resolutions the Seedance 2.0 image-to-video endpoint accepts. The live fal
 * schema lists 480p/720p/1080p/4k — we expose up to 1080p and intentionally
 * skip 4k (different token pricing, no clean $/s constant yet). See
 * https://fal.ai/models/bytedance/seedance-2.0/image-to-video/api.
 */
const SUPPORTED_RESOLUTIONS: readonly SceneResolution[] = ["480p", "720p", "1080p"];

const VALID_ASPECTS: ReadonlySet<SceneAspectRatio> = new Set<SceneAspectRatio>([
  "auto",
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
]);

function clampResolution(resolution: SceneResolution | undefined): SceneResolution {
  return resolution && SUPPORTED_RESOLUTIONS.includes(resolution)
    ? resolution
    : DEFAULT_RESOLUTION;
}

function clampAspect(aspect: SceneAspectRatio | undefined): SceneAspectRatio {
  return aspect && VALID_ASPECTS.has(aspect) ? aspect : "auto";
}

/**
 * Credits/sec for a resolution. Prices off the SHARED Seedance standard-tier
 * USD/s table + anchor (same source as reference-to-video), so 720p stays
 * exactly 3 cr/s, 480p ≈ 1.33, and 1080p ≈ 6.74 — consistent across endpoints.
 */
function seedanceI2vCreditsPerSecond(resolution: SceneResolution): number {
  return seedanceCreditsPerSecondFromUsd(SEEDANCE_STANDARD_USD_PER_SECOND[resolution]);
}

type SeedanceOutput = {
  video: {
    url: string;
    content_type?: string;
    file_size?: number;
    file_name?: string;
  };
  seed?: number;
};

/** Seedance I2V accepts 4–15 seconds (fixed); we avoid "auto" for timeline predictability. */
function clampSeedanceDuration(seconds: number): number {
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s) || s <= 0) return 5;
  return Math.max(4, Math.min(15, s));
}

function durationParam(seconds: number): string {
  return String(clampSeedanceDuration(seconds));
}

// Shared builders so sync (subscribe) and async (queue) submit identical input.
function sceneInputFor(input: SceneInput) {
  return {
    prompt: input.prompt,
    image_url: input.photoUrl,
    resolution: clampResolution(input.resolution),
    duration: durationParam(input.duration) as never,
    aspect_ratio: clampAspect(input.aspectRatio),
    generate_audio: input.generateAudio ?? false,
    bitrate_mode: "standard",
  };
}

function transitionInputFor(input: TransitionInput) {
  return {
    prompt: input.prompt,
    image_url: input.startFrameUrl,
    end_image_url: input.endFrameUrl,
    resolution: clampResolution(input.resolution),
    duration: durationParam(input.duration) as never,
    aspect_ratio: clampAspect(input.aspectRatio),
    generate_audio: input.generateAudio ?? false,
    bitrate_mode: "standard",
  };
}

export const seedanceI2vAdapter: VideoModelAdapter = {
  id: "seedance-2-i2v",
  displayName: "Seedance 2",
  costPerSecond: 0.3034,
  creditsPerSecond: 3,
  supportsStartEndFrame: true,
  supportsNegativePrompt: false,
  supportsGenerateAudio: true,
  supportsAspectRatio: true,
  resolutions: SUPPORTED_RESOLUTIONS,
  maxDuration: 15,
  minDuration: 4,
  curatedDurations: [4, 5, 6, 7, 8, 10, 12, 15],

  creditCostFor(durationSeconds, opts) {
    const resolution = clampResolution(opts?.resolution);
    const d = clampSeedanceDuration(durationSeconds);
    return Math.max(1, Math.ceil(d * seedanceI2vCreditsPerSecond(resolution)));
  },

  async generateScene(input: SceneInput): Promise<ClipResult> {
    const d = clampSeedanceDuration(input.duration);
    const result = (await fal.subscribe(MODEL_ID, {
      input: sceneInputFor(input),
      logs: true,
    })) as { data: SeedanceOutput };

    return { videoUrl: result.data.video.url, durationSeconds: d };
  },

  async generateTransition(input: TransitionInput): Promise<ClipResult> {
    const d = clampSeedanceDuration(input.duration);
    const result = (await fal.subscribe(MODEL_ID, {
      input: transitionInputFor(input),
      logs: true,
    })) as { data: SeedanceOutput };

    return { videoUrl: result.data.video.url, durationSeconds: d };
  },

  async submitScene(input: SceneInput): Promise<string> {
    const { request_id } = await fal.queue.submit(MODEL_ID, {
      input: sceneInputFor(input),
    });
    return request_id;
  },

  async submitTransition(input: TransitionInput): Promise<string> {
    const { request_id } = await fal.queue.submit(MODEL_ID, {
      input: transitionInputFor(input),
    });
    return request_id;
  },

  async queueStatus(requestId: string): Promise<QueueState> {
    const status = await fal.queue.status(MODEL_ID, { requestId });
    return status.status;
  },

  async queueResult(requestId: string): Promise<{ videoUrl: string }> {
    const result = (await fal.queue.result(MODEL_ID, { requestId })) as {
      data: SeedanceOutput;
    };
    return { videoUrl: result.data.video.url };
  },
};
