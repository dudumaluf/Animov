import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getReferenceStatus,
  getReferenceResult,
  referenceUsdCost,
  type ReferenceTier,
  type ReferenceResolution,
} from "@/lib/adapters/seedance-reference";
import { configureFal } from "@/lib/fal-key";

// Polls a previously-submitted fal reference job and finalizes it: on success
// it records the generation log; on failure it refunds the credits debited at
// submit. Both transitions are claimed atomically (status pending → terminal)
// so repeat polls never double-log or double-refund. Fast either way.
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { requestId?: string };

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await configureFal();

  let requestId: string;
  try {
    const body = (await req.json()) as Body;
    requestId = (body.requestId ?? "").trim();
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin
    .from("reference_jobs")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Already finalized — return the cached outcome (idempotent re-poll).
  if (job.status === "completed") {
    return NextResponse.json({
      status: "completed",
      videoUrl: job.result_url,
      duration: job.duration,
      creditsCost: job.credit_cost,
    });
  }
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", error: job.error ?? "Generation failed" });
  }

  const tier = (job.model_tier as ReferenceTier) ?? "standard";
  const resolution = (job.resolution as ReferenceResolution) ?? "720p";

  // Still pending — ask fal where it's at (same tier it was submitted to).
  let state: string;
  try {
    state = await getReferenceStatus(requestId, tier);
  } catch (err) {
    // Transient status error — let the client keep polling.
    console.error("[generate-reference:status] status check", err);
    return NextResponse.json({ status: "pending" });
  }

  if (state !== "COMPLETED") {
    return NextResponse.json({ status: state === "IN_PROGRESS" ? "in_progress" : "queued" });
  }

  // fal says COMPLETED — fetch the result (throws if the job errored).
  try {
    const { videoUrl, seed } = await getReferenceResult(requestId, tier);

    // Claim the pending → completed transition; only the winner logs.
    const { data: claimed } = await admin
      .from("reference_jobs")
      .update({
        status: "completed",
        result_url: videoUrl,
        finished_at: new Date().toISOString(),
      })
      .eq("request_id", requestId)
      .eq("status", "pending")
      .select("request_id")
      .maybeSingle();

    if (claimed) {
      await admin.from("generation_logs").insert({
        user_id: user.id,
        model_id: null,
        generation_type: "reference",
        preset_id: job.preset_id ?? null,
        final_positive_prompt: job.prompt,
        duration_seconds: job.duration,
        cost: referenceUsdCost(job.duration, tier, resolution),
        request_payload: {
          imageUrls: job.image_urls,
          duration: job.duration,
          generateAudio: job.generate_audio,
          presetId: job.preset_id ?? null,
          tier,
          resolution,
          aspectRatio: job.aspect_ratio ?? "auto",
        },
        response_payload: { videoUrl, seed: seed ?? null },
      });
    }

    return NextResponse.json({
      status: "completed",
      videoUrl,
      duration: job.duration,
      creditsCost: job.credit_cost,
      seed: seed ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";

    // Claim the pending → failed transition; only the winner refunds.
    const { data: claimed } = await admin
      .from("reference_jobs")
      .update({
        status: "failed",
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq("request_id", requestId)
      .eq("status", "pending")
      .select("request_id")
      .maybeSingle();

    if (claimed) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: job.credit_cost,
        p_reason: `Reembolso: falha na geração de referência (${job.credit_cost}cr)`,
        p_admin_id: null,
      });
    }

    const falBody = (err as Record<string, unknown>)?.body;
    const detail = falBody && typeof falBody === "object" ? JSON.stringify(falBody) : undefined;
    console.error("[generate-reference:status] result", err, detail ?? "");

    return NextResponse.json({ status: "failed", error: message });
  }
}
