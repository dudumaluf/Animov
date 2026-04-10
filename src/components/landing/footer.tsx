import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10 md:px-10">
      <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
        <Link href="/" className="font-display text-lg tracking-tight">
          Animo<span className="text-accent-gold">v</span>
        </Link>
        <p className="font-mono text-label-xs text-text-secondary">
          &copy; {new Date().getFullYear()} Animov.ai. Todos os direitos
          reservados.
        </p>
      </div>
    </footer>
  );
}
