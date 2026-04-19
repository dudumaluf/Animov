import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/credits", label: "Créditos" },
  { href: "/admin/presets", label: "Presets" },
  { href: "/admin/recipes", label: "Receitas" },
  { href: "/admin/generations", label: "Gerações" },
  { href: "/admin/settings", label: "Configurações" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/5 bg-[#0A0A09]">
        <div className="flex items-center gap-2 px-5 py-5">
          <Link href="/" className="font-display text-lg">Animov</Link>
          <span className="rounded bg-accent-gold/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-accent-gold">Admin</span>
        </div>
        <nav className="flex-1 px-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 font-mono text-label-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/5 px-5 py-4">
          <Link href="/dashboard" className="font-mono text-[10px] text-text-secondary hover:text-accent-gold">
            ← Voltar ao app
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#0D0D0B] p-8">{children}</main>
    </div>
  );
}
