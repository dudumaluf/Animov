"use client";

import { useMemo } from "react";
import { create } from "zustand";

/**
 * Jobs Store
 * ----------
 * Central queue for every generation the editor can dispatch (video, music,
 * image edits). Each Job belongs to a Batch (even a single-click "generate
 * scene" becomes a batch of 1), so higher-level UI can always group them.
 *
 * The store only cares about the **fila**: a global concurrency cap, per-job
 * AbortControllers, FIFO ordering, and status transitions. It does NOT know
 * about scenes, transitions, or credits — those lenses live in the
 * batches-store, project-store and UI components.
 *
 * Coordination with batches-store uses a lightweight checker callback
 * (`setBatchPausedChecker`) to avoid a circular import. Batches-store wires
 * it up on first use and pump() consults it when deciding which `queued`
 * jobs may leave the queue.
 */

export type JobType =
  | "video.scene"
  | "video.transition"
  | "video.reference"
  | "music"
  | "image.edit";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type ExecutorResult = {
  /**
   * Real cost charged by the backend. Executors that don't know (or can't
   * measure) leave it undefined — callers fall back to `estimatedCost`.
   */
  actualCost?: number;
  /** Executor-specific payload (videoUrl, audioUrl, etc.) for downstream use. */
  data: unknown;
};

export type ExecutorFn = (args: {
  payload: unknown;
  signal: AbortSignal;
  onProgress?: (pct: number) => void;
}) => Promise<ExecutorResult>;

export type JobError = { message: string; retriable: boolean };

export type Job = {
  id: string;
  batchId: string;
  type: JobType;
  status: JobStatus;
  projectId: string | null;
  targetId: string | null;
  label: string;
  payload: unknown;
  estimatedCost: number;
  actualCost?: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: JobError;
  executor: ExecutorFn;
  /** AbortController for the in-flight request. Kept on the job so cancel() can reach it. */
  abortController?: AbortController;
  result?: unknown;
  progress?: number;
  /**
   * Server-side queue position (#N) while the global concurrency gate holds
   * this job back on fal. Distinct from the client `status` ("running" = the
   * executor is alive and polling). Set by async executors; surfaced as
   * "na fila (#N)" in the activity drawer. Undefined once it leaves the fila.
   */
  queuePosition?: number;
};

export type EnqueueInput = Omit<
  Job,
  | "id"
  | "status"
  | "createdAt"
  | "abortController"
  | "result"
  | "actualCost"
  | "progress"
  | "queuePosition"
>;

type JobsStore = {
  jobs: Job[];
  maxConcurrent: number;

  enqueue: (input: EnqueueInput) => string;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  /** Remove a terminal job from the list. Does nothing for running/queued. */
  remove: (id: string) => void;
  /** Set the server-side fila position (#N) for a job; null clears it. */
  setQueuePosition: (id: string, position: number | null) => void;
  setMaxConcurrent: (n: number) => void;
  /** Abort every in-flight job and mark them canceled (editor unmount). */
  abortAll: () => void;
  /** Force-evaluate the queue; normally called internally but exposed for pause/resume. */
  pump: () => void;
};

/* ── Batch pause checker (wired by batches-store) ───────────────── */

type BatchPausedChecker = (batchId: string) => boolean;

let batchPausedChecker: BatchPausedChecker = () => false;

/**
 * Register a callback that pump() will consult before pulling a job out of
 * the queue. Used by batches-store to honor its `isPaused` flag without
 * creating a circular import at module load time.
 */
export function setBatchPausedChecker(fn: BatchPausedChecker) {
  batchPausedChecker = fn;
}

/* ── Retry policy ───────────────────────────────────────────────── */

/**
 * Number of automatic retries the pump will attempt on a retriable failure
 * (HTTP 429 / transient network). Retries do not consume the user's manual
 * "Retry failed" button — those are tracked separately at the batch level.
 */
const AUTO_RETRY_LIMIT = 2;
const AUTO_RETRY_BACKOFF_MS = [2000, 6000];

const autoRetryCounts = new Map<string, number>();

/* ── Store ──────────────────────────────────────────────────────── */

// Per-tab client cap. Kept at/below the server-side `fal_max_concurrent` gate
// so a single tab can't outrun fal's account limit; the global queue is the
// real ceiling. Lowered 4 → 2 for the global-queue rollout.
const DEFAULT_MAX_CONCURRENT = 2;

export const useJobsStore = create<JobsStore>((set, get) => {
  /**
   * Drains the queue up to `maxConcurrent` running jobs. Called on every
   * transition that can free a slot (enqueue, succeed, fail, cancel, resume).
   * Pure side-effect: mutates store + fires off executors, never throws.
   */
  const pump = () => {
    const { jobs, maxConcurrent } = get();
    const running = jobs.filter((j) => j.status === "running").length;
    let slots = Math.max(0, maxConcurrent - running);
    if (slots === 0) return;

    // FIFO: queued jobs in insertion order, filtered by pause state.
    const pickable = jobs.filter(
      (j) => j.status === "queued" && !batchPausedChecker(j.batchId),
    );

    for (const job of pickable) {
      if (slots <= 0) break;
      slots -= 1;
      void runJob(job.id);
    }
  };

  const runJob = async (jobId: string) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "queued") return;

    const abortController = new AbortController();
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: "running",
              startedAt: Date.now(),
              abortController,
              error: undefined,
            }
          : j,
      ),
    }));

    try {
      const result = await job.executor({
        payload: job.payload,
        signal: abortController.signal,
        onProgress: (pct) => {
          set((state) => ({
            jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, progress: pct } : j)),
          }));
        },
      });

      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "succeeded",
                finishedAt: Date.now(),
                abortController: undefined,
                actualCost: result.actualCost ?? j.estimatedCost,
                result: result.data,
                progress: 100,
              }
            : j,
        ),
      }));
      autoRetryCounts.delete(jobId);
    } catch (err) {
      // AbortError path — explicit cancel wins, no auto-retry.
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || /abort/i.test(err.message));
      if (isAbort && abortController.signal.aborted) {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "canceled",
                  finishedAt: Date.now(),
                  abortController: undefined,
                }
              : j,
          ),
        }));
        autoRetryCounts.delete(jobId);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        const retriable = isRetriableError(err);
        const tries = autoRetryCounts.get(jobId) ?? 0;

        if (retriable && tries < AUTO_RETRY_LIMIT) {
          autoRetryCounts.set(jobId, tries + 1);
          const delay = AUTO_RETRY_BACKOFF_MS[tries] ?? 6000;
          set((state) => ({
            jobs: state.jobs.map((j) =>
              j.id === jobId
                ? { ...j, status: "queued", abortController: undefined, error: undefined }
                : j,
            ),
          }));
          setTimeout(() => {
            // Re-check after delay: the user may have canceled during backoff.
            const latest = get().jobs.find((j) => j.id === jobId);
            if (latest && latest.status === "queued") pump();
          }, delay);
          return;
        }

        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "failed",
                  finishedAt: Date.now(),
                  abortController: undefined,
                  error: { message, retriable },
                }
              : j,
          ),
        }));
        autoRetryCounts.delete(jobId);
      }
    }

    // Slot may now be free for the next queued job — keep pumping.
    pump();
  };

  return {
    jobs: [],
    maxConcurrent: DEFAULT_MAX_CONCURRENT,

    enqueue: (input) => {
      const id = crypto.randomUUID();
      set((state) => ({
        jobs: [
          ...state.jobs,
          {
            ...input,
            id,
            status: "queued",
            createdAt: Date.now(),
          },
        ],
      }));
      pump();
      return id;
    },

    cancel: (id) => {
      const job = get().jobs.find((j) => j.id === id);
      if (!job) return;
      if (job.status === "running" && job.abortController) {
        try {
          job.abortController.abort();
        } catch {
          /* ignore */
        }
      } else if (job.status === "queued") {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id
              ? { ...j, status: "canceled", finishedAt: Date.now() }
              : j,
          ),
        }));
        autoRetryCounts.delete(id);
        pump();
      }
    },

    retry: (id) => {
      const job = get().jobs.find((j) => j.id === id);
      if (!job || (job.status !== "failed" && job.status !== "canceled")) return;
      autoRetryCounts.delete(id);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === id
            ? {
                ...j,
                status: "queued",
                error: undefined,
                startedAt: undefined,
                finishedAt: undefined,
              }
            : j,
        ),
      }));
      pump();
    },

    remove: (id) => {
      const job = get().jobs.find((j) => j.id === id);
      if (!job) return;
      // Only remove terminal jobs — running/queued must be canceled first so
      // the AbortController is honored and we don't leak a live fetch.
      if (job.status === "running" || job.status === "queued") return;
      set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) }));
      autoRetryCounts.delete(id);
    },

    setQueuePosition: (id, position) => {
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === id ? { ...j, queuePosition: position ?? undefined } : j,
        ),
      }));
    },

    setMaxConcurrent: (n) => {
      const clamped = Math.max(1, Math.min(16, Math.floor(n)));
      set({ maxConcurrent: clamped });
      pump();
    },

    abortAll: () => {
      const jobs = get().jobs;
      for (const j of jobs) {
        if (j.status === "running" && j.abortController) {
          try {
            j.abortController.abort();
          } catch {
            /* ignore */
          }
        }
      }
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.status === "running" || j.status === "queued"
            ? { ...j, status: "canceled", finishedAt: Date.now(), abortController: undefined }
            : j,
        ),
      }));
    },

    pump,
  };
});

/* ── Selectors ──────────────────────────────────────────────────── */

/**
 * Filters jobs to a specific batch. The filter projection is cached via
 * `useMemo` so the returned array reference is stable between renders when
 * neither `jobs` nor `batchId` changes — otherwise every render hands React
 * a new array and trips the "getSnapshot should be cached" warning.
 */
export function useJobsForBatch(batchId: string): Job[] {
  const jobs = useJobsStore((s) => s.jobs);
  return useMemo(() => jobs.filter((j) => j.batchId === batchId), [jobs, batchId]);
}

export function useHasActiveJobs(): boolean {
  return useJobsStore((s) =>
    s.jobs.some((j) => j.status === "queued" || j.status === "running"),
  );
}

export function useJobForTarget(targetId: string, type?: JobType): Job | undefined {
  return useJobsStore((s) =>
    s.jobs.find(
      (j) =>
        j.targetId === targetId &&
        (type ? j.type === type : true) &&
        (j.status === "queued" || j.status === "running"),
    ),
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function isRetriableError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  // HTTP 429 or generic "rate limit" / transient network hiccups.
  return /\b429\b|rate.?limit|too many requests|ECONNRESET|network|timeout/i.test(msg);
}
