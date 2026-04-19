"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { X, Loader2, BookOpen, ArrowLeftRight } from "lucide-react";
import { CompareSlider } from "@/components/editor/compare-slider";
import { RecipesDrawer } from "@/components/editor/recipes-drawer";
import { RecipeChip } from "@/components/editor/recipe-chip";
import { useRecipesStore } from "@/stores/recipes-store";
import type { Recipe } from "@/types/recipes";

const ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "3:2", "4:3", "4:5"];
const RESOLUTIONS = ["1K", "2K", "4K"];
const CREDIT_COST: Record<string, number> = { "1K": 1, "2K": 1, "4K": 2 };

function DroppablePromptPanel({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: "recipe-drop" });
  const dragData = active?.data.current as { type?: string } | undefined;
  const isActiveRecipe = dragData?.type === "recipe";
  return (
    <div
      ref={setNodeRef}
      className={`relative w-full rounded-2xl border bg-[#141412] p-3 shadow-2xl transition-colors ${
        isOver && isActiveRecipe
          ? "border-accent-gold/50 ring-2 ring-accent-gold/30"
          : "border-white/10"
      }`}
    >
      {children}
      {isOver && isActiveRecipe && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-accent-gold/5 backdrop-blur-[1px]">
          <span className="rounded-full bg-accent-gold/20 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-accent-gold">
            Solte para anexar receita
          </span>
        </div>
      )}
    </div>
  );
}

export type AssetEditResult = {
  url: string;
  dataUrl?: string;
};

type Props = {
  sourceUrl: string;
  sourceLabel: string;
  initialRecipe?: Recipe | null;
  onClose: () => void;
  onApply: (result: AssetEditResult) => void;
};

export function AssetEditModal({
  sourceUrl,
  sourceLabel,
  initialRecipe = null,
  onClose,
  onApply,
}: Props) {
  const recipesStore = useRecipesStore();
  const { refresh } = recipesStore;
  const [prompt, setPrompt] = useState("");
  const [attachedRecipe, setAttachedRecipe] = useState<Recipe | null>(
    initialRecipe,
  );
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [resolution, setResolution] = useState("1K");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDragRecipe, setActiveDragRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setAttachedRecipe(initialRecipe);
  }, [initialRecipe]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const attachedRecipeCategory = useMemo(
    () =>
      attachedRecipe
        ? recipesStore.categories.find(
            (c) => c.id === attachedRecipe.category_id,
          ) ?? undefined
        : undefined,
    [attachedRecipe, recipesStore.categories],
  );

  const cycleAspectRatio = () => {
    const idx = ASPECT_RATIOS.indexOf(aspectRatio);
    setAspectRatio(ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length]!);
  };
  const cycleResolution = () => {
    const idx = RESOLUTIONS.indexOf(resolution);
    setResolution(RESOLUTIONS[(idx + 1) % RESOLUTIONS.length]!);
  };

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const data = e.active.data.current as
        | { type?: string; recipeId?: string }
        | undefined;
      if (data?.type === "recipe" && data.recipeId) {
        const recipe = recipesStore.recipes.find(
          (r) => r.id === data.recipeId,
        );
        setActiveDragRecipe(recipe ?? null);
      }
    },
    [recipesStore.recipes],
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragRecipe(null);
      const data = e.active.data.current as
        | { type?: string; recipeId?: string }
        | undefined;
      if (data?.type !== "recipe" || !data.recipeId) return;
      if (e.over?.id !== "recipe-drop") return;
      const recipe = recipesStore.recipes.find((r) => r.id === data.recipeId);
      if (recipe) setAttachedRecipe(recipe);
    },
    [recipesStore.recipes],
  );

  const onDragCancel = useCallback(() => {
    setActiveDragRecipe(null);
  }, []);

  const generate = useCallback(async () => {
    if (generating) return;
    const hasRecipe = !!attachedRecipe;
    if (!hasRecipe && !prompt.trim()) return;

    setGenerating(true);
    setError(null);
    try {
      let finalPrompt = prompt.trim();
      if (hasRecipe) {
        const composeRes = await fetch(
          "/api/edit-image/compose-from-recipe",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipeId: attachedRecipe.id,
              targetImageUrl: sourceUrl,
              userHint: prompt.trim() || undefined,
            }),
          },
        );
        if (!composeRes.ok) {
          const err = (await composeRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(err?.error ?? "Falha ao compor receita");
        }
        const data = (await composeRes.json()) as { prompt?: string };
        if (!data.prompt || !data.prompt.trim()) {
          throw new Error("Receita não retornou prompt");
        }
        finalPrompt = data.prompt;
      }

      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          sourceImageUrl: sourceUrl,
          referenceImageUrls: [],
          aspectRatio,
          resolution,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Edit failed");
      }
      const data = await res.json();
      setResultUrl(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setGenerating(false);
    }
  }, [generating, attachedRecipe, prompt, sourceUrl, aspectRatio, resolution]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#0A0A09]/95">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={12} className="text-accent-gold" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent-gold">
              Editar asset
            </p>
            <p className="font-mono text-[10.5px] text-text-secondary">
              · {sourceLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
          {resultUrl ? (
            <CompareSlider originalUrl={sourceUrl} editedUrl={resultUrl} />
          ) : (
            <div className="relative max-h-full max-w-full">
              <Image
                src={sourceUrl}
                alt={sourceLabel}
                width={1280}
                height={960}
                className="max-h-[75vh] w-auto rounded-xl object-contain"
                unoptimized
                draggable={false}
              />
              {generating && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                  <Loader2 size={24} className="animate-spin text-accent-gold" />
                </div>
              )}
            </div>
          )}
        </div>

        {resultUrl && (
          <div className="flex items-center justify-center gap-3 pb-3">
            <button
              onClick={() => onApply({ url: resultUrl })}
              className="rounded-full bg-accent-gold px-5 py-2 font-mono text-label-sm uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80"
            >
              Usar este asset
            </button>
            <button
              onClick={() => setResultUrl(null)}
              className="rounded-full border border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
            >
              Descartar
            </button>
          </div>
        )}

        {!resultUrl && (
          <div className="flex justify-center px-4 pb-6">
            <div className="w-full max-w-2xl">
              <DroppablePromptPanel>
                {attachedRecipe && (
                  <div className="mb-2 flex items-center justify-end">
                    <RecipeChip
                      recipe={attachedRecipe}
                      category={attachedRecipeCategory}
                      onRemove={() => setAttachedRecipe(null)}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDrawerOpen((v) => !v)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                      drawerOpen
                        ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                        : "border-white/10 text-text-secondary hover:border-accent-gold/30 hover:text-accent-gold"
                    }`}
                    title="Abrir receitas"
                  >
                    <BookOpen size={13} />
                  </button>
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) generate();
                    }}
                    placeholder={
                      attachedRecipe
                        ? `Hint opcional para "${attachedRecipe.short_label}"…`
                        : "Descreva a edição do asset…"
                    }
                    className="flex-1 bg-transparent font-mono text-[12px] text-[var(--text)] placeholder:text-text-secondary focus:outline-none"
                  />
                  <button
                    onClick={generate}
                    disabled={
                      generating || (!attachedRecipe && !prompt.trim())
                    }
                    className="shrink-0 rounded-lg bg-accent-gold px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {generating ? "..." : "Gerar"}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cycleAspectRatio}
                      className="font-mono text-[9px] uppercase text-text-secondary transition-colors hover:text-accent-gold"
                    >
                      {aspectRatio}
                    </button>
                    <span className="text-white/10">·</span>
                    <button
                      onClick={cycleResolution}
                      className="font-mono text-[9px] uppercase text-text-secondary transition-colors hover:text-accent-gold"
                    >
                      {resolution}
                    </button>
                  </div>
                  <span className="font-mono text-[9px] text-text-secondary">
                    {CREDIT_COST[resolution] ?? 1} cr.
                  </span>
                </div>

                {error && (
                  <p className="mt-2 font-mono text-[10px] text-red-400">
                    {error}
                  </p>
                )}
              </DroppablePromptPanel>
            </div>
          </div>
        )}

        <RecipesDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          mode="asset"
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragRecipe ? (
          <div
            className="pointer-events-none inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] uppercase tracking-wider shadow-2xl"
            style={{
              backgroundColor: `rgba(var(--rc-${
                recipesStore.categories.find(
                  (c) => c.id === activeDragRecipe.category_id,
                )?.color_token ?? "polish"
              }) / 0.2)`,
              borderColor: `rgba(var(--rc-${
                recipesStore.categories.find(
                  (c) => c.id === activeDragRecipe.category_id,
                )?.color_token ?? "polish"
              }) / 0.6)`,
              color: `rgb(var(--rc-${
                recipesStore.categories.find(
                  (c) => c.id === activeDragRecipe.category_id,
                )?.color_token ?? "polish"
              }))`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: `rgb(var(--rc-${
                  recipesStore.categories.find(
                    (c) => c.id === activeDragRecipe.category_id,
                  )?.color_token ?? "polish"
                }))`,
              }}
            />
            {activeDragRecipe.short_label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
