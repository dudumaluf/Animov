"use client";

import { useEffect, useState } from "react";

/**
 * useAdminFlags
 * -------------
 * Fetches the admin_feature_flags map on first use, caches it in-module
 * (single fetch across all subscribers), and exposes a merged view of
 * `{...hardcodedDefaults, ...serverValues}` so callers always receive a
 * populated object.
 *
 * The DockRail boots synchronously from `DEFAULT_ADMIN_FLAGS` to avoid a
 * layout flash; server-provided overrides hydrate in over the next tick and
 * re-render affected components. Consumers don't need to gate on "loaded" —
 * the defaults are already a valid shape, and the UI rehydrates transparently
 * once the fetch completes.
 *
 * Flag keys mirror the Supabase seed in
 * `supabase/migrations/00012_admin_feature_flags.sql`. Keeping them in this
 * file lets the UI keep rendering even if the table is unreachable or the
 * user is signed out (API returns an empty `{}` in those cases).
 */

export type DockEdge = "left" | "right";

export type AdminFlags = {
  "dock.panels.properties.edge": DockEdge;
  "dock.panels.activity.edge": DockEdge;
  "dock.default_width": number;
  "dock.properties.auto_open_on_select": boolean;
  "dock.auto_open_activity_on_first_batch": boolean;
  "dock.min_screen_for_both_open": number;
  "dock.resize_enabled": boolean;
  "dock.keyboard_shortcuts": boolean;
  "jobs.max_concurrent": number;
};

export const DEFAULT_ADMIN_FLAGS: AdminFlags = {
  "dock.panels.properties.edge": "right",
  "dock.panels.activity.edge": "left",
  "dock.default_width": 300,
  "dock.properties.auto_open_on_select": true,
  "dock.auto_open_activity_on_first_batch": true,
  "dock.min_screen_for_both_open": 1280,
  "dock.resize_enabled": true,
  "dock.keyboard_shortcuts": false,
  "jobs.max_concurrent": 4,
};

/* ── In-module cache (shared across hook subscribers) ───────────── */

type Cache = {
  flags: AdminFlags;
  loaded: boolean;
  inFlight: Promise<AdminFlags> | null;
};

const cache: Cache = {
  flags: { ...DEFAULT_ADMIN_FLAGS },
  loaded: false,
  inFlight: null,
};

const subscribers = new Set<(flags: AdminFlags) => void>();

function notify() {
  subscribers.forEach((fn) => fn(cache.flags));
}

async function fetchFlagsOnce(): Promise<AdminFlags> {
  if (cache.loaded) return cache.flags;
  if (cache.inFlight) return cache.inFlight;

  cache.inFlight = (async () => {
    try {
      const res = await fetch("/api/admin/feature-flags", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return cache.flags;
      const body = (await res.json()) as { flags?: Record<string, unknown> };
      const server = body.flags ?? {};

      const merged: AdminFlags = { ...DEFAULT_ADMIN_FLAGS };
      for (const k of Object.keys(DEFAULT_ADMIN_FLAGS) as Array<keyof AdminFlags>) {
        if (k in server) {
          // Only coerce into the shape of the default — a malformed row
          // (wrong type, missing field) is ignored so we never tip the UI
          // over into a bad state.
          const raw = (server as Record<string, unknown>)[k];
          if (typeof raw === typeof DEFAULT_ADMIN_FLAGS[k]) {
            (merged as Record<string, unknown>)[k] = raw;
          }
        }
      }

      cache.flags = merged;
      cache.loaded = true;
      notify();
      return merged;
    } catch (err) {
      console.warn("[use-admin-flags]", err);
      return cache.flags;
    } finally {
      cache.inFlight = null;
    }
  })();

  return cache.inFlight;
}

/** Non-hook getter for stores / side-effects that need current flag values. */
export function getAdminFlagsSnapshot(): AdminFlags {
  return cache.flags;
}

/** Non-hook trigger to kick the fetch early (e.g. from a store subscription). */
export function loadAdminFlags(): Promise<AdminFlags> {
  return fetchFlagsOnce();
}

export function useAdminFlags(): AdminFlags {
  const [flags, setFlags] = useState<AdminFlags>(cache.flags);

  useEffect(() => {
    subscribers.add(setFlags);
    void fetchFlagsOnce();
    return () => {
      subscribers.delete(setFlags);
    };
  }, []);

  return flags;
}
