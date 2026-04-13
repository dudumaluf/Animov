"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useProjectStore } from "@/stores/project-store";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";

export function EditorToolbar() {
  const { projectName, setProjectName, totalCost, scenes, isGenerating, generateAll, isSaving, isDirty } = useProjectStore();
  const [editing, setEditing] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cost = totalCost();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from("credits")
          .select("balance")
          .eq("user_id", data.user.id)
          .single()
          .then(({ data: credits }) => {
            if (credits) setCreditBalance(credits.balance);
          });
      }
    });
  }, [isGenerating]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 px-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
        >
          <ArrowLeft size={16} />
        </Link>

        {editing ? (
          <input
            ref={inputRef}
            defaultValue={projectName}
            onBlur={(e) => {
              setProjectName(e.target.value || "Novo Projeto");
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="bg-transparent font-display text-lg outline-none ring-1 ring-white/10 rounded px-2 py-0.5"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-display text-lg hover:text-accent-gold transition-colors"
          >
            {projectName}
          </button>
        )}

        <span className="font-mono text-label-xs text-text-secondary">
          {scenes.length} {scenes.length === 1 ? "cena" : "cenas"}
          {isSaving && " · Salvando..."}
          {!isSaving && isDirty && " · Não salvo"}
          {!isSaving && !isDirty && scenes.length > 0 && " · Salvo"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {creditBalance !== null && (
          <span className="font-mono text-label-sm text-text-secondary">
            <span className="text-accent-gold">{creditBalance}</span> cr.
          </span>
        )}

        <span className="font-mono text-[10px] text-text-secondary">
          Custo: <span className="text-[var(--text)]">{cost}</span>
        </span>

        <button
          disabled={scenes.length === 0 || isGenerating}
          onClick={() => generateAll()}
          className="rounded-full bg-accent-gold px-5 py-2 font-mono text-label-sm uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isGenerating ? "Gerando..." : "Gerar vídeo"}
        </button>
      </div>
    </header>
  );
}
