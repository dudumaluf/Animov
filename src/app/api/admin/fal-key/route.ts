import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getFalKeyStatus,
  setFalKey,
  clearFalKey,
  validateFalKey,
  maskKey,
} from "@/lib/fal-key";
import { getFalBalance } from "@/lib/fal-billing";

/**
 * Admin BYOK endpoint for the Fal API key.
 * --------------------------------------------------
 * Lets an admin swap the Fal key used by ALL generations (so the owner can
 * charge a different Fal account) and revert to the env `FAL_KEY` — all without
 * a redeploy. Every method is admin-gated (role === 'admin') and the FULL key is
 * NEVER returned to the client (masked last-4 only). The key lives in the
 * service-role-only `app_secrets` table (RLS, no policies — migration 00028).
 */

export const runtime = "nodejs";

/** Current key status — { source, masked (last4 only), hasCustom }. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const status = await getFalKeyStatus();
  return NextResponse.json(status);
}

/**
 * Set a custom Fal key. The candidate is validated against Fal BEFORE saving —
 * if Fal refuses the auth, nothing is written. Never echoes the key back.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let key: string;
  try {
    const body = (await req.json()) as { key?: unknown };
    key = typeof body.key === "string" ? body.key.trim() : "";
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ error: "Informe a chave" }, { status: 400 });
  }

  // Test the key before persisting — reject (do NOT save) if Fal rejects auth.
  const valid = await validateFalKey(key);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.message }, { status: 400 });
  }

  try {
    await setFalKey(key, guard.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar a chave";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Informational only — reflects the account that will now be charged. A valid
  // generation key may lack billing scope; that never blocks the save.
  const balance = await getFalBalance(key);

  return NextResponse.json({
    ok: true,
    source: "custom",
    masked: maskKey(key),
    hasCustom: true,
    billingOk: balance.ok,
    balance: balance.ok ? balance.balance : null,
    currency: balance.ok ? balance.currency : null,
  });
}

/** Remove the custom key → revert to env `FAL_KEY`. */
export async function DELETE() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    await clearFalKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao remover a chave";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const status = await getFalKeyStatus();
  return NextResponse.json({ ok: true, ...status });
}
