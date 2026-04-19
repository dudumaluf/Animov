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

  play: () => set({ isPlaying: true, isScrubbing: false }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying, isScrubbing: false })),
  seek: (t) => set({ currentTime: Math.max(0, t) }),
  setScrubbing: (b) =>
    set((s) => ({
      isScrubbing: b,
      isPlaying: b ? false : s.isPlaying,
    })),
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
