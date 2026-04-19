const registry = new Map<string, HTMLVideoElement>();

export const videoRegistry = {
  set(id: string, el: HTMLVideoElement | null) {
    if (el) registry.set(id, el);
    else registry.delete(id);
  },
  get(id: string): HTMLVideoElement | null {
    return registry.get(id) ?? null;
  },
  pauseAll() {
    registry.forEach((v) => {
      try { v.pause(); } catch { /* ignore */ }
    });
  },
  mutedAll(muted: boolean) {
    registry.forEach((v) => {
      try { v.muted = muted; } catch { /* ignore */ }
    });
  },
  has(id: string): boolean {
    return registry.has(id);
  },
  clear() {
    registry.clear();
  },
};
