"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { useProjectPresence } from "@/hooks/use-project-presence";

/**
 * Minimal awareness badge shown in the editor's top toolbar.
 *
 * Visible only when at least one other session is editing the same project
 * concurrently. Click reveals a dropdown listing each device — the user can
 * tell at a glance if they're stepping on their own laptop tab vs a
 * teammate / second device.
 *
 * Passive by design: this never blocks any action. The conflict resolution
 * modal is the actual safety net; the badge just lowers the "wait why did
 * that happen?" cost when a 409 fires.
 */
export function PresenceBadge({ projectId }: { projectId: string | null }) {
  const { otherSessions } = useProjectPresence(projectId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside dismissal — keeps the dropdown from lingering when the
  // user moves focus elsewhere in the toolbar.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  if (otherSessions.length === 0) return null;

  const count = otherSessions.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-accent-gold/30 bg-accent-gold/10 px-2 py-0.5 font-mono text-[10px] text-accent-gold transition-colors hover:bg-accent-gold/20"
        aria-label={`${count} outra(s) sessao(oes) ativa(s)`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-gold opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-gold" />
        </span>
        <Users size={11} />
        <span>{count}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-white/10 bg-[#1a1a17] p-3 shadow-2xl">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] text-text-primary">
            <Users size={12} className="text-accent-gold" />
            <span>
              {count} outra{count === 1 ? "" : "s"} sessao
              {count === 1 ? "" : "es"} ativa{count === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mb-2 font-mono text-[9px] leading-relaxed text-text-secondary">
            Cuidado ao editar — alteracoes podem entrar em conflito. Salvar
            simultaneamente abrira o modal de resolucao.
          </p>
          <ul className="space-y-1">
            {otherSessions.map((s) => (
              <li
                key={s.sessionId}
                className="flex items-center justify-between rounded-md bg-white/5 px-2 py-1.5 font-mono text-[10px]"
              >
                <span className="text-text-primary">{s.deviceLabel}</span>
                <span className="text-text-secondary">
                  {formatRelative(s.openedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diffMs = Math.max(0, Date.now() - ts);
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `ha ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `ha ${min}m`;
  const hr = Math.round(min / 60);
  return `ha ${hr}h`;
}
