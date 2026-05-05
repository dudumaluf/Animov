"use client";

import { registerExecutor } from "@/stores/batches-store";
import type { ExecutorFn } from "@/stores/jobs-store";
import { useProjectStore, persistMusicUrlToStorage } from "@/stores/project-store";

/**
 * music executor
 * --------------
 * Wraps the /api/generate-music round-trip. Keeps the Fal URL optimistic (user
 * hears music immediately), then mirrors into our Supabase `music` bucket in
 * the background so the URL is stable across reloads. Falls back to the Fal
 * URL if the mirror upload fails (same behavior as the legacy generateMusic
 * action, now dedupe-gated via the batch system).
 */

export type MusicPayload = {
  prompt: string;
  projectId: string | null;
  instrumental: boolean;
};

const execute: ExecutorFn = async ({ payload, signal }) => {
  const p = payload as MusicPayload;
  const store = useProjectStore;

  const res = await fetch("/api/generate-music", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: p.prompt, instrumental: p.instrumental }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  const falUrl = data.audioUrl as string;

  // Optimistic UI: flip musicUrl to the Fal URL so playback starts immediately.
  store.setState({ musicUrl: falUrl, isDirty: true });

  // Mirror to Supabase. Best-effort; if it fails we keep the Fal URL (user
  // still hears the track during this session — long-term persistence is the
  // only loss, which the UI already warns about on refresh).
  const mirrored = await persistMusicUrlToStorage(falUrl, p.projectId);
  if (mirrored) {
    store.setState({ musicUrl: mirrored, isDirty: true });
  }

  // Cost reported by /api/generate-music — leave undefined if the backend
  // doesn't provide it so the batch can fall back to estimatedCost.
  const actualCost =
    typeof data.creditsCost === "number" ? (data.creditsCost as number) : undefined;

  return {
    actualCost,
    data: { audioUrl: mirrored ?? falUrl },
  };
};

registerExecutor("music", execute);

export const musicExecutor = execute;
