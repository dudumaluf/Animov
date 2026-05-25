"use client";

import { registerExecutor } from "@/stores/batches-store";
import type { ExecutorFn } from "@/stores/jobs-store";
import {
  useProjectStore,
  ensureSceneHttpsPhotoUrl,
  persistVideoToStorage,
  kickoffStaging,
} from "@/stores/project-store";

/**
 * video.scene executor
 * --------------------
 * Wraps the per-scene generation lifecycle in a single async function so the
 * jobs-store can dispatch, abort and retry it uniformly.
 *
 * Side effects (intentional — keeps the call site in project-store trivial):
 *  - Flips scene.status to "generating" on start, "ready"/"failed" on finish.
 *  - Mirrors the returned Fal URL into Supabase Storage in the background.
 *  - Kicks off sprite staging for instant timeline scrub.
 *  - Clears `generationTargetSeconds` now that the real duration landed.
 *
 * The AbortSignal is threaded into the fetch so Cancel kills an in-flight
 * request cleanly; the status becomes "canceled" via jobs-store's default
 * abort handling, and the catch-block below tags the scene as "failed" only
 * when the error is NOT an abort (prevents double-flag visual glitches).
 */

export type VideoScenePayload = {
  sceneId: string;
  /** Supabase project id — or the URL projectId as a fallback. */
  projectId: string;
  presetId: string;
  /** Target duration the model should render. Falls back to scene.duration. */
  duration: number;
  modelId: string;
};

const execute: ExecutorFn = async ({ payload, signal }) => {
  const p = payload as VideoScenePayload;
  const store = useProjectStore;

  const state = store.getState();
  const scene = state.scenes.find((s) => s.id === p.sceneId);
  if (!scene) {
    throw new Error(`Scene ${p.sceneId} not found`);
  }

  // Resolve a usable HTTPS photo URL (upload on demand if the scene only has
  // a blob/data URL). Must happen before /api/generate-scene because the API
  // rejects >4.5MB payloads — see ensureSceneHttpsPhotoUrl for details.
  const httpsUrl = await ensureSceneHttpsPhotoUrl(
    scene,
    state._photoFiles,
    p.projectId,
    state.exportAspectRatio,
  );
  if (!httpsUrl) {
    throw new Error(`No photo URL available for scene ${p.sceneId}`);
  }

  store.getState().updateSceneStatus(p.sceneId, "generating");

  try {
    const res = await fetch("/api/generate-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoUrl: httpsUrl,
        presetId: p.presetId,
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
      typeof data.duration === "number" ? data.duration : p.duration;

    store.getState().updateSceneStatus(p.sceneId, "ready", data.videoUrl, realCost, realDuration);

    // Clear generation target so future inspector edits don't reuse stale intent.
    store.setState((st) => ({
      scenes: st.scenes.map((s) =>
        s.id === p.sceneId ? { ...s, generationTargetSeconds: undefined } : s,
      ),
    }));

    // Mirror to Supabase and kick off sprite staging in the background.
    // Non-blocking so the user can interact immediately with the Fal URL.
    const falVideoUrl = data.videoUrl as string;
    void persistVideoToStorage(falVideoUrl, p.projectId, p.sceneId).then((permUrl) => {
      if (!permUrl) return;
      store.setState((st) => ({
        scenes: st.scenes.map((s) => {
          if (s.id !== p.sceneId) return s;
          return {
            ...s,
            videoUrl: permUrl,
            videoVersions: s.videoVersions.map((v) =>
              v.url === falVideoUrl ? { ...v, url: permUrl } : v,
            ),
          };
        }),
        isDirty: true,
      }));
      void kickoffStaging(p.sceneId, permUrl, realDuration);
    });

    // Kick off project save once the cycle settles — keeps the in-store data
    // consistent with what Supabase holds so a reload matches the canvas.
    // System save: bypasses optimistic concurrency (executor may be racing
    // with the user's own pending edits) and skips snapshot creation so
    // automated job completions don't crowd the version history.
    void store.getState().saveToSupabase({ system: true });

    return {
      actualCost: realCost,
      data: { videoUrl: data.videoUrl, duration: realDuration },
    };
  } catch (err) {
    // If the user aborted, jobs-store will mark status="canceled" — we leave
    // the scene status at "generating" only momentarily; flip it back to
    // "idle" (same visual as pre-generation) so the UI doesn't leave a spinner
    // spinning. For non-abort errors we mark "failed" as before.
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /abort/i.test(err.message));
    if (isAbort) {
      const cur = store.getState().scenes.find((s) => s.id === p.sceneId);
      if (cur?.status === "generating") {
        store.getState().updateSceneStatus(p.sceneId, "idle");
      }
    } else {
      store.getState().updateSceneStatus(p.sceneId, "failed");
    }
    throw err;
  }
};

registerExecutor("video.scene", execute);

export const videoSceneExecutor = execute;
