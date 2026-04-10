"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useRef, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LandingScene } from "./landing-scene";

export function HeroWithShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScroll = containerRef.current.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / totalScroll));
      setProgress(p);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section ref={containerRef} id="presets" className="relative h-[400vh]">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* R3F Canvas — behind everything */}
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0, 6], fov: 50 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true }}
            style={{ background: "transparent" }}
          >
            <Suspense fallback={null}>
              <LandingScene progress={progress} />
            </Suspense>
          </Canvas>
        </div>

        {/* Hero text overlay — fades out on scroll */}
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300"
          style={{ opacity: Math.max(0, 1 - progress * 3) }}
        >
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
            className="pointer-events-auto mt-10 flex items-center gap-4"
          >
            <Link
              href="/cadastro"
              className="rounded-full bg-[var(--text)] px-7 py-3 font-mono text-label-sm uppercase tracking-widest text-[var(--bg)] transition-opacity hover:opacity-80"
            >
              Criar meu primeiro vídeo
            </Link>
            <a
              href="#como-funciona"
              className="font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)]"
            >
              Ver exemplos &rarr;
            </a>
          </motion.div>
        </div>

        {/* Cards section text — fades in on scroll */}
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-16 transition-opacity duration-300"
          style={{ opacity: Math.max(0, Math.min(1, (progress - 0.5) * 3)) }}
        >
          <p className="eyebrow">— Movimentos de câmera</p>
          <p className="mt-3 text-center font-display text-display-md">
            Seis formas de mostrar<br />um espaço.
          </p>
        </div>

        {/* Stats — bottom of hero */}
        <div
          className="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center gap-10 transition-opacity duration-300"
          style={{ opacity: Math.max(0, 1 - progress * 5) }}
        >
          <Stat value="2.400+" label="vídeos gerados" />
          <Stat value="< 5 min" label="por projeto" />
          <Stat value="R$ 3,95" label="por vídeo" />
        </div>
      </div>
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
