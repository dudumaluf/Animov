"use client";

import { registerExecutor } from "@/stores/batches-store";
import type { ExecutorFn } from "@/stores/jobs-store";
import {
  useProjectStore,
  persistVideoToStorage,
  kickoffStaging,
} from "@/stores/project-store";

/**
 * video.reference executor
 * ------------------------
 * Drives a Seedance 2.0 reference-to-video generation for a reference-group
 * scene using the fal QUEUE: submit once (fast), then poll /status until the
 * (long) render settles. This avoids the serverless 504 that the old
 * synchronous endpoint hit — the heavy work lives on fal, the function calls
 * stay short, and credits are refunded server-side on failure.
 */

export type VideoReferencePayload = {
  sceneId: string;
  /** Supabase project id — or the URL projectId as a fallback. */
  projectId: string;
  /** The composed `@Image1..N` prompt sent to Seedance. */
  prompt: string;
  /** Reference image https URLs (1–9). */
  imageUrls: string[];
  /** Target duration the model should render. */
  duration: number;
  /** Quality/speed tier (standard | fast). */
  tier?: "standard" | "fast";
  /** Output resolution (480p | 720p | 1080p; 1080p is standard-tier only). */
  resolution?: "480p" | "720p" | "1080p";
  /** Concrete Seedance aspect ratio (resolved from the UI preference). */
  aspectRatio?: string;
  /** Whether Seedance should also synthesize audio. */
  generateAudio: boolean;
  /** Selected preset id — for generation logs only. */
  presetId?: string;
  /**
   * When set, the job RESUMES an already-submitted fal request (skips submit +
   * debit and goes straight to polling). Used by `resumePendingReferenceJobs`
   * after a reload. Absent for fresh generations.
   */
  requestId?: string;
};

const POLL_INTERVAL_MS = 5000;
const FIRST_POLL_DELAY_MS = 3000;
const MAX_POLLS = 180; // ~15 min ceiling before we give up polling.

/** Resolves after `ms`, or rejects early if the job is aborted. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

type StatusResponse = {
  status: "queued" | "in_progress" | "completed" | "failed";
  videoUrl?: string;
  duration?: number;
  creditsCost?: number;
  error?: string;
};

const execute: ExecutorFn = async ({ payload, signal }) => {
  const p = payload as VideoReferencePayload;
  const store = useProjectStore;

  const scene = store.getState().scenes.find((s) => s.id === p.sceneId);
  if (!scene) {
    throw new Error(`Reference scene ${p.sceneId} not found`);
  }

  store.getState().updateSceneStatus(p.sceneId, "generating");

  try {
    // 1) Get a fal queue request id. When resuming after a reload the id is
    // already in the payload (and persisted on the scene) — skip submit + debit
    // and go straight to polling. Otherwise submit fresh.
    let requestId = p.requestId;
    if (!requestId) {
      const submitRes = await fetch("/api/generate-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: p.sceneId,
          prompt: p.prompt,
          imageUrls: p.imageUrls,
          duration: p.duration,
          tier: p.tier,
          resolution: p.resolution,
          aspectRatio: p.aspectRatio,
          generateAudio: p.generateAudio,
          presetId: p.presetId,
        }),
        signal,
      });

      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({ error: `HTTP ${submitRes.status}` }));
        throw new Error(err.error ?? `HTTP ${submitRes.status}`);
      }

      const submitted = (await submitRes.json()) as { requestId?: string };
      requestId = submitted.requestId;
      if (!requestId) throw new Error("Submit returned no request id");

      // Persist the request id so a reload mid-render can resume polling
      // (credits are already debited at this point).
      store.getState().setReferencePendingRequest(p.sceneId, requestId);
    }

    // 2) Poll until the render finishes (or fails / times out).
    await wait(FIRST_POLL_DELAY_MS, signal);

    let finalVideoUrl: string | undefined;
    let finalDuration = p.duration;
    let finalCost = p.duration;

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const statusRes = await fetch("/api/generate-reference/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
        signal,
      });

      if (!statusRes.ok) {
        // 404 means the job record vanished; anything else is transient.
        if (statusRes.status === 404) throw new Error("Job de referência não encontrado");
        await wait(POLL_INTERVAL_MS, signal);
        continue;
      }

      const data = (await statusRes.json()) as StatusResponse;

      if (data.status === "completed" && data.videoUrl) {
        finalVideoUrl = data.videoUrl;
        finalDuration = typeof data.duration === "number" ? data.duration : p.duration;
        finalCost = typeof data.creditsCost === "number" ? data.creditsCost : p.duration;
        break;
      }
      if (data.status === "failed") {
        throw new Error(data.error ?? "Falha na geração");
      }

      await wait(POLL_INTERVAL_MS, signal);
    }

    if (!finalVideoUrl) {
      throw new Error("Tempo limite de geração excedido — tente novamente");
    }

    store
      .getState()
      .updateSceneStatus(p.sceneId, "ready", finalVideoUrl, finalCost, finalDuration);

    // Clear generation target + the pending request id (settled) so future
    // inspector edits don't reuse stale intent and a reload won't re-poll.
    store.setState((st) => ({
      scenes: st.scenes.map((s) =>
        s.id === p.sceneId
          ? {
              ...s,
              generationTargetSeconds: undefined,
              referenceConfig: s.referenceConfig
                ? { ...s.referenceConfig, pendingRequestId: undefined }
                : s.referenceConfig,
            }
          : s,
      ),
    }));

    // Mirror to Supabase + stage sprite in the background (non-blocking).
    const falVideoUrl = finalVideoUrl;
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
      void kickoffStaging(p.sceneId, permUrl, finalDuration);
    });

    void store.getState().saveToSupabase({ system: true });

    return {
      actualCost: finalCost,
      data: { videoUrl: finalVideoUrl, duration: finalDuration },
    };
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /abort/i.test(err.message));
    if (isAbort) {
      // Likely a page unmount/navigation. Keep pendingRequestId so the next
      // load resumes polling (the fal render may still be running); just drop
      // the "generating" flag so the node isn't visually stuck.
      const cur = store.getState().scenes.find((s) => s.id === p.sceneId);
      if (cur?.status === "generating") {
        store.getState().updateSceneStatus(p.sceneId, "idle");
      }
    } else {
      // Terminal failure — credits were refunded server-side. Clear the pending
      // id so a reload doesn't re-poll a dead job.
      store.getState().updateSceneStatus(p.sceneId, "failed");
      store.getState().setReferencePendingRequest(p.sceneId, null);
    }
    throw err;
  }
};

registerExecutor("video.reference", execute);

export const videoReferenceExecutor = execute;
