"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useProjectStore,
  type ProjectSnapshotEntry,
} from "@/stores/project-store";
import {
  Clock,
  History,
  RotateCcw,
  Save,
  ShieldAlert,
  X,
} from "lucide-react";

/**
 * Right-edge drawer listing every saved snapshot for the current project.
 *
 * Snapshots come in four flavours, each with its own visual treatment so the
 * user can tell automatic backups (background noise) from intentional ones:
 *
 *  - `auto`          : periodic, structural-change-triggered
 *  - `manual`        : user clicked "Criar backup agora"
 *  - `pre-restore`   : captured automatically right before this drawer
 *                      restored an older snapshot — the undo hatch
 *  - `pre-overwrite` : captured before the user forced a save over a
 *                      conflicting remote state — recovery point for the
 *                      other session's work
 *
 * Restore is destructive but reversible: the server takes a `pre-restore`
 * snapshot before applying, so the user can always undo via this same drawer.
 */
export function VersionHistoryDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabaseProjectId = useProjectStore((s) => s.supabaseProjectId);
  const restoreSnapshot = useProjectStore((s) => s.restoreSnapshot);

  const [snapshots, setSnapshots] = useState<ProjectSnapshotEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    if (!supabaseProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${supabaseProjectId}/snapshots`);
      if (!res.ok) return;
      const body = (await res.json()) as { snapshots: ProjectSnapshotEntry[] };
      setSnapshots(body.snapshots ?? []);
    } catch (err) {
      console.error("[version-history] fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [supabaseProjectId]);

  // Reload on open. Closing-then-reopening picks up snapshots created in
  // the meantime (e.g. an auto snapshot from a recent save).
  useEffect(() => {
    if (open) void fetchSnapshots();
  }, [open, fetchSnapshots]);

  // ESC closes (matches the conflict modal's keyboard contract)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleCreateManual = async () => {
    if (!supabaseProjectId) return;
    setCreating(true);
    try {
      const res = await fetch(
        `/api/projects/${supabaseProjectId}/snapshots`,
        { method: "POST" },
      );
      if (res.ok) await fetchSnapshots();
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (snapshotId: string) => {
    if (confirmRestore !== snapshotId) {
      setConfirmRestore(snapshotId);
      return;
    }
    setRestoring(snapshotId);
    try {
      await restoreSnapshot(snapshotId);
      // Refresh list to show the freshly minted `pre-restore` snapshot.
      await fetchSnapshots();
      setConfirmRestore(null);
    } finally {
      setRestoring(null);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop — soft, lets the editor stay legible behind */}
      <div
        className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-[9991] flex h-screen w-96 flex-col border-l border-white/10 bg-[#141412] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-accent-gold" />
            <h2 className="font-mono text-[13px] font-medium text-text-primary">
              Historico de versoes
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </header>

        <div className="border-b border-white/10 px-4 py-3">
          <button
            onClick={handleCreateManual}
            disabled={creating || !supabaseProjectId}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent-gold/30 bg-accent-gold/10 px-3 py-2 font-mono text-[11px] text-accent-gold transition-colors hover:bg-accent-gold/20 disabled:opacity-50"
          >
            <Save size={12} />
            {creating ? "Criando..." : "Criar backup agora"}
          </button>
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-text-secondary">
            Backups automaticos sao criados a cada mudanca estrutural ou a
            cada 10 minutos de edicao. Voce pode forcar um aqui.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && snapshots.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-[10px] text-text-secondary">
              Carregando historico...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-[10px] text-text-secondary">
              Nenhum backup ainda. Edite o projeto para gerar o primeiro.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {snapshots.map((snap) => (
                <SnapshotRow
                  key={snap.id}
                  snap={snap}
                  isConfirming={confirmRestore === snap.id}
                  isRestoring={restoring === snap.id}
                  onRestore={() => handleRestore(snap.id)}
                  onCancelConfirm={() => setConfirmRestore(null)}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function SnapshotRow({
  snap,
  isConfirming,
  isRestoring,
  onRestore,
  onCancelConfirm,
}: {
  snap: ProjectSnapshotEntry;
  isConfirming: boolean;
  isRestoring: boolean;
  onRestore: () => void;
  onCancelConfirm: () => void;
}) {
  const reasonMeta = REASON_META[snap.reason];
  const Icon = reasonMeta.icon;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${reasonMeta.iconBg} ${reasonMeta.iconColor}`}
        >
          <Icon size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono text-[11px] font-medium ${reasonMeta.labelColor}`}
            >
              {reasonMeta.label}
            </span>
            <span className="font-mono text-[9px] text-text-secondary">
              {formatRelative(snap.createdAt)}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-[9px] text-text-secondary">
            {snap.sceneCount} cena{snap.sceneCount === 1 ? "" : "s"}
            {snap.projectName ? ` · ${snap.projectName}` : ""}
          </div>

          {isConfirming ? (
            <div className="mt-2 flex gap-2">
              <button
                onClick={onRestore}
                disabled={isRestoring}
                className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 font-mono text-[10px] text-amber-300 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
              >
                <RotateCcw size={10} />
                {isRestoring ? "Restaurando..." : "Confirmar restauracao"}
              </button>
              <button
                onClick={onCancelConfirm}
                disabled={isRestoring}
                className="rounded-md px-2 py-1 font-mono text-[10px] text-text-secondary transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={onRestore}
              className="mt-2 flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
            >
              <RotateCcw size={10} />
              Restaurar
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// Visual metadata per snapshot reason. Keeps SnapshotRow declarative.
const REASON_META: Record<
  ProjectSnapshotEntry["reason"],
  {
    label: string;
    icon: typeof Clock;
    iconBg: string;
    iconColor: string;
    labelColor: string;
  }
> = {
  auto: {
    label: "Backup automatico",
    icon: Clock,
    iconBg: "bg-white/5",
    iconColor: "text-text-secondary",
    labelColor: "text-text-primary",
  },
  manual: {
    label: "Backup manual",
    icon: Save,
    iconBg: "bg-accent-gold/15",
    iconColor: "text-accent-gold",
    labelColor: "text-accent-gold",
  },
  "pre-restore": {
    label: "Antes de restauracao",
    icon: RotateCcw,
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    labelColor: "text-blue-300",
  },
  "pre-overwrite": {
    label: "Antes de sobrescrever",
    icon: ShieldAlert,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    labelColor: "text-amber-300",
  },
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "agora mesmo";
  const min = Math.round(sec / 60);
  if (min < 60) return `ha ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `ha ${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `ha ${day}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
