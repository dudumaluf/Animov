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

  generateScene(input: SceneInput): Promise<ClipResult>;
  generateTransition(input: TransitionInput): Promise<ClipResult>;
}
