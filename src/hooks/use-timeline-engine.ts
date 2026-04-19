"use client";

import { useEffect, useRef } from "react";
import { useTimelineStore } from "@/stores/timeline-store";
import {
  timeToSegment,
  totalDuration,
  type Segment,
} from "@/lib/timeline/segments";
import { videoRegistry } from "@/lib/timeline/video-registry";
import { computePlayheadX } from "@/components/editor/playhead";

export interface TimelineEngineParams {
  segments: Segment[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  mainFlexRef: React.RefObject<HTMLDivElement | null>;
  musicUrl: string | null;
  musicVolume: number;
  panX: number;
  setPanX: (x: number) => void;
  zoom: number;
}

const DRIFT_CORRECTION_THRESHOLD = 0.2;
const SEEK_EPSILON = 0.03;
const MAX_FRAME_DELTA = 0.1;
const PAN_SNAP_EPSILON = 0.5;
const PREMOUNT_LEAD_SECONDS = 1.0;

/**
 * Translates a segment-local offset into a source-video `currentTime`.
 * Scene segments may carry a non-destructive `trimStart`; transitions do not.
 * Scene segments with no trim fall back to 0, matching pre-trim behavior.
 */
function sourceOffsetFor(segment: Segment, localOffset: number): number {
  if (segment.kind === "scene") {
    return (segment.trimStart ?? 0) + localOffset;
  }
  return localOffset;
}

export function useTimelineEngine({
  segments,
  viewportRef,
  contentRef,
  mainFlexRef,
  musicUrl,
  musicVolume,
  panX,
  setPanX,
  zoom,
}: TimelineEngineParams) {
  const segmentsRef = useRef(segments);
  const panXRef = useRef(panX);
  const musicVolRef = useRef(musicVolume);
  const setPanXRef = useRef(setPanX);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);
  useEffect(() => {
    panXRef.current = panX;
  }, [panX]);
  useEffect(() => {
    musicVolRef.current = musicVolume;
  }, [musicVolume]);
  useEffect(() => {
    setPanXRef.current = setPanX;
  }, [setPanX]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const isScrubbing = useTimelineStore((s) => s.isScrubbing);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const viewMode = useTimelineStore((s) => s.viewMode);
  const autoFollow = useTimelineStore((s) => s.autoFollow);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSegmentIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  // Tracks which segments we already triggered a "premount" play-pause on.
  // Prevents re-firing the pre-decode on every animation frame once it has been
  // kicked off for a given segment.
  const premountedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    }
    if (!musicUrl) return;
    try {
      const el = new Audio(musicUrl);
      el.loop = true;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.volume = Math.max(0, Math.min(1, musicVolRef.current));
      audioRef.current = el;
    } catch (err) {
      console.warn("[timeline-engine] Audio init failed", err);
    }
    return () => {
      try { audioRef.current?.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    };
  }, [musicUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = Math.max(0, Math.min(1, musicVolume));
  }, [musicVolume]);

  useEffect(() => {
    if (viewMode !== "timeline") {
      videoRegistry.pauseAll();
      try { audioRef.current?.pause(); } catch { /* ignore */ }
      activeSegmentIdRef.current = null;
      premountedRef.current.clear();
      useTimelineStore.getState().setActiveSegment(null, 0);
    }
  }, [viewMode]);

  // When segments change (scene added/removed), drop the premount set so that
  // new segments get pre-decoded on their next approach.
  useEffect(() => {
    premountedRef.current = new Set();
  }, [segments]);

  // Pre-warm all videos when entering timeline mode so first frame is decoded.
  // This is the "double-buffer" trick: by forcing each video element to demux
  // and render frame 0 before playback, clip-to-clip transitions become instant
  // (no black flash while the decoder spins up).
  useEffect(() => {
    if (viewMode !== "timeline") return;
    let cancelled = false;
    const warmupOne = async (segId: string) => {
      const el = videoRegistry.get(segId);
      if (!el) return;
      try {
        el.muted = true;
        if (el.readyState < 2) {
          try { el.load(); } catch { /* ignore */ }
          await new Promise<void>((resolve) => {
            const onReady = () => {
              el.removeEventListener("loadeddata", onReady);
              resolve();
            };
            el.addEventListener("loadeddata", onReady, { once: true });
            setTimeout(() => {
              el.removeEventListener("loadeddata", onReady);
              resolve();
            }, 2500);
          });
        }
        if (cancelled) return;
        // Play then pause: forces decode of the first real frame so switching
        // into this segment later paints immediately.
        try {
          await el.play();
          el.pause();
          el.currentTime = 0;
        } catch { /* autoplay may be blocked until user gesture */ }
      } catch { /* ignore */ }
    };
    const warmup = async () => {
      await Promise.all(segmentsRef.current.map((s) => warmupOne(s.id)));
    };
    warmup();
    return () => { cancelled = true; };
  }, [viewMode, segments]);

  // When viewport or main flex resizes (window resize, inspector toggle, etc.),
  // keep the playhead aligned with currentTime. Since the playhead position is
  // computed from the stable main-flex container, it doesn't move when the
  // inspector toggles — but the engine still re-runs sync to be safe in the
  // rare cases where the main flex width actually changes (window resize).
  useEffect(() => {
    if (viewMode !== "timeline") return;
    const vp = viewportRef.current;
    const mf = mainFlexRef.current;
    if (!vp) return;
    const observer = new ResizeObserver(() => {
      if (useTimelineStore.getState().isScrubbing) return;
      if (!useTimelineStore.getState().autoFollow) return;
      const t = useTimelineStore.getState().currentTime;
      const { segment, localOffset } = timeToSegment(segmentsRef.current, t);
      if (!segment) return;
      syncPanToCurrentTime(segment, localOffset);
    });
    observer.observe(vp);
    if (mf) observer.observe(mf);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Scrubbing: coalesce seeks via rAF so high-frequency pointermove/wheel
  // events collapse to at most one seek per frame. Avoids stacking up
  // currentTime= assignments that each take ~50ms to resolve and keeps the
  // UI responsive on trackpads that emit 120+ events/s.
  useEffect(() => {
    if (!isScrubbing) return;
    videoRegistry.pauseAll();
    videoRegistry.mutedAll(true);
    try { audioRef.current?.pause(); } catch { /* ignore */ }

    let rafHandle: number | null = null;
    let lastAppliedTime = Number.NaN;

    const loop = () => {
      const state = useTimelineStore.getState();
      if (!state.isScrubbing) {
        rafHandle = null;
        return;
      }
      const t = state.currentTime;
      if (t !== lastAppliedTime) {
        lastAppliedTime = t;
        const { segment, localOffset } = timeToSegment(segmentsRef.current, t);
        if (segment) {
          if (segment.id !== activeSegmentIdRef.current) {
            if (activeSegmentIdRef.current) {
              const prev = videoRegistry.get(activeSegmentIdRef.current);
              try { prev?.pause(); } catch { /* ignore */ }
            }
            activeSegmentIdRef.current = segment.id;
          }
          useTimelineStore.getState().setActiveSegment(segment.id, localOffset);
          const el = videoRegistry.get(segment.id);
          const srcOffset = sourceOffsetFor(segment, localOffset);
          if (el && Math.abs(el.currentTime - srcOffset) > SEEK_EPSILON) {
            try { el.currentTime = srcOffset; } catch { /* ignore */ }
          }
          if (state.autoFollow) {
            syncPanToCurrentTime(segment, localOffset);
          }
        }
      }
      rafHandle = requestAnimationFrame(loop);
    };

    rafHandle = requestAnimationFrame(loop);

    return () => {
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrubbing]);

  useEffect(() => {
    if (viewMode !== "timeline") return;
    if (isPlaying || isScrubbing) return;
    if (!useTimelineStore.getState().autoFollow) return;
    const raf = requestAnimationFrame(() => {
      const { segment, localOffset } = timeToSegment(segmentsRef.current, currentTime);
      if (!segment) return;
      syncPanToCurrentTime(segment, localOffset);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentTime, isPlaying, isScrubbing, autoFollow]);

  useEffect(() => {
    if (!isPlaying || viewMode !== "timeline") {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      videoRegistry.pauseAll();
      try { audioRef.current?.pause(); } catch { /* ignore */ }
      return;
    }

    const segs = segmentsRef.current;
    const total = totalDuration(segs);
    if (total <= 0) {
      useTimelineStore.getState().pause();
      return;
    }

    const startState = useTimelineStore.getState();
    let startT = startState.currentTime;
    if (startT >= total - 0.01) {
      startT = 0;
      useTimelineStore.setState({ currentTime: 0 });
    }

    const initInfo = timeToSegment(segs, startT);
    activateSegment(initInfo.segment, initInfo.localOffset);
    useTimelineStore.getState().setActiveSegment(
      initInfo.segment?.id ?? null,
      initInfo.localOffset,
    );

    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (d && isFinite(d) && d > 0) {
        try { audioRef.current.currentTime = startT % d; } catch { /* ignore */ }
      }
      audioRef.current.play().catch(() => { /* autoplay may be blocked */ });
    }

    let lastFrame = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(MAX_FRAME_DELTA, (now - lastFrame) / 1000);
      lastFrame = now;

      const state = useTimelineStore.getState();
      if (!state.isPlaying) {
        rafRef.current = null;
        return;
      }

      const latestSegs = segmentsRef.current;
      const tot = totalDuration(latestSegs);
      const nt = state.currentTime + dt;

      if (nt >= tot) {
        useTimelineStore.setState({ currentTime: tot, isPlaying: false });
        videoRegistry.pauseAll();
        try { audioRef.current?.pause(); } catch { /* ignore */ }
        activeSegmentIdRef.current = null;
        useTimelineStore.getState().setActiveSegment(null, 0);
        rafRef.current = null;
        return;
      }

      const { segment, localOffset } = timeToSegment(latestSegs, nt);
      const newKey = segment ? segment.id : null;

      if (newKey !== activeSegmentIdRef.current) {
        if (activeSegmentIdRef.current) {
          const prevEl = videoRegistry.get(activeSegmentIdRef.current);
          try { prevEl?.pause(); } catch { /* ignore */ }
        }
        activateSegment(segment, localOffset);
        useTimelineStore.getState().setActiveSegment(newKey, localOffset);
      } else if (segment) {
        const el = videoRegistry.get(segment.id);
        const srcOffset = sourceOffsetFor(segment, localOffset);
        if (el && Math.abs(el.currentTime - srcOffset) > DRIFT_CORRECTION_THRESHOLD) {
          try { el.currentTime = srcOffset; } catch { /* ignore */ }
        }
      }

      // Premount pattern (Remotion v5-inspired): PREMOUNT_LEAD_SECONDS before
      // the current segment ends, nudge the NEXT segment's decoder so its
      // first frame is already demuxed and decoded. Result: clip-to-clip
      // transitions feel instant (no black flash, no 200-400ms decoder spin-up).
      if (segment) {
        const timeToBoundary = segment.endTime - nt;
        if (timeToBoundary > 0 && timeToBoundary < PREMOUNT_LEAD_SECONDS) {
          const idx = latestSegs.findIndex((s) => s.id === segment.id);
          const next = idx >= 0 ? latestSegs[idx + 1] : undefined;
          if (next && !premountedRef.current.has(next.id)) {
            premountedRef.current.add(next.id);
            const nextEl = videoRegistry.get(next.id);
            if (nextEl && nextEl.readyState < 4) {
              const parkAt = sourceOffsetFor(next, 0);
              try {
                nextEl.muted = true;
                nextEl.currentTime = parkAt;
                void nextEl.play()
                  .then(() => {
                    // If the engine hasn't activated this segment yet, park it
                    // at its trim-start. If it HAS been activated (fast approach
                    // at end-of-clip), let the activate logic own playback.
                    if (activeSegmentIdRef.current !== next.id) {
                      try { nextEl.pause(); nextEl.currentTime = parkAt; } catch { /* ignore */ }
                    }
                  })
                  .catch(() => { /* autoplay may be blocked pre-gesture */ });
              } catch { /* ignore */ }
            }
          }
        }
      }

      if (state.autoFollow) {
        syncPanToCurrentTime(segment, localOffset);
      }

      useTimelineStore.setState({ currentTime: nt });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      videoRegistry.pauseAll();
      try { audioRef.current?.pause(); } catch { /* ignore */ }
      activeSegmentIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, viewMode]);

  function activateSegment(segment: Segment | null, localOffset: number) {
    if (!segment) {
      activeSegmentIdRef.current = null;
      return;
    }
    activeSegmentIdRef.current = segment.id;
    const el = videoRegistry.get(segment.id);
    if (!el) return;

    videoRegistry.mutedAll(true);
    const shouldAudible = segment.kind === "scene" && segment.isUploadedVideo;
    el.muted = !shouldAudible;

    const srcOffset = sourceOffsetFor(segment, localOffset);
    try { el.currentTime = srcOffset; } catch { /* ignore */ }
    if (useTimelineStore.getState().isPlaying) {
      el.play().catch(() => { /* ignore */ });
    }
  }

  function syncPanToCurrentTime(segment: Segment | null, localOffset: number) {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || !segment) return;

    const cardEl = content.querySelector(
      `[data-timeline-id="${segment.id}"]`,
    ) as HTMLElement | null;
    if (!cardEl) return;

    const localContentX =
      cardEl.offsetLeft +
      (localOffset / Math.max(0.001, segment.duration)) * cardEl.offsetWidth;
    const targetOffset = computePlayheadX(viewport, mainFlexRef.current);
    const z = zoomRef.current || 1;
    const newPanX = targetOffset - localContentX * z;

    if (Math.abs(newPanX - panXRef.current) < PAN_SNAP_EPSILON) return;
    panXRef.current = newPanX;
    setPanXRef.current(newPanX);
  }
}
