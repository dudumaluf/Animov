export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 flex-col border-r border-border bg-bg-secondary p-6 lg:flex">
        <span className="font-display text-lg text-accent-gold">Animov</span>
        <span className="mt-1 font-mono text-label-xs text-text-secondary">
          ADMIN
        </span>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
