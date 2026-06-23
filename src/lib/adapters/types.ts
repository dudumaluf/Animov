export type SceneInput = {
  photoUrl: string;
  prompt: string;
  duration: number;
};

export type TransitionInput = {
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
  maxDuration: number;
  minDuration: number;
  /** Curated duration options shown in the inspector / transition picker. */
  curatedDurations: number[];

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
