import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminRecipesClient } from "./recipes-client";
import type { Recipe, RecipeCategory } from "@/types/recipes";

export const dynamic = "force-dynamic";

export default async function AdminRecipesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [categoriesRes, recipesRes] = await Promise.all([
    admin
      .from("recipe_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
    admin
      .from("recipes")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <AdminRecipesClient
      initialCategories={(categoriesRes.data ?? []) as RecipeCategory[]}
      initialRecipes={(recipesRes.data ?? []) as Recipe[]}
    />
  );
}
