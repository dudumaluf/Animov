"use client";

import { useLayoutEffect, useState } from "react";
import { computePlayheadX } from "@/components/editor/playhead";

/**
 * Returns the horizontal center X (in viewport-local coordinates) to use as the
 * stable "playback axis" in timeline mode. Stable means it does NOT shift when
 * the inspector sidebar opens/closes, because it's measured from the outer
 * `mainFlex` container (canvas + inspector combined), whose half-width stays
 * anchored relative to the canvas viewport's left edge.
 *
 * Both `Playhead` and `TransportBar` must subscribe to this hook so they share
 * the exact same vertical axis — otherwise they visibly desync when the user
 * toggles the inspector.
 *
 * Re-measures on:
 *  - Initial mount (useLayoutEffect) + one rAF safety-net measurement
 *  - Window resize
 *  - Viewport / mainFlex resize (ResizeObserver)
 *
 * PROD BUILD NOTE: the initial `useLayoutEffect` can fire before the browser
 * finishes applying external CSS in production (CSS ships as a separate file
 * rather than inline <style>). That can make the first read return `width: 0`.
 * In dev StrictMode masked this because the effect ran twice — the second run
 * captured the settled layout. Production is single-mount, so we schedule one
 * extra measurement on the next animation frame as a safety net. ResizeObserver
 * handles any further layout shifts.
 */
export function useStableCenterX(
  viewportRef: React.RefObject<HTMLElement | null>,
  mainFlexRef: React.RefObject<HTMLElement | null>,
): number {
  const [centerX, setCenterX] = useState(0);

  useLayoutEffect(() => {
    const compute = () => setCenterX(computePlayheadX(viewportRef.current, mainFlexRef.current));
    compute();
    const rafId = requestAnimationFrame(compute);

    const ro = new ResizeObserver(compute);
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (mainFlexRef.current) ro.observe(mainFlexRef.current);
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [viewportRef, mainFlexRef]);

  return centerX;
}
