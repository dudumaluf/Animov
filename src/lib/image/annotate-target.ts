/**
 * Client-side target-image annotator.
 *
 * Renders a copy of the source image with numbered magenta markers at each
 * provided drop point. Used to give both the vision LLM analyzer and the
 * final image-edit model a precise spatial anchor for placement.
 *
 * Returns a data URL (JPEG) of the annotated image. Runs entirely in the
 * browser (no server cost). Uses OffscreenCanvas when available, falls back
 * to a detached HTMLCanvasElement.
 */

export type AnnotationMarker = {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  label: string; // e.g. "1: sofa-cinza"
};

const MARKER_COLOR = "#ff00a6"; // bright magenta (clearly synthetic)
const MARKER_STROKE = "#ffffff";
const LABEL_BG = "rgba(0,0,0,0.78)";
const LABEL_FG = "#ffffff";
const MARKER_MIN_PX = 28;
const MARKER_MAX_PX = 80;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function createCanvas(width: number, height: number): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");
    return { canvas, ctx: ctx as OffscreenCanvasRenderingContext2D };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");
  return { canvas, ctx };
}

async function canvasToDataUrl(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality = 0.92,
): Promise<string> {
  if (canvas instanceof HTMLCanvasElement) {
    return canvas.toDataURL("image/jpeg", quality);
  }
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function annotateTarget(
  targetUrl: string,
  markers: AnnotationMarker[],
): Promise<string> {
  const img = await loadImage(targetUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) throw new Error("Target image has invalid dimensions");

  const { canvas, ctx } = createCanvas(width, height);

  // Base image.
  ctx.drawImage(img as CanvasImageSource, 0, 0, width, height);

  if (markers.length === 0) {
    return canvasToDataUrl(canvas);
  }

  const minSide = Math.min(width, height);
  const markerRadius = Math.max(
    MARKER_MIN_PX / 2,
    Math.min(MARKER_MAX_PX / 2, minSide * 0.022),
  );
  const numberFontSize = Math.round(markerRadius * 1.1);
  const labelFontSize = Math.max(12, Math.round(minSide * 0.014));
  const labelPaddingX = Math.round(labelFontSize * 0.55);
  const labelPaddingY = Math.round(labelFontSize * 0.35);
  const labelGap = Math.round(markerRadius * 0.7);
  const strokeWidth = Math.max(2, Math.round(markerRadius * 0.12));

  for (const marker of markers) {
    const cx = Math.round(marker.x * width);
    const cy = Math.round(marker.y * height);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = markerRadius * 0.5;
    ctx.fillStyle = MARKER_COLOR;
    ctx.beginPath();
    ctx.arc(cx, cy, markerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = MARKER_STROKE;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.arc(cx, cy, markerRadius, 0, Math.PI * 2);
    ctx.stroke();

    const number = marker.label.split(":")[0]?.trim() ?? "";
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${numberFontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(number, cx, cy);

    const labelText = marker.label;
    ctx.font = `bold ${labelFontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const metrics = ctx.measureText(labelText);
    const labelWidth = Math.ceil(metrics.width) + labelPaddingX * 2;
    const labelHeight = Math.ceil(labelFontSize * 1.4) + labelPaddingY;

    const labelY = cy + markerRadius + labelGap;
    const labelX = Math.max(
      labelWidth / 2 + 4,
      Math.min(width - labelWidth / 2 - 4, cx),
    );

    ctx.fillStyle = LABEL_BG;
    const labelLeft = labelX - labelWidth / 2;
    const radius = Math.min(6, labelHeight / 3);
    ctx.beginPath();
    ctx.moveTo(labelLeft + radius, labelY);
    ctx.lineTo(labelLeft + labelWidth - radius, labelY);
    ctx.quadraticCurveTo(labelLeft + labelWidth, labelY, labelLeft + labelWidth, labelY + radius);
    ctx.lineTo(labelLeft + labelWidth, labelY + labelHeight - radius);
    ctx.quadraticCurveTo(
      labelLeft + labelWidth,
      labelY + labelHeight,
      labelLeft + labelWidth - radius,
      labelY + labelHeight,
    );
    ctx.lineTo(labelLeft + radius, labelY + labelHeight);
    ctx.quadraticCurveTo(labelLeft, labelY + labelHeight, labelLeft, labelY + labelHeight - radius);
    ctx.lineTo(labelLeft, labelY + radius);
    ctx.quadraticCurveTo(labelLeft, labelY, labelLeft + radius, labelY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = LABEL_FG;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, labelX, labelY + labelHeight / 2);
  }

  return canvasToDataUrl(canvas);
}

export function formatMarkerLabel(index: number, name: string): string {
  const trimmed = (name || "ref").trim().replace(/\s+/g, "-");
  const safe = trimmed.length > 16 ? trimmed.slice(0, 15) + "…" : trimmed;
  return `${index}: ${safe}`;
}
