"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
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
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      id="como-funciona"
      className="px-6 py-32 md:px-10"
    >
      <motion.p
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.8 }}
        className="eyebrow"
      >
        — Como funciona
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mt-4 font-display text-display-lg"
      >
        Três passos. Um vídeo.
      </motion.h2>

      <div className="mt-20 grid gap-16 md:grid-cols-3 md:gap-10">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 + i * 0.15 }}
          >
            <span className="font-display text-5xl italic text-accent-gold">
              {step.number}
            </span>
            <h3 className="mt-4 font-display text-2xl">{step.title}</h3>
            <p className="mt-3 font-body text-sm font-light leading-relaxed text-text-secondary">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
