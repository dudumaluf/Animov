/**
 * Output resolutions a model can render. Seedance i2v accepts 480p/720p/1080p
 * (and 4k, which we intentionally DON'T expose — fal prices 4k on a different
 * token rate we don't have a clean $/s constant for). Kling endpoints don't
 * take a resolution at all (the field is simply omitted for them).
 */
export type SceneResolution = "480p" | "720p" | "1080p";

/**
 * Aspect-ratio values Seedance accepts. Kling image-to-video infers the ratio
 * from the input frame and exposes no aspect_ratio input, so this only applies
 * to Seedance adapters. `auto` lets the model infer from the image.
 */
export type SceneAspectRatio =
  | "auto"
  | "21:9"
  | "16:9"
  | "4:3"
  | "1:1"
  | "3:4"
  | "9:16";

export const DEFAULT_SCENE_RESOLUTION: SceneResolution = "720p";

/**
 * Optional, model-aware generation knobs shared by scene + transition inputs.
 * All fields are optional and default to today's behavior when omitted, so
 * existing scenes/jobs that predate these options keep working unchanged.
 * Each adapter only forwards the fields its fal endpoint actually accepts.
 */
export type GenerationOptions = {
  /** Output resolution (Seedance only). Omit ⇒ 720p (legacy default). */
  resolution?: SceneResolution;
  /** Concrete aspect ratio (Seedance only). Omit ⇒ "auto" (legacy default). */
  aspectRatio?: SceneAspectRatio;
  /** Negative prompt (Kling V3 only). Omit/empty ⇒ model/preset default. */
  negativePrompt?: string | null;
  /** Whether the model also synthesizes audio (V3 + Seedance). Omit ⇒ false. */
  generateAudio?: boolean;
};

export type SceneInput = GenerationOptions & {
  photoUrl: string;
  prompt: string;
  duration: number;
};

export type TransitionInput = GenerationOptions & {
  startFrameUrl: string;
  endFrameUrl: string;
  prompt: string;
  duration: number;
};

export type ClipResult = {
  videoUrl: string;
  durationSeconds: number;
};

/** fal queue lifecycle state (mirrors `fal.queue.status().status`). */
export type QueueState = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

export interface VideoModelAdapter {
  id: string;
  displayName: string;
  /** USD per second @ the adapter's default resolution — for generation logs. */
  costPerSecond: number;
  /** Credits debited per second of output (1 for Kling, 3 for Seedance @ 720p). */
  creditsPerSecond: number;
  supportsStartEndFrame: boolean;
  supportsNegativePrompt: boolean;
  /** Whether the endpoint accepts a `generate_audio` input (V3 + Seedance). */
  supportsGenerateAudio: boolean;
  /** Whether the endpoint accepts an `aspect_ratio` input (Seedance only). */
  supportsAspectRatio: boolean;
  /**
   * Output resolutions the endpoint accepts. `undefined`/empty ⇒ resolution is
   * not user-configurable for this model (Kling), so the UI hides the control
   * and the credit cost stays flat.
   */
  resolutions?: readonly SceneResolution[];
  maxDuration: number;
  minDuration: number;
  /** Curated duration options shown in the inspector / transition picker. */
  curatedDurations: number[];
  /**
   * Resolution-aware credit cost for a generation. Optional — when omitted the
   * flat `duration × creditsPerSecond` rate applies (Kling). Seedance overrides
   * this to scale credits off its 720p anchor so 480p costs proportionally less.
   */
  creditCostFor?(durationSeconds: number, opts?: { resolution?: SceneResolution }): number;

  /** Synchronous render (fal.subscribe) — the legacy/fallback path. */
  generateScene(input: SceneInput): Promise<ClipResult>;
  generateTransition(input: TransitionInput): Promise<ClipResult>;

  /**
   * Async queue trio (fal.queue.*) used by the global concurrency queue. Submit
   * returns a fal `request_id`; status/result are polled with that id against
   * THIS adapter's model endpoint (fal scopes the queue by model id, so polling
   * must use the same adapter the job was submitted to).
   */
  submitScene(input: SceneInput): Promise<string>;
  submitTransition(input: TransitionInput): Promise<string>;
  queueStatus(requestId: string): Promise<QueueState>;
  queueResult(requestId: string): Promise<{ videoUrl: string }>;
}
