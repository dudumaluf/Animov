import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_MODEL_ID, creditCostFor } from "@/lib/adapters";
import { ensureFalUrl } from "@/lib/fal-helpers";
import { dispatch } from "@/lib/jobs/dispatch";
import { configureFal } from "@/lib/fal-key";

// SUBMIT-ONLY sibling of /api/generate-transition. Debits, resolves the two
// frame URLs, inserts a `queued` generation_jobs row, then best-effort
// dispatches. The client polls /api/generate/status. The synchronous route
// stays as a fallback.
export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_PROMPT =
  "Smooth cinematic camera transition between two interior spaces. " +
  "Continuous fluid movement, photorealistic, locked architecture, " +
  "preserve all visible surfaces exactly. No new elements, no scene morphing, natural camera flow.";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await configureFal();

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const startImageUrl = body.startImageUrl as string | undefined;
  const endImageUrl = body.endImageUrl as string | undefined;
  const duration = Number(body.duration ?? 5) || 5;
  const modelId = (body.modelId as string) || DEFAULT_MODEL_ID;
  const guidancePrompt =
    typeof body.guidancePrompt === "string" ? body.guidancePrompt.trim() : "";
  const transitionId = typeof body.transitionId === "string" ? body.transitionId : undefined;
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;

  if (!startImageUrl || !endImageUrl) {
    return NextResponse.json(
      { error: "startImageUrl and endImageUrl are required" },
      { status: 400 },
    );
  }

  const creditCost = creditCostFor(modelId, duration);
  const admin = createAdminClient();

  let debited = false;
  let jobId: string | null = null;
  try {
    const { data: newBalance, error: debitError } = await admin.rpc("debit_credit", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_reason: `Transição AI (fila): duration=${duration}s, model=${modelId}, cost=${creditCost}cr`,
    });

    if (debitError) {
      if (debitError.message.includes("Insufficient")) {
        return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
      }
      return NextResponse.json({ error: debitError.message }, { status: 500 });
    }
    debited = true;

    const [falStartUrl, falEndUrl] = await Promise.all([
      ensureFalUrl(startImageUrl),
      ensureFalUrl(endImageUrl),
    ]);

    const prompt = guidancePrompt
      ? `${BASE_PROMPT} Director's note: ${guidancePrompt}`
      : BASE_PROMPT;

    const { data: inserted, error: insertError } = await admin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        type: "transition",
        status: "queued",
        model_id: modelId,
        credit_cost: creditCost,
        duration,
        target_id: transitionId ?? null,
        project_id: projectId ?? null,
        payload: {
          startFrameUrl: falStartUrl,
          endFrameUrl: falEndUrl,
          prompt,
        },
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(`generation_jobs insert: ${insertError?.message ?? "no row"}`);
    }
    jobId = inserted.id as string;

    try {
      await dispatch(admin);
    } catch (dispatchErr) {
      console.error("[generate-transition:submit] dispatch (non-fatal)", dispatchErr);
    }

    return NextResponse.json({ jobId, creditsCost: creditCost, creditsRemaining: newBalance });
  } catch (err: unknown) {
    if (debited && !jobId) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: creditCost,
        p_reason: `Reembolso: falha ao enfileirar transição (${creditCost}cr)`,
        p_admin_id: null,
      });
    }
    const message = err instanceof Error ? err.message : "Submit failed";
    console.error("[generate-transition:submit]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
