"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Undo2,
  X,
} from "lucide-react";

import { useCreditsBalance } from "@/hooks/use-credits-balance";
import {
  batchIsTerminal,
  useActiveBatches,
  useBatchesStore,
  useSessionBatches,
  type Batch,
  type BatchStatus,
} from "@/stores/batches-store";
import {
  useJobsForBatch,
  useJobsStore,
  type Job,
  type JobStatus,
} from "@/stores/jobs-store";
import { useProjectStore } from "@/stores/project-store";

import { DrawerChassis } from "./drawer-chassis";

/**
 * ActivityDrawer
 * --------------
 * Unified "work in flight" surface. The layout is intentionally quiet:
 *   - A compact credits line at the top (`livre / saldo cr` + tiny usage bar)
 *     so every decision sees the real numbers without shouting.
 *   - Two tabs (Em andamento / Histórico) using small inline counts instead
 *     of pill badges so the header stays scannable.
 *   - Batch cards with icon-coded progress counts, a single primary CTA in
 *     full-text and secondary actions as icon-only buttons — the goal is
 *     "every button speaks for itself so the card can breathe".
 *   - A "Sistema" drawer absorbs the old BackgroundTasksIndicator so there's
 *     exactly one place to look for anything the editor is doing behind
 *     the scenes.
 */
export function ActivityDrawer({
  resizable = true,
}: {
  /** Controlled by the DockRail from `dock.resize_enabled`. */
  resizable?: boolean;
} = {}) {
  return (
    <DrawerChassis title="Activity" panelId="activity" resizable={resizable}>
      <ActivityBody />
    </DrawerChassis>
  );
}

/* ── Body ───────────────────────────────────────────────────────── */

function ActivityBody() {
  const active = useActiveBatches();
  const session = useSessionBatches();
  const pendingStaging = useProjectStore((s) =>
    s.scenes.filter((sc) => sc.stagingStatus === "pending").length,
  );
  const [tab, setTab] = useState<"active" | "history">("active");

  const activeCount = active.length + (pendingStaging > 0 ? 1 : 0);

  return (
    <div className="flex h-full flex-col">
      <CreditsHeader />

      <div className="flex shrink-0 border-b border-white/5">
        <TabButton
          label="Em andamento"
          count={activeCount}
          active={tab === "active"}
          onClick={() => setTab("active")}
        />
        <TabButton
          label="Histórico"
          count={session.length}
          active={tab === "history"}
          onClick={() => setTab("history")}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === "active" ? (
          <ActiveTab batches={active} />
        ) : (
          <HistoryTab batches={session} />
        )}
      </div>
    </div>
  );
}

/* ── Credits header ────────────────────────────────────────────── */

function CreditsHeader() {
  const { balance, inUse, available } = useCreditsBalance();
  const hasRunning = useJobsStore((s) =>
    s.jobs.some((j) => j.status === "queued" || j.status === "running"),
  );

  // Usage fraction for the thin bar. When the backend hasn't resolved yet
  // we fall back to 0 so the bar looks empty rather than jittery.
  const usedPct = useMemo(() => {
    if (balance === null || balance <= 0) return 0;
    return Math.max(0, Math.min(100, (inUse / balance) * 100));
  }, [balance, inUse]);

  return (
    <div className="flex shrink-0 flex-col gap-1 border-b border-white/5 px-3 py-2">
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span
          className="flex items-center gap-1.5 text-[var(--text)]"
          title={
            balance === null
              ? "Carregando saldo…"
              : `Saldo ${balance} · em uso ${inUse} · disponível ${available}`
          }
        >
          <span className="tabular-nums">
            {balance === null ? "—" : available.toLocaleString()}
          </span>
          <span className="text-white/20">/</span>
          <span className="tabular-nums text-text-secondary">
            {balance === null ? "—" : balance.toLocaleString()}
          </span>
          <span className="text-text-secondary">cr</span>
        </span>
        {hasRunning && (
          <Loader2 size={11} className="animate-spin text-accent-gold" aria-hidden />
        )}
      </div>
      <div
        className="h-0.5 w-full overflow-hidden rounded-full bg-white/5"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-accent-gold/70 transition-[width] duration-300 ease-out"
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Tab primitive ─────────────────────────────────────────────── */

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 border-b-2 px-3 py-2 font-mono text-[10px] transition-colors ${
        active
          ? "border-accent-gold text-[var(--text)]"
          : "border-transparent text-text-secondary hover:text-[var(--text)]"
      }`}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          className={`ml-1.5 tabular-nums ${
            active ? "text-accent-gold" : "text-text-secondary/70"
          }`}
        >
          · {count}
        </span>
      )}
    </button>
  );
}

/* ── Tab: active ───────────────────────────────────────────────── */

function ActiveTab({ batches }: { batches: (Batch & { status: BatchStatus })[] }) {
  // Subscribe to the stable `scenes` array and memoize the pending-staging
  // filter — a raw `.filter()` inside the zustand selector returns a new
  // reference every render and trips the `getSnapshot should be cached`
  // infinite-loop warning.
  const scenes = useProjectStore((s) => s.scenes);
  const pendingStaging = useMemo(
    () => scenes.filter((sc) => sc.stagingStatus === "pending"),
    [scenes],
  );
  const [systemOpen, setSystemOpen] = useState(false);

  if (batches.length === 0 && pendingStaging.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-[220px] text-center font-mono text-[10px] leading-relaxed text-text-secondary">
          Nada em andamento.
          <br />
          Use o canvas pra começar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {batches.map((b) => (
        <BatchCard key={b.id} batch={b} />
      ))}

      <SystemSection
        count={pendingStaging.length}
        open={systemOpen}
        onToggle={() => setSystemOpen((v) => !v)}
      />
    </div>
  );
}

/* ── Tab: history ──────────────────────────────────────────────── */

function HistoryTab({ batches }: { batches: (Batch & { status: BatchStatus })[] }) {
  const sorted = useMemo(
    () => [...batches].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
    [batches],
  );
  const totalSpent = useMemo(() => {
    return batches.reduce((acc, b) => {
      const jobs = useJobsStore.getState().jobs.filter((j) => j.batchId === b.id);
      return acc + jobs.reduce((s, j) => s + (j.actualCost ?? 0), 0);
    }, 0);
  }, [batches]);

  if (batches.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-[220px] text-center font-mono text-[10px] leading-relaxed text-text-secondary">
          Nada no histórico desta sessão.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((b) => (
        <BatchCard key={b.id} batch={b} />
      ))}
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2 font-mono text-[10px] text-text-secondary">
        <span>{batches.length} {batches.length === 1 ? "batch" : "batches"}</span>
        <span className="tabular-nums">{totalSpent} cr</span>
      </div>
    </div>
  );
}

/* ── System section ────────────────────────────────────────────── */

function SystemSection({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const scenes = useProjectStore((s) => s.scenes);
  const staging = useMemo(
    () => scenes.filter((sc) => sc.stagingStatus),
    [scenes],
  );
  if (staging.length === 0) return null;

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-white/5 bg-[#0C0C0B]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] text-text-secondary transition-colors hover:text-[var(--text)]"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span>Sistema</span>
        {count > 0 && (
          <span className="ml-auto tabular-nums text-accent-gold">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-white/5 px-3 py-1.5">
          <div className="space-y-1">
            {staging.map((sc, idx) => (
              <div
                key={sc.id}
                className="flex items-center justify-between gap-2 font-mono text-[10px]"
              >
                <span className="truncate text-[var(--text)]">Cena {idx + 1}</span>
                <StagingBadge status={sc.stagingStatus} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StagingBadge({
  status,
}: {
  status: "pending" | "ready" | "failed" | undefined;
}) {
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1 text-accent-gold">
        <Loader2 size={9} className="animate-spin" />
        <span className="text-[9px]">extraindo</span>
      </span>
    );
  }
  if (status === "ready") {
    return <CheckCircle2 size={10} className="text-emerald-400" aria-label="pronto" />;
  }
  if (status === "failed") {
    return <AlertCircle size={10} className="text-red-400" aria-label="falhou" />;
  }
  return null;
}

/* ── Batch card ────────────────────────────────────────────────── */

function BatchCard({ batch }: { batch: Batch & { status: BatchStatus } }) {
  // `useJobsForBatch` already memoizes the filter so the returned array
  // stays stable between renders — essential for avoiding the `getSnapshot`
  // infinite-loop warning that `.filter()` inline in a zustand selector
  // would trigger.
  const jobs = useJobsForBatch(batch.id);
  const [expanded, setExpanded] = useState<boolean>(
    batch.status === "failed-partial" || batch.status === "running",
  );

  const dispatchBatch = useBatchesStore((s) => s.dispatch);
  const pauseBatch = useBatchesStore((s) => s.pause);
  const resumeBatch = useBatchesStore((s) => s.resume);
  const cancelBatch = useBatchesStore((s) => s.cancel);
  const retryFailed = useBatchesStore((s) => s.retryFailed);
  const dismissBatch = useBatchesStore((s) => s.dismiss);

  // Balance guard — block a preview dispatch when the estimate would
  // overdraw the user's credits. We capture startBalance on dispatch so
  // the user can see the trail in the card afterwards.
  const credits = useCreditsBalance();
  const estimated = batch.items.reduce((s, it) => s + it.estimatedCost, 0);
  const insufficientBalance =
    batch.status === "preview" &&
    credits.balance !== null &&
    estimated > credits.available;

  const [pendingCancelAt, setPendingCancelAt] = useState<number | null>(null);

  // Gmail-style 3s undo window before actually yanking AbortControllers.
  const startCancel = useCallback(() => {
    const at = Date.now() + 3000;
    setPendingCancelAt(at);
    window.setTimeout(() => {
      setPendingCancelAt((current) => {
        if (current === at) {
          cancelBatch(batch.id);
          return null;
        }
        return current;
      });
    }, 3000);
  }, [cancelBatch, batch.id]);

  const undoCancel = useCallback(() => setPendingCancelAt(null), []);

  const title = batch.title ?? summarizeItems(batch);
  const spent = jobs.reduce((s, j) => s + (j.actualCost ?? 0), 0);
  const counts = bucketJobs(jobs);

  const isPreview = batch.status === "preview";
  const isRunning = batch.status === "running";
  const isFailed = batch.status === "failed-partial";
  const isTerminal = batchIsTerminal(batch.status);

  return (
    <div className="overflow-hidden rounded-lg border border-white/5 bg-[#0C0C0B]">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown size={10} className="shrink-0 text-text-secondary" />
          ) : (
            <ChevronRight size={10} className="shrink-0 text-text-secondary" />
          )}
          <StatusDot status={batch.status} />
          <span className="truncate font-mono text-[11px] text-[var(--text)]">
            {title}
          </span>
        </div>
        <div className="flex shrink-0 items-center font-mono text-[10px] tabular-nums text-text-secondary">
          {isTerminal ? `${spent} cr` : `~${estimated} cr`}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-white/5 px-3 py-2">
          <ProgressSummary
            total={batch.items.length}
            counts={counts}
            isPaused={batch.status === "paused"}
          />

          {pendingCancelAt !== null ? (
            <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#141413] px-2 py-1">
              <span className="font-mono text-[10px] text-text-secondary">
                Cancelando em 3s…
              </span>
              <button
                type="button"
                onClick={undoCancel}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-accent-gold hover:bg-white/5"
              >
                <Undo2 size={10} /> Desfazer
              </button>
            </div>
          ) : (
            <>
              {insufficientBalance && credits.balance !== null && (
                <div
                  className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1 font-mono text-[10px] text-red-300"
                  title={`Saldo ${credits.available} · precisa ${estimated}`}
                >
                  <AlertCircle size={10} className="shrink-0" />
                  <span>Falta {estimated - credits.available} cr</span>
                </div>
              )}
              <ControlRow
                status={batch.status}
                canDispatch={
                  isPreview && batch.items.length > 0 && !insufficientBalance
                }
                hasFailed={counts.failed > 0}
                onDispatch={() =>
                  dispatchBatch(batch.id, {
                    startBalance: credits.balance ?? undefined,
                  })
                }
                onPause={() => pauseBatch(batch.id)}
                onResume={() => resumeBatch(batch.id)}
                onCancel={startCancel}
                onRetryFailed={() => retryFailed(batch.id)}
                onDismiss={() => dismissBatch(batch.id)}
              />
            </>
          )}

          <JobList jobs={jobs} items={batch.items} batchStatus={batch.status} />

          {isFailed && counts.failed > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-red-300">
              <AlertCircle size={10} />
              <span>
                {counts.failed} {counts.failed === 1 ? "falha" : "falhas"}
              </span>
            </div>
          )}

          {isTerminal && batch.startBalance !== undefined && batch.endBalance !== undefined && (
            <div
              className="flex items-center justify-end gap-1 font-mono text-[9px] text-text-secondary/70 tabular-nums"
              title="Saldo antes → depois deste batch"
            >
              <span>{batch.startBalance}</span>
              <span className="text-white/20">→</span>
              <span>{batch.endBalance} cr</span>
            </div>
          )}
        </div>
      )}

      {/* Collapsed running footer */}
      {!expanded && isRunning && (
        <div className="border-t border-white/5 px-3 py-1.5">
          <ProgressSummary
            total={batch.items.length}
            counts={counts}
            isPaused={false}
            compact
          />
        </div>
      )}
    </div>
  );
}

function summarizeItems(batch: Batch): string {
  if (batch.items.length === 0) return "Batch vazio";
  if (batch.items.length === 1) return batch.items[0]!.label;
  return `${batch.items.length} itens`;
}

type BucketedCounts = {
  running: number;
  queued: number;
  succeeded: number;
  failed: number;
  canceled: number;
};

function bucketJobs(jobs: Job[]): BucketedCounts {
  const out: BucketedCounts = {
    running: 0,
    queued: 0,
    succeeded: 0,
    failed: 0,
    canceled: 0,
  };
  for (const j of jobs) {
    out[j.status === "running" ? "running" : j.status] =
      (out[j.status === "running" ? "running" : j.status] ?? 0) + 1;
  }
  return out;
}

function StatusDot({ status }: { status: BatchStatus }) {
  const cls =
    status === "running"
      ? "bg-accent-gold animate-pulse"
      : status === "preview"
        ? "bg-white/30"
        : status === "paused"
          ? "bg-amber-400"
          : status === "completed"
            ? "bg-emerald-400"
            : status === "failed-partial"
              ? "bg-red-400"
              : "bg-white/15";
  return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} aria-hidden />;
}

function ProgressSummary({
  total,
  counts,
  isPaused,
  compact = false,
}: {
  total: number;
  counts: BucketedCounts;
  isPaused: boolean;
  compact?: boolean;
}) {
  const { running, queued, succeeded, failed, canceled } = counts;
  const done = succeeded + failed + canceled;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums">
        <div className="flex items-center gap-2 text-text-secondary">
          {isPaused ? (
            <Pause size={10} className="text-amber-400" aria-label="pausado" />
          ) : running > 0 ? (
            <Loader2 size={10} className="animate-spin text-accent-gold" aria-label="rodando" />
          ) : null}
          <CountPill
            icon={<CheckCircle2 size={10} className="text-emerald-400" />}
            value={succeeded}
            title="Concluídos"
            muted={succeeded === 0}
          />
          {queued > 0 && (
            <CountPill
              icon={
                <span
                  className="block h-1.5 w-1.5 rounded-full bg-white/30"
                  aria-hidden
                />
              }
              value={queued}
              title="Na fila"
            />
          )}
          {failed > 0 && (
            <CountPill
              icon={<AlertCircle size={10} className="text-red-400" />}
              value={failed}
              title="Falhas"
            />
          )}
          {canceled > 0 && (
            <CountPill
              icon={<X size={10} className="text-white/30" />}
              value={canceled}
              title="Cancelados"
            />
          )}
        </div>
        <span className="text-text-secondary">{pct}%</span>
      </div>
      {!compact && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-accent-gold transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function CountPill({
  icon,
  value,
  title,
  muted = false,
}: {
  icon: React.ReactNode;
  value: number;
  title: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1 ${muted ? "opacity-60" : ""}`}
      title={title}
    >
      {icon}
      <span className="tabular-nums text-[var(--text)]">{value}</span>
    </span>
  );
}

/* ── Controls ──────────────────────────────────────────────────── */

/**
 * Layout rule: one primary CTA per state (icon + short verb) plus a single
 * icon-only secondary action. Destructive secondaries (cancel / discard) get
 * a red tint so they're legible without a word. Reversible secondaries
 * (dismiss) stay neutral. This keeps every card row quiet and scannable.
 */
function ControlRow({
  status,
  canDispatch,
  hasFailed,
  onDispatch,
  onPause,
  onResume,
  onCancel,
  onRetryFailed,
  onDismiss,
}: {
  status: BatchStatus;
  canDispatch: boolean;
  hasFailed: boolean;
  onDispatch: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
  onDismiss: () => void;
}) {
  if (status === "preview") {
    return (
      <div className="flex items-center justify-between gap-2">
        <PrimaryAction
          icon={<Play size={10} />}
          label="Gerar tudo"
          onClick={onDispatch}
          disabled={!canDispatch}
        />
        <IconAction
          icon={<X size={12} />}
          label="Descartar"
          tone="neutral"
          onClick={onCancel}
        />
      </div>
    );
  }

  if (status === "running") {
    // Running has no primary CTA — there's nothing to commit, just reversible
    // secondary actions. Both icon-only so the row reads as "two knobs" and
    // the progress bar does the storytelling.
    return (
      <div className="flex items-center justify-end gap-1">
        <IconAction
          icon={<Pause size={12} />}
          label="Pausar"
          tone="neutral"
          onClick={onPause}
        />
        <IconAction
          icon={<X size={12} />}
          label="Cancelar"
          tone="danger"
          onClick={onCancel}
        />
      </div>
    );
  }

  if (status === "paused") {
    return (
      <div className="flex items-center justify-between gap-2">
        <PrimaryAction
          icon={<Play size={10} />}
          label="Retomar"
          onClick={onResume}
        />
        <IconAction
          icon={<X size={12} />}
          label="Cancelar"
          tone="danger"
          onClick={onCancel}
        />
      </div>
    );
  }

  if (status === "failed-partial") {
    return (
      <div className="flex items-center justify-between gap-2">
        {hasFailed ? (
          <PrimaryAction
            icon={<RefreshCw size={10} />}
            label="Retry falhados"
            onClick={onRetryFailed}
          />
        ) : (
          <span />
        )}
        <IconAction
          icon={<X size={12} />}
          label="Dispensar"
          tone="neutral"
          onClick={onDismiss}
        />
      </div>
    );
  }

  // completed / canceled — only a dismiss button
  return (
    <div className="flex items-center justify-end">
      <IconAction
        icon={<X size={12} />}
        label="Dispensar"
        tone="neutral"
        onClick={onDismiss}
      />
    </div>
  );
}

function PrimaryAction({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md border border-accent-gold/40 bg-accent-gold/10 px-2 py-1 font-mono text-[10px] text-accent-gold transition-colors hover:bg-accent-gold/20 disabled:opacity-40"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function IconAction({
  icon,
  label,
  tone,
  onClick,
  size = "md",
}: {
  icon: React.ReactNode;
  label: string;
  tone: "neutral" | "danger";
  onClick: () => void;
  /** `md` (24px) for ControlRow, `sm` (20px) for inline job rows. */
  size?: "sm" | "md";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-300 hover:bg-red-500/10"
      : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]";
  const sizeClass = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex ${sizeClass} items-center justify-center rounded transition-colors ${toneClass}`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

/* ── Job list ──────────────────────────────────────────────────── */

function JobList({
  jobs,
  items,
  batchStatus,
}: {
  jobs: Job[];
  items: Batch["items"];
  batchStatus: BatchStatus;
}) {
  const retry = useJobsStore((s) => s.retry);
  const cancel = useJobsStore((s) => s.cancel);

  // Join items with their jobs by jobId so preview items (no jobId yet)
  // still appear in the list with a muted "queued" glyph.
  const rows = items.map((it) => ({
    item: it,
    job: it.jobId ? jobs.find((j) => j.id === it.jobId) : undefined,
  }));

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {rows.map(({ item, job }) => {
        const status: JobStatus = job?.status ?? "queued";
        const isActive = status === "queued" || status === "running";
        const isFailed = status === "failed";
        const isCanceled = status === "canceled";
        const isSucceeded = status === "succeeded";

        return (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-md bg-[#141413] px-2 py-1"
          >
            <div className="flex min-w-0 items-center gap-2">
              <JobGlyph status={status} />
              <span className="truncate font-mono text-[10px] text-[var(--text)]">
                {item.label}
              </span>
              {isActive && job?.queuePosition ? (
                <span
                  className="shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-text-secondary"
                  title="Posição na fila global de geração"
                >
                  na fila #{job.queuePosition}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1 font-mono text-[9px] tabular-nums text-text-secondary">
              <span>
                {isSucceeded && job?.actualCost !== undefined
                  ? `${job.actualCost} cr`
                  : `~${item.estimatedCost} cr`}
              </span>
              {job && (isFailed || isCanceled) && (
                <IconAction
                  icon={<RefreshCw size={10} />}
                  label="Tentar novamente"
                  tone="neutral"
                  size="sm"
                  onClick={() => retry(job.id)}
                />
              )}
              {job && isActive && batchStatus !== "paused" && (
                <IconAction
                  icon={<X size={10} />}
                  label="Cancelar item"
                  tone="neutral"
                  size="sm"
                  onClick={() => cancel(job.id)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobGlyph({ status }: { status: JobStatus }) {
  if (status === "queued" || status === "running") {
    return (
      <Loader2 size={10} className="shrink-0 animate-spin text-accent-gold" />
    );
  }
  if (status === "succeeded") {
    return <CheckCircle2 size={10} className="shrink-0 text-emerald-400" />;
  }
  if (status === "failed") {
    return <AlertCircle size={10} className="shrink-0 text-red-400" />;
  }
  if (status === "canceled") {
    return <X size={10} className="shrink-0 text-white/30" />;
  }
  return <span className="h-2 w-2 shrink-0 rounded-full bg-white/20" />;
}
