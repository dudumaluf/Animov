"use client";

import { create } from "zustand";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Images, Layers, X } from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { ReferenceDistributeStep } from "@/components/editor/reference-distribute-step";

/**
 * Tiny store that backs the import-choice modal. Kept separate from the
 * project store so the modal can be mounted once globally and any import entry
 * point (drop-zone, toolbar, film-strip "+") can trigger it via
 * `beginPhotoImport` without prop drilling.
 */
type ImportChoiceState = {
  files: File[] | null;
  open: (files: File[]) => void;
  close: () => void;
};

export const useImportChoiceStore = create<ImportChoiceState>((set) => ({
  files: null,
  open: (files) => set({ files }),
  close: () => set({ files: null }),
}));

/**
 * Shared entry point for importing photos. A single image keeps today's
 * behaviour (one scene per photo). Two or more images prompt the user to
 * choose between independent scenes and a single reference group node.
 */
export function beginPhotoImport(files: File[]) {
  const images = files.filter((f) => f.type.startsWith("image/"));
  if (images.length === 0) return;
  if (images.length === 1) {
    useProjectStore.getState().addPhotos(images);
    return;
  }
  useImportChoiceStore.getState().open(images);
}

export function ImportChoiceModal() {
  const files = useImportChoiceStore((s) => s.files);
  const close = useImportChoiceStore((s) => s.close);
  const [step, setStep] = useState<"choice" | "distribute">("choice");

  // Reset to the first step whenever a new import batch arrives.
  useEffect(() => {
    setStep("choice");
  }, [files]);

  useEffect(() => {
    if (!files) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [files, close]);

  if (!files || typeof document === "undefined") return null;
  const count = files.length;

  const chooseIndependent = () => {
    useProjectStore.getState().addPhotos(files);
    close();
  };

  const confirmGroups = (chunks: File[][]) => {
    useProjectStore.getState().createReferenceGroups(chunks);
    close();
  };

  if (step === "distribute") {
    return createPortal(
      <div
        className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
        onClick={close}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <ReferenceDistributeStep
            files={files}
            onBack={() => setStep("choice")}
            onConfirm={confirmGroups}
          />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-[min(94vw,42rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#141413] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <p className="font-mono text-label-sm uppercase tracking-widest text-white/80">
              Importar {count} imagens
            </p>
            <p className="mt-1 text-xs text-white/45">
              Como você quer usar essas imagens?
            </p>
          </div>
          <button
            onClick={close}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2">
          <button
            onClick={chooseIndependent}
            className="group flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-colors group-hover:text-white">
              <Images size={18} />
            </div>
            <div>
              <p className="font-mono text-sm text-[var(--text)]">Cenas independentes</p>
              <p className="mt-1 text-xs leading-snug text-white/45">
                {count} cenas separadas, uma por foto. Cada uma vira um clipe.
              </p>
            </div>
          </button>

          <button
            onClick={() => setStep("distribute")}
            className="group flex flex-col gap-3 rounded-xl border border-accent-gold/20 bg-accent-gold/[0.04] p-5 text-left transition-colors hover:border-accent-gold/40 hover:bg-accent-gold/[0.08]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold">
              <Layers size={18} />
            </div>
            <div>
              <p className="font-mono text-sm text-[var(--text)]">
                Grupo{count > 9 ? "s" : ""} de referência
              </p>
              <p className="mt-1 text-xs leading-snug text-white/45">
                {count > 9
                  ? "A IA compõe um vídeo cinematográfico por grupo. Você organiza as fotos em grupos de até 9 no próximo passo."
                  : "Um node de referência. A IA descreve cada imagem e compõe um vídeo cinematográfico — dá pra dividir em vários no próximo passo."}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
