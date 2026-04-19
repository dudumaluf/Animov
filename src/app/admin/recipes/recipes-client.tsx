"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { RecipeForm, type RecipeFormValue } from "@/components/admin/recipe-form";
import type {
  Recipe,
  RecipeCategory,
  RecipeColorToken,
} from "@/types/recipes";

const COLOR_TOKENS: RecipeColorToken[] = [
  "time",
  "polish",
  "staging",
  "material",
  "asset",
];

type Props = {
  initialCategories: RecipeCategory[];
  initialRecipes: Recipe[];
};

export function AdminRecipesClient({
  initialCategories,
  initialRecipes,
}: Props) {
  const [categories, setCategories] = useState<RecipeCategory[]>(initialCategories);
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">(
    initialCategories[0]?.id ?? "all",
  );
  const [query, setQuery] = useState("");
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryDraft, setNewCategoryDraft] = useState<{
    display_name: string;
    color_token: RecipeColorToken;
  }>({ display_name: "", color_token: "polish" });

  useEffect(() => {
    if (
      selectedCategoryId !== "all" &&
      !categories.some((c) => c.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(categories[0]?.id ?? "all");
    }
  }, [categories, selectedCategoryId]);

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (selectedCategoryId !== "all" && r.category_id !== selectedCategoryId)
        return false;
      if (!q) return true;
      return (
        r.display_name.toLowerCase().includes(q) ||
        r.short_label.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    });
  }, [recipes, selectedCategoryId, query]);

  const upsertRecipe = (recipe: Recipe) => {
    setRecipes((prev) => {
      const idx = prev.findIndex((r) => r.id === recipe.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = recipe;
        return next;
      }
      return [...prev, recipe];
    });
  };

  const removeRecipe = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  const upsertCategory = (category: RecipeCategory) => {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === category.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = category;
        return next;
      }
      return [...prev, category];
    });
  };

  const removeCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setRecipes((prev) => prev.filter((r) => r.category_id !== id));
  };

  const handleSaveRecipe = async (
    recipeId: string | null,
    value: RecipeFormValue,
  ) => {
    setSavingId(recipeId ?? "new");
    setError(null);
    try {
      const endpoint = recipeId
        ? `/api/admin/recipes/${recipeId}`
        : "/api/admin/recipes";
      const res = await fetch(endpoint, {
        method: recipeId ? "PATCH" : "POST",
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
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
      if (!res.ok) throw new Error(body?.error ?? "Duplicate failed");
      if (body?.recipe) {
        upsertRecipe(body.recipe);
        setEditingRecipeId(body.recipe.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (recipe: Recipe, hard = false) => {
    if (
      !window.confirm(
        hard
          ? `Excluir definitivamente "${recipe.display_name}"?`
          : `Desativar "${recipe.display_name}"?`,
      )
    )
      return;
    try {
      const endpoint = hard
        ? `/api/admin/recipes/${recipe.id}?hard=1`
        : `/api/admin/recipes/${recipe.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Delete failed");
      }
      if (hard) removeRecipe(recipe.id);
      else upsertRecipe({ ...recipe, active: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryDraft.display_name.trim()) return;
    setSavingId("new-category");
    try {
      const res = await fetch("/api/admin/recipes/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCategoryDraft),
      });
      const body = (await res.json().catch(() => null)) as {
        category?: RecipeCategory;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Create failed");
      if (body?.category) {
        upsertCategory(body.category);
        setSelectedCategoryId(body.category.id);
      }
      setNewCategoryDraft({ display_name: "", color_token: "polish" });
      setCreatingCategory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveCategory = async (category: RecipeCategory) => {
    setSavingId(category.id);
    try {
      const res = await fetch(`/api/admin/recipes/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(category),
      });
      const body = (await res.json().catch(() => null)) as {
        category?: RecipeCategory;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Save failed");
      if (body?.category) upsertCategory(body.category);
      setEditingCategoryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteCategory = async (category: RecipeCategory) => {
    if (
      !window.confirm(
        `Desativar categoria "${category.display_name}" (e receitas associadas)?`,
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
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const togglePatch = async (
    recipe: Recipe,
    field: "active" | "user_visible",
  ) => {
    const res = await fetch(`/api/admin/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !recipe[field] }),
    });
    const body = (await res.json().catch(() => null)) as {
      recipe?: Recipe;
      error?: string;
    } | null;
    if (!res.ok) {
      setError(body?.error ?? "Toggle failed");
      return;
    }
    if (body?.recipe) upsertRecipe(body.recipe);
  };

  const formInitialCategoryId =
    selectedCategoryId === "all" ? categories[0]?.id : selectedCategoryId;

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-white">Receitas</h1>
          <p className="font-mono text-[11px] text-text-secondary">
            Prompts reutilizáveis · {recipes.length} receitas em{" "}
            {categories.length} categorias
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-56 rounded-md border border-white/10 bg-black/30 py-1.5 pl-7 pr-2 font-mono text-[11px] text-white placeholder:text-text-secondary focus:border-accent-gold/40 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingRecipeId(null);
            }}
            className="flex items-center gap-1 rounded-md bg-accent-gold px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80"
          >
            <Plus size={11} /> Nova receita
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="font-mono text-[11px] text-red-400">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-1 rounded-xl border border-white/5 bg-[#141412] p-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-secondary">
              Categorias
            </span>
            <button
              type="button"
              onClick={() => setCreatingCategory(true)}
              className="flex h-5 w-5 items-center justify-center rounded text-text-secondary transition-colors hover:text-accent-gold"
              title="Nova categoria"
            >
              <Plus size={10} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCategoryId("all")}
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 font-mono text-[11px] transition-colors ${
              selectedCategoryId === "all"
                ? "bg-accent-gold/10 text-accent-gold"
                : "text-text-secondary hover:bg-white/5"
            }`}
          >
            Todas
            <span className="font-mono text-[9px]">{recipes.length}</span>
          </button>
          {categories.map((c) => {
            const count = recipes.filter((r) => r.category_id === c.id).length;
            const active = selectedCategoryId === c.id;
            const isEditing = editingCategoryId === c.id;

            if (isEditing) {
              return (
                <div
                  key={c.id}
                  className="rounded-md border border-accent-gold/30 bg-black/30 p-2"
                >
                  <input
                    className="mb-1 w-full rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-white focus:outline-none"
                    value={c.display_name}
                    onChange={(e) =>
                      upsertCategory({ ...c, display_name: e.target.value })
                    }
                  />
                  <select
                    className="mb-2 w-full rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-white focus:outline-none"
                    value={c.color_token}
                    onChange={(e) =>
                      upsertCategory({
                        ...c,
                        color_token: e.target.value as RecipeColorToken,
                      })
                    }
                  >
                    {COLOR_TOKENS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingCategoryId(null)}
                      className="rounded px-2 py-1 font-mono text-[9px] uppercase text-text-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={savingId === c.id}
                      onClick={() => void handleSaveCategory(c)}
                      className="rounded bg-accent-gold px-2 py-1 font-mono text-[9px] uppercase text-[#0D0D0B] disabled:opacity-40"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={c.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`flex flex-1 items-center justify-between rounded-md px-2 py-1.5 font-mono text-[11px] transition-colors ${
                    active
                      ? "bg-accent-gold/10 text-accent-gold"
                      : "text-text-secondary hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: `rgb(var(--rc-${c.color_token}))`,
                      }}
                    />
                    {c.display_name}
                  </span>
                  <span className="font-mono text-[9px]">{count}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategoryId(c.id)}
                  className="hidden h-5 w-5 items-center justify-center rounded text-text-secondary opacity-0 hover:text-white group-hover:flex group-hover:opacity-100"
                  title="Editar"
                >
                  <Pencil size={9} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteCategory(c)}
                  className="hidden h-5 w-5 items-center justify-center rounded text-text-secondary opacity-0 hover:text-red-400 group-hover:flex group-hover:opacity-100"
                  title="Excluir"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            );
          })}

          {creatingCategory && (
            <div className="mt-2 rounded-md border border-accent-gold/30 bg-black/30 p-2">
              <input
                autoFocus
                value={newCategoryDraft.display_name}
                onChange={(e) =>
                  setNewCategoryDraft((v) => ({
                    ...v,
                    display_name: e.target.value,
                  }))
                }
                placeholder="Nome"
                className="mb-1 w-full rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-white focus:outline-none"
              />
              <select
                value={newCategoryDraft.color_token}
                onChange={(e) =>
                  setNewCategoryDraft((v) => ({
                    ...v,
                    color_token: e.target.value as RecipeColorToken,
                  }))
                }
                className="mb-2 w-full rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-white focus:outline-none"
              >
                {COLOR_TOKENS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCreatingCategory(false);
                    setNewCategoryDraft({
                      display_name: "",
                      color_token: "polish",
                    });
                  }}
                  className="rounded px-2 py-1 font-mono text-[9px] uppercase text-text-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    savingId === "new-category" ||
                    !newCategoryDraft.display_name.trim()
                  }
                  onClick={() => void handleCreateCategory()}
                  className="rounded bg-accent-gold px-2 py-1 font-mono text-[9px] uppercase text-[#0D0D0B] disabled:opacity-40"
                >
                  Criar
                </button>
              </div>
            </div>
          )}
        </aside>

        <section className="space-y-3">
          {creating && (
            <div className="rounded-xl border border-accent-gold/30 bg-[#141412] p-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-gold">
                Nova receita
              </p>
              <RecipeForm
                recipe={null}
                categories={categories}
                defaultCategoryId={formInitialCategoryId}
                onSubmit={(v) => handleSaveRecipe(null, v)}
                onCancel={() => setCreating(false)}
                saving={savingId === "new"}
                error={error}
              />
            </div>
          )}

          {filteredRecipes.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#141412] p-8 text-center font-mono text-[11px] text-text-secondary">
              Nenhuma receita nesta categoria ainda.
            </div>
          ) : (
            filteredRecipes.map((recipe) => {
              const category = categories.find(
                (c) => c.id === recipe.category_id,
              );
              const editing = editingRecipeId === recipe.id;
              if (editing) {
                return (
                  <div
                    key={recipe.id}
                    className="rounded-xl border border-accent-gold/30 bg-[#141412] p-4"
                  >
                    <RecipeForm
                      recipe={recipe}
                      categories={categories}
                      onSubmit={(v) => handleSaveRecipe(recipe.id, v)}
                      onCancel={() => setEditingRecipeId(null)}
                      saving={savingId === recipe.id}
                      error={error}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={recipe.id}
                  className="rounded-xl border border-white/5 bg-[#141412] p-3"
                  style={{
                    borderLeftWidth: 2,
                    borderLeftColor: `rgb(var(--rc-${category?.color_token ?? "polish"}))`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-wider"
                          style={{
                            backgroundColor: `rgba(var(--rc-${category?.color_token ?? "polish"}) / 0.12)`,
                            color: `rgb(var(--rc-${category?.color_token ?? "polish"}))`,
                            border: `1px solid rgba(var(--rc-${category?.color_token ?? "polish"}) / 0.45)`,
                          }}
                        >
                          {recipe.short_label}
                        </span>
                        <p className="truncate font-mono text-[12px] text-white">
                          {recipe.display_name}
                        </p>
                        <span className="shrink-0 font-mono text-[9px] uppercase text-text-secondary">
                          {recipe.scope} · {recipe.processing_mode}
                        </span>
                      </div>
                      {recipe.description && (
                        <p className="mt-0.5 line-clamp-1 font-mono text-[10px] text-text-secondary">
                          {recipe.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void togglePatch(recipe, "active")}
                        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                          recipe.active
                            ? "text-green-400"
                            : "text-text-secondary"
                        } hover:bg-white/5`}
                        title={recipe.active ? "Ativa" : "Inativa"}
                      >
                        {recipe.active ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void togglePatch(recipe, "user_visible")}
                        className={`flex h-7 w-7 items-center justify-center rounded-md font-mono text-[9px] uppercase transition-colors ${
                          recipe.user_visible
                            ? "text-accent-gold"
                            : "text-text-secondary"
                        } hover:bg-white/5`}
                        title={
                          recipe.user_visible ? "Visível pelo user" : "Oculta"
                        }
                      >
                        user
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRecipeId(recipe.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
                        title="Editar"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDuplicate(recipe)}
                        disabled={savingId === recipe.id}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
                        title="Duplicar"
                      >
                        {savingId === recipe.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(recipe)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Desativar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
