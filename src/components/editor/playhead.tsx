"use client";

import { useEffect, useRef } from "react";
import { useTimelineStore } from "@/stores/timeline-store";
import { timeToSegment, totalDuration, type Segment } from "@/lib/timeline/segments";
import { useStableCenterX } from "@/hooks/use-stable-center";
import {
  playheadLineCssColor,
  useEditorSettingsStore,
} from "@/stores/editor-settings-store";

export const PLAYHEAD_FIXED_POSITION = 0.5;

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
}: {
  segments: Segment[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  mainFlexRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  panX: number;
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
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const stableCenterX = useStableCenterX(viewportRef, mainFlexRef);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    dragStartClientX.current = e.clientX;
    dragStartTime.current = useTimelineStore.getState().currentTime;
    setScrubbing(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    const state = useTimelineStore.getState();
    const pps = state.pixelsPerSecond;
    const total = totalDuration(segments);
    const deltaX = e.clientX - dragStartClientX.current;
    const deltaT = deltaX / Math.max(1, pps * (zoomRef.current || 1));
    const newTime = Math.max(0, Math.min(total, dragStartTime.current + deltaT));
    seek(newTime);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    setScrubbing(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

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
