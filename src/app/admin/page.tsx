import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFalBalance } from "@/lib/fal-billing";

// Warn the founder before fal's prepaid balance runs dry (fal has no
// programmatic top-up — keep auto-recharge on; this is the early alarm).
const FAL_LOW_BALANCE_USD = 20;

export default async function AdminOverviewPage() {
  const supabase = createClient();
  const admin = createAdminClient();

  const { count: userCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  const { data: creditSum } = await supabase
    .from("credits")
    .select("balance");

  const totalCredits = creditSum?.reduce((sum, c) => sum + c.balance, 0) ?? 0;

  // ── fal monitoring + simple margin ──
  const [falBalance, costRows, purchaseRows] = await Promise.all([
    getFalBalance(),
    admin.from("generation_logs").select("cost"),
    admin.from("credit_transactions").select("delta, reason").gt("delta", 0),
  ]);

  const totalFalCostUsd = (costRows.data ?? []).reduce(
    (sum, r) => sum + Number(r.cost ?? 0),
    0,
  );

  // "Credits sold" = positive ledger entries from Stripe purchases only
  // (webhook reasons start with "Compra"/"Assinatura"); excludes welcome &
  // admin grants so the margin reflects real revenue-backed credits.
  const creditsSold = (purchaseRows.data ?? []).reduce((sum, r) => {
    const reason = (r.reason ?? "") as string;
    return reason.startsWith("Compra") || reason.startsWith("Assinatura")
      ? sum + Number(r.delta ?? 0)
      : sum;
  }, 0);

  const falCostPerSoldCredit =
    creditsSold > 0 ? totalFalCostUsd / creditsSold : null;

  const stats = [
    { label: "Usuários", value: userCount ?? 0 },
    { label: "Projetos", value: projectCount ?? 0 },
    { label: "Créditos em circulação", value: totalCredits },
  ];

  const lowBalance =
    falBalance.ok && falBalance.balance < FAL_LOW_BALANCE_USD;

  return (
    <div>
      <h1 className="font-display text-display-lg">Admin</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">
        Painel de administração do Animov.ai
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/5 p-5">
            <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-3xl text-accent-gold">{stat.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-display text-xl">Monitoramento fal.ai</h2>
      <p className="mt-1 font-body text-sm text-text-secondary">
        Saldo pré-pago da fal e margem aproximada (créditos vendidos × custo de
        geração).
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div
          className={`rounded-xl border p-5 ${
            lowBalance
              ? "border-red-500/40 bg-red-500/5"
              : "border-white/5"
          }`}
        >
          <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
            Saldo fal
          </p>
          {falBalance.ok ? (
            <>
              <p
                className={`mt-2 font-display text-3xl ${
                  lowBalance ? "text-red-400" : "text-accent-gold"
                }`}
              >
                {falBalance.currency === "USD" ? "$" : ""}
                {falBalance.balance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="font-mono text-xs text-text-secondary">
                  {falBalance.currency}
                </span>
              </p>
              {lowBalance && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-red-400">
                  Saldo baixo — recarregue na fal
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 font-mono text-xs text-text-secondary">
              indisponível — {falBalance.message}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/5 p-5">
          <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
            Custo fal acumulado
          </p>
          <p className="mt-2 font-display text-3xl text-text-primary">
            $
            {totalFalCostUsd.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-secondary">
            soma de generation_logs.cost
          </p>
        </div>

        <div className="rounded-xl border border-white/5 p-5">
          <p className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
            Créditos vendidos
          </p>
          <p className="mt-2 font-display text-3xl text-text-primary">
            {creditsSold}
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-secondary">
            {falCostPerSoldCredit !== null
              ? `custo fal ≈ $${falCostPerSoldCredit.toFixed(3)}/crédito vendido`
              : "nenhuma compra ainda"}
          </p>
        </div>
      </div>
    </div>
  );
}
