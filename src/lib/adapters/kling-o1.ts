import { fal } from "@fal-ai/client";
import type {
  VideoModelAdapter,
  SceneInput,
  TransitionInput,
  ClipResult,
  QueueState,
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

// Shared builders so sync (subscribe) and async (queue) submit identical input.
function sceneInputFor(input: SceneInput) {
  return {
    prompt: input.prompt,
    start_image_url: input.photoUrl,
    duration: String(normalizeKlingO1DurationSeconds(input.duration)) as never,
  };
}

function transitionInputFor(input: TransitionInput) {
  return {
    prompt: input.prompt,
    start_image_url: input.startFrameUrl,
    end_image_url: input.endFrameUrl,
    duration: String(normalizeKlingO1DurationSeconds(input.duration)) as never,
  };
}

export const klingO1Adapter: VideoModelAdapter = {
  id: "kling-o1-pro",
  displayName: "Kling O1 Pro (First-Last Frame)",
  costPerSecond: 0.112,
  creditsPerSecond: 1,
  supportsStartEndFrame: true,
  supportsNegativePrompt: false,
  maxDuration: 10,
  minDuration: 5,
  curatedDurations: [5, 10],

  async generateScene(input: SceneInput): Promise<ClipResult> {
    const d = normalizeKlingO1DurationSeconds(input.duration);
    const result = (await fal.subscribe(MODEL_ID, {
      input: sceneInputFor(input),
      logs: true,
    })) as { data: KlingOutput };

    return { videoUrl: result.data.video.url, durationSeconds: d };
  },

  async generateTransition(input: TransitionInput): Promise<ClipResult> {
    const d = normalizeKlingO1DurationSeconds(input.duration);
    const result = (await fal.subscribe(MODEL_ID, {
      input: transitionInputFor(input),
      logs: true,
    })) as { data: KlingOutput };

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
      data: KlingOutput;
    };
    return { videoUrl: result.data.video.url };
  },
};
