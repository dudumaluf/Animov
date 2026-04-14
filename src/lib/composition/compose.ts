import {
  Input,
  Output,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
} from "mediabunny";

export type ComposeProgress = {
  message: string;
  percent: number;
};

export type ClipInfo = {
  url: string;
  hasAudio: boolean;
  durationHint?: number;
  clipVolume?: number;
};

export type AudioMixSettings = {
  musicVolume: number;
  musicFadeIn: number;
  musicFadeOut: number;
  clipFadeIn: number;
  clipFadeOut: number;
  duckingIntensity: number;
  duckingAttack: number;
  duckingRelease: number;
};

export const DEFAULT_AUDIO_MIX: AudioMixSettings = {
  musicVolume: 0.3,
  musicFadeIn: 0.5,
  musicFadeOut: 2.0,
  clipFadeIn: 0.3,
  clipFadeOut: 0.3,
  duckingIntensity: 0.75,
  duckingAttack: 0.1,
  duckingRelease: 0.4,
};

type CompositionInput = {
  clips: ClipInfo[];
  audioUrl?: string;
  audioMix?: AudioMixSettings;
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (p: ComposeProgress) => void;
};

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n));
}

function coverCrop(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const sw = srcH * dstRatio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  } else {
    const sh = srcW / dstRatio;
    return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
  }
}

/* ── Audio mixing constants ─────────────────────────────── */

const MIX_SAMPLE_RATE = 44100;
const MIX_CHANNELS = 2;
const SPEECH_THRESHOLD = 0.02;
const DUCK_MIN_GAIN = 0.15;

/* ── Audio helpers ──────────────────────────────────────── */

async function fetchBlobWithRetry(url: string, onRetry?: (attempt: number) => void): Promise<Blob> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.blob();
    } catch (e) {
      lastErr = e;
      onRetry?.(attempt + 1);
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function decodeAudioUrl(url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const ctx = new OfflineAudioContext(MIX_CHANNELS, 1, MIX_SAMPLE_RATE);
  return ctx.decodeAudioData(buf);
}

async function extractClipAudioPCM(
  blob: Blob,
): Promise<{ pcm: Float32Array[]; duration: number } | null> {
  try {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) return null;

    const { AudioBufferSink } = await import("mediabunny");
    const sink = new AudioBufferSink(audioTrack);

    const channelArrays: Float32Array[][] = [[], []];
    let totalLength = 0;

    for await (const wrapped of sink.buffers()) {
      const ab = wrapped.buffer;
      for (let ch = 0; ch < MIX_CHANNELS; ch++) {
        const src = ch < ab.numberOfChannels ? ab.getChannelData(ch) : ab.getChannelData(0);
        channelArrays[ch]!.push(new Float32Array(src));
      }
      totalLength += ab.length;
    }

    if (totalLength === 0) return null;

    const pcm: Float32Array[] = [];
    for (let ch = 0; ch < MIX_CHANNELS; ch++) {
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of channelArrays[ch]!) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      pcm.push(merged);
    }

    return { pcm, duration: totalLength / MIX_SAMPLE_RATE };
  } catch (e) {
    console.warn("[extractClipAudioPCM]", e);
    return null;
  }
}

function resampleToMixRate(buffer: AudioBuffer): Float32Array[] {
  if (buffer.sampleRate === MIX_SAMPLE_RATE) {
    const out: Float32Array[] = [];
    for (let ch = 0; ch < MIX_CHANNELS; ch++) {
      out.push(new Float32Array(ch < buffer.numberOfChannels ? buffer.getChannelData(ch) : buffer.getChannelData(0)));
    }
    return out;
  }
  const ratio = MIX_SAMPLE_RATE / buffer.sampleRate;
  const newLen = Math.floor(buffer.length * ratio);
  const out: Float32Array[] = [];
  for (let ch = 0; ch < MIX_CHANNELS; ch++) {
    const src = ch < buffer.numberOfChannels ? buffer.getChannelData(ch) : buffer.getChannelData(0);
    const dst = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i / ratio;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, src.length - 1);
      const frac = srcIdx - lo;
      dst[i] = src[lo]! * (1 - frac) + src[hi]! * frac;
    }
    out.push(dst);
  }
  return out;
}

type ClipAudioInfo = {
  pcm: Float32Array[] | null;
  startSample: number;
  lengthSamples: number;
  volume: number;
};

function buildMixedTimeline(
  clipAudios: ClipAudioInfo[],
  musicPCM: Float32Array[] | null,
  mix: AudioMixSettings,
  totalDurationSec: number,
): Float32Array[] {
  const totalSamples = Math.ceil(totalDurationSec * MIX_SAMPLE_RATE);
  const master: Float32Array[] = [];
  for (let ch = 0; ch < MIX_CHANNELS; ch++) {
    master.push(new Float32Array(totalSamples));
  }

  const clipFadeInSamples = Math.floor(mix.clipFadeIn * MIX_SAMPLE_RATE);
  const clipFadeOutSamples = Math.floor(mix.clipFadeOut * MIX_SAMPLE_RATE);

  for (const clip of clipAudios) {
    if (!clip.pcm) continue;
    for (let ch = 0; ch < MIX_CHANNELS; ch++) {
      const dst = master[ch]!;
      const src = clip.pcm[ch]!;
      const copyLen = Math.min(src.length, clip.lengthSamples, totalSamples - clip.startSample);
      for (let i = 0; i < copyLen; i++) {
        let fade = 1;
        if (clipFadeInSamples > 0 && i < clipFadeInSamples) fade = i / clipFadeInSamples;
        if (clipFadeOutSamples > 0 && i > copyLen - clipFadeOutSamples) {
          fade = Math.min(fade, Math.max(0, (copyLen - i) / clipFadeOutSamples));
        }
        dst[clip.startSample + i] = (dst[clip.startSample + i] ?? 0) + src[i]! * clip.volume * fade;
      }
    }
  }

  if (musicPCM) {
    const hasAnyClipAudio = clipAudios.some((c) => c.pcm !== null);
    const clipMono = hasAnyClipAudio ? master[0]! : null;
    const rmsWindow = Math.floor(0.1 * MIX_SAMPLE_RATE);
    const musicFadeInSamples = Math.floor(mix.musicFadeIn * MIX_SAMPLE_RATE);
    const musicFadeOutSamples = Math.floor(mix.musicFadeOut * MIX_SAMPLE_RATE);
    const attackAlpha = mix.duckingAttack > 0 ? 1 / (mix.duckingAttack * MIX_SAMPLE_RATE) : 1;
    const releaseAlpha = mix.duckingRelease > 0 ? 1 / (mix.duckingRelease * MIX_SAMPLE_RATE) : 1;

    const musicLen = Math.min(musicPCM[0]!.length, totalSamples);

    // Pre-compute the ducking gain envelope once (mono), shared across channels
    const duckEnvelope = new Float32Array(musicLen);
    let envGain = mix.musicVolume;

    for (let i = 0; i < musicLen; i++) {
      let targetGain = mix.musicVolume;

      if (clipMono) {
        const winStart = Math.max(0, i - Math.floor(rmsWindow / 2));
        const winEnd = Math.min(clipMono.length, winStart + rmsWindow);
        let sum = 0;
        for (let j = winStart; j < winEnd; j++) {
          sum += clipMono[j]! * clipMono[j]!;
        }
        const rms = Math.sqrt(sum / (winEnd - winStart));
        if (rms > SPEECH_THRESHOLD) {
          targetGain = mix.musicVolume * (1 - mix.duckingIntensity * (1 - DUCK_MIN_GAIN));
        }
        const alpha = rms > SPEECH_THRESHOLD ? attackAlpha : releaseAlpha;
        envGain += (targetGain - envGain) * alpha;
      }

      let musicFade = 1;
      if (i < musicFadeInSamples) musicFade = i / musicFadeInSamples;
      if (musicFadeOutSamples > 0 && i > musicLen - musicFadeOutSamples) {
        musicFade = Math.min(musicFade, (musicLen - i) / musicFadeOutSamples);
      }

      duckEnvelope[i] = envGain * musicFade;
    }

    for (let ch = 0; ch < MIX_CHANNELS; ch++) {
      const dst = master[ch]!;
      const src = musicPCM[ch]!;

      for (let i = 0; i < musicLen; i++) {
        const mixed = dst[i]! + src[i]! * duckEnvelope[i]!;
        dst[i] = Math.max(-1, Math.min(1, mixed));
      }
    }
  }

  return master;
}

function timelineToChunks(timeline: Float32Array[], chunkDuration: number = 1): AudioBuffer[] {
  const totalSamples = timeline[0]!.length;
  const chunkSamples = Math.floor(chunkDuration * MIX_SAMPLE_RATE);
  const buffers: AudioBuffer[] = [];

  for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
    const length = Math.min(chunkSamples, totalSamples - offset);
    const ab = new AudioBuffer({ length, sampleRate: MIX_SAMPLE_RATE, numberOfChannels: MIX_CHANNELS });
    for (let ch = 0; ch < MIX_CHANNELS; ch++) {
      ab.getChannelData(ch).set(timeline[ch]!.subarray(offset, offset + length));
    }
    buffers.push(ab);
  }

  return buffers;
}

/* ── Main entry ─────────────────────────────────────────── */

export async function composeVideos({
  clips,
  audioUrl,
  audioMix = DEFAULT_AUDIO_MIX,
  width = 1920,
  height = 1080,
  fps = 30,
  onProgress,
}: CompositionInput): Promise<Blob> {
  if (clips.length === 0) throw new Error("No clips to compose");

  const anyClipHasAudio = clips.some((c) => c.hasAudio);

  if (clips.length === 1 && !audioUrl && !anyClipHasAudio) {
    onProgress?.({ message: "Baixando vídeo...", percent: 30 });
    const blob = await fetchBlobWithRetry(clips[0]!.url, (a) => {
      onProgress?.({ message: `Reconectando (${a}/3)...`, percent: 20 + a * 5 });
    });
    onProgress?.({ message: "Pronto", percent: 100 });
    return blob;
  }

  if (clips.length === 1 && clips[0]!.hasAudio && !audioUrl) {
    onProgress?.({ message: "Baixando vídeo...", percent: 30 });
    const blob = await fetchBlobWithRetry(clips[0]!.url, (a) => {
      onProgress?.({ message: `Reconectando (${a}/3)...`, percent: 20 + a * 5 });
    });
    onProgress?.({ message: "Pronto", percent: 100 });
    return blob;
  }

  try {
    return await composeWithMediabunny({ clips, audioUrl, audioMix, width, height, fps, onProgress });
  } catch (err) {
    console.warn("[compose] Mediabunny failed, falling back to MediaRecorder:", err);
    onProgress?.({ message: "Usando modo alternativo de gravação...", percent: 5 });
    return composeWithMediaRecorder({ clips, audioUrl, audioMix, width, height, onProgress });
  }
}

/* ── Mediabunny path (primary) ──────────────────────────── */

async function composeWithMediabunny({
  clips,
  audioUrl,
  audioMix,
  width,
  height,
  fps,
  onProgress,
}: {
  clips: ClipInfo[];
  audioUrl?: string;
  audioMix: AudioMixSettings;
  width: number;
  height: number;
  fps: number;
  onProgress?: CompositionInput["onProgress"];
}): Promise<Blob> {
  const report = (message: string, percent: number) =>
    onProgress?.({ message, percent: clampPct(percent) });

  const n = clips.length;
  const anyClipHasAudio = clips.some((c) => c.hasAudio);
  const needsAudio = !!audioUrl || anyClipHasAudio;

  /* ─ Phase 1: download all clips + extract audio upfront ─ */
  report("Baixando clipes...", 2);

  type ClipData = {
    blob: Blob;
    clipAudioPCM: { pcm: Float32Array[]; duration: number } | null;
  };

  const clipData: ClipData[] = [];

  for (let i = 0; i < n; i++) {
    const clip = clips[i]!;
    report(`Baixando clipe ${i + 1} de ${n}...`, 2 + (i / n) * 8);

    const blob = await fetchBlobWithRetry(clip.url, (attempt) => {
      report(`Clipe ${i + 1}: reconectando (${attempt}/3)...`, 2 + (i / n) * 8);
    });

    let clipAudioPCM: { pcm: Float32Array[]; duration: number } | null = null;
    if (clip.hasAudio) {
      report(`Extraindo áudio do clipe ${i + 1}...`, 2 + ((i + 0.5) / n) * 8);
      clipAudioPCM = await extractClipAudioPCM(blob);
    }

    clipData.push({ blob, clipAudioPCM });
  }

  /* ─ Phase 1b: probe video durations to build timeline ─── */
  report("Analisando duração dos clipes...", 11);

  type ClipMeta = { duration: number };
  const clipMetas: ClipMeta[] = [];

  for (let i = 0; i < n; i++) {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(clipData[i]!.blob) });
    const videoTrack = await input.getPrimaryVideoTrack();
    const dur = videoTrack ? await videoTrack.computeDuration() : 0;
    const hint = clips[i]!.durationHint ?? 0;
    clipMetas.push({ duration: Math.max(dur, hint) });
  }

  const totalDuration = clipMetas.reduce((sum, m) => sum + m.duration, 0);

  /* ─ Phase 2: build mixed audio timeline ────────────────── */
  let mixedChunks: AudioBuffer[] = [];

  if (needsAudio) {
    report("Mixando áudio...", 13);

    let musicPCM: Float32Array[] | null = null;
    if (audioUrl) {
      const musicBuffer = await decodeAudioUrl(audioUrl);
      musicPCM = resampleToMixRate(musicBuffer);
    }

    let sampleOffset = 0;
    const clipAudioInfos: ClipAudioInfo[] = clipMetas.map((meta, i) => {
      const lengthSamples = Math.ceil(meta.duration * MIX_SAMPLE_RATE);
      const info: ClipAudioInfo = {
        pcm: clipData[i]!.clipAudioPCM?.pcm ?? null,
        startSample: sampleOffset,
        lengthSamples,
        volume: clips[i]!.clipVolume ?? 1,
      };
      sampleOffset += lengthSamples;
      return info;
    });

    const masterTimeline = buildMixedTimeline(clipAudioInfos, musicPCM, audioMix, totalDuration);
    mixedChunks = timelineToChunks(masterTimeline);
  }

  /* ─ Phase 3: encode video + feed pre-mixed audio ──────── */
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;

  const videoSource = new CanvasSource(canvas, { codec: "avc", bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource);

  let audioSource: AudioBufferSource | null = null;
  if (needsAudio && mixedChunks.length > 0) {
    audioSource = new AudioBufferSource({ codec: "aac", bitrate: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  let globalTime = 0;
  const frameDuration = 1 / fps;
  let audioChunkIdx = 0;

  const spanEncode = 82;
  const basePct = 15;

  for (let i = 0; i < n; i++) {
    report(`Abrindo clipe ${i + 1} de ${n}...`, basePct + (i / n) * 3);

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(clipData[i]!.blob) });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) continue;

    const decodable = await videoTrack.canDecode();
    if (!decodable) continue;

    const { VideoSampleSink } = await import("mediabunny");
    const sink = new VideoSampleSink(videoTrack);
    const duration = clipMetas[i]!.duration;
    const totalFrames = Math.ceil(duration * fps);

    let tempCanvas: OffscreenCanvas | null = null;
    let tempCtx: OffscreenCanvasRenderingContext2D | null = null;
    let hasDrawnFrame = false;

    for (let f = 0; f < totalFrames; f++) {
      const time = f / fps;
      const sample = await sink.getSample(time);

      if (sample) {
        try {
          const sw = sample.displayWidth;
          const sh = sample.displayHeight;
          if (!tempCanvas || tempCanvas.width !== sw || tempCanvas.height !== sh) {
            tempCanvas = new OffscreenCanvas(sw, sh);
            tempCtx = tempCanvas.getContext("2d")!;
          }
          tempCtx!.clearRect(0, 0, sw, sh);
          sample.draw(tempCtx!, 0, 0, sw, sh);

          ctx.clearRect(0, 0, width, height);
          const crop = coverCrop(sw, sh, width, height);
          ctx.drawImage(tempCanvas, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
          hasDrawnFrame = true;
        } finally {
          sample.close();
        }
      } else if (!hasDrawnFrame) {
        continue;
      }
      // If sample is null but we have a previous frame, hold it (canvas unchanged)

      await videoSource.add(globalTime, frameDuration);

      if (audioSource) {
        while (audioChunkIdx < mixedChunks.length && audioChunkIdx <= globalTime) {
          await audioSource.add(mixedChunks[audioChunkIdx]!);
          audioChunkIdx++;
        }
      }

      globalTime += frameDuration;

      const inner = (f + 1) / totalFrames;
      if (f === 0 || f === totalFrames - 1 || f % Math.max(1, Math.floor(totalFrames / 25)) === 0) {
        report(
          `Codificando clipe ${i + 1}/${n} — quadro ${f + 1} de ${totalFrames}`,
          basePct + 3 + (i + inner) / n * spanEncode,
        );
      }
    }

    report(
      `Clipe ${i + 1}/${n} concluído`,
      basePct + 3 + (i + 1) / n * spanEncode,
    );
  }

  if (audioSource) {
    while (audioChunkIdx < mixedChunks.length) {
      await audioSource.add(mixedChunks[audioChunkIdx]!);
      audioChunkIdx++;
    }
  }

  report("Finalizando arquivo MP4...", 97);
  await output.finalize();

  report("Concluído", 100);
  return new Blob([target.buffer!], { type: "video/mp4" });
}

/* ── MediaRecorder fallback ─────────────────────────────── */

async function composeWithMediaRecorder({
  clips,
  audioUrl,
  audioMix,
  width,
  height,
  onProgress,
}: {
  clips: ClipInfo[];
  audioUrl?: string;
  audioMix: AudioMixSettings;
  width: number;
  height: number;
  onProgress?: CompositionInput["onProgress"];
}): Promise<Blob> {
  const report = (message: string, percent: number) =>
    onProgress?.({ message, percent: clampPct(percent) });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const videoStream = canvas.captureStream(30);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();

  let musicGain: GainNode | null = null;
  let audioEl: HTMLAudioElement | null = null;

  if (audioUrl) {
    report("Carregando música (modo alternativo)...", 8);
    audioEl = document.createElement("audio");
    audioEl.crossOrigin = "anonymous";
    audioEl.src = audioUrl;
    audioEl.volume = 1;
    await new Promise<void>((resolve) => { audioEl!.oncanplaythrough = () => resolve(); audioEl!.load(); });

    const elSource = audioCtx.createMediaElementSource(audioEl);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = audioMix.musicVolume;
    elSource.connect(musicGain);
    musicGain.connect(dest);
  }

  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();
  if (audioEl) void audioEl.play().catch(() => {});

  const nc = clips.length;
  for (let i = 0; i < nc; i++) {
    const clip = clips[i]!;
    report(`Gravando clipe ${i + 1} de ${nc}...`, 15 + (i / nc) * 75);

    if (clip.hasAudio) {
      await playClipWithAudio(clip.url, ctx, width, height, audioCtx, dest, musicGain, audioMix.musicVolume);
    } else {
      await playClipMuted(clip.url, ctx, width, height);
    }
  }

  report("Finalizando gravação...", 95);

  if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
  recorder.stop();
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  await audioCtx.close();

  return new Blob(chunks, { type: mimeType });
}

function playClipMuted(
  url: string,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.onloadeddata = () => {
      video.play().catch(() => {});
    };

    video.onplay = () => {
      const draw = () => {
        if (video.ended || video.paused) return;
        const crop = coverCrop(video.videoWidth, video.videoHeight, width, height);
        ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
        requestAnimationFrame(draw);
      };
      draw();
    };

    video.onended = () => {
      const crop = coverCrop(video.videoWidth, video.videoHeight, width, height);
      ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
      resolve();
    };

    video.onerror = () => reject(new Error(`Failed to load: ${url}`));
    video.src = url;
  });
}

function playClipWithAudio(
  url: string,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  audioCtx: AudioContext,
  dest: MediaStreamAudioDestinationNode,
  musicGain: GainNode | null,
  baseMusicVolume: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = false;
    video.playsInline = true;
    video.preload = "auto";
    video.volume = 1;

    let clipSource: MediaElementAudioSourceNode | null = null;

    video.onloadeddata = () => {
      try {
        clipSource = audioCtx.createMediaElementSource(video);
        clipSource.connect(dest);
      } catch {
        // already connected
      }

      if (musicGain) {
        musicGain.gain.setTargetAtTime(baseMusicVolume * DUCK_MIN_GAIN, audioCtx.currentTime, 0.1);
      }

      video.play().catch(() => {});
    };

    video.onplay = () => {
      const draw = () => {
        if (video.ended || video.paused) return;
        const crop = coverCrop(video.videoWidth, video.videoHeight, width, height);
        ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
        requestAnimationFrame(draw);
      };
      draw();
    };

    video.onended = () => {
      const crop = coverCrop(video.videoWidth, video.videoHeight, width, height);
      ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);

      if (musicGain) {
        musicGain.gain.setTargetAtTime(baseMusicVolume, audioCtx.currentTime, 0.1);
      }
      if (clipSource) {
        try { clipSource.disconnect(); } catch { /* ok */ }
      }
      resolve();
    };

    video.onerror = () => reject(new Error(`Failed to load: ${url}`));
    video.src = url;
  });
}

/* ── Utilities ──────────────────────────────────────────── */

function getSupportedMimeType(): string {
  const types = [
    "video/mp4;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
