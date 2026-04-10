export default function EditorPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <main className="flex min-h-screen flex-col bg-black">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="font-display text-xl">
          Projeto {params.projectId}
        </h1>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <p className="font-mono text-label-sm uppercase tracking-widest text-text-secondary">
          Fase 3 — Film Strip Editor
        </p>
      </div>
    </main>
  );
}
