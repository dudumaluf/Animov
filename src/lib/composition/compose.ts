import { Muxer, ArrayBufferTarget } from "mp4-muxer";

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

  if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
    return composeWithWebCodecs({ clipUrls, width, height, fps, onProgress });
  }

  return composeWithMediaRecorder({ clipUrls, width, height, onProgress });
}

async function composeWithWebCodecs({
  clipUrls,
  width,
  height,
  fps,
  onProgress,
}: Required<Omit<CompositionInput, "onProgress">> & { onProgress?: CompositionInput["onProgress"] }): Promise<Blob> {
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width,
      height,
    },
    fastStart: "in-memory",
  });

  let encodedFrames = 0;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
      encodedFrames++;
    },
    error: (err) => console.error("[encoder]", err),
  });

  encoder.configure({
    codec: "avc1.640028",
    width,
    height,
    bitrate: 10_000_000,
    framerate: fps,
  });

  const frameDuration = 1_000_000 / fps;
  let globalTimestamp = 0;

  for (let i = 0; i < clipUrls.length; i++) {
    onProgress?.(i, clipUrls.length);
    const frames = await extractFrames(clipUrls[i]!, width, height, fps);

    for (const canvas of frames) {
      const frame = new VideoFrame(canvas, {
        timestamp: globalTimestamp,
        duration: frameDuration,
      });
      const keyFrame = globalTimestamp === 0 || encodedFrames % (fps * 2) === 0;
      encoder.encode(frame, { keyFrame });
      frame.close();
      globalTimestamp += frameDuration;
    }
  }

  onProgress?.(clipUrls.length, clipUrls.length);

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  return new Blob([target.buffer], { type: "video/mp4" });
}

async function extractFrames(
  url: string,
  width: number,
  height: number,
  fps: number,
): Promise<HTMLCanvasElement[]> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error(`Failed to load: ${url}`));
  });

  const duration = video.duration;
  const totalFrames = Math.ceil(duration * fps);
  const frames: HTMLCanvasElement[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const time = f / fps;
    video.currentTime = time;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, width, height);
    frames.push(canvas);
  }

  return frames;
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
