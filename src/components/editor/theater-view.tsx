"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { VideoMirror } from "@/components/editor/video-mirror";
import { SpriteFrame } from "@/components/editor/sprite-frame";

/**
 * Big letterboxed preview used by the "Foco" preset. Reuses the video element
 * already registered in videoRegistry by the filmstrip — no extra decoder.
 * Shows a sprite frame overlay while the user is scrubbing to give instant
 * visual feedback without waiting for a seek. Falls back to the selected scene
 * when the timeline is idle (nothing active under the playhead).
 */
export function TheaterView() {
  const viewMode = useTimelineStore((s) => s.viewMode);
  const activeSegmentId = useTimelineStore((s) => s.activeSegmentId);
  const segmentLocalOffset = useTimelineStore((s) => s.segmentLocalOffset);
  const isScrubbing = useTimelineStore((s) => s.isScrubbing);
  const scenes = useProjectStore((s) => s.scenes);
  const transitions = useProjectStore((s) => s.transitions);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);

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

  const showSprite =
    viewMode === "timeline" &&
    isScrubbing &&
    resolved?.sprite &&
    activeSegmentId === resolved.id &&
    (resolved.duration ?? 0) > 0;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black animate-in fade-in duration-200">
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
              progress={segmentLocalOffset / Math.max(0.001, resolved.duration)}
              className="absolute inset-0 h-full w-full"
              objectFit="contain"
            />
          )}
        </div>
      ) : resolved && resolved.poster ? (
        <div className="relative h-full w-full">
          <Image
            src={resolved.poster}
            alt=""
            fill
            unoptimized
            className="object-contain"
            draggable={false}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-white/30">
          <span className="font-mono text-[10px] uppercase tracking-widest">
            Foco
          </span>
          <span className="text-xs">
            Selecione uma cena ou de play para ver o preview aqui.
          </span>
        </div>
      )}
    </div>
  );
}
