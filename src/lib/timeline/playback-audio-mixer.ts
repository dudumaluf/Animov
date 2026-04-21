import { DEFAULT_AUDIO_MIX, type AudioMixSettings } from "@/lib/composition/compose";

/**
 * Real-time playback audio mixer — approximates the offline mix produced by
 * `compose.ts` so the editor preview sounds close to the exported MP4.
 *
 * Scope (by design, matches Phase 3 plan):
 *   - Music bus: gain + project-level fades (no ducking yet).
 *   - No clip bus yet (added in Phase 3.5).
 *   - No ducking yet (added in Phase 3.7).
 *
 * Signal graph (Phase 3.3):
 *
 *     <audio> ─ MediaElementSource ─▶ musicGain ─▶ destination
 *
 * Notes:
 *   - `AudioContext` is created lazily on first `attachMusic` and resumed
 *     on the first play() attempt from outside. Browsers require a user
 *     gesture before the context can emit sound — the engine's play path
 *     provides that gesture, so we `resume()` opportunistically in tick().
 *   - `MediaElementSource` is single-shot per element. We cache the source
 *     on a WeakMap keyed by the element so swapping the attached element
 *     doesn't throw "already connected".
 *   - If WebAudio isn't available in the environment (very old browsers,
 *     SSR), `supported` returns false and the mixer degrades to no-op so
 *     the engine can fall back to `<audio>.volume` control.
 */
export class PlaybackAudioMixer {
  private ctx: AudioContext | null = null;

  private musicEl: HTMLAudioElement | null = null;
  private musicSrc: MediaElementAudioSourceNode | null = null;
  private musicGain: GainNode | null = null;

  // Cache sources keyed by element — MediaElementSource can only be created
  // once per HTMLMediaElement instance in the lifetime of a page. Re-using
  // across attach/detach cycles prevents the "HTMLMediaElement already
  // connected previously to a different MediaElementSourceNode" exception.
  private sourceCache: WeakMap<HTMLMediaElement, MediaElementAudioSourceNode> =
    new WeakMap();

  private mix: AudioMixSettings = { ...DEFAULT_AUDIO_MIX };
  private musicBaseVolume = 1;

  /** Non-throwing feature check. Safe to call before any other API. */
  static supported(): boolean {
    if (typeof window === "undefined") return false;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    return typeof AC === "function";
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (!PlaybackAudioMixer.supported()) return null;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    try {
      this.ctx = new AC();
    } catch (err) {
      console.warn("[mixer] AudioContext init failed", err);
      this.ctx = null;
    }
    return this.ctx;
  }

  private getOrCreateSource(
    el: HTMLMediaElement,
    ctx: AudioContext,
  ): MediaElementAudioSourceNode | null {
    const cached = this.sourceCache.get(el);
    if (cached) return cached;
    try {
      const src = ctx.createMediaElementSource(el);
      this.sourceCache.set(el, src);
      return src;
    } catch (err) {
      console.warn("[mixer] createMediaElementSource failed", err);
      return null;
    }
  }

  /** Attach the project's music `<audio>` so its output flows through the mixer. */
  attachMusic(el: HTMLAudioElement): void {
    if (this.musicEl === el) return;
    this.detachMusic();

    const ctx = this.ensureContext();
    if (!ctx) return;

    const src = this.getOrCreateSource(el, ctx);
    if (!src) return;

    const gain = ctx.createGain();
    gain.gain.value = this.musicBaseVolume;

    try {
      src.connect(gain);
      gain.connect(ctx.destination);
    } catch (err) {
      console.warn("[mixer] music chain connect failed", err);
      return;
    }

    this.musicEl = el;
    this.musicSrc = src;
    this.musicGain = gain;

    // The <audio>.volume property is now downstream of our gain stage; set it
    // to 1 so nothing else attenuates the signal. The mixer owns volume.
    try { el.volume = 1; } catch { /* ignore */ }
  }

  detachMusic(): void {
    if (this.musicGain) {
      try { this.musicGain.disconnect(); } catch { /* ignore */ }
    }
    if (this.musicSrc && this.musicGain) {
      // Don't disconnect the MediaElementSource itself — it's cached and
      // may be reused on the next attach for the SAME element. Disconnecting
      // it is fine, but connecting again is also safe. Leave it connected
      // to nothing until re-attach.
      try { this.musicSrc.disconnect(); } catch { /* ignore */ }
    }
    this.musicSrc = null;
    this.musicGain = null;
    this.musicEl = null;
  }

  setMix(mix: AudioMixSettings): void {
    this.mix = { ...mix };
  }

  setMusicBaseVolume(vol: number): void {
    this.musicBaseVolume = Math.max(0, Math.min(2, vol));
    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.setTargetAtTime(this.musicBaseVolume, now, 0.01);
    }
  }

  /**
   * Linear fade envelope that matches the offline mix (`compose.ts`) — value
   * in [0, 1] depending on how far `t` is from the start (fade-in) and the
   * end (fade-out). `fadeIn` / `fadeOut` are seconds (not samples like the
   * offline path). Pure function so tests and Phase 3.7 can reuse it.
   */
  static musicFadeEnvelope(
    t: number,
    total: number,
    fadeIn: number,
    fadeOut: number,
  ): number {
    let fade = 1;
    if (fadeIn > 0 && t < fadeIn) {
      fade = Math.max(0, t / fadeIn);
    }
    if (fadeOut > 0 && total > 0 && t > total - fadeOut) {
      fade = Math.min(fade, Math.max(0, (total - t) / fadeOut));
    }
    return Math.max(0, Math.min(1, fade));
  }

  /**
   * Called every playback/scrub frame from the engine with the current
   * project-wide time. Phase 3.4 applies the music fade envelope; Phase 3.7
   * will layer ducking on top of the same gain node.
   */
  tick(projectTime: number, totalDuration: number): void {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      // Browsers keep the context suspended until a user gesture. The engine
      // only ticks once playback/scrub starts (both come from real gestures),
      // so resume() is safe here. Swallow the rejection — if it fails, the
      // next tick will try again.
      this.ctx.resume().catch(() => { /* gesture not yet delivered */ });
    }

    if (this.musicGain && totalDuration > 0) {
      const fade = PlaybackAudioMixer.musicFadeEnvelope(
        projectTime,
        totalDuration,
        this.mix.musicFadeIn,
        this.mix.musicFadeOut,
      );
      const target = this.musicBaseVolume * fade;
      // setTargetAtTime with a tiny time-constant gives us a smooth 1-frame
      // glide, avoiding zipper noise from per-frame gain jumps while still
      // tracking the envelope closely.
      this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.01);
    }
  }

  dispose(): void {
    this.detachMusic();
    if (this.ctx) {
      // Don't close on SPA nav — `close()` is expensive. `suspend()` lets
      // the context wake instantly on the next attach/play.
      try { this.ctx.suspend().catch(() => { /* ignore */ }); } catch { /* ignore */ }
    }
  }
}
