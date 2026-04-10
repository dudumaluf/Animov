import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 flex-col border-r border-border bg-bg-secondary p-6 lg:flex">
        <span className="font-display text-lg text-accent-gold">Animov</span>
        <span className="mt-1 font-mono text-label-xs uppercase text-text-secondary">
          Admin
        </span>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
