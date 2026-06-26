"use client";

import { useEffect, useState } from "react";

/**
 * Admin BYOK editor for the Fal API key. Talks only to the admin-gated
 * /api/admin/fal-key endpoints — the full key never lives in the client; the
 * panel only ever sees the masked last-4. Lets the owner point all generations
 * at a different Fal account (e.g. the company's, which holds the credits) and
 * revert to the env default, with no redeploy.
 */

type Status = {
  source: "custom" | "env";
  masked: string | null;
  hasCustom: boolean;
};

type Feedback = { kind: "ok" | "err"; text: string } | null;

type KeyResult = {
  billingOk?: boolean;
  balance?: number | null;
  currency?: string | null;
};

function balanceSuffix(r: KeyResult): string {
  return r.billingOk && typeof r.balance === "number"
    ? ` · saldo ${r.currency ?? "USD"} ${r.balance.toFixed(2)}`
    : "";
}

export function FalKeyEditor() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState<"idle" | "testing" | "saving" | "reverting">(
    "idle",
  );
  const [feedback, setFeedback] = useState<Feedback>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/admin/fal-key", { cache: "no-store" });
      if (res.ok) {
        setStatus((await res.json()) as Status);
      } else {
        setFeedback({ kind: "err", text: "Não foi possível carregar o status" });
      }
    } catch {
      setFeedback({ kind: "err", text: "Erro de rede ao carregar o status" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const test = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setBusy("testing");
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/fal-key/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json().catch(() => ({}))) as KeyResult & {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        setFeedback({ kind: "ok", text: `Chave válida${balanceSuffix(data)}` });
      } else {
        setFeedback({ kind: "err", text: data.error ?? "Chave inválida" });
      }
    } catch {
      setFeedback({ kind: "err", text: "Erro de rede ao testar" });
    } finally {
      setBusy("idle");
    }
  };

  const save = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setBusy("saving");
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/fal-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json().catch(() => ({}))) as KeyResult & {
        ok?: boolean;
        error?: string;
        masked?: string | null;
      };
      if (res.ok && data.ok) {
        setStatus({
          source: "custom",
          masked: data.masked ?? null,
          hasCustom: true,
        });
        setKeyInput("");
        setFeedback({
          kind: "ok",
          text: `Chave salva — gerações usam a chave custom${balanceSuffix(data)}`,
        });
      } else {
        setFeedback({ kind: "err", text: data.error ?? "Falha ao salvar" });
      }
    } catch {
      setFeedback({ kind: "err", text: "Erro de rede ao salvar" });
    } finally {
      setBusy("idle");
    }
  };

  const revert = async () => {
    setBusy("reverting");
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/fal-key", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as Partial<Status> & {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        setStatus({
          source: data.source ?? "env",
          masked: data.masked ?? null,
          hasCustom: Boolean(data.hasCustom),
        });
        setFeedback({ kind: "ok", text: "Revertido para a chave padrão (env)" });
      } else {
        setFeedback({ kind: "err", text: data.error ?? "Falha ao reverter" });
      }
    } catch {
      setFeedback({ kind: "err", text: "Erro de rede ao reverter" });
    } finally {
      setBusy("idle");
    }
  };

  const isCustom = status?.source === "custom";

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl">Chave da API Fal (BYOK)</h2>
      <p className="mt-1 max-w-2xl font-body text-sm text-text-secondary">
        Troque a chave da Fal usada em <strong>todas</strong> as gerações sem
        precisar de deploy — útil para cobrar de outra conta Fal (ex.: a da
        empresa, que tem créditos). A chave é guardada de forma segura apenas no
        servidor (nunca exposta ao navegador) e a troca passa a valer em poucos
        segundos. Sem chave custom, o sistema usa a chave padrão do ambiente
        (<code className="text-accent-gold">FAL_KEY</code>).
      </p>

      <div className="mt-4 rounded-xl border border-white/5 p-4">
        {loading ? (
          <p className="font-mono text-label-sm text-text-secondary">
            Carregando status…
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                Origem atual
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  isCustom
                    ? "border-accent-gold/40 text-accent-gold"
                    : "border-white/15 text-text-secondary"
                }`}
              >
                {isCustom ? "Custom" : "Env padrão"}
              </span>
              <span className="font-mono text-label-sm text-text-primary">
                {status?.masked ?? "— nenhuma chave configurada —"}
              </span>
            </div>

            <div className="mt-4">
              <label
                htmlFor="fal-key-input"
                className="font-mono text-[10px] uppercase tracking-widest text-text-secondary"
              >
                Nova chave Fal
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  id="fal-key-input"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="cole a chave da conta Fal aqui"
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    setFeedback(null);
                  }}
                  className="w-full min-w-64 max-w-md flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-label-sm text-text-primary outline-none focus:border-accent-gold/40"
                />
                <button
                  type="button"
                  onClick={test}
                  disabled={!keyInput.trim() || busy !== "idle"}
                  className="rounded-md border border-white/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-all hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy === "testing" ? "Testando…" : "Testar"}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!keyInput.trim() || busy !== "idle"}
                  className="rounded-md border border-accent-gold/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-accent-gold transition-all hover:bg-accent-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy === "saving" ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={revert}
                disabled={!isCustom || busy !== "idle"}
                className="rounded-md border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-all hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy === "reverting" ? "Revertendo…" : "Voltar pro padrão (env)"}
              </button>
              {feedback && (
                <span
                  className={`font-mono text-[11px] ${
                    feedback.kind === "ok" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {feedback.text}
                </span>
              )}
            </div>

            <p className="mt-3 font-mono text-[10px] leading-relaxed text-text-secondary/70">
              A chave é validada na Fal antes de salvar. Só os últimos 4
              caracteres são exibidos — a chave completa nunca sai do servidor.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
