"use client";

import { useMemo } from "react";
import { create } from "zustand";

import {
  setBatchPausedChecker,
  useJobsStore,
  type Job,
  type JobType,
  type ExecutorFn,
} from "./jobs-store";

/**
 * Batches Store
 * -------------
 * Groups related jobs into a user-facing unit of work. One "Generate all"
 * click creates one batch of N jobs; a single-cena generation is a batch
 * of 1. This is the shape the ActivityDrawer renders.
 *
 * Status is derived from the join with jobs-store (we never persist
 * `running`/`completed` on the batch itself) so there's no drift between
 * what the fila says and what the drawer shows.
 */

export type BatchItem = {
  id: string;
  /** Stable identifier of the thing being acted on (sceneId, transitionId, etc.). */
  targetId: string | null;
  label: string;
  estimatedCost: number;
  payload: unknown;
  type: JobType;
  /** The actual enqueued job id once dispatched. Undefined while in preview. */
  jobId?: string;
};

export type BatchStatus =
  | "preview"
  | "running"
  | "paused"
  | "completed"
  | "failed-partial"
  | "canceled";

export type Batch = {
  id: string;
  createdAt: number;
  title?: string;
  items: BatchItem[];
  projectId: string | null;
  dispatchedAt?: number;
  finishedAt?: number;
  isPaused: boolean;
  /** Optional: cached when dispatch runs so the drawer can show before/after. */
  startBalance?: number;
  endBalance?: number;
};

/* ── Executor registry ──────────────────────────────────────────── */

type ExecutorRegistry = Partial<Record<JobType, ExecutorFn>>;
const executorRegistry: ExecutorRegistry = {};

/**
 * Registers the executor for a given JobType. Called once per executor
 * module at top level so batches-store can find them when dispatching.
 * Kept lazy (no eager imports) to avoid pulling every executor into the
 * initial editor bundle when only a subset is used.
 */
export function registerExecutor(type: JobType, fn: ExecutorFn) {
  executorRegistry[type] = fn;
}

/* ── Store shape ────────────────────────────────────────────────── */

type BatchesStore = {
  batches: Batch[];

  createPreview: (
    items: Omit<BatchItem, "id" | "jobId">[],
    opts?: { title?: string; projectId?: string | null },
  ) => string;
  updatePreviewItem: (
    batchId: string,
    itemId: string,
    patch: Partial<Pick<BatchItem, "payload" | "estimatedCost" | "label">>,
  ) => void;
  removePreviewItem: (batchId: string, itemId: string) => void;

  dispatch: (batchId: string, opts?: { startBalance?: number }) => void;
  pause: (batchId: string) => void;
  resume: (batchId: string) => void;
  cancel: (batchId: string) => void;
  retryFailed: (batchId: string) => void;
  dismiss: (batchId: string) => void;

  /** Record end balance for a batch as soon as it reaches a terminal status. */
  recordEndBalance: (batchId: string, balance: number) => void;
};

export const useBatchesStore = create<BatchesStore>((set, get) => ({
  batches: [],

  createPreview: (items, opts) => {
    const id = crypto.randomUUID();
    const batch: Batch = {
      id,
      createdAt: Date.now(),
      title: opts?.title,
      items: items.map((it) => ({ ...it, id: crypto.randomUUID() })),
      projectId: opts?.projectId ?? null,
      isPaused: false,
    };
    set((state) => ({ batches: [...state.batches, batch] }));
    return id;
  },

  updatePreviewItem: (batchId, itemId, patch) => {
    set((state) => ({
      batches: state.batches.map((b) => {
        if (b.id !== batchId || b.dispatchedAt) return b;
        return {
          ...b,
          items: b.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
        };
      }),
    }));
  },

  removePreviewItem: (batchId, itemId) => {
    set((state) => ({
      batches: state.batches.map((b) => {
        if (b.id !== batchId || b.dispatchedAt) return b;
        return { ...b, items: b.items.filter((it) => it.id !== itemId) };
      }),
    }));
  },

  dispatch: (batchId, opts) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch || batch.dispatchedAt) return;
    if (batch.items.length === 0) return;

    // Resolve executor per item + enqueue; swap in jobId on the item so the
    // drawer can correlate job status back to the batch row.
    const enqueue = useJobsStore.getState().enqueue;
    const nextItems = batch.items.map((it) => {
      const executor = executorRegistry[it.type];
      if (!executor) {
        // No executor registered — keep the item in the batch but mark as
        // failed via an immediate no-op job. In practice this only happens
        // if an executor module wasn't imported; we log loudly to surface it.
        console.error(
          `[batches-store] No executor registered for type=${it.type}; item will fail.`,
        );
      }
      const jobId = enqueue({
        batchId,
        type: it.type,
        projectId: batch.projectId,
        targetId: it.targetId,
        label: it.label,
        payload: it.payload,
        estimatedCost: it.estimatedCost,
        executor:
          executor ??
          (async () => {
            throw new Error(`No executor registered for ${it.type}`);
          }),
      });
      return { ...it, jobId };
    });

    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId
          ? {
              ...b,
              items: nextItems,
              dispatchedAt: Date.now(),
              startBalance: opts?.startBalance ?? b.startBalance,
            }
          : b,
      ),
    }));
  },

  pause: (batchId) => {
    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId && b.dispatchedAt ? { ...b, isPaused: true } : b,
      ),
    }));
  },

  resume: (batchId) => {
    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, isPaused: false } : b,
      ),
    }));
    useJobsStore.getState().pump();
  },

  cancel: (batchId) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return;
    // Preview batches never went to jobs-store — just drop them.
    if (!batch.dispatchedAt) {
      set((state) => ({ batches: state.batches.filter((b) => b.id !== batchId) }));
      return;
    }
    const cancel = useJobsStore.getState().cancel;
    for (const it of batch.items) {
      if (it.jobId) cancel(it.jobId);
    }
    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, isPaused: false, finishedAt: Date.now() } : b,
      ),
    }));
  },

  retryFailed: (batchId) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch || !batch.dispatchedAt) return;
    const jobsState = useJobsStore.getState();
    for (const it of batch.items) {
      if (!it.jobId) continue;
      const j = jobsState.jobs.find((x) => x.id === it.jobId);
      if (j && (j.status === "failed" || j.status === "canceled")) {
        jobsState.retry(it.jobId);
      }
    }
    // Re-open the finishedAt marker so the batch returns to "running" derived.
    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, finishedAt: undefined } : b,
      ),
    }));
  },

  dismiss: (batchId) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return;
    // Clean up terminal jobs bound to this batch so jobs-store doesn't grow
    // unbounded across a long session.
    const jobsState = useJobsStore.getState();
    for (const it of batch.items) {
      if (!it.jobId) continue;
      const j = jobsState.jobs.find((x) => x.id === it.jobId);
      if (j && (j.status === "succeeded" || j.status === "failed" || j.status === "canceled")) {
        jobsState.remove(it.jobId);
      }
    }
    set((state) => ({ batches: state.batches.filter((b) => b.id !== batchId) }));
  },

  recordEndBalance: (batchId, balance) => {
    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, endBalance: balance } : b,
      ),
    }));
  },
}));

/* ── Pause wiring for jobs-store ────────────────────────────────── */

setBatchPausedChecker((batchId) => {
  const b = useBatchesStore.getState().batches.find((x) => x.id === batchId);
  return b?.isPaused ?? false;
});

/* ── Derived status ─────────────────────────────────────────────── */

export function deriveBatchStatus(batch: Batch, jobs: Job[]): BatchStatus {
  if (!batch.dispatchedAt) return "preview";
  if (batch.isPaused) return "paused";

  const myJobs = jobs.filter((j) => j.batchId === batch.id);
  if (myJobs.length === 0) return batch.dispatchedAt ? "canceled" : "preview";

  const anyRunning = myJobs.some((j) => j.status === "running" || j.status === "queued");
  if (anyRunning) return "running";

  const anyFailed = myJobs.some((j) => j.status === "failed");
  const anySucceeded = myJobs.some((j) => j.status === "succeeded");
  const allCanceled = myJobs.every((j) => j.status === "canceled");

  if (allCanceled) return "canceled";
  if (anyFailed && anySucceeded) return "failed-partial";
  if (anyFailed) return "failed-partial";
  if (anySucceeded) return "completed";
  return "canceled";
}

export function batchIsTerminal(status: BatchStatus): boolean {
  return status === "completed" || status === "failed-partial" || status === "canceled";
}

/* ── Selectors ──────────────────────────────────────────────────── */

/**
 * Joins `batches` with `jobs` to derive each batch's current status. Both
 * source lists are stable zustand references, and the projection is cached
 * via `useMemo` — without that caching every render would hand React a new
 * array reference and trip the `useSyncExternalStore` "getSnapshot should be
 * cached" warning (seen as a render-loop in the editor page).
 */
export function useBatchesWithStatus(): Array<Batch & { status: BatchStatus }> {
  const batches = useBatchesStore((s) => s.batches);
  const jobs = useJobsStore((s) => s.jobs);
  return useMemo(
    () => batches.map((b) => ({ ...b, status: deriveBatchStatus(b, jobs) })),
    [batches, jobs],
  );
}

export function useActiveBatches(): Array<Batch & { status: BatchStatus }> {
  const all = useBatchesWithStatus();
  return useMemo(() => all.filter((b) => !batchIsTerminal(b.status)), [all]);
}

export function useSessionBatches(): Array<Batch & { status: BatchStatus }> {
  const all = useBatchesWithStatus();
  return useMemo(() => all.filter((b) => batchIsTerminal(b.status)), [all]);
}

/**
 * True when the given scene (or other target) has a job actively in flight —
 * used by per-scene UIs to disable their local "Generate" button without
 * touching a global lock.
 */
export function useHasActiveJobForTarget(targetId: string, type?: JobType): boolean {
  return useJobsStore((s) =>
    s.jobs.some(
      (j) =>
        j.targetId === targetId &&
        (type ? j.type === type : true) &&
        (j.status === "queued" || j.status === "running"),
    ),
  );
}

/**
 * Message of the most recent *failed* job for a target (e.g. "Créditos
 * insuficientes"). Lets a per-scene UI surface why a generation failed instead
 * of leaving the error only in the network console. Returns null when the
 * latest job for the target didn't fail (or there is none).
 */
export function useLastJobErrorForTarget(
  targetId: string,
  type?: JobType,
): string | null {
  return useJobsStore((s) => {
    let latest: Job | undefined;
    for (const j of s.jobs) {
      if (j.targetId !== targetId) continue;
      if (type && j.type !== type) continue;
      const t = j.finishedAt ?? j.createdAt;
      const lt = latest ? (latest.finishedAt ?? latest.createdAt) : -1;
      if (!latest || t >= lt) latest = j;
    }
    return latest?.status === "failed" ? (latest.error?.message ?? "Falha na geração") : null;
  });
}

/**
 * True when *any* music job is currently in-flight project-wide. Used by the
 * "Generate music" UI for dedupe so a second click while one is running
 * shows a hint instead of firing a duplicate request.
 */
export function useHasActiveMusicJob(): boolean {
  return useJobsStore((s) =>
    s.jobs.some(
      (j) => j.type === "music" && (j.status === "queued" || j.status === "running"),
    ),
  );
}
