import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dispatch,
  finalizeJob,
  queuePosition,
  type JobRow,
} from "@/lib/jobs/dispatch";

fal.config({ credentials: process.env.FAL_KEY! });

// Unified poll endpoint for the generic generation queue. Maps a generation_jobs
// row to the client's status contract: `queued` (+ position #N) / `in_progress`
// / `completed` (videoUrl) / `failed` (error, credits already refunded). Drives
// the queue forward on each poll so it advances even without the cron (local dev).
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { jobId?: string };

function done(job: JobRow) {
  return NextResponse.json({
    status: "completed",
    videoUrl: job.result_url,
    duration: job.duration,
    creditsCost: job.credit_cost,
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let jobId: string;
  try {
    const body = (await req.json()) as Body;
    jobId = (body.jobId ?? "").trim();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const loadJob = async (): Promise<JobRow | null> => {
    const { data } = await admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    return (data as JobRow | null) ?? null;
  };

  let job = await loadJob();
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "completed") return done(job);
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", error: job.error ?? "Generation failed" });
  }

  // Not yet in flight — try to advance the queue, then re-read.
  if (job.status === "queued" || job.status === "submitting") {
    try {
      await dispatch(admin);
    } catch (err) {
      console.error("[generate:status] dispatch (non-fatal)", err);
    }
    job = (await loadJob()) ?? job;
    if (job.status === "queued" || job.status === "submitting") {
      const position = await queuePosition(admin, job);
      return NextResponse.json({ status: "queued", position });
    }
  }

  // In flight — poll fal and finalize if ready.
  if (job.status === "submitted") {
    await finalizeJob(admin, job);
    job = (await loadJob()) ?? job;
    if (job.status === "completed") return done(job);
    if (job.status === "failed") {
      return NextResponse.json({ status: "failed", error: job.error ?? "Generation failed" });
    }
    return NextResponse.json({ status: "in_progress" });
  }

  // Fallback (shouldn't reach) — report queued so the client keeps polling.
  return NextResponse.json({ status: "queued", position: 1 });
}
