import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatch, reapStale, reapSubmitted } from "@/lib/jobs/dispatch";
import { configureFal } from "@/lib/fal-key";

// Vercel Cron (~1 min) heartbeat for the generation queue: reap stuck jobs
// (frees leaked slots), reap finished in-flight jobs (frees slots, logs success
// / refunds failures), then dispatch queued jobs up to fal_max_concurrent. This
// keeps the queue advancing even when no client tab is polling. Guarded by
// CRON_SECRET (Vercel sends it as a Bearer token).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    return header === `Bearer ${secret}`;
  }
  // No secret configured: allow only in local dev. Any deployed env runs with
  // NODE_ENV=production (Vercel sets this for production AND preview builds), so
  // a missing secret fails closed there — the endpoint is never publicly open.
  return process.env.NODE_ENV !== "production";
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await configureFal();
  const admin = createAdminClient();
  try {
    await reapStale(admin);
    await reapSubmitted(admin);
    await dispatch(admin);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cron:dispatch]", err);
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

// Vercel Cron uses GET; POST kept for manual triggering / future flexibility.
export async function POST(req: NextRequest) {
  return run(req);
}
