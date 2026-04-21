/**
 * Granular audio scrubber for the project's music track.
 *
 * While the user drags the playhead we don't want to seek the main `<audio>`
 * element on every frame — the decoder/seek latency would be miserable and
 * seek spam also tends to drop random samples. Instead we decode the track
 * once into an AudioBuffer, then on each scrub tick schedule a short grain
 * (~90-120ms) played from the corresponding offset. That gives the user a
 * "brush across the audio" preview like Premiere's audio scrub, loops the
 * music correctly (modulo duration), and costs nothing once warm.
 *
 * Decode strategy:
 *   - `primeUrl(url)` kicks off fetch+decodeAudioData in background and
 *     caches the Promise. Subsequent `primeUrl(sameUrl)` returns the same
 *     promise; calling before scrubbing so decode usually completes while
 *     the user is still reading the timeline.
 *   - If the buffer isn't ready by the time the user scrubs, `scrub()` is
 *     a graceful no-op — the UI keeps scrubbing visually, just without the
 *     audio preview. Once decode finishes, subsequent scrubs pick up audio.
 *
 * Ownership:
 *   - The scrubber does NOT own an AudioContext. It reuses the mixer's so
 *     there's one shared audio graph per project. Caller provides the
 *     destination node (a mixer-owned GainNode that applies base volume).
 */
export class MusicGrainScrubber {
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;
  private readonly decodeCache: Map<string, Promise<AudioBuffer | null>> =
    new Map();

  private activeUrl: string | null = null;
  private activeBuffer: AudioBuffer | null = null;
  private scrubbing = false;
  private lastGrainAt = 0;

  // Grain sound parameters — values that sounded natural on a couple of
  // upload + Fal tracks. Tweak here if we add a user preference.
  private readonly grainDurationMs = 110;
  private readonly grainFadeMs = 6;
  private readonly minGrainSpacingMs = 33; // ~30 Hz

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  /**
   * Kick off fetch + decode if not already cached. Returns a Promise that
   * resolves to the decoded buffer (or null on failure). Safe to call on
   * every musicUrl change — repeated calls with the same URL are coalesced.
   */
  primeUrl(url: string): Promise<AudioBuffer | null> {
    const cached = this.decodeCache.get(url);
    if (cached) return cached;

    const promise = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        // `decodeAudioData` is the callback version in some older engines
        // but modern browsers honor the Promise form — we stick with it.
        const buf = await this.ctx.decodeAudioData(ab);
        return buf;
      } catch (err) {
        console.warn("[grain-scrubber] decode failed", err);
        return null;
      }
    })();

    this.decodeCache.set(url, promise);
    return promise;
  }

  /** True when the buffer for `url` is already resolved and non-null. */
  isReady(url: string): boolean {
    return this.activeUrl === url && this.activeBuffer !== null;
  }

  /**
   * Begin a scrub session for the given music URL. Sets `activeBuffer`
   * once decode resolves. Safe to call multiple times; later calls either
   * reuse the current buffer or swap to the new one.
   */
  startScrub(url: string): void {
    this.scrubbing = true;
    this.activeUrl = url;

    const cached = this.decodeCache.get(url);
    if (cached) {
      void cached.then((buf) => {
        // Only apply if this url is still the target by the time decode
        // resolves — user could have swapped tracks during the wait.
        if (this.activeUrl === url) {
          this.activeBuffer = buf;
        }
      });
    } else {
      void this.primeUrl(url).then((buf) => {
        if (this.activeUrl === url) {
          this.activeBuffer = buf;
        }
      });
    }
  }

  /**
   * Schedule a grain at `projectTime` (seconds, project-wall-clock — we
   * mod by buffer duration to pick the playback offset, which matches the
   * looping behavior of the main <audio>). Throttled to `minGrainSpacingMs`
   * so wheel/trackpad storms don't schedule 100s of nodes a second.
   */
  scrub(projectTime: number): void {
    if (!this.scrubbing) return;
    if (!this.activeBuffer) return;

    const now = this.ctx.currentTime;
    if ((now - this.lastGrainAt) * 1000 < this.minGrainSpacingMs) return;
    this.lastGrainAt = now;

    const dur = this.activeBuffer.duration;
    if (!isFinite(dur) || dur <= 0) return;

    // Clamp inside the buffer; if projectTime is past buffer duration we
    // just loop, same as the main audio element does (loop = true).
    const offset = ((projectTime % dur) + dur) % dur;
    const grainSeconds = this.grainDurationMs / 1000;
    const fadeSeconds = this.grainFadeMs / 1000;
    // If the grain would overshoot the end, shrink it instead of wrapping
    // inside a single grain (avoids a click at the loop boundary).
    const effectiveGrain = Math.min(grainSeconds, Math.max(0.01, dur - offset));

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.activeBuffer;

      const gain = this.ctx.createGain();
      // Linear fade-in / fade-out inside the grain: the AudioParam ramp API
      // lets us front-load a tiny envelope cheaply without an ScriptProcessor.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + fadeSeconds);
      gain.gain.setValueAtTime(1, now + effectiveGrain - fadeSeconds);
      gain.gain.linearRampToValueAtTime(0, now + effectiveGrain);

      src.connect(gain);
      gain.connect(this.destination);

      src.start(now, offset, effectiveGrain);
      src.stop(now + effectiveGrain + 0.01);

      src.onended = () => {
        try { src.disconnect(); } catch { /* ignore */ }
        try { gain.disconnect(); } catch { /* ignore */ }
      };
    } catch (err) {
      console.warn("[grain-scrubber] grain schedule failed", err);
    }
  }

  stopScrub(): void {
    this.scrubbing = false;
    this.lastGrainAt = 0;
  }

  dispose(): void {
    this.stopScrub();
    this.decodeCache.clear();
    this.activeBuffer = null;
    this.activeUrl = null;
  }
}
