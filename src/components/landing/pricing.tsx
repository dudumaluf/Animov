"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useControls } from "leva";
import { cn } from "@/lib/utils";

const ALIGN_MAP = { left: "left", center: "center", right: "right" } as const;
const SIZE_MAP = { md: "text-display-md", lg: "text-display-lg", xl: "text-display-xl" } as const;

const plans = [
  {
    name: "Free",
    price: "R$ 0",
    credits: "3 créditos",
    features: ["3 vídeos de teste", "Marca d'água Animov", "Presets básicos"],
    featured: false,
  },
  {
    name: "Starter",
    price: "R$ 79",
    period: "/mês",
    credits: "20 créditos/mês",
    features: [
      "Sem marca d'água",
      "Todos os presets",
      "Logo personalizado",
      "Trilha sonora",
      "Armazenamento 1 ano",
    ],
    featured: true,
    badge: "Mais popular",
  },
  {
    name: "Pro",
    price: "R$ 199",
    period: "/mês",
    credits: "60 créditos/mês",
    features: [
      "Tudo do Starter",
      "Qualidade superior",
      "Formato 9:16 Reels",
      "Link de compartilhamento",
      "Suporte prioritário",
    ],
    featured: false,
  },
];

export function Pricing() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const heading = useControls("Pricing.Heading", {
    eyebrow: "— Planos",
    title: "Simples assim.",
    align: { options: ALIGN_MAP, value: "left" },
    size: { options: SIZE_MAP, value: "text-display-lg" },
    italic: false,
    paddingX: { value: 0, min: 0, max: 200, step: 4 },
    maxWidth: { value: 900, min: 300, max: 1400, step: 10 },
  });

  const footer = useControls("Pricing.Footer", {
    text: "Todos os planos incluem cancel a qualquer momento · Suporte em português · Sem taxa de setup",
  });

  return (
    <section ref={ref} id="planos" className="px-6 py-32 md:px-10">
      <div style={{ textAlign: heading.align as CanvasTextAlign, paddingLeft: heading.paddingX, paddingRight: heading.paddingX }}>
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="eyebrow"
        >
          {heading.eyebrow}
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={`mt-4 font-display ${heading.size} ${heading.italic ? "italic" : ""}`}
          style={{
            maxWidth: heading.maxWidth,
            marginLeft: heading.align === "right" || heading.align === "center" ? "auto" : undefined,
            marginRight: heading.align === "left" || heading.align === "center" ? "auto" : undefined,
          }}
        >
          {heading.title}
        </motion.h2>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
            className={cn(
              "relative flex flex-col rounded-card border p-8",
              plan.featured
                ? "border-accent-gold/30 bg-accent-gold/5"
                : "border-border bg-bg-secondary",
            )}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-6 rounded-full bg-accent-gold px-3 py-1 font-mono text-label-xs uppercase text-[#0D0D0B]">
                {plan.badge}
              </span>
            )}
            <p className="font-mono text-label-sm uppercase tracking-widest text-text-secondary">
              {plan.name}
            </p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-4xl">{plan.price}</span>
              {plan.period && (
                <span className="font-mono text-label-sm text-text-secondary">
                  {plan.period}
                </span>
              )}
            </div>
            <p className="mt-2 font-mono text-sm text-accent-gold">
              {plan.credits}
            </p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="font-mono text-label-sm text-text-secondary"
                >
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/cadastro"
              className={cn(
                "mt-8 block w-full rounded-full py-2.5 text-center font-mono text-label-sm uppercase tracking-widest transition-opacity hover:opacity-80",
                plan.featured
                  ? "bg-accent-gold text-[#0D0D0B]"
                  : "bg-[var(--text)] text-[var(--bg)]",
              )}
            >
              Começar
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="mt-10 text-center font-mono text-label-xs text-text-secondary">
        {footer.text}
      </p>
    </section>
  );
}
