"use client";

import { registerExecutor } from "@/stores/batches-store";
import type { ExecutorFn } from "@/stores/jobs-store";
import {
  useProjectStore,
  persistVideoToStorage,
  kickoffStagingForTransition,
  resolveSceneHttpsUrl,
} from "@/stores/project-store";

/**
 * video.transition executor
 * -------------------------
 * Generates an AI transition between two scenes via first/last frame. Same
 * pattern as video-scene: side-effects on project-store, background persist +
 * stage. The AbortSignal cancels in-flight fetches cleanly.
 */

export type VideoTransitionPayload = {
  transitionId: string;
  fromSceneId: string;
  toSceneId: string;
  projectId: string;
  duration: number;
  modelId: string;
};

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
    resolveSceneHttpsUrl(fromScene, state._photoFiles, p.projectId),
    resolveSceneHttpsUrl(toScene, state._photoFiles, p.projectId),
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
    const res = await fetch("/api/generate-transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startImageUrl: startUrl,
        endImageUrl: endUrl,
        duration: p.duration,
        modelId: p.modelId,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    const data = await res.json();
    const realCost =
      typeof data.creditsCost === "number" ? data.creditsCost : p.duration;
    const realDuration =
      typeof data.duration === "number" && data.duration > 0
        ? data.duration
        : p.duration;

    store.setState((st) => ({
      transitions: st.transitions.map((t) =>
        t.id === p.transitionId
          ? {
              ...t,
              status: "ready" as const,
              videoUrl: data.videoUrl,
              costCredits: realCost,
              duration: realDuration,
            }
          : t,
      ),
      isDirty: true,
    }));

    const falVideoUrl = data.videoUrl as string;
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
      data: { videoUrl: data.videoUrl, duration: realDuration },
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
