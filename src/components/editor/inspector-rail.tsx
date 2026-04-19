"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Clapperboard, Loader2, Scissors, Sparkles, X } from "lucide-react";

import { useProjectStore } from "@/stores/project-store";
import { useEditorSettingsStore } from "@/stores/editor-settings-store";
import { Inspector } from "./inspector";

type InspectorRailProps = {
  onPreviewVideo?: (url: string) => void;
  onExport?: () => void;
  onDownloadLast?: () => void;
  onEditImage?: (sceneId: string) => void;
};

/**
 * InspectorRail
 * -------------
 * Modo "railed" do inspector: uma coluna de 44px à direita, com ícones
 * sumarizando o estado da seleção. Ao clicar no rail, abre-se um overlay
 * temporário à esquerda do rail com o inspector completo. Click fora
 * fecha o overlay. Isso permite manter o layout compacto sem perder
 * nenhuma funcionalidade: o Inspector é reutilizado tal e qual.
 */
export function InspectorRail({
  onPreviewVideo,
  onExport,
  onDownloadLast,
  onEditImage,
}: InspectorRailProps) {
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
  const scene = useProjectStore((s) => s.scenes.find((sc) => sc.id === s.selectedSceneId));
  const isGenerating = useProjectStore((s) => s.isGenerating);
  const setInspectorDensity = useEditorSettingsStore((s) => s.setInspectorDensity);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const railRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const hasSelection = !!selectedSceneId || editNodeSelected;

  useEffect(() => {
    if (!hasSelection) setOverlayOpen(false);
  }, [hasSelection]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOverlayOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (overlayRef.current?.contains(target)) return;
      if (railRef.current?.contains(target)) return;
      setOverlayOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [overlayOpen]);

  let statusDot: "idle" | "ready" | "processing" | "error" = "idle";
  if (scene) {
    if (scene.status === "processing" || scene.status === "generating") statusDot = "processing";
    else if (scene.status === "ready") statusDot = "ready";
    else if (scene.status === "failed") statusDot = "error";
  }

  const statusColor =
    statusDot === "ready"
      ? "bg-emerald-400"
      : statusDot === "processing"
        ? "bg-accent-gold"
        : statusDot === "error"
          ? "bg-red-400"
          : "bg-white/25";

  return (
    <>
      <aside
        ref={railRef}
        className="flex w-11 shrink-0 flex-col items-center gap-3 border-l border-white/5 bg-[#0A0A09] py-3"
      >
        <button
          type="button"
          onClick={() => hasSelection && setOverlayOpen((v) => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
            hasSelection
              ? "border-white/10 bg-white/5 text-white hover:border-accent-gold/40 hover:text-accent-gold"
              : "border-white/5 bg-transparent text-white/20"
          }`}
          title={
            hasSelection
              ? overlayOpen
                ? "Fechar inspector"
                : "Abrir inspector"
              : "Selecione um node"
          }
          aria-label="Alternar inspector"
          disabled={!hasSelection}
        >
          {overlayOpen ? <X size={14} /> : <ChevronRight size={14} />}
        </button>

        <div
          className={`h-1.5 w-1.5 rounded-full ${statusColor} ${
            statusDot === "processing" ? "animate-pulse" : ""
          }`}
          aria-hidden
        />

        {scene && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 font-mono text-[9px] text-text-secondary"
            title={`Cena ${scene.id.slice(0, 4)}`}
          >
            <Clapperboard size={10} />
          </div>
        )}

        {editNodeSelected && !selectedSceneId && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 font-mono text-[9px] text-text-secondary"
            title="Edit final"
          >
            <Scissors size={10} />
          </div>
        )}

        {isGenerating && (
          <div className="flex h-6 w-6 items-center justify-center text-accent-gold" title="Gerando…" aria-hidden>
            <Loader2 size={12} className="animate-spin" />
          </div>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setInspectorDensity("full")}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-white/5 bg-transparent text-white/30 transition-colors hover:text-white"
          title="Expandir inspector"
          aria-label="Expandir inspector"
        >
          <Sparkles size={10} />
        </button>
      </aside>

      {overlayOpen && hasSelection && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={overlayRef}
              className="pointer-events-auto fixed right-11 top-[44px] bottom-0 z-50 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-right-2 duration-150"
            >
              <Inspector
                onPreviewVideo={onPreviewVideo}
                onExport={onExport}
                onDownloadLast={onDownloadLast}
                onEditImage={onEditImage}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
