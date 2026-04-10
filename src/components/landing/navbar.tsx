"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-5 md:px-10"
    >
      <Link href="/" className="font-display text-lg tracking-tight">
        Animo<span className="text-accent-gold">v</span>
      </Link>

      <div className="flex items-center gap-8">
        <a
          href="#presets"
          className="hidden font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)] md:block"
        >
          Presets
        </a>
        <a
          href="#como-funciona"
          className="hidden font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)] md:block"
        >
          Como funciona
        </a>
        <a
          href="#planos"
          className="hidden font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)] md:block"
        >
          Planos
        </a>
        <Link
          href="/cadastro"
          className="rounded-full bg-[var(--text)] px-5 py-2 font-mono text-label-sm uppercase tracking-widest text-[var(--bg)] transition-opacity hover:opacity-80"
        >
          Começar grátis
        </Link>
      </div>
    </motion.nav>
  );
}
