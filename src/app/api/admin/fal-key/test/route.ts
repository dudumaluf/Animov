import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateFalKey } from "@/lib/fal-key";
import { getFalBalance } from "@/lib/fal-billing";

/**
 * Validate a CANDIDATE Fal key WITHOUT saving it (the "Testar" button). Admin-
 * gated. Returns whether the key authenticates with Fal and, if available, the
 * prepaid balance of the account it points at. Never echoes the key.
 */

export const runtime = "nodejs";

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

  const valid = await validateFalKey(key);
  if (!valid.ok) {
    return NextResponse.json({ ok: false, error: valid.message });
  }

  const balance = await getFalBalance(key);
  return NextResponse.json({
    ok: true,
    billingOk: balance.ok,
    balance: balance.ok ? balance.balance : null,
    currency: balance.ok ? balance.currency : null,
  });
}
