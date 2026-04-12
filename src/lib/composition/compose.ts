import {
  Input,
  Output,
  Conversion,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  QUALITY_HIGH,
} from "mediabunny";

type CompositionInput = {
  clipUrls: string[];
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (current: number, total: number) => void;
};

export async function composeVideos({
  clipUrls,
  width = 1920,
  height = 1080,
  fps = 30,
  onProgress,
}: CompositionInput): Promise<Blob> {
  if (clipUrls.length === 0) throw new Error("No clips to compose");

  if (clipUrls.length === 1) {
    const res = await fetch(clipUrls[0]!);
    return res.blob();
  }

  try {
    return await composeWithMediabunny({ clipUrls, width, height, fps, onProgress });
  } catch (err) {
    console.warn("[compose] Mediabunny failed, falling back to MediaRecorder:", err);
    return composeWithMediaRecorder({ clipUrls, width, height, onProgress });
  }
}

async function composeWithMediabunny({
  clipUrls,
  width,
  height,
  fps,
  onProgress,
}: {
  clipUrls: string[];
  width: number;
  height: number;
  fps: number;
  onProgress?: CompositionInput["onProgress"];
}): Promise<Blob> {
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

  await output.start();

  for (let i = 0; i < clipUrls.length; i++) {
    onProgress?.(i, clipUrls.length);

    const res = await fetch(clipUrls[i]!);
    const blob = await res.blob();

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

      ctx.clearRect(0, 0, width, height);
      sample.draw(ctx, 0, 0, width, height);

      await videoSource.add(1 / fps, 1 / fps);
    }
  }

  onProgress?.(clipUrls.length, clipUrls.length);

  await output.finalize();

  return new Blob([target.buffer!], { type: "video/mp4" });
}

async function composeWithMediaRecorder({
  clipUrls,
  width,
  height,
  onProgress,
}: {
  clipUrls: string[];
  width: number;
  height: number;
  onProgress?: CompositionInput["onProgress"];
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  for (let i = 0; i < clipUrls.length; i++) {
    onProgress?.(i, clipUrls.length);
    await playClipToCanvas(clipUrls[i]!, ctx, width, height);
  }

  onProgress?.(clipUrls.length, clipUrls.length);

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
      video.play().catch(reject);
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
