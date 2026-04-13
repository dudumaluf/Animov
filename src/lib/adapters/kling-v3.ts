import { fal } from "@fal-ai/client";
import type {
  VideoModelAdapter,
  SceneInput,
  TransitionInput,
  ClipResult,
} from "./types";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "fal-ai/kling-video/v3/pro/image-to-video";

type KlingOutput = {
  video: {
    url: string;
    content_type: string;
    file_size: number;
    file_name: string;
  };
};

function clampDuration(seconds: number): 5 | 10 {
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s) || s <= 0) return 5;
  return s >= 8 ? 10 : 5;
}

export const klingV3Adapter: VideoModelAdapter = {
  id: "kling-v3-pro",
  displayName: "Kling V3 Pro",
  costPerSecond: 0.112,
  supportsStartEndFrame: true,
  supportsNegativePrompt: true,
  maxDuration: 10,
  minDuration: 5,

  async generateScene(input: SceneInput): Promise<ClipResult> {
    const d = clampDuration(input.duration);
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt: input.prompt,
        start_image_url: input.photoUrl,
        duration: String(d) as never,
        generate_audio: false,
      },
      logs: true,
    }) as { data: KlingOutput };

    return {
      videoUrl: result.data.video.url,
      durationSeconds: d,
    };
  },

  async generateTransition(input: TransitionInput): Promise<ClipResult> {
    const d = clampDuration(input.duration);
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt: input.prompt,
        start_image_url: input.startFrameUrl,
        end_image_url: input.endFrameUrl,
        duration: String(d) as never,
        generate_audio: false,
      },
      logs: true,
    }) as { data: KlingOutput };

    return {
      videoUrl: result.data.video.url,
      durationSeconds: d,
    };
  },
};
