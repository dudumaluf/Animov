export type RecipeColorToken =
  | "time"
  | "polish"
  | "staging"
  | "material"
  | "asset";

export type RecipeScope = "target" | "asset" | "any";
export type RecipeProcessingMode = "vision" | "template";

export type RecipeCategory = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  color_token: RecipeColorToken;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Recipe = {
  id: string;
  category_id: string;
  slug: string;
  display_name: string;
  short_label: string;
  description: string | null;
  icon: string | null;
  scope: RecipeScope;
  processing_mode: RecipeProcessingMode;
  vision_system_prompt: string | null;
  prompt_template: string;
  active: boolean;
  user_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RecipesPayload = {
  categories: RecipeCategory[];
  recipes: Recipe[];
};
