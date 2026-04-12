"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useRef, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useControls } from "leva";
import { LandingScene } from "./landing-scene";

const ALIGN_MAP = { left: "left", center: "center", right: "right" } as const;
const JUSTIFY_MAP = { left: "items-start", center: "items-center", right: "items-end" } as const;

export function HeroWithShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const hero = useControls("Hero.Text", {
    eyebrow: "— Animov.ai · desde 2025",
    headline1: "Seus imóveis,",
    headline2: "em movimento.",
    subtitle: "Fotos que você já tem → vídeo cinematográfico pronto para publicar. Sem editar. Sem agência.",
    ctaLabel: "Criar meu primeiro vídeo",
    ctaSecondary: "Ver exemplos →",
    align: { options: ALIGN_MAP, value: "left" },
    paddingX: { value: 48, min: 0, max: 200, step: 4 },
    paddingY: { value: 0, min: 0, max: 200, step: 4 },
    maxWidth: { value: 640, min: 300, max: 1200, step: 10 },
    verticalPosition: { options: { top: "start", center: "center", bottom: "end" }, value: "center" },
  });

  const secondary = useControls("Hero.SecondaryText", {
    eyebrow: "— Movimentos de câmera",
    line1: "Seis formas",
    line2: "de mostrar",
    line3: "um espaço.",
    align: { options: ALIGN_MAP, value: "right" },
    horizontalPosition: { options: { left: "start", center: "center", right: "end" }, value: "end" },
    paddingX: { value: 80, min: 0, max: 200, step: 4 },
  });

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

  const justifyClass = JUSTIFY_MAP[hero.align as keyof typeof JUSTIFY_MAP];
  const verticalMap = { start: "justify-start", center: "justify-center", end: "justify-end" } as const;
  const verticalClass = verticalMap[hero.verticalPosition as keyof typeof verticalMap];

  return (
    <section ref={containerRef} id="inicio" className="relative h-[400vh]">
      {/* Anchor for "Presets" nav — positioned where cards/secondary text appear */}
      <div id="presets" className="absolute" style={{ top: "200vh" }} />
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* R3F Canvas — behind everything */}
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0, 8], fov: 45 }}
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
          className={`pointer-events-none absolute inset-0 flex flex-col ${justifyClass} ${verticalClass} transition-opacity duration-300`}
          style={{
            opacity: Math.max(0, 1 - progress * 3),
            padding: `${hero.paddingY}px ${hero.paddingX}px`,
          }}
        >
          <div style={{ maxWidth: hero.maxWidth, textAlign: hero.align as CanvasTextAlign }}>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="eyebrow"
            >
              {hero.eyebrow}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="mt-5 font-display text-display-xl text-balance"
            >
              {hero.headline1}
              <br />
              <em>{hero.headline2}</em>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1 }}
              className="mt-6 max-w-md font-body text-base font-light text-text-secondary"
            >
              {hero.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.2 }}
              className="pointer-events-auto mt-10 flex flex-wrap gap-4"
            >
              <Link
                href="/cadastro"
                className="rounded-full bg-[var(--text)] px-7 py-3 font-mono text-label-sm uppercase tracking-widest text-[var(--bg)] transition-opacity hover:opacity-80"
              >
                {hero.ctaLabel}
              </Link>
              <a
                href="#presets"
                className="font-mono text-label-sm uppercase tracking-widest text-text-secondary transition-colors hover:text-[var(--text)]"
              >
                {hero.ctaSecondary}
              </a>
            </motion.div>
          </div>
        </div>

        {/* Cards section text — large, editorial, position controlled via Leva */}
        <div
          className="pointer-events-none absolute inset-0 flex transition-opacity duration-500"
          style={{
            opacity: Math.max(0, Math.min(1, (progress - 0.45) * 4)),
            alignItems: "center",
            justifyContent: secondary.horizontalPosition,
            padding: `0 ${secondary.paddingX}px`,
          }}
        >
          <div className="max-w-lg" style={{ textAlign: secondary.align as CanvasTextAlign }}>
            <p className="eyebrow">{secondary.eyebrow}</p>
            <h2 className="mt-4 font-display text-display-xl italic leading-[0.9]">
              {secondary.line1}
              <br />
              {secondary.line2}
              <br />
              {secondary.line3}
            </h2>
          </div>
        </div>

        {/* Bottom gradient fade — smooth transition to next section */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[40vh]"
          style={{
            background: `linear-gradient(to bottom, transparent, var(--bg))`,
            opacity: Math.max(0, Math.min(1, (progress - 0.6) * 2.5)),
          }}
        />

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
