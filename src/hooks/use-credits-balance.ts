"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { useHasActiveJobs, useJobsStore } from "@/stores/jobs-store";

/**
 * useCreditsBalance
 * -----------------
 * Polls the Supabase `credits` table for the signed-in user's balance.
 * Refetches quickly (15s) whenever a job is running so the "available"
 * breakdown in the ActivityDrawer feels live without hammering the db in
 * idle state (60s fallback).
 *
 * Also returns the in-flight "inUse" value — the sum of estimated costs
 * for jobs that haven't finished yet — so consumers can render the
 * breakdown `balance · inUse · available` without recomputing it.
 */

const REFETCH_MS_IDLE = 60_000;
const REFETCH_MS_ACTIVE = 15_000;

export type CreditsBalance = {
  /** Last fetched balance from Supabase. `null` while the first fetch runs. */
  balance: number | null;
  /** Aggregate estimated cost of jobs that haven't settled yet. */
  inUse: number;
  /** `balance - inUse`, clamped to 0 when data is still loading. */
  available: number;
  refetch: () => void;
};

export function useCreditsBalance(): CreditsBalance {
  const hasActive = useHasActiveJobs();
  const inUse = useJobsStore((s) =>
    s.jobs
      .filter((j) => j.status === "queued" || j.status === "running")
      .reduce((acc, j) => acc + (j.estimatedCost || 0), 0),
  );

  const [balance, setBalance] = useState<number | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    async function run() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return;
        const { data: row } = await supabase
          .from("credits")
          .select("balance")
          .eq("user_id", auth.user.id)
          .single();
        if (cancelled) return;
        if (row && typeof row.balance === "number") {
          setBalance(row.balance);
        }
      } catch {
        /* swallow — balance stays at last known value. */
      }
    }
    void run();
    const interval = setInterval(run, hasActive ? REFETCH_MS_ACTIVE : REFETCH_MS_IDLE);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasActive, refetchTick]);

  const available = balance === null ? 0 : Math.max(0, balance - inUse);

  return {
    balance,
    inUse,
    available,
    refetch: () => setRefetchTick((t) => t + 1),
  };
}
