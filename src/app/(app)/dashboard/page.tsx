import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/editor/project-card";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, created_at, updated_at")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-display-lg">Projetos</h1>
        <Link
          href="/editor/new"
          className="rounded-full bg-accent-gold px-6 py-3 font-mono text-label-sm uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80"
        >
          Novo projeto
        </Link>
      </div>

      {(!projects || projects.length === 0) ? (
        <div className="mt-16 flex flex-col items-center gap-4">
          <p className="font-body text-sm text-text-secondary">
            Nenhum projeto ainda.
          </p>
          <Link
            href="/editor/new"
            className="rounded-full border border-white/10 px-5 py-2.5 font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:border-accent-gold/40 hover:text-accent-gold"
          >
            Criar primeiro projeto
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </main>
  );
}
