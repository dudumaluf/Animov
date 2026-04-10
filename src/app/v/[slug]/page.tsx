export default function SharedVideoPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-display-md">Video Compartilhado</h1>
        <p className="mt-2 font-mono text-label-sm uppercase tracking-widest text-text-secondary">
          /{params.slug}
        </p>
        <p className="mt-4 font-mono text-label-sm text-text-secondary">
          Fase 6 — Compartilhamento público
        </p>
      </div>
    </main>
  );
}
