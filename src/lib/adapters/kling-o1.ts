import { fal } from "@fal-ai/client";
import type {
  VideoModelAdapter,
  SceneInput,
  TransitionInput,
  ClipResult,
} from "./types";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "fal-ai/kling-video/o1/image-to-video";

/**
 * fal.ai Kling O1 `image-to-video` rejects any duration except "5" or "10"
 * (error: "Duration only supports 5s or 10s.") even when docs list 3–10.
 */
export function normalizeKlingO1DurationSeconds(seconds: number): 5 | 10 {
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s) || s <= 0) return 5;
  return s >= 8 ? 10 : 5;
}

type KlingOutput = {
  video: {
    url: string;
    content_type: string;
    file_size: number;
    file_name: string;
  };
};

export const klingO1Adapter: VideoModelAdapter = {
  id: "kling-o1-pro",
  displayName: "Kling O1 Pro (First-Last Frame)",
  costPerSecond: 0.112,
  supportsStartEndFrame: true,
  supportsNegativePrompt: false,
  maxDuration: 10,
  minDuration: 5,

  async generateScene(input: SceneInput): Promise<ClipResult> {
    const d = normalizeKlingO1DurationSeconds(input.duration);
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt: input.prompt,
        start_image_url: input.photoUrl,
        duration: String(d) as never,
      },
      logs: true,
    }) as { data: KlingOutput };

    return {
      videoUrl: result.data.video.url,
      durationSeconds: d,
    };
  },

  async generateTransition(input: TransitionInput): Promise<ClipResult> {
    const d = normalizeKlingO1DurationSeconds(input.duration);
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt: input.prompt,
        start_image_url: input.startFrameUrl,
        end_image_url: input.endFrameUrl,
        duration: String(d) as never,
      },
      logs: true,
    }) as { data: KlingOutput };

    return {
      videoUrl: result.data.video.url,
      durationSeconds: d,
    };
  },
};
