import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = createClient();

  const { count: userCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  const { data: creditSum } = await supabase
    .from("credits")
    .select("balance");

  const totalCredits = creditSum?.reduce((sum, c) => sum + c.balance, 0) ?? 0;

  const stats = [
    { label: "Usuários", value: userCount ?? 0 },
    { label: "Projetos", value: projectCount ?? 0 },
    { label: "Créditos em circulação", value: totalCredits },
  ];

  return (
    <div>
      <h1 className="font-display text-display-lg">Admin</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">
        Painel de administração do Animov.ai
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/5 p-5">
            <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-3xl text-accent-gold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
