import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "@/lib/adapters";
import { configureFal } from "@/lib/fal-key";

/**
 * Global generation-queue dispatcher (server-only — uses the service-role key)
 * ------------------------------------------------
 * Respects fal's per-account concurrency limit by gating how many jobs are
 * "in flight" (submitting/submitted) at once. The cap lives in
 * `system_settings.fal_max_concurrent` (tunable from the admin panel as fal
 * scales the account). Two entry points drive it:
 *   - submit routes call {@link dispatch} right after inserting a `queued` row
 *     (best-effort immediate start), and
 *   - a ~1-min Vercel Cron hits /api/cron/dispatch which {@link reapSubmitted}s
 *     finished jobs (freeing slots) then {@link dispatch}es queued ones — so the
 *     queue advances even when no client tab is polling.
 *
 * Idempotency: every state transition is a guarded UPDATE (`.eq('status', …)`)
 * so concurrent dispatchers/polls never double-submit, double-log, or
 * double-refund. Credits use the same `add_credit` RPC as everywhere else.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type JobRow = {
  id: string;
  user_id: string;
  type: "scene" | "transition" | "reference";
  status: "queued" | "submitting" | "submitted" | "completed" | "failed";
  model_id: string | null;
  request_id: string | null;
  payload: Record<string, unknown>;
  credit_cost: number;
  duration: number | null;
  result_url: string | null;
  error: string | null;
  target_id: string | null;
  project_id: string | null;
  created_at: string;
};

const DEFAULT_CAP = 2;

/**
 * Stuck-job ceilings (slot-leak guards). Because the global cap counts every
 * `submitting`/`submitted` row as in-flight, a job that never reaches a terminal
 * state would occupy a slot forever and eventually deadlock the whole queue.
 * {@link reapStale} fails + refunds anything past these windows so the slot is
 * always reclaimed:
 *   - STALE_SUBMITTING: claimed (`submitting`) but the submit never resolved —
 *     the process died before writing `submitted`/`failed`. fal enqueue is a
 *     sub-second POST, so minutes here means orphaned; no request_id was saved
 *     so we cannot poll fal and just refund.
 *   - STALE_SUBMITTED: on fal but never settled (fal incident / dropped job).
 *     Generous — longer than any real render — so we never reap a live job.
 */
const STALE_SUBMITTING_MS = 5 * 60_000;
const STALE_SUBMITTED_MS = 30 * 60_000;

function nowIso(): string {
  return new Date().toISOString();
}

export async function getFalMaxConcurrent(admin: AdminClient): Promise<number> {
  const { data } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", "fal_max_concurrent")
    .maybeSingle();
  const raw = Number(data?.value);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_CAP;
  return Math.floor(raw);
}

async function countInFlight(admin: AdminClient): Promise<number> {
  const { count } = await admin
    .from("generation_jobs")
    .select("*", { count: "exact", head: true })
    .in("status", ["submitting", "submitted"]);
  return count ?? 0;
}

/** Number of jobs ahead of (or equal to) this one still waiting to start. */
export async function queuePosition(
  admin: AdminClient,
  job: Pick<JobRow, "created_at">,
): Promise<number> {
  const { count } = await admin
    .from("generation_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued")
    .lte("created_at", job.created_at);
  return Math.max(1, count ?? 1);
}

async function refund(admin: AdminClient, job: JobRow, reason: string): Promise<void> {
  if (job.credit_cost <= 0) return;
  await admin.rpc("add_credit", {
    p_user_id: job.user_id,
    p_amount: job.credit_cost,
    p_reason: reason,
    p_admin_id: null,
  });
}

/**
 * Claim one queued job (queued → submitting), submit it to the fal queue, then
 * mark it `submitted` with the returned request id. On any failure the job is
 * marked `failed` and its credits refunded. Returns true if the job was claimed
 * by THIS call (so the caller can account for a freshly used slot).
 */
async function submitOneQueued(admin: AdminClient, job: JobRow): Promise<boolean> {
  // Atomically claim — only one dispatcher wins the queued → submitting move.
  const { data: claimed } = await admin
    .from("generation_jobs")
    .update({ status: "submitting" })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!claimed) return false;

  if (!job.model_id) {
    await admin
      .from("generation_jobs")
      .update({ status: "failed", error: "missing model_id", finished_at: nowIso() })
      .eq("id", job.id);
    await refund(admin, job, `Reembolso: job sem modelo (${job.credit_cost}cr)`);
    return true;
  }

  try {
    const adapter = getAdapter(job.model_id);
    const duration = job.duration ?? 5;
    let requestId: string;

    if (job.type === "scene") {
      const pl = job.payload as { photoUrl?: string; prompt?: string };
      if (!pl.photoUrl || !pl.prompt) throw new Error("scene payload incomplete");
      requestId = await adapter.submitScene({
        photoUrl: pl.photoUrl,
        prompt: pl.prompt,
        duration,
      });
    } else if (job.type === "transition") {
      const pl = job.payload as {
        startFrameUrl?: string;
        endFrameUrl?: string;
        prompt?: string;
      };
      if (!pl.startFrameUrl || !pl.endFrameUrl || !pl.prompt) {
        throw new Error("transition payload incomplete");
      }
      requestId = await adapter.submitTransition({
        startFrameUrl: pl.startFrameUrl,
        endFrameUrl: pl.endFrameUrl,
        prompt: pl.prompt,
        duration,
      });
    } else {
      throw new Error(`unsupported job type for generic queue: ${job.type}`);
    }

    await admin
      .from("generation_jobs")
      .update({ status: "submitted", request_id: requestId, submitted_at: nowIso() })
      .eq("id", job.id);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "submit failed";
    console.error("[dispatch] submit failed for", job.id, message);
    await admin
      .from("generation_jobs")
      .update({ status: "failed", error: message, finished_at: nowIso() })
      .eq("id", job.id);
    await refund(admin, job, `Reembolso: falha ao enfileirar geração (${job.credit_cost}cr)`);
    return true;
  }
}

/**
 * Fill open slots (cap − in-flight) with the oldest `queued` jobs, FIFO. Safe to
 * call from multiple places concurrently; the per-job claim prevents
 * double-submission. The global cap is a soft gate (fal queues anything we send
 * beyond it), so a momentary +1 under a race is harmless.
 */
export async function dispatch(admin: AdminClient): Promise<void> {
  // Ensure the shared fal client points at the active key before any submit.
  await configureFal();
  const cap = await getFalMaxConcurrent(admin);
  const inFlight = await countInFlight(admin);
  const slots = cap - inFlight;
  if (slots <= 0) return;

  const { data: queued } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(slots);

  for (const job of (queued ?? []) as JobRow[]) {
    await submitOneQueued(admin, job);
  }
}

export type FinalizeOutcome =
  | "in_progress"
  | "queued"
  | "completed"
  | "failed";

async function logGenerationSuccess(
  admin: AdminClient,
  job: JobRow,
  videoUrl: string,
): Promise<void> {
  const adapter = job.model_id ? safeAdapterCost(job.model_id) : 0;
  const duration = job.duration ?? 0;
  const cost = adapter * duration;
  const pl = job.payload as Record<string, unknown>;

  if (job.type === "scene") {
    await admin.from("generation_logs").insert({
      user_id: job.user_id,
      model_id: null,
      generation_type: "scene",
      preset_id: (pl.presetId as string) ?? null,
      final_positive_prompt: (pl.prompt as string) ?? null,
      final_negative_prompt: (pl.negativePrompt as string) ?? null,
      duration_seconds: duration,
      cost,
      request_payload: {
        photoUrl: pl.photoUrl ?? null,
        presetId: pl.presetId ?? null,
        duration,
        modelId: job.model_id,
      },
      response_payload: { videoUrl },
    });
  } else if (job.type === "transition") {
    await admin.from("generation_logs").insert({
      user_id: job.user_id,
      model_id: null,
      generation_type: "transition",
      final_positive_prompt: (pl.prompt as string) ?? null,
      duration_seconds: duration,
      cost,
      request_payload: {
        startImageUrl: pl.startFrameUrl ?? null,
        endImageUrl: pl.endFrameUrl ?? null,
        duration,
        modelId: job.model_id,
      },
      response_payload: { videoUrl },
    });
  }
}

function safeAdapterCost(modelId: string): number {
  try {
    return getAdapter(modelId).costPerSecond;
  } catch {
    return 0;
  }
}

/**
 * Poll a `submitted` job's fal status and finalize it if done: on COMPLETED
 * claim submitted → completed and log; on fal error claim submitted → failed
 * and refund. Returns the coarse outcome for the caller (status route / cron).
 * Transient status errors leave the job `submitted` (we just report in_progress).
 */
export async function finalizeJob(
  admin: AdminClient,
  job: JobRow,
): Promise<FinalizeOutcome> {
  if (!job.model_id || !job.request_id) return "in_progress";

  // Ensure the shared fal client points at the active key before polling fal.
  await configureFal();

  let adapter;
  try {
    adapter = getAdapter(job.model_id);
  } catch {
    return "in_progress";
  }

  let state: string;
  try {
    state = await adapter.queueStatus(job.request_id);
  } catch (err) {
    console.error("[dispatch] queueStatus transient error", job.id, err);
    return "in_progress";
  }

  if (state !== "COMPLETED") {
    return state === "IN_PROGRESS" ? "in_progress" : "queued";
  }

  try {
    const { videoUrl } = await adapter.queueResult(job.request_id);
    const { data: claimed } = await admin
      .from("generation_jobs")
      .update({ status: "completed", result_url: videoUrl, finished_at: nowIso() })
      .eq("id", job.id)
      .eq("status", "submitted")
      .select("id")
      .maybeSingle();

    if (claimed) {
      await logGenerationSuccess(admin, job, videoUrl);
    }
    return "completed";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    const { data: claimed } = await admin
      .from("generation_jobs")
      .update({ status: "failed", error: message, finished_at: nowIso() })
      .eq("id", job.id)
      .eq("status", "submitted")
      .select("id")
      .maybeSingle();

    if (claimed) {
      await refund(admin, job, `Reembolso: falha na geração (${job.credit_cost}cr)`);
    }
    return "failed";
  }
}

/** Finalize up to `limit` in-flight jobs (cron reaper). */
export async function reapSubmitted(admin: AdminClient, limit = 25): Promise<void> {
  const { data: submitted } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true })
    .limit(limit);

  for (const job of (submitted ?? []) as JobRow[]) {
    await finalizeJob(admin, job);
  }
}

/**
 * Reclaim slots held by jobs stuck mid-flight (see {@link STALE_SUBMITTING_MS} /
 * {@link STALE_SUBMITTED_MS}). Without this a crashed submit or a hung fal job
 * would pin a concurrency slot indefinitely and the queue would deadlock once
 * every slot is occupied by a zombie. Each terminal transition is claimed with
 * a guarded UPDATE so it can never race {@link finalizeJob} (no double refund).
 * Runs from the cron heartbeat, before {@link reapSubmitted} + {@link dispatch}.
 */
export async function reapStale(admin: AdminClient, limit = 25): Promise<void> {
  const nowMs = Date.now();
  const submittingCutoff = new Date(nowMs - STALE_SUBMITTING_MS).toISOString();
  const submittedCutoff = new Date(nowMs - STALE_SUBMITTED_MS).toISOString();

  // Orphaned claims: `submitting` past the window. No request_id was ever
  // persisted (it's written atomically with the submitted transition), so fal
  // is unreachable for this row — fail + refund to free the slot.
  const { data: stuckSubmitting } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("status", "submitting")
    .lt("created_at", submittingCutoff)
    .limit(limit);

  for (const job of (stuckSubmitting ?? []) as JobRow[]) {
    const { data: claimed } = await admin
      .from("generation_jobs")
      .update({ status: "failed", error: "stuck submitting (reaped)", finished_at: nowIso() })
      .eq("id", job.id)
      .eq("status", "submitting")
      .select("id")
      .maybeSingle();
    if (claimed) {
      await refund(admin, job, `Reembolso: job travado ao enfileirar (${job.credit_cost}cr)`);
    }
  }

  // Hung fal jobs: `submitted` past any plausible render time. Give finalize one
  // last chance (fal may have just settled); if it's still not terminal, fail +
  // refund so the slot is reclaimed and the queue can advance again.
  const { data: stuckSubmitted } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("status", "submitted")
    .lt("submitted_at", submittedCutoff)
    .limit(limit);

  for (const job of (stuckSubmitted ?? []) as JobRow[]) {
    const outcome = await finalizeJob(admin, job);
    if (outcome === "completed" || outcome === "failed") continue;
    const { data: claimed } = await admin
      .from("generation_jobs")
      .update({ status: "failed", error: "render timed out (reaped)", finished_at: nowIso() })
      .eq("id", job.id)
      .eq("status", "submitted")
      .select("id")
      .maybeSingle();
    if (claimed) {
      await refund(admin, job, `Reembolso: tempo limite da geração (${job.credit_cost}cr)`);
    }
  }
}
