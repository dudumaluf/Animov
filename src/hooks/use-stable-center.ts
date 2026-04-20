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
 *  - Initial mount (useLayoutEffect) with rAF retry until dims are non-zero
 *  - Window resize
 *  - Viewport / mainFlex resize (ResizeObserver)
 *
 * PROD BUILD NOTE: the initial `useLayoutEffect` fires before the browser has
 * necessarily finished applying external CSS in production (CSS ships as a
 * separate file rather than inline <style>). That can make the first read
 * return `width: 0`. In dev StrictMode masked this because the effect ran
 * twice — the second run captured the settled layout. Production is single-
 * mount, so we retry via rAF for a few frames until the refs have real width.
 */
const MAX_RETRY_FRAMES = 8;

export function useStableCenterX(
  viewportRef: React.RefObject<HTMLElement | null>,
  mainFlexRef: React.RefObject<HTMLElement | null>,
): number {
  const [centerX, setCenterX] = useState(0);

  useLayoutEffect(() => {
    let retryFrames = 0;
    let rafId: number | null = null;

    const tryCompute = () => {
      rafId = null;
      const vp = viewportRef.current;
      const mf = mainFlexRef.current;
      const vpW = vp?.getBoundingClientRect().width ?? 0;
      const mfW = mf?.getBoundingClientRect().width ?? 0;

      setCenterX(computePlayheadX(vp, mf));

      // If either ref measured 0 the CSS almost certainly hasn't applied yet.
      // Try again on the next frame — up to MAX_RETRY_FRAMES so we never spin
      // forever if the element is legitimately hidden/collapsed.
      if ((vpW === 0 || mfW === 0) && retryFrames < MAX_RETRY_FRAMES) {
        retryFrames += 1;
        rafId = requestAnimationFrame(tryCompute);
      }
    };

    tryCompute();

    const compute = () => setCenterX(computePlayheadX(viewportRef.current, mainFlexRef.current));
    const vp = viewportRef.current;
    const mf = mainFlexRef.current;
    const ro = new ResizeObserver(compute);
    if (vp) ro.observe(vp);
    if (mf) ro.observe(mf);
    window.addEventListener("resize", compute);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [viewportRef, mainFlexRef]);

  return centerX;
}
