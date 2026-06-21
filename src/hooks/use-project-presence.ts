"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type PresenceEntry = {
  sessionId: string;
  userId: string;
  deviceLabel: string;
  openedAt: number;
};

/**
 * A single shared presence channel per project, reference-counted across every
 * consumer in the tab. Supabase-js caches channels by topic, so two components
 * each calling `supabase.channel("project-presence:X")` would touch the SAME
 * instance — the second `.on("presence")` lands after the first `.subscribe()`
 * and throws ("cannot add presence callbacks after subscribe()"), and two
 * `sessionId`s would also double-count the tab. Centralizing the channel here
 * means any number of consumers share one subscription and one sessionId.
 */
type PresenceRoom = {
  supabase: SupabaseClient;
  channel: RealtimeChannel;
  sessionId: string;
  subscribers: Set<(list: PresenceEntry[]) => void>;
  latest: PresenceEntry[];
  refCount: number;
};

const rooms = new Map<string, PresenceRoom>();

function getOrCreateRoom(projectId: string): PresenceRoom {
  const existing = rooms.get(projectId);
  if (existing) return existing;

  const supabase = createClient();
  const sessionId = crypto.randomUUID();

  // The channel name uses the project id directly — Realtime sandboxes presence
  // state per channel name, so different projects don't bleed.
  const channel = supabase.channel(`project-presence:${projectId}`, {
    config: { presence: { key: sessionId } },
  });

  const room: PresenceRoom = {
    supabase,
    channel,
    sessionId,
    subscribers: new Set(),
    latest: [],
    refCount: 0,
  };

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ user_id?: string; device_label?: string; opened_at?: number }>
      >;
      const next: PresenceEntry[] = [];
      for (const [key, metas] of Object.entries(state)) {
        // Last meta wins — presence emits an array per key on conflict.
        const meta = metas[metas.length - 1];
        if (!meta) continue;
        if (key === sessionId) continue; // skip self
        next.push({
          sessionId: key,
          userId: meta.user_id ?? "",
          deviceLabel: meta.device_label ?? "Desconhecido",
          openedAt: meta.opened_at ?? Date.now(),
        });
      }
      room.latest = next;
      room.subscribers.forEach((fn) => fn(next));
    })
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await channel.track({
        user_id: user.id,
        device_label: deriveDeviceLabel(),
        opened_at: Date.now(),
      });
    });

  rooms.set(projectId, room);
  return room;
}

/**
 * Tracks other concurrent sessions of the same project via Supabase Realtime
 * presence. Returns the list of *other* sessions (the current one is filtered
 * out by `sessionId`) so the UI can show a passive awareness badge without
 * blocking anything. Safe to call from multiple components for the same
 * project — they all share one underlying channel (see {@link PresenceRoom}).
 *
 * Failure modes (the hook stays a no-op rather than throwing):
 *   - Realtime disabled on the Supabase project → channel never receives
 *     `sync`, `otherSessions` stays empty.
 *   - Network drop / page hidden → presence library handles re-sync.
 *   - User not authenticated → presence is never tracked, list stays empty.
 */
export function useProjectPresence(projectId: string | null): {
  otherSessions: PresenceEntry[];
  totalSessions: number;
  selfSessionId: string;
} {
  const [otherSessions, setOtherSessions] = useState<PresenceEntry[]>([]);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    if (!projectId || typeof window === "undefined") return;

    const room = getOrCreateRoom(projectId);
    sessionIdRef.current = room.sessionId;

    const onChange = (list: PresenceEntry[]) => setOtherSessions(list);
    room.subscribers.add(onChange);
    room.refCount += 1;
    setOtherSessions(room.latest); // sync to current state immediately

    return () => {
      room.subscribers.delete(onChange);
      room.refCount -= 1;
      // Last consumer leaves → tear the channel down so we don't leak it.
      if (room.refCount <= 0) {
        rooms.delete(projectId);
        void room.channel.untrack();
        void room.supabase.removeChannel(room.channel);
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
