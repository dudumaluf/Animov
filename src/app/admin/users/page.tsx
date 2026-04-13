import { createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const supabase = createClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, email, name, role, created_at")
    .order("created_at", { ascending: false });

  const { data: credits } = await supabase
    .from("credits")
    .select("user_id, balance");

  const creditMap = new Map(credits?.map((c) => [c.user_id, c.balance]) ?? []);

  return (
    <div>
      <h1 className="font-display text-display-lg">Usuários</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">
        {users?.length ?? 0} usuários cadastrados
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-white/5">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Email</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Nome</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Role</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary">Créditos</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary">Desde</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-label-sm">{user.email}</td>
                <td className="px-4 py-3 font-mono text-label-sm text-text-secondary">{user.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                    user.role === "admin"
                      ? "bg-accent-gold/10 text-accent-gold"
                      : "bg-white/5 text-text-secondary"
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-label-sm text-accent-gold">
                  {creditMap.get(user.id) ?? 0}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[10px] text-text-secondary">
                  {new Date(user.created_at).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
