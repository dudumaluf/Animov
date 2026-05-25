"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PresenceEntry = {
  sessionId: string;
  userId: string;
  deviceLabel: string;
  openedAt: number;
};

/**
 * Tracks other concurrent sessions of the same project via Supabase Realtime
 * presence. Returns the list of *other* sessions (the current one is filtered
 * out by `sessionId`) so the UI can show a passive awareness badge without
 * blocking anything.
 *
 * Why a sessionId instead of just user_id?
 *   A single user often has multiple tabs/devices open. Each tab gets its
 *   own random sessionId so the count reflects "active editing surfaces",
 *   not "logged-in users".
 *
 * Failure modes (the hook stays a no-op rather than throwing):
 *   - Realtime disabled on the Supabase project → channel never receives
 *     `sync`, `otherSessions` stays empty.
 *   - Network drop / page hidden → presence library handles re-sync.
 *   - User not authenticated → hook short-circuits, returns empty.
 */
export function useProjectPresence(projectId: string | null): {
  otherSessions: PresenceEntry[];
  totalSessions: number;
  selfSessionId: string;
} {
  // sessionId is stable for the lifetime of this tab/component instance.
  // Stored in a ref (not state) so re-renders don't churn it.
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current && typeof crypto !== "undefined") {
    sessionIdRef.current = crypto.randomUUID();
  }

  const [otherSessions, setOtherSessions] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    if (!projectId) return;
    if (typeof window === "undefined") return;

    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      // Resolve the authenticated user once; presence payload carries this
      // for the badge tooltip (e.g. to flag "you're also in another tab").
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const deviceLabel = deriveDeviceLabel();

      // The channel name uses the project id directly — Realtime sandboxes
      // presence state per channel name, so different projects don't bleed.
      channel = supabase.channel(`project-presence:${projectId}`, {
        config: {
          presence: {
            key: sessionIdRef.current,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!channel) return;
          const state = channel.presenceState() as Record<
            string,
            Array<{
              user_id?: string;
              device_label?: string;
              opened_at?: number;
            }>
          >;
          const next: PresenceEntry[] = [];
          for (const [key, metas] of Object.entries(state)) {
            // Last meta wins — presence emits an array per key on conflict.
            const meta = metas[metas.length - 1];
            if (!meta) continue;
            if (key === sessionIdRef.current) continue; // skip self
            next.push({
              sessionId: key,
              userId: meta.user_id ?? "",
              deviceLabel: meta.device_label ?? "Desconhecido",
              openedAt: meta.opened_at ?? Date.now(),
            });
          }
          setOtherSessions(next);
        })
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED" || !channel) return;
          await channel.track({
            user_id: user.id,
            device_label: deviceLabel,
            opened_at: Date.now(),
          });
        });
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) {
        // Untrack first so other sessions see us drop off immediately,
        // then unsubscribe to release the channel.
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
    };
  }, [projectId]);

  return {
    otherSessions,
    totalSessions: otherSessions.length + 1,
    selfSessionId: sessionIdRef.current,
  };
}

/**
 * Build a human-readable device label from `navigator.userAgent`. The result
 * is intentionally fuzzy — exposing exact UA strings to other users would
 * leak more than we need for a "who else is here" badge.
 */
function deriveDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Servidor";
  const ua = navigator.userAgent;

  const os = /Mac OS X/.test(ua)
    ? "macOS"
    : /Windows NT/.test(ua)
      ? "Windows"
      : /Linux/.test(ua)
        ? "Linux"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Android/.test(ua)
            ? "Android"
            : "Desconhecido";

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";

  return `${os} - ${browser}`;
}
