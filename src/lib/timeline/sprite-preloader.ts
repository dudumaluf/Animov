/**
 * Tiny in-memory registry that kicks off HTTP fetch + decode for sprite
 * sheet JPEGs ahead of time. The goal is to eliminate the "black flash"
 * the user would otherwise see the first time they scrub across a card
 * — at that point the `background-image` in SpriteFrame would start its
 * download, and the wrapper would be empty until it finished.
 *
 * Design notes:
 * - Single shared instance keyed by sprite URL. A URL is considered "ready"
 *   as soon as the browser reports decode success (`img.decode()`), meaning
 *   the next element that references it can render synchronously.
 * - We keep a strong reference to the Image so the browser keeps the
 *   decoded bitmap in its image cache for the duration of the session.
 * - `preload(url)` is idempotent and returns the same in-flight promise for
 *   concurrent callers.
 * - `isReady(url)` is synchronous — SpriteFrame uses it to seed its initial
 *   state and skip the fade-in if the sprite is already cached.
 */

type PreloadEntry = {
  img: HTMLImageElement;
  promise: Promise<void>;
  ready: boolean;
};

class SpritePreloader {
  private entries = new Map<string, PreloadEntry>();

  isReady(url: string): boolean {
    return this.entries.get(url)?.ready === true;
  }

  preload(url: string): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    const existing = this.entries.get(url);
    if (existing) return existing.promise;

    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    const promise = new Promise<void>((resolve) => {
      const done = () => {
        const entry = this.entries.get(url);
        if (entry) entry.ready = true;
        resolve();
      };
      img.onload = () => {
        if (typeof img.decode === "function") {
          img.decode().then(done, done);
        } else {
          done();
        }
      };
      img.onerror = () => done();
    });
    img.src = url;

    const entry: PreloadEntry = { img, promise, ready: false };
    this.entries.set(url, entry);
    return promise;
  }

  preloadMany(urls: readonly string[]): void {
    urls.forEach((u) => {
      if (u) this.preload(u);
    });
  }
}

export const spritePreloader = new SpritePreloader();
