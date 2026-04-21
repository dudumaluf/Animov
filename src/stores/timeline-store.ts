import { create } from "zustand";

export type ViewMode = "canvas" | "timeline";

export type TimelineStore = {
  viewMode: ViewMode;
  currentTime: number;
  isPlaying: boolean;
  isScrubbing: boolean;
  autoFollow: boolean;
  pixelsPerSecond: number;
  activeSegmentId: string | null;
  segmentLocalOffset: number;

  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  setScrubbing: (b: boolean) => void;
  setAutoFollow: (b: boolean) => void;
  setPixelsPerSecond: (pps: number) => void;
  setActiveSegment: (id: string | null, localOffset: number) => void;
  reset: () => void;
};

const DEFAULT_PIXELS_PER_SECOND = 32;

// Captured on the 0->1 transition of `isScrubbing` and consumed on the 1->0
// transition so we can auto-resume playback after the user releases a
// pointer drag / wheel burst. Kept outside store state to avoid triggering
// re-renders on a piece of internal bookkeeping.
let wasPlayingBeforeScrub = false;

export const useTimelineStore = create<TimelineStore>((set) => ({
  viewMode: "canvas",
  currentTime: 0,
  isPlaying: false,
  isScrubbing: false,
  autoFollow: true,
  pixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
  activeSegmentId: null,
  segmentLocalOffset: 0,

  setViewMode: (mode) =>
    set((s) => ({
      viewMode: mode,
      isPlaying: mode === "canvas" ? false : s.isPlaying,
    })),

  toggleViewMode: () =>
    set((s) => ({
      viewMode: s.viewMode === "canvas" ? "timeline" : "canvas",
      isPlaying: false,
    })),

  play: () => {
    wasPlayingBeforeScrub = false;
    set({ isPlaying: true, isScrubbing: false });
  },
  pause: () => {
    wasPlayingBeforeScrub = false;
    set({ isPlaying: false });
  },
  togglePlay: () =>
    set((s) => {
      wasPlayingBeforeScrub = false;
      return { isPlaying: !s.isPlaying, isScrubbing: false };
    }),
  seek: (t) => set({ currentTime: Math.max(0, t) }),
  setScrubbing: (b) =>
    set((s) => {
      // Entering a scrub: remember playback state exactly once per drag.
      // We only capture on the 0->1 transition so repeated wheel ticks
      // (setScrubbing(true) fired every frame) don't clobber `wasPlaying`
      // with the intermediate `isPlaying=false` we just wrote ourselves.
      if (b && !s.isScrubbing) {
        wasPlayingBeforeScrub = s.isPlaying;
      }
      // Leaving a scrub: if we had been playing, resume — otherwise stay
      // paused so a regular click-seek doesn't start playback unexpectedly.
      if (!b && s.isScrubbing) {
        const shouldResume = wasPlayingBeforeScrub;
        wasPlayingBeforeScrub = false;
        return {
          isScrubbing: false,
          isPlaying: shouldResume,
        };
      }
      return {
        isScrubbing: b,
        isPlaying: b ? false : s.isPlaying,
      };
    }),
  setAutoFollow: (b) => set({ autoFollow: b }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: Math.max(8, Math.min(200, pps)) }),
  setActiveSegment: (id, localOffset) => set({ activeSegmentId: id, segmentLocalOffset: localOffset }),
  reset: () =>
    set({
      currentTime: 0,
      isPlaying: false,
      isScrubbing: false,
      activeSegmentId: null,
      segmentLocalOffset: 0,
    }),
}));
