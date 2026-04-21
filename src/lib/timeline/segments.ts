import type { Scene, Transition } from "@/stores/project-store";

export type SceneSegment = {
  kind: "scene";
  id: string;
  sceneId: string;
  startTime: number;
  endTime: number;
  duration: number;
  videoUrl?: string;
  imageUrl: string;
  isReady: boolean;
  isUploadedVideo: boolean;
  /**
   * Non-destructive trim into the source video (seconds).
   * Engine uses `el.currentTime = trimStart + localOffset`.
   * undefined = play from 0.
   */
  trimStart?: number;
  /**
   * Non-destructive end-point in the source video (seconds).
   * Engine stops/advances when localOffset crosses `trimEnd - trimStart`.
   * undefined = play to native end.
   */
  trimEnd?: number;
};

export type TransitionSegment = {
  kind: "transition";
  id: string;
  fromSceneId: string;
  toSceneId: string;
  startTime: number;
  endTime: number;
  duration: number;
  videoUrl: string;
};

export type Segment = SceneSegment | TransitionSegment;

const MIN_SEGMENT_DURATION = 0.01;

export function buildSegments(scenes: Scene[], transitions: Transition[]): Segment[] {
  const segments: Segment[] = [];
  let t = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    const isReady = scene.status === "ready" && !!scene.videoUrl;

    // Effective duration for the timeline slot:
    // - video with trim: (trimEnd ?? native) - (trimStart ?? 0)
    // - video without trim or image-only: scene.duration (already effective)
    let effective = scene.duration;
    if (isReady) {
      const activeVer = scene.videoVersions?.[scene.activeVersion];
      const native =
        activeVer?.duration && activeVer.duration > 0
          ? activeVer.duration
          : scene.duration;
      const start = scene.trimStart ?? 0;
      const end = scene.trimEnd ?? native;
      const windowed = end - start;
      if (windowed > 0) effective = windowed;
    }
    const duration = Math.max(MIN_SEGMENT_DURATION, effective || 5);

    segments.push({
      kind: "scene",
      id: scene.id,
      sceneId: scene.id,
      startTime: t,
      endTime: t + duration,
      duration,
      videoUrl: scene.videoUrl,
      imageUrl: scene.photoDataUrl ?? scene.photoUrl,
      isReady,
      isUploadedVideo: scene.sourceType === "video-upload",
      trimStart: scene.trimStart,
      trimEnd: scene.trimEnd,
    });
    t += duration;

    if (i < scenes.length - 1) {
      const next = scenes[i + 1]!;
      const transId = `t-${scene.id}-${next.id}`;
      const trans = transitions.find((tr) => tr.id === transId);
      if (trans && trans.status === "ready" && trans.videoUrl) {
        const tDur = Math.max(
          MIN_SEGMENT_DURATION,
          trans.duration ?? trans.costCredits ?? 5,
        );
        segments.push({
          kind: "transition",
          id: transId,
          fromSceneId: scene.id,
          toSceneId: next.id,
          startTime: t,
          endTime: t + tDur,
          duration: tDur,
          videoUrl: trans.videoUrl,
        });
        t += tDur;
      }
    }
  }

  return segments;
}

export function totalDuration(segments: Segment[]): number {
  if (segments.length === 0) return 0;
  return segments[segments.length - 1]!.endTime;
}

export function timeToSegment(
  segments: Segment[],
  time: number,
): { segment: Segment | null; localOffset: number; index: number } {
  if (segments.length === 0) return { segment: null, localOffset: 0, index: -1 };
  const total = totalDuration(segments);
  const clamped = Math.max(0, Math.min(time, total));

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (clamped < seg.endTime) {
      return { segment: seg, localOffset: clamped - seg.startTime, index: i };
    }
  }

  const last = segments[segments.length - 1]!;
  return { segment: last, localOffset: last.duration, index: segments.length - 1 };
}

export function segmentAtIndex(segments: Segment[], index: number): Segment | null {
  return segments[index] ?? null;
}

export function findSceneSegmentIndex(segments: Segment[], sceneId: string): number {
  return segments.findIndex((s) => s.kind === "scene" && s.sceneId === sceneId);
}

export function findPreviousSceneTime(segments: Segment[], time: number): number {
  const { index } = timeToSegment(segments, time);
  for (let i = index - 1; i >= 0; i--) {
    const seg = segments[i]!;
    if (seg.kind === "scene") return seg.startTime;
  }
  return 0;
}

export function findNextSceneTime(segments: Segment[], time: number): number {
  const { index } = timeToSegment(segments, time);
  for (let i = index + 1; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.kind === "scene") return seg.startTime;
  }
  return totalDuration(segments);
}

/**
 * Normalized [0, 1] position within the SOURCE video for sprite lookup.
 * The sprite sheet is extracted from the full native video, so progress
 * has to map back to source-time — not segment-local time — or the frames
 * will fly by faster than reality whenever the user has trimmed the clip
 * (e.g. a 10s video trimmed to 5s would otherwise show all frames 0→end
 * during a 5s scrub, appearing ~2x real playback speed).
 *
 * Falls back to `localOffset / fallbackDuration` (segment-local mapping)
 * when native duration is unknown — good enough for image-only scenes,
 * transitions, and legacy scenes that never stored a version duration.
 */
export function spriteProgressForScene(
  localOffset: number,
  trimStart: number | undefined,
  nativeDuration: number | undefined,
  fallbackDuration: number,
): number {
  const nd = nativeDuration && nativeDuration > 0 ? nativeDuration : fallbackDuration;
  if (nd <= 0) return 0;
  const sourceTime = (trimStart ?? 0) + localOffset;
  return Math.max(0, Math.min(0.9999, sourceTime / nd));
}
