import { fal } from "@fal-ai/client";
import type {
  VideoModelAdapter,
  SceneInput,
  TransitionInput,
  ClipResult,
  QueueState,
} from "./types";

const MODEL_ID = "fal-ai/kling-video/v3/pro/image-to-video";

type KlingOutput = {
  video: {
    url: string;
    content_type: string;
    file_size: number;
    file_name: string;
  };
};

function clampV3Duration(seconds: number): number {
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s) || s <= 0) return 5;
  return Math.max(3, Math.min(15, s));
}

// Shared input builders so the sync (subscribe) and async (queue) paths submit
// byte-identical payloads — only the transport differs.
function sceneInputFor(input: SceneInput) {
  return {
    prompt: input.prompt,
    start_image_url: input.photoUrl,
    duration: String(clampV3Duration(input.duration)) as never,
    generate_audio: false,
  };
}

function transitionInputFor(input: TransitionInput) {
  return {
    prompt: input.prompt,
    start_image_url: input.startFrameUrl,
    end_image_url: input.endFrameUrl,
    duration: String(clampV3Duration(input.duration)) as never,
    generate_audio: false,
  };
}

export const klingV3Adapter: VideoModelAdapter = {
  id: "kling-v3-pro",
  displayName: "Kling V3 Pro",
  costPerSecond: 0.112,
  creditsPerSecond: 1,
  supportsStartEndFrame: true,
  supportsNegativePrompt: true,
  maxDuration: 15,
  minDuration: 3,
  curatedDurations: [3, 5, 7, 10, 12, 15],

  async generateScene(input: SceneInput): Promise<ClipResult> {
    const d = clampV3Duration(input.duration);
    const result = (await fal.subscribe(MODEL_ID, {
      input: sceneInputFor(input),
      logs: true,
    })) as { data: KlingOutput };

    return { videoUrl: result.data.video.url, durationSeconds: d };
  },

  async generateTransition(input: TransitionInput): Promise<ClipResult> {
    const d = clampV3Duration(input.duration);
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
