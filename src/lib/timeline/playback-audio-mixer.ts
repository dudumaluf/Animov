import { DEFAULT_AUDIO_MIX, type AudioMixSettings } from "@/lib/composition/compose";
import { MusicGrainScrubber } from "@/lib/timeline/music-grain-scrubber";

export type ClipAttachInfo = {
  /** Effective segment duration (post-trim) in seconds. */
  duration: number;
  /** Per-scene gain (0..2) from `scene.audioVolume`. Default 1. */
  clipVolume: number;
};

// Mirrored from compose.ts — not exported from there today; duplicating the
// constants here keeps the preview lined up with the export math.
const DUCK_MIN_GAIN = 0.15;
const SPEECH_THRESHOLD = 0.02;
const ANALYSER_FFT_SIZE = 1024;

/**
 * Real-time playback audio mixer — approximates the offline mix produced by
 * `compose.ts` so the editor preview sounds close to the exported MP4.
 *
 * Scope (by Phase 3 plan):
 *   - Music bus: gain + project-level fades. (Phase 3.3/3.4)
 *   - Clip bus (uploaded video audio): gain + segment-level fades. (Phase 3.5/3.6)
 *   - Ducking of music vs clip RMS. (Phase 3.7)
 *
 * Signal graph:
 *
 *     <audio> ── MediaElementSource ──▶ musicGain ──▶ destination
 *
 *     <video> ── MediaElementSource ──▶ clipGain ──┬──▶ destination
 *                                                  └──▶ analyser (RMS, Phase 3.7)
 *
 * Notes:
 *   - `AudioContext` is created lazily on first `attachMusic` and resumed
 *     on the first play() attempt from outside. Browsers require a user
 *     gesture before the context can emit sound — the engine's play path
 *     provides that gesture, so we `resume()` opportunistically in tick().
 *   - `MediaElementSource` is single-shot per element. We cache the source
 *     on a WeakMap keyed by the element so swapping the attached element
 *     doesn't throw "already connected".
 *   - Once an element is wrapped by MediaElementSource, its audio is routed
 *     exclusively through the graph (bypasses the element's default
 *     destination). `.volume` / `.muted` on the element no longer affect
 *     output — our gain nodes are the single source of attenuation.
 *   - If WebAudio isn't available in the environment (very old browsers,
 *     SSR), `supported` returns false and the mixer degrades to no-op so
 *     the engine can fall back to `<audio>.volume` control.
 */
export class PlaybackAudioMixer {
  private ctx: AudioContext | null = null;

  private musicEl: HTMLAudioElement | null = null;
  private musicSrc: MediaElementAudioSourceNode | null = null;
  private musicGain: GainNode | null = null;

  private clipEl: HTMLVideoElement | null = null;
  private clipSrc: MediaElementAudioSourceNode | null = null;
  private clipGain: GainNode | null = null;
  private clipAnalyser: AnalyserNode | null = null;
  private analyserBuffer: Float32Array<ArrayBuffer> | null = null;
  private clipInfo: ClipAttachInfo | null = null;

  // Grain scrub bus: a parallel path to destination, used only while the
  // user is actively scrubbing. Bypasses the music fade envelope because
  // scrub audio shouldn't fade-in every time the user drags from t=0.
  private scrubGain: GainNode | null = null;
  private scrubber: MusicGrainScrubber | null = null;
  private musicUrl: string | null = null;
  private musicScrubActive = false;

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
    this.musicUrl = el.src || el.currentSrc || null;

    // Kick off background decode so the scrubber is warm by the time the
    // user reaches for the timeline. Silent failure — scrub falls back to
    // a visual-only behavior when decode isn't ready.
    if (this.musicUrl) {
      this.ensureScrubber(ctx)?.primeUrl(this.musicUrl).catch(() => { /* ignore */ });
    }

    // The <audio>.volume property is now downstream of our gain stage; set it
    // to 1 so nothing else attenuates the signal. The mixer owns volume.
    try { el.volume = 1; } catch { /* ignore */ }
  }

  private ensureScrubber(ctx: AudioContext): MusicGrainScrubber | null {
    if (this.scrubber) return this.scrubber;
    try {
      const scrubGain = ctx.createGain();
      scrubGain.gain.value = 0;
      scrubGain.connect(ctx.destination);
      this.scrubGain = scrubGain;
      this.scrubber = new MusicGrainScrubber(ctx, scrubGain);
      return this.scrubber;
    } catch (err) {
      console.warn("[mixer] scrubber init failed", err);
      return null;
    }
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
    // Scrub session, if any, is tied to the old URL's buffer — stop it
    // and let the next attach re-prime. The scrubber itself and its gain
    // node stay alive for the lifetime of the mixer so we don't thrash
    // the graph on music swaps.
    this.scrubber?.stopScrub();
    this.musicScrubActive = false;
    this.musicUrl = null;
  }

  /**
   * Attach an uploaded video's audio track to the clip bus. Safe to call on
   * segment transitions — if a different element is already attached, we
   * detach it first. If the same element is re-attached (e.g. a no-op
   * transition), metadata is refreshed without rebuilding the graph.
   */
  attachClip(el: HTMLVideoElement, info: ClipAttachInfo): void {
    if (this.clipEl === el) {
      this.clipInfo = { ...info };
      return;
    }
    this.detachClip();

    const ctx = this.ensureContext();
    if (!ctx) return;

    const src = this.getOrCreateSource(el, ctx);
    if (!src) return;

    const gain = ctx.createGain();
    // Start at 0 so the fade-in envelope can ramp the first frame cleanly
    // instead of punching through at full clip volume for one frame.
    gain.gain.value = 0;

    // Analyser fan-off of clipGain so ducking can observe the clip's RMS
    // without inserting itself in the signal path (no double-attenuation).
    let analyser: AnalyserNode | null = null;
    try {
      analyser = ctx.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      analyser.smoothingTimeConstant = 0; // raw data — we smooth on our side
    } catch (err) {
      console.warn("[mixer] analyser init failed", err);
      analyser = null;
    }

    try {
      src.connect(gain);
      gain.connect(ctx.destination);
      if (analyser) gain.connect(analyser);
    } catch (err) {
      console.warn("[mixer] clip chain connect failed", err);
      return;
    }

    this.clipEl = el;
    this.clipSrc = src;
    this.clipGain = gain;
    this.clipAnalyser = analyser;
    // Back the buffer by an explicit ArrayBuffer (not the default which may
    // resolve to ArrayBufferLike in TS lib.dom) so getFloatTimeDomainData's
    // stricter overload accepts it.
    this.analyserBuffer = analyser
      ? new Float32Array(new ArrayBuffer(analyser.fftSize * 4))
      : null;
    this.clipInfo = { ...info };

    // Mixer owns attenuation; keep the element fully open upstream.
    try {
      el.volume = 1;
      el.muted = false;
    } catch { /* ignore */ }
  }

  detachClip(): void {
    if (this.clipGain) {
      try { this.clipGain.disconnect(); } catch { /* ignore */ }
    }
    if (this.clipSrc) {
      try { this.clipSrc.disconnect(); } catch { /* ignore */ }
    }
    if (this.clipAnalyser) {
      try { this.clipAnalyser.disconnect(); } catch { /* ignore */ }
    }
    this.clipSrc = null;
    this.clipGain = null;
    this.clipAnalyser = null;
    this.analyserBuffer = null;
    this.clipEl = null;
    this.clipInfo = null;
  }

  /**
   * Sample the clip's analyser and return the RMS amplitude of the most
   * recent ~23ms window. Returns 0 when no clip is attached. Pure-ish
   * (mutates the shared buffer) — cheap to call every frame.
   */
  private sampleClipRms(): number {
    const analyser = this.clipAnalyser;
    const buf = this.analyserBuffer;
    if (!analyser || !buf) return 0;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] ?? 0;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
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
    // Keep scrubGain in sync when scrub is active so the user hears the
    // current slider value during a drag.
    if (this.scrubGain && this.ctx && this.musicScrubActive) {
      const now = this.ctx.currentTime;
      this.scrubGain.gain.setTargetAtTime(this.musicBaseVolume, now, 0.01);
    }
  }

  /**
   * Enter scrub mode: silence the main music bus so the <audio> element
   * doesn't fight the grain scheduler, and open the scrub bus to the
   * current music volume. Called from the engine when `isScrubbing` goes
   * true. Idempotent — repeated calls keep the same state.
   */
  beginMusicScrub(): void {
    if (this.musicScrubActive) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.musicScrubActive = true;

    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    }
    if (this.scrubGain) {
      this.scrubGain.gain.setTargetAtTime(
        this.musicBaseVolume,
        ctx.currentTime,
        0.02,
      );
    }
    if (this.musicUrl) this.scrubber?.startScrub(this.musicUrl);
  }

  /**
   * Schedule a single grain at `projectTime`. Throttled internally in the
   * scrubber so the engine can call this from rAF without spamming the
   * audio graph.
   */
  scrubAt(projectTime: number): void {
    if (!this.musicScrubActive) return;
    this.scrubber?.scrub(projectTime);
  }

  /**
   * Exit scrub mode: close the scrub bus, let the next `tick()` bring the
   * music bus back to the envelope target. Engine is responsible for
   * calling `audio.currentTime = projectTime % duration` before it plays
   * so the main music element resumes in sync.
   */
  endMusicScrub(): void {
    if (!this.musicScrubActive) return;
    this.musicScrubActive = false;
    this.scrubber?.stopScrub();
    if (this.scrubGain && this.ctx) {
      this.scrubGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
    // musicGain will return to the envelope on the next tick() — no need
    // to reset here (avoids a double-ramp fight).
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
   * Per-clip linear fade envelope. `localOffset` is the position inside the
   * segment (seconds from segment start); `duration` is the post-trim
   * segment length. Mirrors the per-clip fade applied offline in compose.ts.
   */
  static clipFadeEnvelope(
    localOffset: number,
    duration: number,
    fadeIn: number,
    fadeOut: number,
  ): number {
    if (duration <= 0) return 0;
    let fade = 1;
    if (fadeIn > 0 && localOffset < fadeIn) {
      fade = Math.max(0, localOffset / fadeIn);
    }
    if (fadeOut > 0 && localOffset > duration - fadeOut) {
      fade = Math.min(fade, Math.max(0, (duration - localOffset) / fadeOut));
    }
    return Math.max(0, Math.min(1, fade));
  }

  /**
   * Called every playback/scrub frame from the engine with the current
   * project-wide time and (optionally) the offset into the active uploaded
   * clip. Applies music + clip fades and ducking.
   *
   * Ducking math mirrors compose.ts:
   *   - When clip RMS > SPEECH_THRESHOLD: music target is attenuated by
   *     `(1 - duckingIntensity * (1 - DUCK_MIN_GAIN))` — at full intensity
   *     that floors music to DUCK_MIN_GAIN.
   *   - setTargetAtTime's time-constant is duckingAttack while ducking in,
   *     duckingRelease while recovering — Web Audio smooths for us.
   */
  tick(
    projectTime: number,
    totalDuration: number,
    clipLocalOffset?: number,
  ): void {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      // Browsers keep the context suspended until a user gesture. The engine
      // only ticks once playback/scrub starts (both come from real gestures),
      // so resume() is safe here. Swallow the rejection — if it fails, the
      // next tick will try again.
      this.ctx.resume().catch(() => { /* gesture not yet delivered */ });
    }

    const now = this.ctx.currentTime;
    const hasActiveClip =
      this.clipGain !== null &&
      this.clipInfo !== null &&
      typeof clipLocalOffset === "number";

    if (this.clipGain && this.clipInfo && typeof clipLocalOffset === "number") {
      const fade = PlaybackAudioMixer.clipFadeEnvelope(
        clipLocalOffset,
        this.clipInfo.duration,
        this.mix.clipFadeIn,
        this.mix.clipFadeOut,
      );
      const target = this.clipInfo.clipVolume * fade;
      this.clipGain.gain.setTargetAtTime(target, now, 0.01);
    }

    // While scrubbing, the scrub bus owns audio output for the music track.
    // The main music bus stays muted (`beginMusicScrub` ramped it to 0) and
    // must NOT follow the fade envelope, otherwise the envelope would fight
    // the mute and leak sound through the main <audio>.
    if (this.musicGain && totalDuration > 0 && !this.musicScrubActive) {
      const musicFade = PlaybackAudioMixer.musicFadeEnvelope(
        projectTime,
        totalDuration,
        this.mix.musicFadeIn,
        this.mix.musicFadeOut,
      );
      let target = this.musicBaseVolume * musicFade;

      // Ducking: only apply when a clip is actively playing — image scenes
      // / AI videos don't duck (they have no audio in the preview), which
      // matches the offline behavior where those frames have ~0 RMS.
      let duckTimeConstant = 0.01; // default smoothing when idle
      if (hasActiveClip && this.mix.duckingIntensity > 0) {
        const rms = this.sampleClipRms();
        const isSpeaking = rms > SPEECH_THRESHOLD;
        if (isSpeaking) {
          const duckAmount =
            1 - this.mix.duckingIntensity * (1 - DUCK_MIN_GAIN);
          target *= duckAmount;
          duckTimeConstant = Math.max(0.005, this.mix.duckingAttack);
        } else {
          duckTimeConstant = Math.max(0.005, this.mix.duckingRelease);
        }
      }

      this.musicGain.gain.setTargetAtTime(target, now, duckTimeConstant);
    }
  }

  dispose(): void {
    this.detachClip();
    this.detachMusic();
    this.scrubber?.dispose();
    this.scrubber = null;
    if (this.scrubGain) {
      try { this.scrubGain.disconnect(); } catch { /* ignore */ }
      this.scrubGain = null;
    }
    if (this.ctx) {
      // Don't close on SPA nav — `close()` is expensive. `suspend()` lets
      // the context wake instantly on the next attach/play.
      try { this.ctx.suspend().catch(() => { /* ignore */ }); } catch { /* ignore */ }
    }
  }
}
