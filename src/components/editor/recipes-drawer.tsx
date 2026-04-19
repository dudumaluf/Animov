"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Pencil,
  Copy,
  Trash2,
  Plus,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useRecipesStore } from "@/stores/recipes-store";
import type {
  Recipe,
  RecipeCategory,
  RecipeProcessingMode,
  RecipeScope,
} from "@/types/recipes";
import { RecipeForm, type RecipeFormValue } from "@/components/admin/recipe-form";

type DrawerMode = "target" | "asset";

function colorStyles(token: RecipeCategory["color_token"]) {
  return {
    bg: `rgba(var(--rc-${token}) / 0.12)`,
    border: `rgba(var(--rc-${token}) / 0.45)`,
    fg: `rgb(var(--rc-${token}))`,
  };
}

function DraggableRecipeCard({
  recipe,
  category,
  isAdmin,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onDuplicate,
  onDelete,
  categories,
  saving,
  errorMessage,
  onQuickAction,
  quickActionLoading,
}: {
  recipe: Recipe;
  category: RecipeCategory | undefined;
  isAdmin: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (value: RecipeFormValue) => Promise<void>;
  onDuplicate: () => void;
  onDelete: () => void;
  categories: RecipeCategory[];
  saving: boolean;
  errorMessage: string | null;
  onQuickAction?: (recipe: Recipe) => void;
  quickActionLoading?: boolean;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `recipe:${recipe.id}`,
    data: { type: "recipe", recipeId: recipe.id },
  });

  const token = category?.color_token ?? "polish";
  const styles = colorStyles(token);

  if (editing) {
    return (
      <div
        className="rounded-lg border border-accent-gold/30 bg-black/30 p-2.5"
        style={{ borderLeftColor: styles.fg, borderLeftWidth: 2 }}
      >
        <RecipeForm
          recipe={recipe}
          categories={categories}
          onSubmit={onSave}
          onCancel={onCancelEdit}
          saving={saving}
          error={errorMessage}
          compact
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group relative cursor-grab touch-none rounded-lg border border-white/5 bg-black/20 p-2.5 transition-opacity active:cursor-grabbing ${
        isDragging ? "opacity-20" : "hover:bg-black/40"
      }`}
      style={{ borderLeftWidth: 2, borderLeftColor: styles.fg }}
      title={recipe.description ?? recipe.display_name}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-wider"
              style={{
                backgroundColor: styles.bg,
                color: styles.fg,
                border: `1px solid ${styles.border}`,
              }}
            >
              {recipe.short_label}
            </span>
            {!recipe.active && (
              <span className="font-mono text-[8px] uppercase text-red-400/70">
                inativa
              </span>
            )}
            {!recipe.user_visible && recipe.active && (
              <span className="font-mono text-[8px] uppercase text-amber-400/70">
                oculta
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-mono text-[10.5px] text-white">
            {recipe.display_name}
          </p>
          {recipe.description && (
            <p className="mt-0.5 line-clamp-1 font-mono text-[9.5px] text-text-secondary">
              {recipe.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onQuickAction && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction(recipe);
              }}
              disabled={quickActionLoading}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-accent-gold disabled:opacity-40"
              title="Aplicar no asset"
            >
              {quickActionLoading ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <span className="font-mono text-[10px]">↓</span>
              )}
            </button>
          )}
          {isAdmin && (
            <>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary opacity-0 transition-opacity hover:bg-white/5 hover:text-white group-hover:opacity-100"
                title="Editar"
              >
                <Pencil size={10} />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary opacity-0 transition-opacity hover:bg-white/5 hover:text-white group-hover:opacity-100"
                title="Duplicar"
              >
                <Copy size={10} />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary opacity-0 transition-opacity hover:bg-white/5 hover:text-red-400 group-hover:opacity-100"
                title="Excluir (soft)"
              >
                <Trash2 size={10} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  mode: DrawerMode;
  onQuickAction?: (recipe: Recipe) => void;
  quickActionRecipeId?: string | null;
};

export function RecipesDrawer({
  open,
  onClose,
  mode,
  onQuickAction,
  quickActionRecipeId,
}: Props) {
  const {
    categories,
    recipes,
    loading,
    error,
    isAdmin,
    loadedAt,
    refresh,
    upsertRecipe,
    removeRecipe,
    upsertCategory,
    removeCategory,
  } = useRecipesStore();

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [creatingCategoryId, setCreatingCategoryId] = useState<string | null>(
    null,
  );
  const [adminMode, setAdminMode] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!loadedAt) {
      void refresh({ admin: adminMode && isAdmin });
    }
  }, [open, loadedAt, refresh, adminMode, isAdmin]);

  useEffect(() => {
    if (!open) return;
    if (categories.length === 0) return;
    setExpanded((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      categories.forEach((c) => {
        next[c.id] = true;
      });
      return next;
    });
  }, [open, categories]);

  const scopes: RecipeScope[] = useMemo(
    () => (mode === "asset" ? ["asset", "any"] : ["target", "any"]),
    [mode],
  );

  const visibleCategories = useMemo(() => {
    return categories.filter((c) => (adminMode && isAdmin) || c.active);
  }, [categories, adminMode, isAdmin]);

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (!scopes.includes(r.scope)) return false;
      if (!adminMode && (!r.active || !r.user_visible)) return false;
      if (!q) return true;
      return (
        r.display_name.toLowerCase().includes(q) ||
        r.short_label.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q)
      );
    });
  }, [recipes, scopes, query, adminMode]);

  const recipesByCategory = useMemo(() => {
    const map = new Map<string, Recipe[]>();
    visibleCategories.forEach((c) => map.set(c.id, []));
    for (const r of filteredRecipes) {
      if (!map.has(r.category_id)) map.set(r.category_id, []);
      map.get(r.category_id)!.push(r);
    }
    return map;
  }, [visibleCategories, filteredRecipes]);

  const handleSaveRecipe = async (
    recipeId: string | null,
    value: RecipeFormValue,
  ) => {
    setSavingId(recipeId ?? "new");
    setSaveError(null);
    try {
      const endpoint = recipeId
        ? `/api/admin/recipes/${recipeId}`
        : "/api/admin/recipes";
      const method = recipeId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const body = (await res.json().catch(() => null)) as {
        recipe?: Recipe;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? `Save failed (${res.status})`);
      if (body?.recipe) upsertRecipe(body.recipe);
      setEditingRecipeId(null);
      setCreatingCategoryId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDuplicate = async (recipe: Recipe) => {
    setSavingId(recipe.id);
    try {
      const res = await fetch(`/api/admin/recipes/${recipe.id}/duplicate`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as {
        recipe?: Recipe;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? `Duplicate failed`);
      if (body?.recipe) {
        upsertRecipe(body.recipe);
        setEditingRecipeId(body.recipe.id);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (recipe: Recipe) => {
    if (!window.confirm(`Desativar receita "${recipe.display_name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/recipes/${recipe.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Delete failed");
      }
      removeRecipe(recipe.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingId("new-category");
    try {
      const res = await fetch("/api/admin/recipes/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          color_token: "polish",
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        category?: RecipeCategory;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Create failed");
      if (body?.category) upsertCategory(body.category);
      setNewCategoryName("");
      setShowCategoryForm(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteCategory = async (category: RecipeCategory) => {
    if (
      !window.confirm(
        `Desativar categoria "${category.display_name}" e todas as receitas dela?`,
      )
    )
      return;
    try {
      const res = await fetch(
        `/api/admin/recipes/categories/${category.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Delete failed");
      }
      removeCategory(category.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const totalVisible = Array.from(recipesByCategory.values()).reduce(
    (acc, arr) => acc + arr.length,
    0,
  );

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-y-0 right-0 z-40 w-[360px] transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <aside className="pointer-events-auto flex h-full flex-col border-l border-white/10 bg-[#141412] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-accent-gold">
                Receitas
              </p>
              <p className="font-mono text-[10px] text-text-secondary">
                {totalVisible} disponíveis · {mode === "asset" ? "asset" : "cena"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
              title="Fechar"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 px-4 py-3">
            <div className="relative flex-1">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar receita…"
                className="w-full rounded-md border border-white/10 bg-black/30 py-1.5 pl-7 pr-2 font-mono text-[10.5px] text-white placeholder:text-text-secondary focus:border-accent-gold/40 focus:outline-none"
              />
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  const next = !adminMode;
                  setAdminMode(next);
                  void refresh({ force: true, admin: next });
                }}
                className={`flex h-7 items-center gap-1 rounded-md border px-2 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                  adminMode
                    ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                    : "border-white/10 text-text-secondary hover:text-white"
                }`}
                title="Ver receitas inativas/ocultas"
              >
                {adminMode ? <Eye size={10} /> : <EyeOff size={10} />}
                admin
              </button>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 px-4 pb-2">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryForm(true);
                }}
                className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-mono text-[9.5px] uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
              >
                <Plus size={10} />
                categoria
              </button>
              <button
                type="button"
                onClick={() => {
                  const first = visibleCategories[0];
                  if (first) {
                    setExpanded((p) => ({ ...p, [first.id]: true }));
                    setCreatingCategoryId(first.id);
                    setEditingRecipeId(null);
                  }
                }}
                disabled={visibleCategories.length === 0}
                className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-mono text-[9.5px] uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold disabled:opacity-30"
              >
                <Plus size={10} />
                receita
              </button>
            </div>
          )}

          {showCategoryForm && isAdmin && (
            <div className="mx-4 mb-2 rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-[10.5px] text-white focus:border-accent-gold/40 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateCategory();
                    if (e.key === "Escape") setShowCategoryForm(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleCreateCategory()}
                  disabled={!newCategoryName.trim()}
                  className="rounded-md bg-accent-gold px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-[#0D0D0B] disabled:opacity-40"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setNewCategoryName("");
                  }}
                  className="rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {loading && recipes.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-accent-gold" />
              </div>
            ) : error ? (
              <p className="py-4 text-center font-mono text-[10px] text-red-400">
                {error}
              </p>
            ) : totalVisible === 0 ? (
              <p className="py-6 text-center font-mono text-[10px] text-text-secondary">
                Nenhuma receita para este escopo.
              </p>
            ) : (
              visibleCategories.map((category) => {
                const items = recipesByCategory.get(category.id) ?? [];
                if (items.length === 0 && !adminMode) return null;
                const isOpen = expanded[category.id] ?? true;
                const styles = colorStyles(category.color_token);
                const isCreating = creatingCategoryId === category.id;

                return (
                  <div key={category.id} className="mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((p) => ({
                          ...p,
                          [category.id]: !isOpen,
                        }))
                      }
                      className="group mb-1.5 flex w-full items-center gap-1.5 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown size={11} className="text-text-secondary" />
                      ) : (
                        <ChevronRight size={11} className="text-text-secondary" />
                      )}
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: styles.fg }}
                      />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">
                        {category.display_name}
                      </span>
                      <span className="ml-auto font-mono text-[9px] text-text-secondary">
                        {items.length}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteCategory(category);
                          }}
                          className="hidden h-5 w-5 items-center justify-center rounded text-text-secondary opacity-0 hover:text-red-400 group-hover:flex group-hover:opacity-100"
                          title="Excluir categoria"
                        >
                          <Trash2 size={9} />
                        </button>
                      )}
                    </button>

                    {isOpen && (
                      <div className="space-y-1.5">
                        {isAdmin && isCreating && (
                          <div
                            className="rounded-lg border border-accent-gold/30 bg-black/30 p-2.5"
                            style={{
                              borderLeftColor: styles.fg,
                              borderLeftWidth: 2,
                            }}
                          >
                            <RecipeForm
                              recipe={null}
                              categories={visibleCategories}
                              defaultCategoryId={category.id}
                              onSubmit={(v) => handleSaveRecipe(null, v)}
                              onCancel={() => setCreatingCategoryId(null)}
                              saving={savingId === "new"}
                              error={saveError}
                              compact
                            />
                          </div>
                        )}
                        {items.map((recipe) => (
                          <DraggableRecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            category={category}
                            isAdmin={isAdmin}
                            editing={editingRecipeId === recipe.id}
                            onEdit={() => {
                              setEditingRecipeId(recipe.id);
                              setCreatingCategoryId(null);
                            }}
                            onCancelEdit={() => setEditingRecipeId(null)}
                            onSave={(v) => handleSaveRecipe(recipe.id, v)}
                            onDuplicate={() => void handleDuplicate(recipe)}
                            onDelete={() => void handleDelete(recipe)}
                            categories={visibleCategories}
                            saving={savingId === recipe.id}
                            errorMessage={
                              savingId === recipe.id ? saveError : null
                            }
                            onQuickAction={onQuickAction}
                            quickActionLoading={
                              quickActionRecipeId === recipe.id
                            }
                          />
                        ))}
                        {isAdmin && !isCreating && (
                          <button
                            type="button"
                            onClick={() => {
                              setCreatingCategoryId(category.id);
                              setEditingRecipeId(null);
                            }}
                            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-white/10 py-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/30 hover:text-accent-gold"
                          >
                            <Plus size={10} />
                            nova receita
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {saveError && (
            <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-2">
              <p className="font-mono text-[10px] text-red-400">{saveError}</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

export type { DrawerMode, RecipeProcessingMode };
