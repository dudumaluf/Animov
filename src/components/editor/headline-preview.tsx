"use client";

import { useMemo } from "react";
import { useProjectStore, type ExportAspectRatio } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { useEditorSettingsStore } from "@/stores/editor-settings-store";
import { VideoMirror } from "@/components/editor/video-mirror";
import { SpriteFrame } from "@/components/editor/sprite-frame";
import { TransformedImage } from "@/components/editor/transformed-image";
import { FrameOverlay } from "@/components/editor/frame-overlay";
import { useStableCenterX } from "@/hooks/use-stable-center";
import { spriteProgressForScene } from "@/lib/timeline/segments";

// The card is height-anchored: keep a constant 180px tall and let the width
// follow the project's aspect ratio so a 9:16 project doesn't get a tiny
// pillar inside a 16:9 card (or vice versa). Numbers below are width = height
// * ratio, rounded for crisp rendering.
const HEADLINE_HEIGHT = 180;
const HEADLINE_TOP_OFFSET = 36;
const HEADLINE_RATIO_NUM: Record<ExportAspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
};

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
  const exportAspectRatio = useProjectStore((s) => s.exportAspectRatio);
  const frameOverlay = useEditorSettingsStore((s) => s.frameOverlay);

  const stableCenterX = useStableCenterX(viewportRef, mainFlexRef);

  const headlineWidth = Math.round(
    HEADLINE_HEIGHT * HEADLINE_RATIO_NUM[exportAspectRatio],
  );

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
        imageTransform: scene.imageTransform ?? null,
        sprite: scene.sprite ?? null,
        duration: scene.duration,
        trimStart: scene.trimStart,
        nativeDuration: scene.videoVersions?.[scene.activeVersion]?.duration,
      };
    }
    const transition = transitions.find((t) => t.id === candidateId);
    if (transition) {
      return {
        id: transition.id,
        videoUrl: transition.videoUrl ?? null,
        poster: null,
        imageTransform: null,
        sprite: transition.sprite ?? null,
        duration: transition.duration ?? transition.costCredits ?? 1,
        trimStart: undefined,
        nativeDuration: transition.duration ?? transition.costCredits,
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
        width: headlineWidth,
        height: HEADLINE_HEIGHT,
        opacity: hasContent ? 1 : 0,
        transition: "opacity 150ms ease-out, width 200ms ease-out",
      }}
      aria-hidden={!hasContent}
    >
      <FrameOverlay
        aspectRatio={exportAspectRatio}
        mode={frameOverlay.mode}
        overflowOpacity={frameOverlay.overflowOpacity}
        enabled={frameOverlay.enabled && hasContent}
        className="h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]"
      >
        {resolved && resolved.videoUrl ? (
          <div className="relative h-full w-full">
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
                progress={spriteProgressForScene(
                  segmentLocalOffset,
                  resolved.trimStart,
                  resolved.nativeDuration,
                  resolved.duration,
                )}
                className="absolute inset-0 h-full w-full"
                objectFit="contain"
              />
            )}
          </div>
        ) : resolved && resolved.poster ? (
          <TransformedImage
            src={resolved.poster}
            transform={resolved.imageTransform}
            aspectRatio={exportAspectRatio}
            alt=""
            className="h-full w-full"
            objectFit="contain"
            draggable={false}
          />
        ) : null}
      </FrameOverlay>
    </div>
  );
}
