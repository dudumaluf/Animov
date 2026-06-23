"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CreditCard, Loader2, Settings2 } from "lucide-react";

/**
 * BillingActions
 * --------------
 * Client surface for the account page: subscription plan cards, one-time credit
 * pack cards, and a "manage subscription" portal button. Reads the catalog rows
 * (admin-editable) passed from the server page and kicks off Stripe hosted
 * Checkout / Customer Portal. Handles the ?success / ?canceled return params
 * with an inline banner + a balance refresh.
 */

export type BillingEntry = {
  stripePriceId: string;
  kind: "subscription" | "pack";
  plan: string | null;
  credits: number;
  label: string | null;
  displayPrice: string | null;
};

export function BillingActions({
  subscriptions,
  packs,
  hasSubscription,
  currentPlan,
}: {
  subscriptions: BillingEntry[];
  packs: BillingEntry[];
  hasSubscription: boolean;
  currentPlan: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const success = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";

  // Refresh once after a successful return so the server-rendered balance /
  // plan reflect the just-granted credits (webhook lands within a second or two
  // in test mode; the refresh re-reads the latest).
  useEffect(() => {
    if (success) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  async function startCheckout(priceId: string) {
    setError(null);
    setPendingId(priceId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Não foi possível iniciar o checkout");
      }
      window.location.href = data.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no checkout");
      setPendingId(null);
    }
  }

  async function openPortal() {
    setError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Não foi possível abrir o portal");
      }
      window.location.href = data.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir o portal");
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {success && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 font-mono text-label-sm text-green-300">
          Pagamento confirmado! Seus créditos serão atualizados em instantes.
        </div>
      )}
      {canceled && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 font-mono text-label-sm text-text-secondary">
          Checkout cancelado — nenhuma cobrança foi feita.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 font-mono text-label-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Subscriptions ── */}
      {subscriptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Planos de assinatura</h2>
            {hasSubscription && (
              <button
                type="button"
                onClick={openPortal}
                disabled={portalLoading}
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 font-mono text-label-xs text-text-secondary transition-colors hover:border-white/20 hover:text-[var(--text)] disabled:opacity-50"
              >
                {portalLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Settings2 size={12} />
                )}
                Gerenciar assinatura
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {subscriptions.map((s) => {
              const isCurrent = hasSubscription && currentPlan === s.plan;
              return (
                <div
                  key={s.stripePriceId}
                  className={`flex flex-col rounded-xl border p-5 ${
                    isCurrent
                      ? "border-accent-gold/40 bg-accent-gold/5"
                      : "border-white/5"
                  }`}
                >
                  <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                    {s.label ?? s.plan}
                  </p>
                  <p className="mt-2 font-display text-2xl">{s.displayPrice}</p>
                  <p className="mt-1 font-mono text-label-sm text-accent-gold">
                    {s.credits} créditos/mês
                  </p>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => startCheckout(s.stripePriceId)}
                    disabled={pendingId !== null || isCurrent}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full py-2.5 font-mono text-label-sm uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-50 ${
                      isCurrent
                        ? "border border-white/10 text-text-secondary"
                        : "bg-accent-gold text-[#0D0D0B]"
                    }`}
                  >
                    {pendingId === s.stripePriceId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isCurrent ? (
                      <>
                        <Check size={14} /> Plano atual
                      </>
                    ) : (
                      "Assinar"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── One-time credit packs ── */}
      {packs.length > 0 && (
        <div>
          <h2 className="font-display text-xl">Pacotes de créditos</h2>
          <p className="mt-1 font-mono text-label-sm text-text-secondary">
            Compra única — créditos não expiram.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {packs.map((p) => (
              <div
                key={p.stripePriceId}
                className="flex flex-col rounded-xl border border-white/5 p-5"
              >
                <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
                  {p.label ?? `${p.credits} créditos`}
                </p>
                <p className="mt-2 font-display text-2xl">{p.displayPrice}</p>
                <p className="mt-1 font-mono text-label-sm text-accent-gold">
                  {p.credits} créditos
                </p>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => startCheckout(p.stripePriceId)}
                  disabled={pendingId !== null}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-2.5 font-mono text-label-sm uppercase tracking-widest text-[var(--text)] transition-colors hover:border-accent-gold/30 hover:text-accent-gold disabled:opacity-50"
                >
                  {pendingId === p.stripePriceId ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <CreditCard size={14} /> Comprar
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
