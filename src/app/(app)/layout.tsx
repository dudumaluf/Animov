import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/shared/app-sidebar";

export default async function AppLayout({
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
    .select("name, role")
    .eq("id", user.id)
    .single();

  const { data: credits } = await supabase
    .from("credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        userName={profile?.name ?? user.email?.split("@")[0] ?? ""}
        userEmail={user.email ?? ""}
        creditBalance={credits?.balance ?? 0}
        isAdmin={profile?.role === "admin"}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
