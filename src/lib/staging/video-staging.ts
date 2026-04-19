/**
 * Staging pipeline: after a scene video is persisted to Supabase storage, we
 * extract a sprite-sheet of thumbnails for instant scrub preview. This runs on
 * the main thread but is cooperative (yields to the event loop between seeks)
 * so the UI stays responsive. All heavy work is I/O bound (video seek ->
 * decode -> drawImage -> blob encode); no CPU-bound loops.
 *
 * The sprite is a JPEG grid: `columns × rows` cells of `thumbWidth × thumbHeight`
 * pixels. The film-strip uses CSS background-position to show the exact frame
 * that corresponds to the playhead during scrubbing, avoiding the 200-500ms
 * seek latency of the HTMLVideoElement.
 */

import type { SceneSprite } from "@/stores/project-store";

const MAX_FRAMES = 30;
const FRAMES_PER_SECOND = 3;
const THUMB_WIDTH = 160;
const JPEG_QUALITY = 0.7;
const SEEK_TIMEOUT_MS = 2000;

export type StageVideoParams = {
  sceneId: string;
  videoUrl: string;
  projectId: string;
  duration: number;
  signal?: AbortSignal;
};

export async function stageVideoForTimeline(
  params: StageVideoParams,
): Promise<SceneSprite | null> {
  const { sceneId, videoUrl, projectId, duration, signal } = params;

  if (!videoUrl || !duration || duration <= 0) return null;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  video.src = videoUrl;

  try {
    await waitForMetadata(video, signal);
    if (signal?.aborted) return null;

    const videoDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
    const frames = Math.min(
      MAX_FRAMES,
      Math.max(1, Math.ceil(videoDuration * FRAMES_PER_SECOND)),
    );

    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    const aspect = vh / vw;
    const thumbWidth = THUMB_WIDTH;
    const thumbHeight = Math.max(1, Math.round(thumbWidth * aspect));

    const columns = Math.ceil(Math.sqrt(frames));
    const rows = Math.ceil(frames / columns);

    const canvas = document.createElement("canvas");
    canvas.width = columns * thumbWidth;
    canvas.height = rows * thumbHeight;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) return null;
      const targetTime = Math.max(
        0,
        Math.min(videoDuration - 0.01, (videoDuration * (i + 0.5)) / frames),
      );
      try {
        await seekTo(video, targetTime);
      } catch {
        /* keep last decoded frame and move on */
      }
      const col = i % columns;
      const row = Math.floor(i / columns);
      try {
        ctx.drawImage(video, col * thumbWidth, row * thumbHeight, thumbWidth, thumbHeight);
      } catch {
        /* tainted canvas (CORS) — abort and report null */
        return null;
      }
      await yieldToEventLoop();
    }

    if (signal?.aborted) return null;

    const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (!blob) return null;

    const formData = new FormData();
    formData.append("sprite", blob, `${sceneId}.jpg`);
    formData.append("projectId", projectId);
    formData.append("sceneId", sceneId);

    const res = await fetch("/api/persist-sprite", {
      method: "POST",
      body: formData,
      signal,
    });

    if (!res.ok) {
      console.error("[stage-video] upload failed", res.status);
      return null;
    }

    const data = (await res.json()) as { url?: string };
    if (!data.url) return null;

    return {
      url: data.url,
      frames,
      columns,
      rows,
      thumbWidth,
      thumbHeight,
    };
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") return null;
    console.error("[stage-video]", err);
    return null;
  } finally {
    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch {
      /* ignore */
    }
  }
}

function waitForMetadata(
  video: HTMLVideoElement,
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    if (video.readyState >= 1 && isFinite(video.duration)) {
      resolve();
      return;
    }
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to load video metadata"));
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    video.addEventListener("loadedmetadata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = window.setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Seek timeout"));
    }, SEEK_TIMEOUT_MS);
    const onSeeked = () => {
      window.clearTimeout(timeoutHandle);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    try {
      video.currentTime = time;
    } catch {
      window.clearTimeout(timeoutHandle);
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Seek failed"));
    }
  });
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout?: number }) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(() => resolve(), 0);
    }
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
