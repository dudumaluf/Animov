"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

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

  return (
    <section ref={ref} id="planos" className="px-6 py-32 md:px-10">
      <motion.p
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.8 }}
        className="eyebrow"
      >
        — Planos
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mt-4 font-display text-display-lg"
      >
        Simples assim.
      </motion.h2>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
            className={cn(
              "relative rounded-card border p-8",
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
            <ul className="mt-6 space-y-2.5">
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
        Todos os planos incluem cancel a qualquer momento · Suporte em
        português · Sem taxa de setup
      </p>
    </section>
  );
}
