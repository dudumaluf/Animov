"use client";

import { registerExecutor } from "@/stores/batches-store";
import type { ExecutorFn } from "@/stores/jobs-store";

/**
 * image.edit executor
 * -------------------
 * Thin wrapper around /api/edit-image for image transformations that benefit
 * from batch orchestration (e.g. LLM-driven or multi-image workflows). The
 * existing `ImageEditModal` keeps its own inline call path for the
 * interactive one-shot flow; this executor is what higher-level batch UIs
 * (and the future recipe engine) dispatch through the jobs-store.
 *
 * Payload is intentionally minimal — the caller owns image URL resolution
 * and any pre-processing (ensureSceneHttpsPhotoUrl etc.) so this executor
 * stays dependency-free and reusable outside the scene graph.
 */

export type ImageEditPayload = {
  imageUrl: string;
  prompt: string;
  /**
   * Optional strength/guidance knobs exposed by /api/edit-image. Passed
   * through as-is so this executor doesn't need to know the backend's
   * specific parameter names.
   */
  options?: Record<string, unknown>;
};

const execute: ExecutorFn = async ({ payload, signal }) => {
  const p = payload as ImageEditPayload;

  const res = await fetch("/api/edit-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: p.imageUrl,
      prompt: p.prompt,
      ...(p.options ?? {}),
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  const actualCost =
    typeof data.creditsCost === "number" ? (data.creditsCost as number) : undefined;

  return {
    actualCost,
    data: { imageUrl: data.imageUrl ?? data.url, raw: data },
  };
};

registerExecutor("image.edit", execute);

export const imageEditExecutor = execute;
