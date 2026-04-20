"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { VideoMirror } from "@/components/editor/video-mirror";
import { SpriteFrame } from "@/components/editor/sprite-frame";
import { useStableCenterX } from "@/hooks/use-stable-center";

const HEADLINE_DEFAULT_WIDTH = 320;
const HEADLINE_DEFAULT_HEIGHT = 180;
const HEADLINE_TOP_OFFSET = 36;

/**
 * Floating preview card anchored to the stable horizontal center of the editor
 * (same axis the playhead sits on). Used by the "Revisao" preset so reviewers
 * can keep an eye on the frame while the inspector is compacted into a rail.
 *
 * Visuals:
 * - 16:9 card, fixed 320x180 by default
 * - Letterboxed contain mode — the actual render area matches the source
 *   aspect ratio without stretching
 * - Fades in/out via opacity for a non-jarring toggle
 *
 * Playback: shares `videoRegistry` with the filmstrip. Zero extra decoder.
 */
export function HeadlinePreview({
  viewportRef,
  mainFlexRef,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  mainFlexRef: React.RefObject<HTMLDivElement | null>;
}) {
  const viewMode = useTimelineStore((s) => s.viewMode);
  const activeSegmentId = useTimelineStore((s) => s.activeSegmentId);
  const segmentLocalOffset = useTimelineStore((s) => s.segmentLocalOffset);
  const isScrubbing = useTimelineStore((s) => s.isScrubbing);
  const scenes = useProjectStore((s) => s.scenes);
  const transitions = useProjectStore((s) => s.transitions);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);

  const stableCenterX = useStableCenterX(viewportRef, mainFlexRef);

  const resolved = useMemo(() => {
    const candidateId =
      viewMode === "timeline" ? activeSegmentId ?? selectedSceneId : selectedSceneId;
    if (!candidateId) return null;
    const scene = scenes.find((s) => s.id === candidateId);
    if (scene) {
      return {
        id: scene.id,
        videoUrl: scene.videoUrl ?? null,
        poster: scene.photoDataUrl ?? scene.photoUrl ?? null,
        sprite: scene.sprite ?? null,
        duration: scene.duration,
      };
    }
    const transition = transitions.find((t) => t.id === candidateId);
    if (transition) {
      return {
        id: transition.id,
        videoUrl: transition.videoUrl ?? null,
        poster: null,
        sprite: transition.sprite ?? null,
        duration: transition.duration ?? transition.costCredits ?? 1,
      };
    }
    return null;
  }, [viewMode, activeSegmentId, selectedSceneId, scenes, transitions]);

  const hasContent = !!(resolved && (resolved.videoUrl || resolved.poster));
  const showSprite =
    viewMode === "timeline" &&
    isScrubbing &&
    resolved?.sprite &&
    activeSegmentId === resolved.id &&
    (resolved.duration ?? 0) > 0;

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        top: HEADLINE_TOP_OFFSET,
        left: `${stableCenterX}px`,
        transform: "translateX(-50%)",
        width: HEADLINE_DEFAULT_WIDTH,
        height: HEADLINE_DEFAULT_HEIGHT,
        opacity: hasContent ? 1 : 0,
        transition: "opacity 150ms ease-out",
      }}
      aria-hidden={!hasContent}
    >
      {resolved && resolved.videoUrl ? (
        <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
          <VideoMirror
            sourceId={resolved.id}
            poster={null}
            className="h-full w-full"
            style={{ backgroundColor: "transparent" }}
            objectFit="contain"
          />
          {showSprite && resolved.sprite && (
            <SpriteFrame
              sprite={resolved.sprite}
              progress={segmentLocalOffset / Math.max(0.001, resolved.duration)}
              className="absolute inset-0 h-full w-full"
              objectFit="contain"
            />
          )}
        </div>
      ) : resolved && resolved.poster ? (
        <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
          <Image
            src={resolved.poster}
            alt=""
            fill
            unoptimized
            className="object-contain"
            draggable={false}
          />
        </div>
      ) : null}
    </div>
  );
}
