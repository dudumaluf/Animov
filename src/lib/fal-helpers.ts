import { fal } from "@fal-ai/client";

/**
 * Ensures a URL is a fal.ai-compatible HTTPS URL.
 * If the input is a blob/data URL or non-HTTPS, re-uploads via fal storage.
 */
export async function ensureFalUrl(url: string): Promise<string> {
  if (url.startsWith("https://") && !url.startsWith("data:")) {
    return url;
  }
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], "frame.jpg", { type: blob.type || "image/jpeg" });
  return fal.storage.upload(file);
}
