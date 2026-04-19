import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeCategory, RecipeScope } from "@/types/recipes";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope");
  const includeInactive = isAdmin && url.searchParams.get("admin") === "1";

  const allowedScopes: RecipeScope[] = ["target", "asset", "any"];
  const scopes: RecipeScope[] | null =
    scopeParam && allowedScopes.includes(scopeParam as RecipeScope)
      ? scopeParam === "any"
        ? ["target", "asset", "any"]
        : [scopeParam as RecipeScope, "any"]
      : null;

  // RLS already filters by active+user_visible for non-admins; admins see everything.
  const categoriesQuery = supabase
    .from("recipe_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  let recipesQuery = supabase
    .from("recipes")
    .select("*")
    .order("sort_order", { ascending: true });

  if (scopes && scopes.length > 0) {
    recipesQuery = recipesQuery.in("scope", scopes);
  }

  if (!includeInactive) {
    recipesQuery = recipesQuery.eq("active", true).eq("user_visible", true);
  }

  const [categoriesRes, recipesRes] = await Promise.all([
    categoriesQuery,
    recipesQuery,
  ]);

  if (categoriesRes.error) {
    return NextResponse.json(
      { error: categoriesRes.error.message },
      { status: 500 },
    );
  }
  if (recipesRes.error) {
    return NextResponse.json(
      { error: recipesRes.error.message },
      { status: 500 },
    );
  }

  const categories = (categoriesRes.data ?? []) as RecipeCategory[];
  const recipes = (recipesRes.data ?? []) as Recipe[];

  return NextResponse.json(
    { categories, recipes, isAdmin },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}
