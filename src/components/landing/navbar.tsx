"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useControls } from "leva";
import { createClient } from "@/lib/supabase/client";

export function Navbar() {
  const labels = useControls("Navbar.Labels", {
    brand: "Animov",
    link1: "Início",
    link2: "Presets",
    link3: "Como funciona",
    link4: "Planos",
    cta: "Começar grátis",
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-5 md:px-10"
    >
      <Link href="/" className="font-display text-lg tracking-tight">
        {labels.brand}
      </Link>

      <div className="flex items-center gap-8">
        <a
          href="#inicio"
          className="hidden font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)] md:block"
        >
          {labels.link1}
        </a>
        <a
          href="#presets"
          className="hidden font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)] md:block"
        >
          {labels.link2}
        </a>
        <a
          href="#como-funciona"
          className="hidden font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)] md:block"
        >
          {labels.link3}
        </a>
        <a
          href="#planos"
          className="hidden font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)] md:block"
        >
          {labels.link4}
        </a>
        <Link
          href={isLoggedIn ? "/dashboard" : "/cadastro"}
          className="rounded-full bg-[var(--text)] px-5 py-2 font-mono text-label-sm uppercase tracking-widest text-[var(--bg)] transition-opacity hover:opacity-80"
        >
          {isLoggedIn ? "Meus projetos" : labels.cta}
        </Link>
      </div>
    </motion.nav>
  );
}
