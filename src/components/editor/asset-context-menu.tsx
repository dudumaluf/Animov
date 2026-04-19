"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import type { Recipe, RecipeCategory } from "@/types/recipes";

type Props = {
  x: number;
  y: number;
  quickRecipes: Recipe[];
  categoriesById: Map<string, RecipeCategory>;
  runningRecipeId?: string | null;
  onQuickAction: (recipe: Recipe) => void;
  onOpenEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
};

export function AssetContextMenu({
  x,
  y,
  quickRecipes,
  categoriesById,
  runningRecipeId,
  onQuickAction,
  onOpenEdit,
  onRemove,
  onClose,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} />
      <div
        className="fixed z-[71] min-w-[200px] overflow-hidden rounded-lg border border-white/10 bg-[#141412] py-1 shadow-2xl"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        {quickRecipes.length > 0 && (
          <>
            <p className="px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">
              Aplicar receita
            </p>
            {quickRecipes.map((recipe) => {
              const category = categoriesById.get(recipe.category_id);
              const token = category?.color_token ?? "polish";
              const running = runningRecipeId === recipe.id;
              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onQuickAction(recipe)}
                  disabled={running}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] text-white transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: `rgb(var(--rc-${token}))` }}
                  />
                  <span className="flex-1 truncate">{recipe.display_name}</span>
                  {running ? (
                    <Loader2 size={10} className="animate-spin text-accent-gold" />
                  ) : (
                    <span
                      className="font-mono text-[8.5px] uppercase tracking-wider"
                      style={{ color: `rgb(var(--rc-${token}))` }}
                    >
                      {recipe.short_label}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="my-1 border-t border-white/5" />
          </>
        )}
        <button
          type="button"
          onClick={onOpenEdit}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] text-white transition-colors hover:bg-white/5"
        >
          <Pencil size={11} />
          Editar asset…
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10.5px] text-red-400 transition-colors hover:bg-red-500/10"
        >
          <Trash2 size={11} />
          Remover
        </button>
      </div>
    </>,
    document.body,
  );
}
