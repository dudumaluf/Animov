export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-16 flex-col items-center border-r border-border bg-bg-secondary py-6 lg:flex">
        <span className="font-display text-lg text-accent-gold">v</span>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
