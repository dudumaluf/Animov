import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NewProjectPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: "Novo Projeto", status: "draft" })
    .select("id")
    .single();

  if (error || !project) {
    redirect("/dashboard");
  }

  redirect(`/editor/${project.id}`);
}
