import { fal } from "@fal-ai/client";
import type {
  VideoModelAdapter,
  SceneInput,
  TransitionInput,
  ClipResult,
} from "./types";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "bytedance/seedance-2.0/image-to-video";

/** Default resolution for Phase 1 — balances quality vs the ~$0.30/s price point. */
const DEFAULT_RESOLUTION = "720p" as const;

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

export const seedanceI2vAdapter: VideoModelAdapter = {
  id: "seedance-2-i2v",
  displayName: "Seedance 2",
  costPerSecond: 0.3034,
  creditsPerSecond: 3,
  supportsStartEndFrame: true,
  supportsNegativePrompt: false,
  maxDuration: 15,
  minDuration: 4,
  curatedDurations: [4, 5, 6, 7, 8, 10, 12, 15],

  async generateScene(input: SceneInput): Promise<ClipResult> {
    const d = clampSeedanceDuration(input.duration);
    const result = (await fal.subscribe(MODEL_ID, {
      input: {
        prompt: input.prompt,
        image_url: input.photoUrl,
        resolution: DEFAULT_RESOLUTION,
        duration: durationParam(d) as never,
        aspect_ratio: "auto",
        generate_audio: false,
        bitrate_mode: "standard",
      },
      logs: true,
    })) as { data: SeedanceOutput };

    return {
      videoUrl: result.data.video.url,
      durationSeconds: d,
    };
  },

  async generateTransition(input: TransitionInput): Promise<ClipResult> {
    const d = clampSeedanceDuration(input.duration);
    const result = (await fal.subscribe(MODEL_ID, {
      input: {
        prompt: input.prompt,
        image_url: input.startFrameUrl,
        end_image_url: input.endFrameUrl,
        resolution: DEFAULT_RESOLUTION,
        duration: durationParam(d) as never,
        aspect_ratio: "auto",
        generate_audio: false,
        bitrate_mode: "standard",
      },
      logs: true,
    })) as { data: SeedanceOutput };

    return {
      videoUrl: result.data.video.url,
      durationSeconds: d,
    };
  },
};
