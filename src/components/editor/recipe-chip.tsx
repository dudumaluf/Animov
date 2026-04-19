"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Info } from "lucide-react";
import type { Recipe, RecipeCategory } from "@/types/recipes";

type RecipeChipProps = {
  recipe: Recipe;
  category: RecipeCategory | undefined;
  onRemove: () => void;
};

export function RecipeChip({ recipe, category, onRemove }: RecipeChipProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPos, setDetailPos] = useState<{ x: number; y: number } | null>(null);

  const token = category?.color_token ?? "polish";

  const style: React.CSSProperties = {
    backgroundColor: `rgba(var(--rc-${token}) / 0.12)`,
    borderColor: `rgba(var(--rc-${token}) / 0.45)`,
    color: `rgb(var(--rc-${token}))`,
  };

  return (
    <>
      <div
        className="group relative inline-flex h-9 max-w-[180px] items-center gap-1.5 rounded-full border px-2.5 pr-1.5 transition-opacity"
        style={style}
        title={recipe.display_name}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
            setDetailPos({ x: rect.left, y: rect.bottom + 6 });
            setDetailOpen(true);
          }}
          className="flex items-center gap-1.5 truncate text-left"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: `rgb(var(--rc-${token}))` }}
          />
          <span className="truncate font-mono text-[10px] uppercase tracking-wider">
            {recipe.short_label}
          </span>
          <Info size={9} className="shrink-0 opacity-60" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/40"
          title="Remover receita"
        >
          <X size={10} />
        </button>
      </div>

      {detailOpen && detailPos && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setDetailOpen(false)}
              />
              <div
                className="fixed z-[61] w-[320px] rounded-xl border border-white/10 bg-[#141412] p-3 shadow-2xl"
                style={{ left: detailPos.x, top: detailPos.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `rgb(var(--rc-${token}))` }}
                  />
                  <p className="font-mono text-[11px] font-semibold text-white">
                    {recipe.display_name}
                  </p>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-text-secondary">
                    {recipe.processing_mode}
                  </span>
                </div>
                {recipe.description && (
                  <p className="mb-2 font-mono text-[10px] leading-relaxed text-text-secondary">
                    {recipe.description}
                  </p>
                )}
                {recipe.vision_system_prompt && (
                  <div className="mb-2">
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-accent-gold/60">
                      System
                    </p>
                    <p className="max-h-24 overflow-auto font-mono text-[9.5px] leading-relaxed text-text-secondary">
                      {recipe.vision_system_prompt}
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-accent-gold/60">
                    Template
                  </p>
                  <p className="max-h-24 overflow-auto font-mono text-[9.5px] leading-relaxed text-text-secondary">
                    {recipe.prompt_template}
                  </p>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
