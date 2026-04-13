import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, email, role, created_at")
    .eq("id", user.id)
    .single();

  const { data: credits } = await supabase
    .from("credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("id, delta, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: projects } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <main className="p-8">
      <h1 className="font-display text-display-lg">Minha Conta</h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 p-5">
          <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">Créditos</p>
          <p className="mt-2 font-display text-3xl text-accent-gold">{credits?.balance ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/5 p-5">
          <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">Plano</p>
          <p className="mt-2 font-display text-xl">Free</p>
        </div>
        <div className="rounded-xl border border-white/5 p-5">
          <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">Membro desde</p>
          <p className="mt-2 font-mono text-label-sm">
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-xl">Perfil</h2>
        <div className="mt-4 rounded-xl border border-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-label-xs text-text-secondary">Email</span>
            <span className="font-mono text-label-sm">{profile?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-label-xs text-text-secondary">Nome</span>
            <span className="font-mono text-label-sm">{profile?.name ?? "—"}</span>
          </div>
          {profile?.role === "admin" && (
            <div className="flex items-center justify-between">
              <span className="font-mono text-label-xs text-text-secondary">Role</span>
              <span className="rounded bg-accent-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase text-accent-gold">Admin</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-xl">Histórico de Créditos</h2>
        {(!transactions || transactions.length === 0) ? (
          <p className="mt-4 font-mono text-label-sm text-text-secondary">Nenhuma transação ainda.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Motivo</th>
                  <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary">Créditos</th>
                  <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary">Data</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/5">
                    <td className="px-4 py-3 font-mono text-label-sm text-text-secondary">{tx.reason}</td>
                    <td className={`px-4 py-3 text-right font-mono text-label-sm ${tx.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                      {tx.delta > 0 ? "+" : ""}{tx.delta}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[10px] text-text-secondary">
                      {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
