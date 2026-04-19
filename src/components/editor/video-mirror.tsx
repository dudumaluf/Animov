"use client";

import { useEffect, useRef, useState } from "react";
import { videoRegistry } from "@/lib/timeline/video-registry";
import { useTimelineStore } from "@/stores/timeline-store";
import { SpriteFrame } from "@/components/editor/sprite-frame";
import type { SceneSprite } from "@/stores/project-store";

interface RvfcMetadata {
  presentationTime: DOMHighResTimeStamp;
  expectedDisplayTime: DOMHighResTimeStamp;
  width: number;
  height: number;
  mediaTime: number;
  presentedFrames: number;
  processingDuration?: number;
}

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    cb: (now: DOMHighResTimeStamp, metadata: RvfcMetadata) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Mirrors a registered HTMLVideoElement into a canvas via requestVideoFrameCallback.
 * Zero extra decoders: we reuse the video element from `videoRegistry`.
 * Falls back to polling via rAF when rVFC is unavailable or the source is paused
 * (so seeks/loaded transitions still update the canvas).
 */
export function VideoMirror({
  sourceId,
  poster,
  className,
  style,
  onFirstFrame,
  objectFit = "cover",
}: {
  sourceId: string;
  poster?: string | null;
  className?: string;
  style?: React.CSSProperties;
  onFirstFrame?: () => void;
  objectFit?: "cover" | "contain";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    setHasDrawn(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    let cancelled = false;
    let rvfcHandle: number | null = null;
    let timeoutHandle: number | null = null;
    let drawn = false;

    const draw = () => {
      if (cancelled) return;
      const source = videoRegistry.get(sourceId) as VideoWithRvfc | null;
      if (source && source.readyState >= 2 && source.videoWidth > 0) {
        const vw = source.videoWidth;
        const vh = source.videoHeight;
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }
        try {
          ctx.drawImage(source, 0, 0);
          if (!drawn) {
            drawn = true;
            setHasDrawn(true);
            onFirstFrame?.();
          }
        } catch {
          /* tainted canvas or detached element */
        }
      }
      schedule();
    };

    const schedule = () => {
      if (cancelled) return;
      const source = videoRegistry.get(sourceId) as VideoWithRvfc | null;
      const canUseRvfc =
        source && !source.paused && typeof source.requestVideoFrameCallback === "function";
      if (canUseRvfc && source) {
        rvfcHandle = source.requestVideoFrameCallback!(() => {
          rvfcHandle = null;
          draw();
        });
      } else {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          draw();
        }, 1000 / 30);
      }
    };

    draw();

    return () => {
      cancelled = true;
      if (rvfcHandle !== null) {
        const source = videoRegistry.get(sourceId) as VideoWithRvfc | null;
        if (source && typeof source.cancelVideoFrameCallback === "function") {
          try {
            source.cancelVideoFrameCallback(rvfcHandle);
          } catch {
            /* ignore */
          }
        }
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [sourceId, onFirstFrame]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        backgroundImage: poster ? `url("${poster}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#000",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit,
          opacity: hasDrawn ? 1 : 0,
          transition: "opacity 120ms ease-out",
        }}
      />
    </div>
  );
}

/**
 * Smart preview for the inspector:
 * - In timeline mode: mirrors the filmstrip video via canvas so we reuse the same
 *   decoder. Scene changes show instantly because the source video is already
 *   warmed up and the canvas is updated in-place. While the user is scrubbing,
 *   an overlay sprite-frame is shown on top of the canvas for instant visual
 *   feedback (no decoder seek latency).
 * - In canvas mode: renders a plain <video> (no `key`, so React reuses the same
 *   element on src swaps) with autoplay + loop as before.
 */
export function InspectorPreviewVideo({
  sceneId,
  videoUrl,
  poster,
  sprite,
  duration,
}: {
  sceneId: string;
  videoUrl: string;
  poster?: string | null;
  sprite?: SceneSprite;
  duration?: number;
}) {
  const viewMode = useTimelineStore((s) => s.viewMode);
  const isScrubbing = useTimelineStore((s) => s.isScrubbing);
  const activeSegmentId = useTimelineStore((s) => s.activeSegmentId);
  const segmentLocalOffset = useTimelineStore((s) => s.segmentLocalOffset);

  if (viewMode === "timeline") {
    const showSprite =
      !!sprite && isScrubbing && activeSegmentId === sceneId && (duration ?? 0) > 0;
    return (
      <div className="relative h-full w-full">
        <VideoMirror
          sourceId={sceneId}
          poster={poster ?? null}
          className="h-full w-full"
        />
        {showSprite && sprite && (
          <SpriteFrame
            sprite={sprite}
            progress={segmentLocalOffset / Math.max(0.001, duration ?? 1)}
            className="absolute inset-0 h-full w-full"
            style={{ backgroundColor: "#000" }}
          />
        )}
      </div>
    );
  }

  return (
    <video
      src={videoUrl}
      poster={poster ?? undefined}
      crossOrigin="anonymous"
      className="h-full w-full object-cover"
      muted
      loop
      autoPlay
      playsInline
      preload="auto"
    />
  );
}
