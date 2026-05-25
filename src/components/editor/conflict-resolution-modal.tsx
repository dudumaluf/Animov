"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { AlertTriangle, RefreshCw, Save, X } from "lucide-react";

/**
 * Surfaces a save conflict (HTTP 409 from PATCH /api/projects/[id]) and
 * asks the user how to resolve it. Three outcomes:
 *
 *  1. **Recarregar** — discards local edits, fetches the server's current
 *     state. Confirms again if there are > 5 local changes to avoid
 *     accidentally throwing away significant work.
 *  2. **Sobrescrever** — re-saves with `force: true`. The server captures
 *     a `pre-overwrite` snapshot automatically so the other session's work
 *     stays recoverable from the version-history drawer.
 *  3. **Cancelar** — keeps the local state and the conflict descriptor.
 *     The user can keep editing; the next save attempt will hit the same
 *     409 again. The "Salvar" button in the toolbar is the manual retry.
 *
 * Local-changes count is intentionally a coarse heuristic (scene + transition
 * count + name flag). A precise diff would require keeping a baseline copy of
 * the loaded state — for the V1 modal it would add complexity without
 * meaningfully improving the user's decision.
 */
export function ConflictResolutionModal({
  hasOtherSession,
}: {
  /** Optional hint surfaced by realtime presence — adds urgency to the copy. */
  hasOtherSession?: boolean;
}) {
  const clearConflict = useProjectStore((s) => s.clearConflict);
  const loadFromSupabase = useProjectStore((s) => s.loadFromSupabase);
  const saveToSupabase = useProjectStore((s) => s.saveToSupabase);
  const supabaseProjectId = useProjectStore((s) => s.supabaseProjectId);
  const scenes = useProjectStore((s) => s.scenes);
  const transitions = useProjectStore((s) => s.transitions);

  const [confirming, setConfirming] = useState<"reload" | "overwrite" | null>(null);
  const [busy, setBusy] = useState(false);

  // Rough estimate of "how much work would be discarded by Recarregar".
  // For a sharper number we'd need to diff against the loaded baseline —
  // tracked in a future iteration if users say the heuristic feels off.
  const localChangeMagnitude =
    scenes.length + transitions.filter((t) => t.status === "ready").length;
  const isHighStakesDiscard = localChangeMagnitude > 5;

  // ESC closes (treated as "Cancelar e revisar")
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearConflict();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearConflict]);

  const handleReload = async () => {
    if (isHighStakesDiscard && confirming !== "reload") {
      setConfirming("reload");
      return;
    }
    if (!supabaseProjectId) return;
    setBusy(true);
    try {
      await loadFromSupabase(supabaseProjectId);
      // loadFromSupabase already clears conflict on success.
    } finally {
      setBusy(false);
    }
  };

  const handleOverwrite = async () => {
    if (confirming !== "overwrite") {
      setConfirming("overwrite");
      return;
    }
    setBusy(true);
    try {
      await saveToSupabase({ force: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative max-w-md rounded-2xl border border-amber-500/30 bg-[#141412] shadow-2xl">
        <button
          onClick={() => clearConflict()}
          className="absolute right-3 top-3 rounded-md p-1 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        <div className="flex gap-3 border-b border-white/10 px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="font-mono text-[14px] font-medium text-text-primary">
              Esse projeto foi editado em outro lugar
            </h2>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-text-secondary">
              {hasOtherSession ? (
                <>
                  Detectamos outra sessao aberta agora mesmo e ela salvou
                  alteracoes mais recentes que as suas.
                </>
              ) : (
                <>
                  Outra sessao (outro dispositivo ou aba) salvou alteracoes
                  depois que voce abriu este projeto.
                </>
              )}{" "}
              Voce decide como continuar.
            </p>
          </div>
        </div>

        <div className="space-y-2 px-6 py-4">
          <ResolutionOption
            icon={<RefreshCw size={14} />}
            title={
              confirming === "reload"
                ? "Confirmar: descartar minhas alteracoes locais"
                : "Recarregar do servidor"
            }
            description={
              isHighStakesDiscard
                ? `Voce tem ~${localChangeMagnitude} elementos em edicao que serao perdidos.`
                : "Pega a versao mais recente do servidor. Suas alteracoes locais serao descartadas."
            }
            destructive={confirming === "reload"}
            disabled={busy}
            onClick={handleReload}
          />

          <ResolutionOption
            icon={<Save size={14} />}
            title={
              confirming === "overwrite"
                ? "Confirmar: sobrescrever a versao remota"
                : "Sobrescrever com minhas alteracoes"
            }
            description="Salva o que voce tem aqui por cima. Um backup automatico da versao remota e criado pra recuperacao no historico."
            destructive={confirming === "overwrite"}
            disabled={busy}
            onClick={handleOverwrite}
          />

          <ResolutionOption
            icon={<X size={14} />}
            title="Cancelar e revisar"
            description="Mantem o estado atual; nada e salvo nem recarregado. Use 'Salvar' na barra superior quando estiver pronto."
            disabled={busy}
            onClick={() => clearConflict()}
          />
        </div>

        <div className="border-t border-white/10 px-6 py-3 text-center">
          <p className="font-mono text-[9px] text-text-secondary">
            Pressione ESC para cancelar
          </p>
        </div>
      </div>
    </div>
  );
}

function ResolutionOption({
  icon,
  title,
  description,
  destructive = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
        destructive
          ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15"
          : "border-white/10 hover:border-accent-gold/30 hover:bg-white/5"
      }`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
          destructive
            ? "bg-amber-500/20 text-amber-400"
            : "bg-white/5 text-text-secondary"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`font-mono text-[12px] font-medium ${
            destructive ? "text-amber-300" : "text-text-primary"
          }`}
        >
          {title}
        </p>
        <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>
    </button>
  );
}
