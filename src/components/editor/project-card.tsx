"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState } from "react";

type Project = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
};

// Pin locale + timezone so the formatted date is byte-identical whether it is
// produced during SSR (UTC on Vercel) or re-rendered on the client (viewer's
// local zone). A bare toLocaleDateString picks up each host's timezone, so a
// timestamp near midnight formats to a different day on server vs client and
// trips a React hydration mismatch (#425/#418/#423).
const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Deletar "${project.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <Link
      href={`/editor/${project.id}`}
      className={`group relative rounded-xl border border-white/5 p-5 transition-all hover:border-accent-gold/20 hover:bg-white/[0.02] ${deleting ? "opacity-30 pointer-events-none" : ""}`}
    >
      <p className="font-display text-lg group-hover:text-accent-gold transition-colors">
        {project.name}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
            project.status === "ready"
              ? "bg-green-500/10 text-green-400"
              : project.status === "generating"
              ? "bg-accent-gold/10 text-accent-gold"
              : project.status === "failed"
              ? "bg-red-500/10 text-red-400"
              : "bg-white/5 text-text-secondary"
          }`}
        >
          {project.status === "draft" && "Rascunho"}
          {project.status === "generating" && "Gerando"}
          {project.status === "ready" && "Pronto"}
          {project.status === "failed" && "Erro"}
        </span>
        <span className="font-mono text-[10px] text-text-secondary">
          {DATE_FORMAT.format(new Date(project.updated_at))}
        </span>
      </div>
      <button
        onClick={handleDelete}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-white/0 transition-all group-hover:text-text-secondary hover:!bg-red-500/10 hover:!text-red-400"
      >
        <Trash2 size={14} />
      </button>
    </Link>
  );
}
