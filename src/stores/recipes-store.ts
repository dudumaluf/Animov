"use client";

import { create } from "zustand";
import type { Recipe, RecipeCategory } from "@/types/recipes";

type RecipesState = {
  categories: RecipeCategory[];
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  loadedAt: number | null;
  refresh: (opts?: { force?: boolean; admin?: boolean }) => Promise<void>;
  upsertRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
  upsertCategory: (category: RecipeCategory) => void;
  removeCategory: (id: string) => void;
};

const STALE_MS = 60_000;

export const useRecipesStore = create<RecipesState>((set, get) => ({
  categories: [],
  recipes: [],
  loading: false,
  error: null,
  isAdmin: false,
  loadedAt: null,

  async refresh(opts) {
    const force = opts?.force ?? false;
    const admin = opts?.admin ?? false;
    const state = get();

    if (
      !force &&
      state.loadedAt &&
      Date.now() - state.loadedAt < STALE_MS &&
      state.recipes.length > 0
    ) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const url = new URL("/api/recipes", window.location.origin);
      if (admin) url.searchParams.set("admin", "1");

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Failed to load recipes (${res.status})`);
      }
      const data = (await res.json()) as {
        categories: RecipeCategory[];
        recipes: Recipe[];
        isAdmin?: boolean;
      };
      set({
        categories: data.categories ?? [],
        recipes: data.recipes ?? [],
        isAdmin: data.isAdmin ?? false,
        loadedAt: Date.now(),
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load recipes",
      });
    }
  },

  upsertRecipe(recipe) {
    set((state) => {
      const idx = state.recipes.findIndex((r) => r.id === recipe.id);
      const next = [...state.recipes];
      if (idx >= 0) next[idx] = recipe;
      else next.push(recipe);
      return { recipes: next };
    });
  },

  removeRecipe(id) {
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== id),
    }));
  },

  upsertCategory(category) {
    set((state) => {
      const idx = state.categories.findIndex((c) => c.id === category.id);
      const next = [...state.categories];
      if (idx >= 0) next[idx] = category;
      else next.push(category);
      return { categories: next };
    });
  },

  removeCategory(id) {
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      recipes: state.recipes.filter((r) => r.category_id !== id),
    }));
  },
}));
