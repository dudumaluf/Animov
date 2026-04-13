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

/** Progress for the export overlay (0–100). */
export type ComposeProgress = {
  message: string;
  percent: number;
};

type CompositionInput = {
  clipUrls: string[];
  audioUrl?: string;
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (p: ComposeProgress) => void;
};

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n));
}

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

export async function composeVideos({
  clipUrls,
  audioUrl,
  width = 1920,
  height = 1080,
  fps = 30,
  onProgress,
}: CompositionInput): Promise<Blob> {
  if (clipUrls.length === 0) throw new Error("No clips to compose");

  if (clipUrls.length === 1 && !audioUrl) {
    onProgress?.({ message: "Baixando vídeo...", percent: 30 });
    const blob = await fetchBlobWithRetry(clipUrls[0]!, (a) => {
      onProgress?.({ message: `Reconectando (${a}/3)...`, percent: 20 + a * 5 });
    });
    onProgress?.({ message: "Pronto", percent: 100 });
    return blob;
  }

  try {
    return await composeWithMediabunny({ clipUrls, audioUrl, width, height, fps, onProgress });
  } catch (err) {
    console.warn("[compose] Mediabunny failed, falling back to MediaRecorder:", err);
    onProgress?.({ message: "Usando modo alternativo de gravação...", percent: 5 });
    return composeWithMediaRecorder({ clipUrls, audioUrl, width, height, onProgress });
  }
}

async function decodeAudioToBuffers(url: string): Promise<AudioBuffer[]> {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const audioCtx = new OfflineAudioContext(2, 1, 44100);
  const fullBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const chunkDuration = 1;
  const sampleRate = fullBuffer.sampleRate;
  const channels = fullBuffer.numberOfChannels;
  const totalSamples = fullBuffer.length;
  const chunkSamples = Math.floor(chunkDuration * sampleRate);
  const buffers: AudioBuffer[] = [];

  for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
    const length = Math.min(chunkSamples, totalSamples - offset);
    const chunk = new AudioBuffer({ length, sampleRate, numberOfChannels: channels });
    for (let ch = 0; ch < channels; ch++) {
      const src = fullBuffer.getChannelData(ch);
      const dst = chunk.getChannelData(ch);
      dst.set(src.subarray(offset, offset + length));
    }
    buffers.push(chunk);
  }

  return buffers;
}

async function composeWithMediabunny({
  clipUrls,
  audioUrl,
  width,
  height,
  fps,
  onProgress,
}: {
  clipUrls: string[];
  audioUrl?: string;
  width: number;
  height: number;
  fps: number;
  onProgress?: CompositionInput["onProgress"];
}): Promise<Blob> {
  const report = (message: string, percent: number) =>
    onProgress?.({ message, percent: clampPct(percent) });

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;

  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource);

  let audioSource: AudioBufferSource | null = null;
  let audioBuffers: AudioBuffer[] = [];

  if (audioUrl) {
    report("Decodificando áudio...", 3);
    audioBuffers = await decodeAudioToBuffers(audioUrl);
    audioSource = new AudioBufferSource({
      codec: "aac",
      bitrate: QUALITY_HIGH,
    });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  let globalTime = 0;
  const frameDuration = 1 / fps;
  let audioBufferIndex = 0;

  const n = clipUrls.length;
  const spanEncode = audioUrl ? 88 : 92;
  const basePct = audioUrl ? 8 : 4;

  for (let i = 0; i < n; i++) {
    report(`Baixando clipe ${i + 1} de ${n}...`, basePct + (i / n) * 6);

    const blob = await fetchBlobWithRetry(clipUrls[i]!, (attempt) => {
      report(`Clipe ${i + 1}: reconectando (${attempt}/3)...`, basePct + (i / n) * 6);
    });

    report(`Abrindo clipe ${i + 1} de ${n}...`, basePct + 6 + (i / n) * 4);

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob),
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) continue;

    const decodable = await videoTrack.canDecode();
    if (!decodable) continue;

    const { VideoSampleSink } = await import("mediabunny");
    const sink = new VideoSampleSink(videoTrack);
    const duration = await videoTrack.computeDuration();
    const totalFrames = Math.ceil(duration * fps);

    for (let f = 0; f < totalFrames; f++) {
      const time = f / fps;
      const sample = await sink.getSample(time);
      if (!sample) continue;

      try {
        ctx.clearRect(0, 0, width, height);
        sample.draw(ctx, 0, 0, width, height);

        await videoSource.add(globalTime, frameDuration);

        if (audioSource && audioBufferIndex < audioBuffers.length) {
          const audioTime = globalTime;
          const audioDuration = audioBuffers[audioBufferIndex]!.duration;
          if (audioTime >= audioBufferIndex * audioDuration) {
            await audioSource.add(audioBuffers[audioBufferIndex]!);
            audioBufferIndex++;
          }
        }

        globalTime += frameDuration;
      } finally {
        sample.close();
      }

      if (f === 0 || f === totalFrames - 1 || f % Math.max(1, Math.floor(totalFrames / 25)) === 0) {
        const inner = (f + 1) / totalFrames;
        report(
          `Codificando clipe ${i + 1}/${n} — quadro ${f + 1} de ${totalFrames}`,
          basePct + 10 + (i + inner) / n * spanEncode,
        );
      }
    }
  }

  if (audioSource) {
    while (audioBufferIndex < audioBuffers.length && audioBufferIndex * 1 <= globalTime) {
      await audioSource.add(audioBuffers[audioBufferIndex]!);
      audioBufferIndex++;
    }
  }

  report("Finalizando arquivo MP4...", 97);
  await output.finalize();

  report("Concluído", 100);
  return new Blob([target.buffer!], { type: "video/mp4" });
}

async function composeWithMediaRecorder({
  clipUrls,
  audioUrl,
  width,
  height,
  onProgress,
}: {
  clipUrls: string[];
  audioUrl?: string;
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

  let combinedStream: MediaStream;
  let audioEl: HTMLAudioElement | null = null;

  if (audioUrl) {
    report("Carregando áudio (modo alternativo)...", 8);
    audioEl = document.createElement("audio");
    audioEl.crossOrigin = "anonymous";
    audioEl.src = audioUrl;
    audioEl.volume = 1;
    await new Promise<void>((resolve) => { audioEl!.oncanplaythrough = () => resolve(); audioEl!.load(); });

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audioEl);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioCtx.destination);

    combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);
  } else {
    combinedStream = videoStream;
  }

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

  const nc = clipUrls.length;
  for (let i = 0; i < nc; i++) {
    report(`Gravando clipe ${i + 1} de ${nc}...`, 15 + (i / nc) * 75);
    await playClipToCanvas(clipUrls[i]!, ctx, width, height);
  }

  report("Finalizando gravação...", 95);

  if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
  recorder.stop();
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  return new Blob(chunks, { type: mimeType });
}

function playClipToCanvas(
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
      video.play().catch(() => {
        /* play() can abort if pause() runs (e.g. tab background); draw loop still runs from onplay */
      });
    };

    video.onplay = () => {
      const draw = () => {
        if (video.ended || video.paused) return;
        ctx.drawImage(video, 0, 0, width, height);
        requestAnimationFrame(draw);
      };
      draw();
    };

    video.onended = () => {
      ctx.drawImage(video, 0, 0, width, height);
      resolve();
    };

    video.onerror = () => reject(new Error(`Failed to load: ${url}`));
    video.src = url;
  });
}

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
