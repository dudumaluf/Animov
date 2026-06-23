/**
 * fal account-billing reader (server-only).
 * -----------------------------------------
 * Wraps fal's read-only Account Billing endpoint
 * (`GET https://api.fal.ai/v1/account/billing?expand=credits`) so we can show
 * the current prepaid balance in the admin panel and warn before it runs dry.
 * fal exposes NO programmatic top-up — keep auto-recharge enabled in the fal
 * dashboard; this read is the safety-net alert.
 *
 * Note: the billing endpoint requires an ADMIN-scoped fal key. A standard
 * model key returns 401/403 — we surface that as a clear, non-fatal message.
 */

const FAL_BILLING_URL = "https://api.fal.ai/v1/account/billing?expand=credits";

export type FalBalanceResult =
  | { ok: true; balance: number; currency: string; username?: string }
  | { ok: false; status: number; message: string };

export async function getFalBalance(): Promise<FalBalanceResult> {
  const key = process.env.FAL_KEY;
  if (!key) {
    return { ok: false, status: 0, message: "FAL_KEY não configurada" };
  }

  try {
    const res = await fetch(FAL_BILLING_URL, {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const msg =
        res.status === 401 || res.status === 403
          ? "Chave fal sem escopo de billing (use uma Admin key da fal)"
          : `fal billing HTTP ${res.status}`;
      return { ok: false, status: res.status, message: msg };
    }

    const data = (await res.json()) as {
      username?: string;
      credits?: { current_balance?: number; currency?: string };
    };
    const balance = Number(data.credits?.current_balance);
    if (!Number.isFinite(balance)) {
      return {
        ok: false,
        status: 200,
        message: "Resposta da fal sem saldo (expand=credits requer Admin key)",
      };
    }
    return {
      ok: true,
      balance,
      currency: data.credits?.currency ?? "USD",
      username: data.username,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "Erro ao consultar fal",
    };
  }
}
