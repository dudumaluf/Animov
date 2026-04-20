"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTimelineStore } from "@/stores/timeline-store";
import { timeToSegment, totalDuration, type Segment } from "@/lib/timeline/segments";
import { useStableCenterX } from "@/hooks/use-stable-center";
import {
  playheadLineCssColor,
  useEditorSettingsStore,
} from "@/stores/editor-settings-store";

export const PLAYHEAD_FIXED_POSITION = 0.5;

/** Distance from the viewport edge at which auto-pan kicks in during a scrub drag. */
const EDGE_PAN_ZONE = 72;
/** Max pan speed (pixels/frame) when pointer is glued to the extreme edge. */
const EDGE_PAN_MAX_SPEED = 14;

export function computePlayheadX(
  viewport: HTMLElement | null,
  mainFlex: HTMLElement | null,
): number {
  if (!viewport) return 0;
  if (mainFlex) {
    const vpRect = viewport.getBoundingClientRect();
    const mfRect = mainFlex.getBoundingClientRect();
    const stableCenterAbs = mfRect.left + mfRect.width * PLAYHEAD_FIXED_POSITION;
    return stableCenterAbs - vpRect.left;
  }
  return viewport.offsetWidth * PLAYHEAD_FIXED_POSITION;
}

function contentXForTime(
  time: number,
  segments: Segment[],
  content: HTMLElement | null,
): number | null {
  if (!content) return null;
  const { segment, localOffset } = timeToSegment(segments, time);
  if (!segment) return null;
  const cardEl = content.querySelector(
    `[data-timeline-id="${segment.id}"]`,
  ) as HTMLElement | null;
  if (!cardEl) return null;
  return (
    cardEl.offsetLeft +
    (localOffset / Math.max(0.001, segment.duration)) * cardEl.offsetWidth
  );
}

export function Playhead({
  segments,
  viewportRef,
  contentRef,
  mainFlexRef,
  zoom,
  panX,
  setPanX,
}: {
  segments: Segment[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  mainFlexRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  panX: number;
  setPanX?: (updater: (px: number) => number) => void;
}) {
  const viewMode = useTimelineStore((s) => s.viewMode);
  const autoFollow = useTimelineStore((s) => s.autoFollow);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const isScrubbing = useTimelineStore((s) => s.isScrubbing);
  const seek = useTimelineStore((s) => s.seek);
  const setScrubbing = useTimelineStore((s) => s.setScrubbing);

  const playheadLine = useEditorSettingsStore((s) => s.playheadLine);

  const dragging = useRef(false);
  const dragStartClientX = useRef(0);
  const dragStartTime = useRef(0);
  const dragStartPanX = useRef(0);
  const lastClientX = useRef(0);
  const rafHandle = useRef<number | null>(null);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const panXRef = useRef(panX);
  useEffect(() => { panXRef.current = panX; }, [panX]);

  const stableCenterX = useStableCenterX(viewportRef, mainFlexRef);

  /**
   * During drag, if the pointer sits near either viewport edge, auto-pan the
   * canvas so the user can scrub past the visible strip without lifting the
   * pointer. Pan speed scales with how close the pointer is to the edge so it
   * feels natural rather than suddenly jumping.
   *
   * The same rAF loop recomputes the "effective" client delta by subtracting
   * the net pan we've applied, keeping `seek()` honest: what the user sees
   * under their cursor is what currentTime represents.
   */
  const autoPanLoop = useCallback(() => {
    if (!dragging.current) {
      rafHandle.current = null;
      return;
    }
    const vp = viewportRef.current;
    const canPan = !!setPanX && !!vp;
    let appliedPan = 0;
    if (canPan && vp) {
      const rect = vp.getBoundingClientRect();
      const x = lastClientX.current;
      const leftDist = x - rect.left;
      const rightDist = rect.right - x;
      let speed = 0;
      if (leftDist < EDGE_PAN_ZONE) {
        const t = 1 - Math.max(0, leftDist) / EDGE_PAN_ZONE;
        speed = -EDGE_PAN_MAX_SPEED * t;
      } else if (rightDist < EDGE_PAN_ZONE) {
        const t = 1 - Math.max(0, rightDist) / EDGE_PAN_ZONE;
        speed = EDGE_PAN_MAX_SPEED * t;
      }
      if (speed !== 0) {
        appliedPan = -speed;
        setPanX!((prev) => prev + appliedPan);
      }
    }

    const state = useTimelineStore.getState();
    const pps = state.pixelsPerSecond;
    const total = totalDuration(segments);
    const effectivePps = Math.max(1, pps * (zoomRef.current || 1));
    // currentTime must reflect the pointer's position ON the content. Since
    // panX changes under the pointer, the "effective" dx grows by -appliedPan
    // — the content moved, the pointer stayed, so we gained that much content
    // ground to the right (or left).
    const dx = (lastClientX.current - dragStartClientX.current) - (panXRef.current - dragStartPanX.current);
    const deltaT = dx / effectivePps;
    const newTime = Math.max(0, Math.min(total, dragStartTime.current + deltaT));
    seek(newTime);

    rafHandle.current = requestAnimationFrame(autoPanLoop);
  }, [segments, seek, setPanX, viewportRef]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    dragStartClientX.current = e.clientX;
    dragStartTime.current = useTimelineStore.getState().currentTime;
    dragStartPanX.current = panXRef.current;
    lastClientX.current = e.clientX;
    setScrubbing(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current);
    rafHandle.current = requestAnimationFrame(autoPanLoop);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    lastClientX.current = e.clientX;
    // The rAF loop will pick up lastClientX and apply seek + optional pan.
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    setScrubbing(false);
    if (rafHandle.current !== null) {
      cancelAnimationFrame(rafHandle.current);
      rafHandle.current = null;
    }
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    return () => {
      if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current);
    };
  }, []);

  // Re-center the playhead/canvas when the user flips autoFollow back on. The
  // engine already listens for this, but we fire a micro-seek to force a
  // downstream recomputation on the next frame — otherwise a stale render can
  // leave the playhead drawn at x=0 while the preview shows mid-timeline.
  useEffect(() => {
    if (!autoFollow) return;
    const id = requestAnimationFrame(() => {
      const t = useTimelineStore.getState().currentTime;
      // Trigger the engine's autoFollow sync path without changing the clock.
      useTimelineStore.getState().seek(t);
    });
    return () => cancelAnimationFrame(id);
  }, [autoFollow]);

  if (viewMode !== "timeline") return null;
  if (segments.length === 0) return null;

  // When autoFollow is ON the playhead stays at the stable viewport center
  // and the canvas pans under it. When it's OFF the playhead is anchored to
  // the current time's position within the content, so it visually glides
  // across the cards as time advances (or as the user scrubs/pans the canvas).
  let visualX = stableCenterX;
  if (!autoFollow) {
    const cx = contentXForTime(currentTime, segments, contentRef.current);
    if (cx !== null) visualX = cx * zoom + panX;
  }

  const isActive = isScrubbing || dragging.current;
  let lineAlpha = 0;
  if (playheadLine.visibility === "always") {
    lineAlpha = isActive ? playheadLine.opacityScrub : playheadLine.opacityBaseline;
  } else if (playheadLine.visibility === "only_scrub") {
    lineAlpha = isActive ? playheadLine.opacityScrub : 0;
  }
  const lineColor = playheadLineCssColor(playheadLine.color, lineAlpha);
  const glowColor = playheadLineCssColor(playheadLine.color, 70);
  const applyGlow = playheadLine.glowOnScrub && isActive && lineAlpha > 0;

  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-40"
      style={{
        left: `${visualX}px`,
        width: 0,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 -translate-x-1/2"
        style={{
          width: 1,
          backgroundColor: lineColor,
          transition: "opacity 150ms ease-out, filter 150ms ease-out",
          opacity: lineAlpha > 0 ? 1 : 0,
          filter: applyGlow ? `drop-shadow(0 0 6px ${glowColor})` : "none",
        }}
      />
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="pointer-events-auto absolute top-3 left-0 flex h-5 w-5 -translate-x-1/2 cursor-ew-resize items-center justify-center"
        style={{ touchAction: "none" }}
        aria-label="Arrastar para scrub"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, totalDuration(segments))}
        aria-valuenow={currentTime}
      >
        <div className="h-3 w-3 rotate-45 rounded-sm bg-accent-gold shadow-[0_1px_4px_rgba(0,0,0,0.5)]" />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="pointer-events-auto absolute inset-y-0 left-0 -translate-x-1/2 cursor-ew-resize"
        style={{ width: 12, touchAction: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}
