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
  costPerSecond: number;
  supportsStartEndFrame: boolean;
  supportsNegativePrompt: boolean;
  maxDuration: number;
  minDuration: number;

  generateScene(input: SceneInput): Promise<ClipResult>;
  generateTransition?(input: TransitionInput): Promise<ClipResult>;
}
