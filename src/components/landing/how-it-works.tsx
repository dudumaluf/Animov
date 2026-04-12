"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useControls } from "leva";

const ALIGN_MAP = { left: "left", center: "center", right: "right" } as const;
const SIZE_MAP = { md: "text-display-md", lg: "text-display-lg", xl: "text-display-xl" } as const;

const defaultSteps = [
  {
    number: "01",
    title: "Sobe as fotos",
    description:
      "Arraste as fotos do imóvel. Mínimo 2, máximo 10. A ordem que você define é a ordem das cenas.",
  },
  {
    number: "02",
    title: "Escolhe o estilo",
    description:
      "Dolly In, Orbit, Ken Burns, Reveal, Float Up. Cada preset move a câmera de um jeito diferente.",
  },
  {
    number: "03",
    title: "Baixa e publica",
    description:
      "Seu vídeo pronto em menos de 5 minutos. Com seu logo, sua trilha, sua marca.",
  },
];

export function HowItWorks() {
  const containerRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  const heading = useControls("HowItWorks.Heading", {
    eyebrow: "— Como funciona",
    title: "Três passos. Um vídeo.",
    align: { options: ALIGN_MAP, value: "center" },
    size: { options: SIZE_MAP, value: "text-display-xl" },
    italic: true,
    paddingX: { value: 244, min: 0, max: 400, step: 4 },
    maxWidth: { value: 1400, min: 300, max: 1400, step: 10 },
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

  const activeIndex = progress < 0.15
    ? -1
    : Math.min(defaultSteps.length - 1, Math.floor((progress - 0.15) / (0.75 / defaultSteps.length)));

  const titleOpacity = Math.min(1, progress * 5);

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      <div id="como-funciona" className="absolute" style={{ top: "60vh" }} />
      <div className="sticky top-0 flex h-screen flex-col justify-center px-6 md:px-10">
        <div style={{ textAlign: heading.align as CanvasTextAlign, paddingLeft: heading.paddingX, paddingRight: heading.paddingX }}>
          <motion.p
            className="eyebrow transition-opacity duration-500"
            style={{ opacity: titleOpacity }}
          >
            {heading.eyebrow}
          </motion.p>
          <motion.h2
            className={`mt-4 font-display ${heading.size} transition-opacity duration-500 ${heading.italic ? "italic" : ""}`}
            style={{
              opacity: titleOpacity,
              maxWidth: heading.maxWidth,
              marginLeft: heading.align === "right" || heading.align === "center" ? "auto" : undefined,
              marginRight: heading.align === "left" || heading.align === "center" ? "auto" : undefined,
            }}
          >
            {heading.title}
          </motion.h2>
        </div>

        <div className="mt-20 grid gap-16 md:grid-cols-3 md:gap-10" style={{ paddingLeft: heading.paddingX, paddingRight: heading.paddingX }}>
          {defaultSteps.map((step, i) => {
            const isActive = i === activeIndex;
            const isPast = i < activeIndex;

            return (
              <div
                key={step.number}
                className="transition-all duration-700 ease-out"
                style={{
                  opacity: isActive ? 1 : isPast ? 0.4 : 0.15,
                  transform: isActive ? "translateY(0)" : "translateY(8px)",
                }}
              >
                <span
                  className="block font-display text-5xl italic transition-colors duration-700"
                  style={{ color: isActive ? "var(--accent-gold)" : "var(--text-secondary)" }}
                >
                  {step.number}
                </span>
                <h3 className="mt-4 font-display text-2xl">{step.title}</h3>
                <p className="mt-3 font-body text-sm font-light leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
