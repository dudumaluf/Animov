/**
 * Trim-aware video frame extraction.
 * ----------------------------------
 * Loads a video off-screen, seeks to an arbitrary source-time, and rasterizes
 * the frame to a PNG blob/File. Used by:
 *   - the "extract frame" timeline action (first / last / current)
 *   - the AI transition pipeline (last frame of clip A → first frame of clip B)
 *
 * IMPORTANT: callers pass a SOURCE time (seconds into the original file), not
 * a timeline-local offset. For trimmed clips, compute it with the helpers
 * below so the extracted frame matches what actually plays on the timeline.
 */

/** Small epsilon so "last frame" requests don't land past the decodable end. */
const END_EPSILON = 0.05;

/**
 * Resolves the source-time (seconds into the original file) for a named edge
 * of a trimmed clip:
 *   - "first"   → trimStart (or 0)
 *   - "last"    → trimEnd (or nativeDuration), pulled back by END_EPSILON
 *   - a number  → that exact local offset added to trimStart
 *
 * `nativeDuration` is the full file length; when unknown (0/undefined) we let
 * the <video> element's own duration drive the "last" case at extract time.
 */
export function sourceTimeForEdge(
  edge: "first" | "last" | number,
  trimStart: number | undefined,
  trimEnd: number | undefined,
  nativeDuration: number | undefined,
): number {
  const start = trimStart ?? 0;
  if (edge === "first") return start;
  if (edge === "last") {
    const end =
      typeof trimEnd === "number" && trimEnd > 0
        ? trimEnd
        : nativeDuration && nativeDuration > 0
          ? nativeDuration
          : 0;
    // end===0 means "unknown" — caller (extractFrameBlob) clamps to the real
    // <video>.duration once metadata loads.
    return end > 0 ? Math.max(start, end - END_EPSILON) : -1;
  }
  // Numeric local offset (e.g. playhead position within the clip).
  return start + Math.max(0, edge);
}

/**
 * Extracts a single frame as a PNG Blob.
 *
 * @param videoUrl  Source video URL (must be CORS-readable for canvas export).
 * @param sourceTime  Seconds into the source file. Pass -1 to mean "the very
 *                    last decodable frame" (resolved from <video>.duration).
 */
export async function extractFrameBlob(
  videoUrl: string,
  sourceTime: number,
): Promise<Blob> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  video.src = videoUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video"));
    });

    const duration = video.duration || 0;
    const target =
      sourceTime < 0
        ? Math.max(0, duration - END_EPSILON)
        : Math.min(sourceTime, Math.max(0, duration - END_EPSILON));

    video.currentTime = target;
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Failed to seek video"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("toBlob returned null");
    return blob;
  } finally {
    // Release the decoder/network handle promptly.
    video.removeAttribute("src");
    video.load();
  }
}

/** Convenience: extract a frame and wrap it in a named File. */
export async function extractFrameFile(
  videoUrl: string,
  sourceTime: number,
  filename = "frame.png",
): Promise<File> {
  const blob = await extractFrameBlob(videoUrl, sourceTime);
  return new File([blob], filename, { type: "image/png" });
}
