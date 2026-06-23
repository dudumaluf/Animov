"use client";

import { registerExecutor } from "@/stores/batches-store";
import type { ExecutorFn } from "@/stores/jobs-store";
import {
  useProjectStore,
  persistVideoToStorage,
  kickoffStagingForTransition,
  resolveSceneHttpsUrl,
  uploadPhoto,
  type Scene,
} from "@/stores/project-store";
import { extractFrameFile, sourceTimeForEdge } from "@/lib/video/extract-frame";
import { runQueuedJob } from "@/lib/jobs/queue-client";

/**
 * Global-queue rollout switch. `false` keeps the proven synchronous
 * /api/generate-transition path (the fallback). Flip to `true` (after verifying
 * the queue on a preview deploy) to route transitions through the submit+poll
 * global concurrency queue — same ExecutorFn contract, different transport.
 */
const USE_ASYNC_QUEUE = false;

/**
 * video.transition executor
 * -------------------------
 * Generates an AI transition between two scenes. The transition connects the
 * actual clip content: the LAST (trimmed) frame of the outgoing scene's video
 * and the FIRST (trimmed) frame of the incoming scene's video. This respects
 * any timeline trim — what you see leaving/entering a clip is what the model
 * gets. When a scene has no generated video yet, we fall back to its source
 * still photo (transformed for the export frame).
 *
 * Same lifecycle pattern as video-scene: side-effects on project-store,
 * background persist + stage. The AbortSignal cancels in-flight fetches.
 */

export type VideoTransitionPayload = {
  transitionId: string;
  fromSceneId: string;
  toSceneId: string;
  projectId: string;
  duration: number;
  modelId: string;
  /** Optional user steering appended to the base transition prompt. */
  guidancePrompt?: string;
};

/**
 * Resolves the image URL that represents `edge` of `scene` for the transition:
 *   - "last"  → last visible frame of the (trimmed) clip
 *   - "first" → first visible frame of the (trimmed) clip
 *
 * Extracts + uploads a real video frame when the scene has a generated video;
 * otherwise falls back to the scene's source still (so transitions still work
 * before a clip is generated, matching the old behavior).
 */
async function resolveTransitionFrame(
  scene: Scene,
  edge: "first" | "last",
  photoFiles: Record<string, File>,
  projectId: string,
  aspectRatio: Parameters<typeof resolveSceneHttpsUrl>[3],
): Promise<string | null> {
  const isReadyVideo = scene.status === "ready" && !!scene.videoUrl;
  if (isReadyVideo && scene.videoUrl) {
    try {
      const activeVer = scene.videoVersions?.[scene.activeVersion];
      const nativeDuration = activeVer?.duration;
      const sourceTime = sourceTimeForEdge(
        edge,
        scene.trimStart,
        scene.trimEnd,
        nativeDuration,
      );
      const file = await extractFrameFile(
        scene.videoUrl,
        sourceTime,
        `${scene.id}-${edge}.png`,
      );
      return await uploadPhoto(file, projectId);
    } catch (err) {
      // Fall through to the still photo — a transition from the source image
      // is recoverable; failing the whole job is not.
      console.error(
        `[video-transition] ${edge} frame extract failed, using source photo`,
        err,
      );
    }
  }
  return resolveSceneHttpsUrl(scene, photoFiles, projectId, aspectRatio);
}

const execute: ExecutorFn = async ({ payload, signal }) => {
  const p = payload as VideoTransitionPayload;
  const store = useProjectStore;

  const state = store.getState();
  const fromScene = state.scenes.find((s) => s.id === p.fromSceneId);
  const toScene = state.scenes.find((s) => s.id === p.toSceneId);
  if (!fromScene || !toScene) {
    throw new Error(`Transition endpoints missing: ${p.transitionId}`);
  }

  const [startUrl, endUrl] = await Promise.all([
    resolveTransitionFrame(
      fromScene,
      "last",
      state._photoFiles,
      p.projectId,
      state.exportAspectRatio,
    ),
    resolveTransitionFrame(
      toScene,
      "first",
      state._photoFiles,
      p.projectId,
      state.exportAspectRatio,
    ),
  ]);
  if (!startUrl || !endUrl) {
    throw new Error("Could not resolve image URLs for transition");
  }

  store.setState((st) => ({
    transitions: st.transitions.map((t) =>
      t.id === p.transitionId
        ? { ...t, status: "generating" as const, enabled: true }
        : t,
    ),
  }));

  try {
    let videoUrl: string;
    let realDuration: number;
    let realCost: number;

    if (USE_ASYNC_QUEUE) {
      // Global queue: submit-only + poll (fila position surfaced via jobs-store).
      const r = await runQueuedJob({
        submitUrl: "/api/generate-transition/submit",
        submitBody: {
          startImageUrl: startUrl,
          endImageUrl: endUrl,
          duration: p.duration,
          modelId: p.modelId,
          guidancePrompt: p.guidancePrompt,
          transitionId: p.transitionId,
          projectId: p.projectId,
        },
        signal,
        targetId: p.transitionId,
        jobType: "video.transition",
        fallbackDuration: p.duration,
      });
      videoUrl = r.videoUrl;
      realCost = r.creditsCost;
      realDuration = r.duration > 0 ? r.duration : p.duration;
    } else {
      // Synchronous fallback (default): one request that holds until fal returns.
      const res = await fetch("/api/generate-transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startImageUrl: startUrl,
          endImageUrl: endUrl,
          duration: p.duration,
          modelId: p.modelId,
          guidancePrompt: p.guidancePrompt,
        }),
        signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      realCost = typeof data.creditsCost === "number" ? data.creditsCost : p.duration;
      realDuration =
        typeof data.duration === "number" && data.duration > 0
          ? data.duration
          : p.duration;
      videoUrl = data.videoUrl as string;
    }

    store.setState((st) => ({
      transitions: st.transitions.map((t) =>
        t.id === p.transitionId
          ? {
              ...t,
              status: "ready" as const,
              videoUrl,
              costCredits: realCost,
              duration: realDuration,
            }
          : t,
      ),
      isDirty: true,
    }));

    const falVideoUrl = videoUrl;
    void persistVideoToStorage(falVideoUrl, p.projectId, p.transitionId).then((permUrl) => {
      if (!permUrl) return;
      store.setState((st) => ({
        transitions: st.transitions.map((t) =>
          t.id === p.transitionId ? { ...t, videoUrl: permUrl } : t,
        ),
        isDirty: true,
      }));
      void kickoffStagingForTransition(p.transitionId, permUrl, realDuration);
    });

    return {
      actualCost: realCost,
      data: { videoUrl, duration: realDuration },
    };
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /abort/i.test(err.message));
    if (isAbort) {
      store.setState((st) => ({
        transitions: st.transitions.map((t) =>
          t.id === p.transitionId && t.status === "generating"
            ? { ...t, status: "idle" as const }
            : t,
        ),
      }));
    } else {
      store.setState((st) => ({
        transitions: st.transitions.map((t) =>
          t.id === p.transitionId ? { ...t, status: "failed" as const } : t,
        ),
      }));
    }
    throw err;
  }
};

registerExecutor("video.transition", execute);

export const videoTransitionExecutor = execute;
