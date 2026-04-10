"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logout } from "@/app/(auth)/actions/auth";

interface AppSidebarProps {
  userName: string;
  userEmail: string;
  creditBalance: number;
  isAdmin: boolean;
}

const navItems = [
  { href: "/dashboard", label: "Projetos" },
  { href: "/conta", label: "Conta" },
];

export function AppSidebar({
  userName,
  creditBalance,
  isAdmin,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 flex-col justify-between border-r border-border bg-bg-secondary lg:flex">
      <div>
        <div className="border-b border-border px-4 py-5">
          <Link href="/" className="font-display text-lg tracking-tight">
            Animo<span className="text-accent-gold">v</span>
          </Link>
        </div>

        <nav className="mt-4 flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 font-mono text-label-sm uppercase tracking-widest transition-colors",
                pathname === item.href
                  ? "bg-accent-gold/10 text-accent-gold"
                  : "text-text-secondary hover:text-[var(--text)]",
              )}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "rounded-md px-3 py-2 font-mono text-label-sm uppercase tracking-widest transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-accent-gold/10 text-accent-gold"
                  : "text-text-secondary hover:text-[var(--text)]",
              )}
            >
              Admin
            </Link>
          )}
        </nav>
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-label-xs uppercase text-text-secondary">
            Créditos
          </span>
          <span className="font-mono text-sm font-medium text-accent-gold">
            {creditBalance}
          </span>
        </div>
        <p className="mb-3 truncate text-sm text-text-secondary">{userName}</p>
        <form action={logout}>
          <button
            type="submit"
            className="w-full rounded-md px-3 py-1.5 text-left font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)]"
          >
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
