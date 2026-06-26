import { fal } from "@fal-ai/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fal API key resolver — admin BYOK (bring-your-own-key)
 * ------------------------------------------------------
 * The Fal key used for EVERY generation is resolved at request time from a
 * single source of truth:
 *
 *   1. a custom key stored (encrypted-at-rest by Postgres) in `app_secrets`
 *      (key = 'fal_api_key') — set by an admin via /admin/settings, so the
 *      owner can charge a different Fal account (e.g. the company's) WITHOUT a
 *      redeploy, or
 *   2. the build-time `FAL_KEY` env var, used as the fallback when no custom key
 *      is set (so with NO custom key the behavior is unchanged).
 *
 * `app_secrets` is service-role-only (RLS enabled, no policies — see migration
 * 00028), so the key never reaches the browser and only this server module +
 * the admin API can touch it.
 *
 * Propagation: reads are memoized in a short module-scope TTL cache to avoid a
 * DB hit on every Fal call. A key swap therefore takes effect within ~{@link
 * CACHE_TTL_MS} on instances that haven't seen the change yet (the instance
 * that performed the swap updates its cache immediately). Acceptable because the
 * app caps global Fal concurrency at 2 and the key only changes when an admin
 * swaps it.
 *
 * The `fal` singleton from `@fal-ai/client` is shared process-wide; {@link
 * configureFal} mutates it. That is safe here because in steady state every
 * in-flight request uses the SAME key — it only differs during the brief window
 * right after an admin swap (documented, accepted trade-off).
 */

/** app_secrets row key for the custom Fal API key. */
const FAL_KEY_SECRET = "fal_api_key";

/** Fal REST API base (mirrors @fal-ai/client's getRestApiUrl()). */
const FAL_REST_URL = "https://rest.fal.ai";

/** How long a resolved key is trusted before we re-read `app_secrets`. */
const CACHE_TTL_MS = 20_000;

type KeyCache = { custom: string | undefined; at: number };
let cache: KeyCache | null = null;

/** Read the custom key straight from `app_secrets` (service-role). Never throws. */
async function readCustomKey(): Promise<string | undefined> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("app_secrets")
      .select("value")
      .eq("key", FAL_KEY_SECRET)
      .maybeSingle();
    if (error) {
      // Fail open to the env key — never block generations on a transient read.
      console.error("[fal-key] read app_secrets failed:", error.message);
      return undefined;
    }
    const value = typeof data?.value === "string" ? data.value.trim() : "";
    return value.length > 0 ? value : undefined;
  } catch (err) {
    console.error(
      "[fal-key] read app_secrets threw:",
      err instanceof Error ? err.message : "unknown",
    );
    return undefined;
  }
}

/**
 * Resolve the active Fal key: the custom key from `app_secrets` if present,
 * otherwise the `FAL_KEY` env var. TTL-cached. Returns `undefined` only when
 * neither is configured.
 */
export async function getFalKey(): Promise<string | undefined> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.custom ?? process.env.FAL_KEY;
  }
  const custom = await readCustomKey();
  cache = { custom, at: now };
  return custom ?? process.env.FAL_KEY;
}

/**
 * Point the shared `fal` client at the active key. Call at the start of every
 * request handler (and before every Fal submit) that talks to Fal — this is the
 * sole place credentials are configured now that the module-level `fal.config`
 * lines have been removed.
 */
export async function configureFal(): Promise<void> {
  const credentials = (await getFalKey()) ?? "";
  fal.config({ credentials });
}

/** Mask a key for display — only the last 4 chars are ever shown. */
export function maskKey(key: string | null | undefined): string | null {
  const s = (key ?? "").trim();
  if (!s) return null;
  return `••••${s.slice(-4)}`;
}

export type FalKeyStatus = {
  /** 'custom' when a key is stored in app_secrets, else 'env'. */
  source: "custom" | "env";
  /** Masked last-4 of the ACTIVE key, or null if nothing is configured at all. */
  masked: string | null;
  /** Whether a custom key row exists (so the UI can offer "revert to env"). */
  hasCustom: boolean;
};

/**
 * Current key status for the admin panel. Reads `app_secrets` directly (bypasses
 * the TTL cache) so the panel always shows the truth right after a save/revert.
 * NEVER returns the full key — only the masked last 4.
 */
export async function getFalKeyStatus(): Promise<FalKeyStatus> {
  const custom = await readCustomKey();
  const active = custom ?? process.env.FAL_KEY ?? "";
  return {
    source: custom ? "custom" : "env",
    masked: maskKey(active),
    hasCustom: Boolean(custom),
  };
}

/** Upsert the custom Fal key (service-role) and refresh the local cache. */
export async function setFalKey(key: string, updatedBy: string): Promise<void> {
  const value = key.trim();
  if (!value) throw new Error("Chave vazia");
  const admin = createAdminClient();
  const { error } = await admin.from("app_secrets").upsert(
    {
      key: FAL_KEY_SECRET,
      value,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  // Immediate local propagation; other instances pick it up within the TTL.
  cache = { custom: value, at: Date.now() };
}

/** Delete the custom Fal key (service-role) → revert to env FAL_KEY. */
export async function clearFalKey(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_secrets")
    .delete()
    .eq("key", FAL_KEY_SECRET);
  if (error) throw new Error(error.message);
  cache = { custom: undefined, at: Date.now() };
}

export type FalKeyValidation = { ok: true } | { ok: false; message: string };

/**
 * Validate a CANDIDATE Fal key by making a lightweight, authenticated request to
 * Fal — WITHOUT mutating the shared `fal` singleton (so a bad candidate can
 * never poison live generations). Uses the storage "initiate upload" endpoint:
 * it authenticates the key (401/403 ⇒ invalid) but transfers no file bytes, and
 * — unlike the account-billing endpoint — works for ANY valid key regardless of
 * billing scope. The candidate is never logged or echoed back in errors.
 */
export async function validateFalKey(
  candidate: string,
): Promise<FalKeyValidation> {
  const key = candidate.trim();
  if (!key) return { ok: false, message: "Informe a chave" };

  try {
    const res = await fetch(
      `${FAL_REST_URL}/storage/upload/initiate?storage_type=fal-cdn-v3`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          content_type: "text/plain",
          file_name: "animov-key-check.txt",
        }),
        cache: "no-store",
      },
    );

    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Chave inválida (a fal recusou a autenticação)" };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `Não foi possível validar a chave (fal HTTP ${res.status})`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Erro de rede ao validar a chave na fal" };
  }
}
