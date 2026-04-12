type CompositionInput = {
  clipUrls: string[];
  width?: number;
  height?: number;
  onProgress?: (current: number, total: number) => void;
};

export async function composeVideos({
  clipUrls,
  width = 1280,
  height = 720,
  onProgress,
}: CompositionInput): Promise<Blob> {
  if (clipUrls.length === 0) throw new Error("No clips to compose");

  if (clipUrls.length === 1) {
    const res = await fetch(clipUrls[0]!);
    return res.blob();
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: getSupportedMimeType(),
    videoBitsPerSecond: 8_000_000,
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

  const mimeType = recorder.mimeType || "video/webm";
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

    video.onerror = () => reject(new Error(`Failed to load clip: ${url}`));

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
