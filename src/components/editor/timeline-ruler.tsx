"use client";

import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTimelineStore } from "@/stores/timeline-store";
import {
  useEditorSettingsStore,
  type RulerDensityMode,
} from "@/stores/editor-settings-store";
import { totalDuration, type Segment } from "@/lib/timeline/segments";
import { useStableCenterX } from "@/hooks/use-stable-center";

const RULER_HEIGHT = 24;

/**
 * Candidate major-tick intervals in seconds. Covers common human-readable
 * cadences (1s, 2s, 5s, ...) so the ruler never surprises with odd numbers.
 * 3 and 4 are intentionally excluded to keep cadences predictable.
 */
const INTERVAL_STOPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600] as const;

/**
 * Compute a human-friendly major-tick interval such that labels end up roughly
 * `target` pixels apart on screen. `dense` packs more labels, `sparse` spreads
 * them further apart; `auto` uses the default 110px target.
 */
function computeMajorInterval(
  effectivePps: number,
  densityMode: RulerDensityMode,
): number {
  if (effectivePps <= 0) return INTERVAL_STOPS[0];
  const target =
    densityMode === "dense" ? 60 : densityMode === "sparse" ? 180 : 110;
  for (const s of INTERVAL_STOPS) {
    if (s * effectivePps >= target) return s;
  }
  return INTERVAL_STOPS[INTERVAL_STOPS.length - 1]!;
}

function formatTimeLabel(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (sec === 0) return `${m}m`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function TimelineRulerInner({
  segments,
  viewportRef,
  mainFlexRef,
  panX,
  zoom,
}: {
  segments: Segment[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  mainFlexRef: React.RefObject<HTMLDivElement | null>;
  panX: number;
  zoom: number;
}) {
  const viewMode = useTimelineStore((s) => s.viewMode);
  const pixelsPerSecond = useTimelineStore((s) => s.pixelsPerSecond);
  const rulerSettings = useEditorSettingsStore((s) => s.ruler);
  const stableCenterX = useStableCenterX(viewportRef, mainFlexRef);

  const [viewportWidth, setViewportWidth] = useState(0);
  const rulerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewportRef]);

  const total = useMemo(() => totalDuration(segments), [segments]);
  const effectivePps = Math.max(0.01, pixelsPerSecond * zoom);
  const majorInterval = useMemo(
    () => computeMajorInterval(effectivePps, rulerSettings.densityMode),
    [effectivePps, rulerSettings.densityMode],
  );

  // Ticks now cover BOTH the content range and the visible viewport range, so
  // when the user pans past `total` they still see a reference grid instead
  // of an empty bar. We skip generation when either is 0 to avoid infinite
  // loops on initial render.
  const { minorTicks, majorTicks } = useMemo(() => {
    const minor: number[] = [];
    const major: number[] = [];
    if (effectivePps <= 0 || majorInterval <= 0) return { minorTicks: minor, majorTicks: major };

    const minorInterval = Math.max(
      0.5,
      majorInterval >= 10
        ? majorInterval / 5
        : majorInterval >= 5
          ? majorInterval / 5
          : 1,
    );

    // Start slightly before the visible area if we've panned to the right
    // (panX < 0), so ticks appear from the moment they scroll into view.
    const startT = Math.max(0, Math.floor(-panX / effectivePps / minorInterval) * minorInterval);
    // End at whichever is later: the content end, or the right edge of the
    // viewport. Cap to a sane upper bound so weird zooms don't explode.
    const viewportEnd = (viewportWidth - panX) / effectivePps;
    const endT = Math.min(
      Math.max(total, viewportEnd) + minorInterval,
      60 * 60 * 4, // 4 hours ceiling
    );

    const epsilon = 1e-3;
    for (let t = startT; t <= endT + epsilon; t += minorInterval) {
      const rounded = Math.round(t * 1000) / 1000;
      const isMajor =
        Math.abs(rounded % majorInterval) < epsilon ||
        Math.abs((rounded % majorInterval) - majorInterval) < epsilon;
      if (isMajor) major.push(rounded);
      else minor.push(rounded);
    }
    return { minorTicks: minor, majorTicks: major };
  }, [total, effectivePps, majorInterval, panX, viewportWidth]);

  if (viewMode !== "timeline") return null;
  if (!rulerSettings.visible) return null;
  if (segments.length === 0) return null;

  const endX = panX + total * effectivePps;

  return (
    <div
      ref={rulerRef}
      className="pointer-events-none absolute left-0 right-0 top-0 z-30 overflow-hidden border-b border-white/5 bg-[#0A0A09]/70"
      style={{ height: RULER_HEIGHT, contain: "layout paint" }}
    >
      {minorTicks.map((t) => {
        const x = panX + t * effectivePps;
        if (x < -4 || x > viewportWidth + 4) return null;
        return (
          <div
            key={`min-${t}`}
            className="absolute top-0 bg-white/10"
            style={{ left: x, width: 1, height: 4 }}
          />
        );
      })}

      {majorTicks.map((t) => {
        const x = panX + t * effectivePps;
        // Extra generous culling horizontally so labels near the right edge
        // (which extend rightward from their tick) don't disappear just
        // because the tick sits at viewportWidth - 1.
        if (x < -60 || x > viewportWidth + 60) return null;
        return (
          <div
            key={`maj-${t}`}
            className="absolute top-0"
            style={{ left: x }}
          >
            <div
              className="absolute top-0 bg-white/25"
              style={{ width: 1, height: 7 }}
            />
            <span
              className="absolute top-[8px] left-1 whitespace-nowrap font-mono text-[9px] tabular-nums text-text-secondary/60"
            >
              {formatTimeLabel(t)}
            </span>
          </div>
        );
      })}

      {endX >= -4 && endX <= viewportWidth + 4 && (
        <div
          className="absolute top-0 bg-white/30"
          style={{ left: endX, width: 1, height: RULER_HEIGHT, opacity: 0.6 }}
          aria-hidden="true"
        />
      )}

      {stableCenterX > 0 && (
        <div
          className="absolute inset-y-0 bg-accent-gold/25"
          style={{ left: stableCenterX - 0.5, width: 1 }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * Memoized wrapper — the inner component still has to re-render on every
 * `panX`/`zoom` change (the ticks move with it), but memoizing prevents
 * needless re-renders from unrelated store updates (e.g. `currentTime`
 * bumps during scrub/playback that don't mutate tick layout).
 */
export const TimelineRuler = memo(TimelineRulerInner);
