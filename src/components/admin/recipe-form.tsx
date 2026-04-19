"use client";

import { useEffect, useState } from "react";
import type {
  Recipe,
  RecipeCategory,
  RecipeProcessingMode,
  RecipeScope,
} from "@/types/recipes";

export type RecipeFormValue = {
  category_id: string;
  slug?: string;
  display_name: string;
  short_label: string;
  description: string;
  icon: string;
  scope: RecipeScope;
  processing_mode: RecipeProcessingMode;
  vision_system_prompt: string;
  prompt_template: string;
  active: boolean;
  user_visible: boolean;
  sort_order: number;
};

function toForm(
  recipe: Recipe | null,
  fallbackCategoryId: string | undefined,
): RecipeFormValue {
  return {
    category_id: recipe?.category_id ?? fallbackCategoryId ?? "",
    slug: recipe?.slug ?? "",
    display_name: recipe?.display_name ?? "",
    short_label: recipe?.short_label ?? "",
    description: recipe?.description ?? "",
    icon: recipe?.icon ?? "",
    scope: recipe?.scope ?? "target",
    processing_mode: recipe?.processing_mode ?? "vision",
    vision_system_prompt: recipe?.vision_system_prompt ?? "",
    prompt_template: recipe?.prompt_template ?? "",
    active: recipe?.active ?? true,
    user_visible: recipe?.user_visible ?? true,
    sort_order: recipe?.sort_order ?? 0,
  };
}

type Props = {
  recipe: Recipe | null;
  categories: RecipeCategory[];
  defaultCategoryId?: string;
  onSubmit: (value: RecipeFormValue) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
  error?: string | null;
  compact?: boolean;
};

export function RecipeForm({
  recipe,
  categories,
  defaultCategoryId,
  onSubmit,
  onCancel,
  saving,
  error,
  compact,
}: Props) {
  const [value, setValue] = useState<RecipeFormValue>(() =>
    toForm(recipe, defaultCategoryId),
  );

  useEffect(() => {
    setValue(toForm(recipe, defaultCategoryId));
  }, [recipe, defaultCategoryId]);

  const requiresVision = value.processing_mode === "vision";
  const visionMissing =
    requiresVision && value.vision_system_prompt.trim().length === 0;

  const canSubmit =
    value.category_id &&
    value.display_name.trim().length > 0 &&
    value.short_label.trim().length > 0 &&
    value.prompt_template.trim().length > 0 &&
    !visionMissing &&
    !saving;

  const inputBase =
    "w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[11px] text-white outline-none placeholder:text-text-secondary focus:border-accent-gold/50";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        void onSubmit(value);
      }}
      className="space-y-3"
    >
      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
            Nome
          </label>
          <input
            className={inputBase}
            value={value.display_name}
            onChange={(e) => setValue({ ...value, display_name: e.target.value })}
            placeholder="Transformar para dia"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
            Rótulo curto (1-3 palavras)
          </label>
          <input
            className={inputBase}
            value={value.short_label}
            onChange={(e) =>
              setValue({ ...value, short_label: e.target.value.slice(0, 24) })
            }
            placeholder="Dia"
            maxLength={24}
          />
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-3"}`}>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
            Categoria
          </label>
          <select
            className={inputBase}
            value={value.category_id}
            onChange={(e) =>
              setValue({ ...value, category_id: e.target.value })
            }
          >
            <option value="" disabled>
              Escolha…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
            Escopo
          </label>
          <select
            className={inputBase}
            value={value.scope}
            onChange={(e) =>
              setValue({ ...value, scope: e.target.value as RecipeScope })
            }
          >
            <option value="target">Target (cena)</option>
            <option value="asset">Asset (referência)</option>
            <option value="any">Qualquer</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
            Modo
          </label>
          <select
            className={inputBase}
            value={value.processing_mode}
            onChange={(e) =>
              setValue({
                ...value,
                processing_mode: e.target.value as RecipeProcessingMode,
              })
            }
          >
            <option value="vision">Vision (LLM)</option>
            <option value="template">Template (fixo)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
          Descrição curta
        </label>
        <input
          className={inputBase}
          value={value.description}
          onChange={(e) =>
            setValue({ ...value, description: e.target.value })
          }
          placeholder="Cena em luz natural de dia claro"
        />
      </div>

      {requiresVision && (
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
            Vision system prompt
          </label>
          <textarea
            rows={compact ? 3 : 5}
            className={`${inputBase} font-mono text-[10.5px] leading-relaxed`}
            value={value.vision_system_prompt}
            onChange={(e) =>
              setValue({ ...value, vision_system_prompt: e.target.value })
            }
            placeholder="You are a real-estate photo editor..."
          />
        </div>
      )}

      <div>
        <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
          Prompt template
        </label>
        <textarea
          rows={compact ? 3 : 5}
          className={`${inputBase} font-mono text-[10.5px] leading-relaxed`}
          value={value.prompt_template}
          onChange={(e) =>
            setValue({ ...value, prompt_template: e.target.value })
          }
          placeholder="Transform the scene into bright natural daytime. {user_hint}"
        />
        <p className="mt-1 font-mono text-[9px] text-text-secondary">
          Placeholders: {"{user_hint}"}, {"{target_context}"}, {"{refs_summary}"}
        </p>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-4"}`}>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
            Ícone (lucide)
          </label>
          <input
            className={inputBase}
            value={value.icon}
            onChange={(e) => setValue({ ...value, icon: e.target.value })}
            placeholder="sun"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-text-secondary">
            Ordem
          </label>
          <input
            className={inputBase}
            type="number"
            value={value.sort_order}
            onChange={(e) =>
              setValue({ ...value, sort_order: Number(e.target.value) || 0 })
            }
          />
        </div>
        <label className="flex items-center gap-2 font-mono text-[10px] text-text-secondary">
          <input
            type="checkbox"
            checked={value.active}
            onChange={(e) => setValue({ ...value, active: e.target.checked })}
            className="accent-accent-gold"
          />
          Ativo
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] text-text-secondary">
          <input
            type="checkbox"
            checked={value.user_visible}
            onChange={(e) =>
              setValue({ ...value, user_visible: e.target.checked })
            }
            className="accent-accent-gold"
          />
          Visível p/ user
        </label>
      </div>

      {error ? (
        <p className="font-mono text-[10px] text-red-400">{error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-accent-gold px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Salvando…" : recipe ? "Salvar" : "Criar"}
        </button>
      </div>
    </form>
  );
}
