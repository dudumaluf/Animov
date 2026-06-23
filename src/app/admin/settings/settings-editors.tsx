"use client";

import { useState } from "react";

type SaveState = "idle" | "saving" | "saved" | "error";

function StatusDot({ state }: { state: SaveState }) {
  if (state === "saving")
    return <span className="font-mono text-[10px] text-text-secondary">…</span>;
  if (state === "saved")
    return <span className="font-mono text-[10px] text-green-400">salvo</span>;
  if (state === "error")
    return <span className="font-mono text-[10px] text-red-400">erro</span>;
  return null;
}

export function SettingRow({
  settingKey,
  initialValue,
  type,
}: {
  settingKey: string;
  initialValue: string | number;
  type: "integer" | "string";
}) {
  const [value, setValue] = useState(String(initialValue));
  const [saved, setSaved] = useState(String(initialValue));
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== saved;

  const save = async () => {
    setError(null);
    let payloadValue: number | string;
    if (type === "integer") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        setState("error");
        setError("inteiro ≥ 0");
        return;
      }
      payloadValue = n;
    } else {
      if (!value.trim()) {
        setState("error");
        setError("obrigatório");
        return;
      }
      payloadValue = value.trim();
    }

    setState("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "system_setting",
          key: settingKey,
          value: payloadValue,
        }),
      });
      if (res.ok) {
        setSaved(String(payloadValue));
        setState("saved");
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState("error");
        setError(data.error ?? "falhou");
      }
    } catch {
      setState("error");
      setError("erro de rede");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type={type === "integer" ? "number" : "text"}
        min={type === "integer" ? 0 : undefined}
        step={type === "integer" ? 1 : undefined}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
          setError(null);
        }}
        className="w-32 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-label-sm text-text-primary outline-none focus:border-accent-gold/40"
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || state === "saving"}
        className="rounded-md border border-accent-gold/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-accent-gold transition-all hover:bg-accent-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
      >
        Salvar
      </button>
      {error ? (
        <span className="font-mono text-[10px] text-red-400">{error}</span>
      ) : (
        <StatusDot state={state} />
      )}
    </div>
  );
}

export function CatalogRow({
  stripePriceId,
  kind,
  plan,
  displayPrice,
  initialCredits,
  initialLabel,
}: {
  stripePriceId: string;
  kind: string;
  plan: string | null;
  displayPrice: string | null;
  initialCredits: number;
  initialLabel: string | null;
}) {
  const [credits, setCredits] = useState(String(initialCredits));
  const [label, setLabel] = useState(initialLabel ?? "");
  const [savedCredits, setSavedCredits] = useState(String(initialCredits));
  const [savedLabel, setSavedLabel] = useState(initialLabel ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty = credits !== savedCredits || label !== savedLabel;

  const save = async () => {
    setError(null);
    const c = Number(credits);
    if (!Number.isInteger(c) || c < 0) {
      setState("error");
      setError("créditos inteiro ≥ 0");
      return;
    }
    setState("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "catalog",
          stripePriceId,
          credits: c,
          label: label.trim(),
        }),
      });
      if (res.ok) {
        setSavedCredits(String(c));
        setSavedLabel(label.trim());
        setState("saved");
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState("error");
        setError(data.error ?? "falhou");
      }
    } catch {
      setState("error");
      setError("erro de rede");
    }
  };

  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3">
        <p className="font-mono text-label-sm">{plan ?? "—"}</p>
        <p className="font-mono text-[10px] text-text-secondary">
          {kind} · {displayPrice ?? "—"}
        </p>
        <p className="font-mono text-[9px] text-text-secondary/60">
          {stripePriceId}
        </p>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          step={1}
          value={credits}
          onChange={(e) => {
            setCredits(e.target.value);
            setState("idle");
            setError(null);
          }}
          className="w-20 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-label-sm text-text-primary outline-none focus:border-accent-gold/40"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setState("idle");
            setError(null);
          }}
          className="w-full min-w-40 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-label-sm text-text-primary outline-none focus:border-accent-gold/40"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {error ? (
            <span className="font-mono text-[10px] text-red-400">{error}</span>
          ) : (
            <StatusDot state={state} />
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || state === "saving"}
            className="rounded-md border border-accent-gold/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-accent-gold transition-all hover:bg-accent-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Salvar
          </button>
        </div>
      </td>
    </tr>
  );
}
