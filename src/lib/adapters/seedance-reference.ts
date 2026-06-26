import { fal } from "@fal-ai/client";

/**
 * Seedance 2.0 reference-to-video
 * --------------------------------
 * Distinct from the standard {@link VideoModelAdapter} (single start frame):
 * this endpoint takes up to 9 reference images that the prompt addresses by
 * `@Image1..@ImageN`. It does not fit the generateScene/Transition shape, so
 * it lives as a standalone helper consumed by `/api/generate-reference`.
 *
 * Two tiers share the same queue API and IO shape — only the model id, latency
 * and price differ:
 *   - standard → `bytedance/seedance-2.0/reference-to-video`
 *   - fast     → `bytedance/seedance-2.0/fast/reference-to-video`
 *
 * Docs: https://fal.ai/models/bytedance/seedance-2.0/reference-to-video
 */

/** Quality/speed tier. `fast` is cheaper + lower-latency, `standard` is the default. */
export type ReferenceTier = "standard" | "fast";

/**
 * Output resolution. 480p renders faster/cheaper; 720p is the balanced default;
 * 1080p is highest-quality (standard tier only — fast tops out at 720p).
 */
export type ReferenceResolution = "480p" | "720p" | "1080p";

/**
 * Aspect ratio sent to Seedance. `auto` lets the model decide; the rest are the
 * concrete enum values the endpoint accepts. (`project` — "follow the canvas" —
 * is a UI-only preference resolved to one of these before submit.)
 */
export type ReferenceAspectRatio =
  | "auto"
  | "21:9"
  | "16:9"
  | "4:3"
  | "1:1"
  | "3:4"
  | "9:16";

const MODEL_IDS: Record<ReferenceTier, string> = {
  standard: "bytedance/seedance-2.0/reference-to-video",
  fast: "bytedance/seedance-2.0/fast/reference-to-video",
};

/** Public alias (standard tier) so callers can reference the fal endpoint id. */
export const REFERENCE_MODEL_ID = MODEL_IDS.standard;

/** Resolve a tier to its fal model id, defaulting to standard. */
export function referenceModelId(tier: ReferenceTier | undefined): string {
  return MODEL_IDS[tier ?? "standard"] ?? MODEL_IDS.standard;
}

/**
 * fal USD per second of output, by tier + resolution (image inputs, no video).
 * Derived from fal's token pricing — tokens/s = W·H·24/1024 (≈9.6k @ 480p,
 * 21.6k @ 720p, 48.6k @ 1080p) at $0.014/1k (standard) or $0.0112/1k (fast).
 * These match fal's published per-second figures. (fast/1080p is listed for
 * type completeness but never selectable — fast only supports up to 720p.)
 */
const REFERENCE_USD_PER_SECOND: Record<
  ReferenceTier,
  Record<ReferenceResolution, number>
> = {
  standard: { "480p": 0.1345, "720p": 0.3034, "1080p": 0.682 },
  fast: { "480p": 0.1076, "720p": 0.2419, "1080p": 0.5443 },
};

/** Resolutions each tier actually supports. fast tops out at 720p. */
export const REFERENCE_RESOLUTIONS_BY_TIER: Record<ReferenceTier, ReferenceResolution[]> = {
  standard: ["480p", "720p", "1080p"],
  fast: ["480p", "720p"],
};

/** Clamp a resolution to one the tier supports (fast can't do 1080p → 720p). */
export function clampResolutionForTier(
  tier: ReferenceTier,
  resolution: ReferenceResolution,
): ReferenceResolution {
  return REFERENCE_RESOLUTIONS_BY_TIER[tier].includes(resolution) ? resolution : "720p";
}

/** Credit/USD anchor — the original standard@720p price point (kept stable). */
const ANCHOR_CREDITS_PER_SECOND = 3;
const ANCHOR_USD_PER_SECOND = 0.3034;

/**
 * Standard-tier fal USD/s by resolution. This is ALSO the price basis for the
 * Seedance image-to-video adapter (same model family, same per-second rates),
 * so both endpoints scale credits off identical numbers. Exported so the i2v
 * adapter doesn't duplicate the constants. 4k is intentionally omitted — we
 * don't expose it (no clean $/s constant).
 */
export const SEEDANCE_STANDARD_USD_PER_SECOND: Record<ReferenceResolution, number> =
  REFERENCE_USD_PER_SECOND.standard;

/**
 * Single source of truth for Seedance credit scaling: credits/s from a fal
 * USD/s figure, anchored at standard@720p (3 cr/s @ $0.3034/s). Used by BOTH
 * the reference-to-video and image-to-video adapters so a given resolution
 * costs the same credits regardless of which Seedance endpoint renders it.
 */
export function seedanceCreditsPerSecondFromUsd(usdPerSecond: number): number {
  return (usdPerSecond / ANCHOR_USD_PER_SECOND) * ANCHOR_CREDITS_PER_SECOND;
}

/** Credits debited per second @ standard/720p (back-compat anchor export). */
export const REFERENCE_CREDITS_PER_SECOND = ANCHOR_CREDITS_PER_SECOND;

/** USD per second @ standard/720p (back-compat anchor export). */
export const REFERENCE_COST_PER_SECOND = ANCHOR_USD_PER_SECOND;

/** Default tier/resolution/aspect when a scene predates these options. */
export const REFERENCE_DEFAULT_TIER: ReferenceTier = "standard";
export const REFERENCE_DEFAULT_RESOLUTION: ReferenceResolution = "720p";
export const REFERENCE_DEFAULT_ASPECT: ReferenceAspectRatio = "auto";

/** Curated duration chips shown in the reference inspector. */
export const REFERENCE_CURATED_DURATIONS = [4, 5, 6, 7, 8, 10, 12, 15] as const;

/** Seedance reference-to-video accepts at most 9 reference images. */
export const REFERENCE_MAX_IMAGES = 9;

type SeedanceOutput = {
  video: {
    url: string;
    content_type?: string;
    file_size?: number;
    file_name?: string;
  };
  seed?: number;
};

/** Seedance accepts 4–15 seconds (or "auto"); we pin a concrete value for timeline predictability. */
export function clampReferenceDuration(seconds: number): number {
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s) || s <= 0) return 5;
  return Math.max(4, Math.min(15, s));
}

/**
 * Credits charged per second for a tier+resolution. Scales off the standard@720p
 * anchor by the fal-cost ratio, so margins stay consistent and cheaper combos
 * cost proportionally fewer credits.
 */
export function referenceCreditsPerSecond(
  tier: ReferenceTier = REFERENCE_DEFAULT_TIER,
  resolution: ReferenceResolution = REFERENCE_DEFAULT_RESOLUTION,
): number {
  return seedanceCreditsPerSecondFromUsd(REFERENCE_USD_PER_SECOND[tier][resolution]);
}

/**
 * Credits charged for a reference generation. Total is rounded UP so we never
 * charge below the fal cost basis; standard/720p stays exactly `3 × duration`
 * (no regression for existing scenes).
 */
export function referenceCreditCost(
  durationSeconds: number,
  tier: ReferenceTier = REFERENCE_DEFAULT_TIER,
  resolution: ReferenceResolution = REFERENCE_DEFAULT_RESOLUTION,
): number {
  const d = clampReferenceDuration(durationSeconds);
  return Math.max(1, Math.ceil(d * referenceCreditsPerSecond(tier, resolution)));
}

/** USD cost of a generation — recorded in `generation_logs` for accounting. */
export function referenceUsdCost(
  durationSeconds: number,
  tier: ReferenceTier = REFERENCE_DEFAULT_TIER,
  resolution: ReferenceResolution = REFERENCE_DEFAULT_RESOLUTION,
): number {
  const d = clampReferenceDuration(durationSeconds);
  return REFERENCE_USD_PER_SECOND[tier][resolution] * d;
}

export type ReferenceVideoInput = {
  /** The composed `@Image1..N` prompt. */
  prompt: string;
  /** Reference image URLs (https). Trimmed to the first {@link REFERENCE_MAX_IMAGES}. */
  imageUrls: string[];
  /** Target duration in seconds (clamped to 4–15). */
  duration: number;
  /** Quality/speed tier (default standard). */
  tier?: ReferenceTier;
  /** Output resolution (default 720p). */
  resolution?: ReferenceResolution;
  /** Concrete aspect ratio (already resolved from any UI preference). Default auto. */
  aspectRatio?: ReferenceAspectRatio;
  /** Whether Seedance should also synthesize audio (default off). */
  generateAudio?: boolean;
};

export type ReferenceVideoResult = {
  videoUrl: string;
  durationSeconds: number;
  seed?: number;
};

/** Builds the fal input payload (clamps duration, trims to 9 images). */
function buildReferenceInput(input: ReferenceVideoInput) {
  return {
    prompt: input.prompt,
    image_urls: input.imageUrls.slice(0, REFERENCE_MAX_IMAGES),
    resolution: input.resolution ?? REFERENCE_DEFAULT_RESOLUTION,
    duration: String(clampReferenceDuration(input.duration)),
    aspect_ratio: input.aspectRatio ?? REFERENCE_DEFAULT_ASPECT,
    generate_audio: input.generateAudio ?? false,
  };
}

/**
 * Enqueue a reference-to-video job and return immediately with the fal
 * `request_id`. The caller persists it (with the tier) and polls
 * {@link getReferenceStatus} — this keeps the serverless function short (no
 * waiting for the full render, so no 504 / lost credits).
 */
export async function submitReferenceVideo(input: ReferenceVideoInput): Promise<string> {
  const submitted = await fal.queue.submit(referenceModelId(input.tier), {
    input: buildReferenceInput(input) as never,
  });
  return submitted.request_id;
}

export type ReferenceQueueState = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

/**
 * Lightweight queue status check. `tier` MUST match the tier used at submit —
 * fal scopes the queue by model id, so polling the wrong endpoint 404s.
 */
export async function getReferenceStatus(
  requestId: string,
  tier?: ReferenceTier,
): Promise<ReferenceQueueState> {
  const status = await fal.queue.status(referenceModelId(tier), { requestId });
  return status.status;
}

/**
 * Fetch the finished result. Throws if the job failed (fal returns an error
 * payload) — the status route maps that to a refund. `tier` MUST match submit.
 */
export async function getReferenceResult(
  requestId: string,
  tier?: ReferenceTier,
): Promise<{ videoUrl: string; seed?: number }> {
  const result = (await fal.queue.result(referenceModelId(tier), { requestId })) as {
    data: SeedanceOutput;
  };
  return { videoUrl: result.data.video.url, seed: result.data.seed };
}
