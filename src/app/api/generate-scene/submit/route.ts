import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter, DEFAULT_MODEL_ID, creditCostFor } from "@/lib/adapters";
import { buildPromptForScene } from "@/lib/presets/build-prompt";
import { ensureFalUrl } from "@/lib/fal-helpers";
import { dispatch } from "@/lib/jobs/dispatch";

fal.config({ credentials: process.env.FAL_KEY! });

// SUBMIT-ONLY sibling of /api/generate-scene. Debits, builds the prompt, inserts
// a `queued` generation_jobs row, then best-effort dispatches (global cap gate).
// The heavy render runs on fal; the client polls /api/generate/status. The
// classic synchronous route stays as a fallback. Short ceiling — no render hold.
export const runtime = "nodejs";
export const maxDuration = 60;

type JsonBody = {
  photoUrl?: string;
  presetId?: string;
  duration?: number;
  modelId?: string;
  guidancePrompt?: string;
  sceneId?: string;
  projectId?: string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let photoUrl: string;
  let presetId = "push_in_serene";
  let duration = 5;
  let modelId = DEFAULT_MODEL_ID;
  let guidancePrompt: string | undefined;
  let sceneId: string | undefined;
  let projectId: string | undefined;

  try {
    const body = (await req.json()) as JsonBody;
    if (!body.photoUrl) {
      return NextResponse.json({ error: "photoUrl is required" }, { status: 400 });
    }
    photoUrl = body.photoUrl;
    presetId = body.presetId ?? presetId;
    duration = Number(body.duration ?? duration);
    modelId = body.modelId ?? modelId;
    guidancePrompt = body.guidancePrompt?.trim() || undefined;
    sceneId = typeof body.sceneId === "string" ? body.sceneId : undefined;
    projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  } catch (err) {
    console.error("[generate-scene:submit] parse body", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const adapter = getAdapter(modelId);
  const creditCost = creditCostFor(modelId, duration);
  const admin = createAdminClient();

  let debited = false;
  let jobId: string | null = null;
  try {
    const { data: newBalance, error: debitError } = await admin.rpc("debit_credit", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_reason: `Cena (fila): preset=${presetId}, duration=${duration}s, model=${modelId}, cost=${creditCost}cr`,
    });

    if (debitError) {
      if (debitError.message.includes("Insufficient")) {
        return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
      }
      return NextResponse.json({ error: debitError.message }, { status: 500 });
    }
    debited = true;

    const falPhotoUrl = await ensureFalUrl(photoUrl);
    const { positive, negative } = await buildPromptForScene({
      photoUrl: falPhotoUrl,
      presetId,
      adapter,
      guidancePrompt,
    });

    const { data: inserted, error: insertError } = await admin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        type: "scene",
        status: "queued",
        model_id: modelId,
        credit_cost: creditCost,
        duration,
        target_id: sceneId ?? null,
        project_id: projectId ?? null,
        payload: {
          photoUrl: falPhotoUrl,
          prompt: positive,
          negativePrompt: negative,
          presetId,
        },
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(`generation_jobs insert: ${insertError?.message ?? "no row"}`);
    }
    jobId = inserted.id as string;

    // Best-effort immediate start. If it throws (or the cap is full) the row
    // stays `queued` and the cron dispatcher picks it up — never refund here.
    try {
      await dispatch(admin);
    } catch (dispatchErr) {
      console.error("[generate-scene:submit] dispatch (non-fatal)", dispatchErr);
    }

    return NextResponse.json({ jobId, creditsCost: creditCost, creditsRemaining: newBalance });
  } catch (err: unknown) {
    if (debited && !jobId) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: creditCost,
        p_reason: `Reembolso: falha ao enfileirar cena (${creditCost}cr)`,
        p_admin_id: null,
      });
    }
    const message = err instanceof Error ? err.message : "Submit failed";
    console.error("[generate-scene:submit]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
