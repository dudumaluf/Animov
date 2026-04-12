"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useProjectStore } from "@/stores/project-store";
import { ArrowLeft, Download } from "lucide-react";
import { composeVideos, downloadBlob } from "@/lib/composition/compose";

export function EditorToolbar() {
  const { projectName, setProjectName, totalCost, scenes, isGenerating, generateAll, isSaving, isDirty } = useProjectStore();
  const [editing, setEditing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeProgress, setComposeProgress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cost = totalCost();

  const readyScenes = scenes.filter((s) => s.status === "ready" && s.videoUrl);
  const canCompose = readyScenes.length >= 2 && !isGenerating && !composing;

  const handleCompose = async () => {
    if (!canCompose) return;
    setComposing(true);
    setComposeProgress("Preparando...");

    try {
      const clipUrls = readyScenes.map((s) => s.videoUrl!);

      const blob = await composeVideos({
        clipUrls,
        onProgress: (current, total) => {
          if (current < total) {
            setComposeProgress(`Clip ${current + 1}/${total}`);
          } else {
            setComposeProgress("Finalizando...");
          }
        },
      });

      const safeName = projectName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "animov";
      downloadBlob(blob, `${safeName}.webm`);
      setComposeProgress("");
    } catch (err) {
      console.error("[compose]", err);
      setComposeProgress("Erro na composição");
      setTimeout(() => setComposeProgress(""), 3000);
    } finally {
      setComposing(false);
    }
  };

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
          {composing && ` · ${composeProgress}`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-label-sm text-text-secondary">
          Custo: <span className="text-accent-gold">{cost} crédito{cost !== 1 ? "s" : ""}</span>
        </span>

        {canCompose && (
          <button
            onClick={handleCompose}
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-all hover:border-accent-gold/30 hover:text-accent-gold"
          >
            <Download size={12} />
            Exportar
          </button>
        )}

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
