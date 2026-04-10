"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="eyebrow"
      >
        — Animov.ai · desde 2025
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.7 }}
        className="mt-5 text-center font-display text-display-xl text-balance"
      >
        Seus imóveis,
        <br />
        <em>em movimento.</em>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1 }}
        className="mt-6 max-w-md text-center font-body text-base font-light text-text-secondary"
      >
        Fotos que você já tem &rarr; vídeo cinematográfico pronto para
        publicar. Sem editar. Sem agência.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="mt-10 flex items-center gap-4"
      >
        <Link
          href="/cadastro"
          className="rounded-full bg-[var(--text)] px-7 py-3 font-mono text-label-sm uppercase tracking-widest text-[var(--bg)] transition-opacity hover:opacity-80"
        >
          Criar meu primeiro vídeo
        </Link>
        <a
          href="#presets"
          className="font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)]"
        >
          Ver exemplos &rarr;
        </a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-10 flex gap-10"
      >
        <Stat value="2.400+" label="vídeos gerados" />
        <Stat value="< 5 min" label="por projeto" />
        <Stat value="R$ 3,95" label="por vídeo" />
      </motion.div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-sm font-medium text-accent-gold">{value}</p>
      <p className="mt-0.5 font-mono text-label-xs uppercase text-text-secondary">
        {label}
      </p>
    </div>
  );
}
