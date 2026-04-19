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
 *  - Initial mount (useLayoutEffect)
 *  - Window resize
 *  - Viewport / mainFlex resize (ResizeObserver)
 */
export function useStableCenterX(
  viewportRef: React.RefObject<HTMLElement | null>,
  mainFlexRef: React.RefObject<HTMLElement | null>,
): number {
  const [centerX, setCenterX] = useState(0);

  useLayoutEffect(() => {
    const compute = () => {
      setCenterX(computePlayheadX(viewportRef.current, mainFlexRef.current));
    };
    compute();

    const vp = viewportRef.current;
    const mf = mainFlexRef.current;
    const ro = new ResizeObserver(compute);
    if (vp) ro.observe(vp);
    if (mf) ro.observe(mf);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [viewportRef, mainFlexRef]);

  return centerX;
}
