import { fal } from "@fal-ai/client";
import type {
  VideoModelAdapter,
  SceneInput,
  TransitionInput,
  ClipResult,
} from "./types";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "fal-ai/kling-video/o1/image-to-video";

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
  minDuration: 3,

  async generateScene(input: SceneInput): Promise<ClipResult> {
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt: input.prompt,
        start_image_url: input.photoUrl,
        duration: String(input.duration) as never,
      },
      logs: true,
    }) as { data: KlingOutput };

    return {
      videoUrl: result.data.video.url,
      durationSeconds: input.duration,
    };
  },

  async generateTransition(input: TransitionInput): Promise<ClipResult> {
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt: input.prompt,
        start_image_url: input.startFrameUrl,
        end_image_url: input.endFrameUrl,
        duration: String(input.duration) as never,
      },
      logs: true,
    }) as { data: KlingOutput };

    return {
      videoUrl: result.data.video.url,
      durationSeconds: input.duration,
    };
  },
};
