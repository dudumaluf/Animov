"use client";

import { useJobsStore, type JobType } from "@/stores/jobs-store";

/**
 * Client driver for the global generation queue (scene + transition).
 * ------------------------------------------------------------------
 * Mirrors the proven video.reference flow: POST once to a submit-only route to
 * get a `jobId` (credits debited server-side), then poll /api/generate/status
 * until the render settles. While the server holds the job in the fila it
 * reports a position #N — we surface that on the matching jobs-store job so the
 * activity drawer can show "na fila (#N)". On failure the server already
 * refunded; we just propagate the error to the jobs-store.
 *
 * Kept behind a per-executor flag so the synchronous routes remain the default
 * fallback until the queue is verified on a preview deploy.
 */

const POLL_INTERVAL_MS = 5000;
const FIRST_POLL_DELAY_MS = 3000;
const MAX_POLLS = 240; // ~20 min ceiling (fila wait + render) before giving up.

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
  position?: number;
  error?: string;
};

export type QueuedJobResult = {
  videoUrl: string;
  duration: number;
  creditsCost: number;
};

export async function runQueuedJob(opts: {
  submitUrl: string;
  submitBody: Record<string, unknown>;
  signal: AbortSignal;
  /** Client target id (sceneId / transitionId) — used to find this job to tag its fila position. */
  targetId: string;
  jobType: JobType;
  /** Fallback duration/cost if the server omits them. */
  fallbackDuration: number;
}): Promise<QueuedJobResult> {
  const { submitUrl, submitBody, signal, targetId, jobType, fallbackDuration } = opts;

  const setPos = (position: number | null) => {
    const job = useJobsStore
      .getState()
      .jobs.find(
        (j) =>
          j.targetId === targetId &&
          j.type === jobType &&
          (j.status === "running" || j.status === "queued"),
      );
    if (job) useJobsStore.getState().setQueuePosition(job.id, position);
  };

  // 1) Submit (debits + inserts a queued row, returns jobId).
  const submitRes = await fetch(submitUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submitBody),
    signal,
  });
  if (!submitRes.ok) {
    const err = await submitRes
      .json()
      .catch(() => ({ error: `HTTP ${submitRes.status}` }));
    throw new Error(err.error ?? `HTTP ${submitRes.status}`);
  }
  const { jobId } = (await submitRes.json()) as { jobId?: string };
  if (!jobId) throw new Error("Submit returned no job id");

  // 2) Poll until completed / failed / timeout.
  await wait(FIRST_POLL_DELAY_MS, signal);

  let result: QueuedJobResult | undefined;
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    const statusRes = await fetch("/api/generate/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
      signal,
    });

    if (!statusRes.ok) {
      if (statusRes.status === 404) throw new Error("Job não encontrado");
      await wait(POLL_INTERVAL_MS, signal);
      continue;
    }

    const data = (await statusRes.json()) as StatusResponse;

    if (data.status === "queued") {
      setPos(typeof data.position === "number" ? data.position : null);
    } else {
      setPos(null);
    }

    if (data.status === "completed" && data.videoUrl) {
      result = {
        videoUrl: data.videoUrl,
        duration: typeof data.duration === "number" ? data.duration : fallbackDuration,
        creditsCost:
          typeof data.creditsCost === "number" ? data.creditsCost : fallbackDuration,
      };
      break;
    }
    if (data.status === "failed") {
      setPos(null);
      throw new Error(data.error ?? "Falha na geração");
    }

    await wait(POLL_INTERVAL_MS, signal);
  }

  setPos(null);
  if (!result) {
    throw new Error("Tempo limite de geração excedido — tente novamente");
  }
  return result;
}
