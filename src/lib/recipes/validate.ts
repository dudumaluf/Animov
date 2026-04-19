import type {
  RecipeColorToken,
  RecipeProcessingMode,
  RecipeScope,
} from "@/types/recipes";

const COLOR_TOKENS: RecipeColorToken[] = [
  "time",
  "polish",
  "staging",
  "material",
  "asset",
];
const SCOPES: RecipeScope[] = ["target", "asset", "any"];
const MODES: RecipeProcessingMode[] = ["vision", "template"];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function sanitizeShortLabel(input: string): string {
  return input.trim().slice(0, 24);
}

export type CategoryInput = {
  slug?: string;
  display_name?: string;
  description?: string | null;
  icon?: string | null;
  color_token?: string;
  sort_order?: number;
  active?: boolean;
};

export type RecipeInput = {
  category_id?: string;
  slug?: string;
  display_name?: string;
  short_label?: string;
  description?: string | null;
  icon?: string | null;
  scope?: string;
  processing_mode?: string;
  vision_system_prompt?: string | null;
  prompt_template?: string;
  active?: boolean;
  user_visible?: boolean;
  sort_order?: number;
};

export function validateCategoryInput(
  body: CategoryInput,
  { partial = false }: { partial?: boolean } = {},
): { ok: true; value: Required<Omit<CategoryInput, "description" | "icon">> & Pick<CategoryInput, "description" | "icon"> } | { ok: false; error: string } {
  if (!partial || body.display_name !== undefined) {
    if (typeof body.display_name !== "string" || body.display_name.trim().length === 0) {
      return { ok: false, error: "display_name required" };
    }
  }
  if (!partial || body.color_token !== undefined) {
    if (!COLOR_TOKENS.includes(body.color_token as RecipeColorToken)) {
      return { ok: false, error: `color_token must be one of ${COLOR_TOKENS.join(", ")}` };
    }
  }

  const slug =
    body.slug && body.slug.trim().length > 0
      ? slugify(body.slug)
      : body.display_name
      ? slugify(body.display_name)
      : undefined;

  if (!partial && !slug) {
    return { ok: false, error: "slug required" };
  }

  const value = {
    slug: slug!,
    display_name: body.display_name!.trim(),
    description: body.description ?? null,
    icon: body.icon ?? null,
    color_token: body.color_token as RecipeColorToken,
    sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
    active: typeof body.active === "boolean" ? body.active : true,
  };

  return { ok: true, value };
}

export function validateRecipeInput(
  body: RecipeInput,
  { partial = false }: { partial?: boolean } = {},
): { ok: true; value: RecipeInput } | { ok: false; error: string } {
  const out: RecipeInput = {};

  if (!partial || body.category_id !== undefined) {
    if (typeof body.category_id !== "string" || body.category_id.trim().length === 0) {
      return { ok: false, error: "category_id required" };
    }
    out.category_id = body.category_id;
  }
  if (!partial || body.display_name !== undefined) {
    if (typeof body.display_name !== "string" || body.display_name.trim().length === 0) {
      return { ok: false, error: "display_name required" };
    }
    out.display_name = body.display_name.trim();
  }
  if (!partial || body.short_label !== undefined) {
    const label = typeof body.short_label === "string"
      ? sanitizeShortLabel(body.short_label)
      : body.display_name
      ? sanitizeShortLabel(body.display_name)
      : "";
    if (!label) return { ok: false, error: "short_label required" };
    out.short_label = label;
  }
  if (!partial || body.prompt_template !== undefined) {
    if (typeof body.prompt_template !== "string" || body.prompt_template.trim().length === 0) {
      return { ok: false, error: "prompt_template required" };
    }
    out.prompt_template = body.prompt_template;
  }
  if (!partial || body.scope !== undefined) {
    if (!SCOPES.includes(body.scope as RecipeScope)) {
      return { ok: false, error: `scope must be one of ${SCOPES.join(", ")}` };
    }
    out.scope = body.scope;
  }
  if (!partial || body.processing_mode !== undefined) {
    if (!MODES.includes(body.processing_mode as RecipeProcessingMode)) {
      return { ok: false, error: `processing_mode must be one of ${MODES.join(", ")}` };
    }
    out.processing_mode = body.processing_mode;
  }

  if (body.slug !== undefined) {
    out.slug = slugify(body.slug);
  } else if (!partial && body.display_name) {
    out.slug = slugify(body.display_name);
  }

  if (body.description !== undefined) out.description = body.description;
  if (body.icon !== undefined) out.icon = body.icon;
  if (body.vision_system_prompt !== undefined) out.vision_system_prompt = body.vision_system_prompt;
  if (body.active !== undefined) out.active = body.active;
  if (body.user_visible !== undefined) out.user_visible = body.user_visible;
  if (body.sort_order !== undefined) out.sort_order = body.sort_order;

  if (
    (out.processing_mode === "vision" || body.processing_mode === "vision") &&
    out.vision_system_prompt !== undefined &&
    (typeof out.vision_system_prompt !== "string" ||
      out.vision_system_prompt.trim().length === 0)
  ) {
    return { ok: false, error: "vision_system_prompt required when processing_mode='vision'" };
  }

  return { ok: true, value: out };
}
