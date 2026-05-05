import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
const uuid = () => crypto.randomUUID();
import {
  buildPortableProject,
  parsePortableProjectJson,
  portableToScene,
} from "@/lib/project-portable";
import { DEFAULT_MODEL_ID } from "@/lib/adapters";
import { extractVideoThumbnail } from "@/lib/utils/video-thumbnail";
import { type AudioMixSettings, DEFAULT_AUDIO_MIX } from "@/lib/composition/compose";
import { stageVideoForTimeline } from "@/lib/staging/video-staging";
import { useBatchesStore } from "@/stores/batches-store";
import { useJobsStore } from "@/stores/jobs-store";

export type VideoVersion = { url: string; duration: number };

export type SceneStagingStatus = "pending" | "ready" | "failed";

export type SceneSprite = {
  url: string;
  frames: number;
  columns: number;
  rows: number;
  thumbWidth: number;
  thumbHeight: number;
};

export type ImageCropAspect = "free" | "16:9" | "9:16" | "1:1" | "4:5";

/**
 * Non-destructive crop applied to the scene's source photo. Coordinates are
 * normalized (0-1) so the rectangle stays valid if the underlying image is
 * later re-uploaded at a different resolution. The original `photoUrl` is
 * never mutated; the crop is rasterized just-in-time by the generation
 * pipeline (canvas + uploadPhoto) and reflected in the UI via CSS positioning
 * (CroppedImage component) — see render-cropped-on-generate logic.
 */
export type ImageCrop = {
  aspect: ImageCropAspect;
  x: number;       // 0-1, top-left of crop in source image
  y: number;       // 0-1
  width: number;   // 0-1
  height: number;  // 0-1
};

export type Scene = {
  id: string;
  photoUrl: string;
  photoDataUrl?: string;
  presetId: string;
  duration: number;
  status: "idle" | "generating" | "ready" | "failed" | "processing";
  videoUrl?: string;
  videoVersions: VideoVersion[];
  activeVersion: number;
  costCredits: number;
  sourceType?: "image" | "video-upload";
  audioVolume?: number;
  stagingStatus?: SceneStagingStatus;
  sprite?: SceneSprite;
  /**
   * Non-destructive trim window for video scenes (seconds into source).
   * Timeline playback only renders [trimStart, trimEnd] of the source video.
   * Image-only scenes ignore these (they use `duration` directly).
   * null/undefined = no trim (play full source).
   */
  trimStart?: number;
  trimEnd?: number;
  /**
   * Desired duration to request from the video model on the NEXT generation.
   * Kept separate from `duration` (which reflects the effective clip length).
   * Cleared on successful generation so the UI never confuses past intent
   * with future intent. `undefined` falls back to `duration` at request time.
   */
  generationTargetSeconds?: number;
  /**
   * Optional non-destructive crop on the source photo. Applied at generation
   * time (rasterized + uploaded as derivative) and reflected in previews via
   * CSS. Reset automatically when the photo is replaced via IA-edit.
   */
  crop?: ImageCrop;
};

export type Transition = {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  presetId: string;
  enabled: boolean;
  status: "idle" | "generating" | "ready" | "failed";
  videoUrl?: string;
  costCredits: number;
  /**
   * Real duration (seconds) returned by the video model. Decoupled from
   * `costCredits` because providers like Kling can return 4.2s when asked
   * for 5s. Timeline segment math uses this when present; falls back to
   * `costCredits` for transitions created before this field existed.
   */
  duration?: number;
  /**
   * Sprite sheet metadata for instant scrub preview (same staging pipeline
   * as scenes). `undefined` = not staged yet; staging is best-effort and can
   * fail silently (scrub falls back to raw `<video>` seek).
   */
  sprite?: SceneSprite;
  stagingStatus?: SceneStagingStatus;
};

export type ProjectStore = {
  projectId: string;
  supabaseProjectId: string | null;
  projectName: string;
  modelId: string;
  scenes: Scene[];
  transitions: Transition[];
  selectedSceneId: string | null;
  hasEditNode: boolean;
  editNodeSelected: boolean;
  musicPrompt: string;
  musicUrl: string | null;
  exportAspectRatio: "16:9" | "9:16";
  audioMix: AudioMixSettings;
  isLoading: boolean;
  isDirty: boolean;
  isSaving: boolean;

  _photoFiles: Record<string, File>;

  setProjectName: (name: string) => void;
  setModelId: (modelId: string) => void;
  selectScene: (id: string | null) => void;

  addPhotos: (files: File[]) => void;
  addVideoUploads: (files: File[]) => void;
  insertPhotoAt: (index: number, file: File) => void;
  insertVideoAt: (index: number, file: File) => void;
  insertPlaceholder: (index: number) => string;
  updatePlaceholderImage: (sceneId: string, file: File) => Promise<void>;
  removeScene: (id: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  setScenePreset: (sceneId: string, presetId: string) => void;
  setSceneDuration: (sceneId: string, duration: number) => void;
  setSceneGenerationTarget: (sceneId: string, seconds: number | null) => void;
  setSceneTrim: (
    sceneId: string,
    trim: { trimStart?: number | null; trimEnd?: number | null },
  ) => void;
  setSceneCrop: (sceneId: string, crop: ImageCrop | null) => void;
  setActiveVersion: (sceneId: string, version: number) => void;
  updateSceneImage: (sceneId: string, newImageUrl: string) => void;

  toggleTransition: (transitionId: string) => void;
  generateTransition: (fromSceneId: string, toSceneId: string, duration?: number) => Promise<void>;
  removeTransition: (transitionId: string) => void;
  setHasEditNode: (has: boolean) => void;
  selectEditNode: () => void;
  setMusicPrompt: (prompt: string) => void;
  generateMusic: () => Promise<void>;
  uploadMusicFile: (file: File) => Promise<void>;
  clearMusic: () => void;
  setExportAspectRatio: (ratio: "16:9" | "9:16") => void;
  setAudioMixSetting: <K extends keyof AudioMixSettings>(key: K, val: AudioMixSettings[K]) => void;
  setSceneAudioVolume: (sceneId: string, vol: number) => void;

  /**
   * Reconciles a stored `videoVersions[i].duration` with what the `<video>`
   * element actually reports after it loads its metadata. Heals in both
   * directions:
   *  - Grow when the stored value is smaller (legacy regeneration paths
   *    persisted the trimmed scene.duration as the version's duration,
   *    which capped trim handles below the file's real native length).
   *  - Shrink when the stored value overshoots the file (adapters like
   *    Kling V3 return the *requested* duration as `durationSeconds`, so
   *    a 5s ask that yields a 3s file leaves stored=5/real=3 — the engine
   *    then plays out at native end and freezes on the last frame until
   *    the segment boundary, see use-timeline-engine drift correction).
   *
   * Shrink uses a wider tolerance (`SHRINK_TOLERANCE`) than grow because
   * progressively-loaded sources can transiently report partial durations
   * before the moov atom is fully parsed. For Fal.ai outputs and direct
   * uploads (the only sources Animov has today) `loadedmetadata` is
   * definitive, so the wider window is conservative noise insurance, not
   * a behavioural compromise.
   *
   * When shrinking, also clamps `scene.trimEnd` to the new native (a
   * pre-shrink trim end could point past the real file end — those frames
   * never decoded, so clamping is non-destructive housekeeping) and
   * recomputes `scene.duration` from the (possibly clamped) trim window.
   */
  reconcileVideoVersionDuration: (sceneId: string, versionIndex: number, realDuration: number) => void;

  updateSceneStatus: (sceneId: string, status: Scene["status"], videoUrl?: string, costCredits?: number, videoDuration?: number) => void;
  generateAll: () => Promise<void>;
  generateScene: (sceneId: string) => Promise<void>;

  initProject: (urlProjectId: string) => Promise<void>;
  saveToSupabase: () => Promise<void>;
  loadFromSupabase: (supabaseId: string) => Promise<void>;

  exportProjectJson: () => { json: string; skippedSceneIds: string[] };
  importPortableProject: (
    json: string,
  ) => { ok: true; skippedSceneIds: string[] } | { ok: false; error: string };

  totalCost: () => number;
  reset: () => void;
};

const PLACEHOLDER_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function promoteReadyTransition(t: Transition): Scene {
  return {
    id: crypto.randomUUID(),
    photoUrl: t.videoUrl!,
    photoDataUrl: t.videoUrl!,
    presetId: "push_in_serene",
    duration: 5,
    status: "ready" as const,
    videoUrl: t.videoUrl!,
    videoVersions: [{ url: t.videoUrl!, duration: 5 }],
    activeVersion: 0,
    costCredits: 0,
  };
}

function rebuildTransitions(scenes: Scene[], existingTransitions?: Transition[]): Transition[] {
  const transitions: Transition[] = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    const id = `t-${scenes[i]!.id}-${scenes[i + 1]!.id}`;
    const existing = existingTransitions?.find((t) => t.id === id);
    if (existing) {
      transitions.push(existing);
    } else {
      transitions.push({
        id,
        fromSceneId: scenes[i]!.id,
        toSceneId: scenes[i + 1]!.id,
        presetId: "soft_dissolve_drift",
        enabled: true,
        status: "idle",
        costCredits: 5,
      });
    }
  }
  return transitions;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VALID_CROP_ASPECTS = new Set<ImageCropAspect>(["free", "16:9", "9:16", "1:1", "4:5"]);

/**
 * Defensive parse for the `crop` JSONB column. Returns undefined for any
 * malformed payload — keeps the inspector and CroppedImage components free
 * of `if (crop && typeof crop === ...)` defensive code at every render.
 */
function parseCropFromDb(raw: unknown): ImageCrop | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Partial<Record<keyof ImageCrop, unknown>>;
  if (!VALID_CROP_ASPECTS.has(c.aspect as ImageCropAspect)) return undefined;
  if (
    typeof c.x !== "number" ||
    typeof c.y !== "number" ||
    typeof c.width !== "number" ||
    typeof c.height !== "number"
  ) {
    return undefined;
  }
  if (c.width <= 0 || c.height <= 0) return undefined;
  return {
    aspect: c.aspect as ImageCropAspect,
    x: Math.max(0, Math.min(1, c.x)),
    y: Math.max(0, Math.min(1, c.y)),
    width: Math.max(0, Math.min(1, c.width)),
    height: Math.max(0, Math.min(1, c.height)),
  };
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}

export async function persistVideoToStorage(
  falUrl: string,
  projectId: string,
  sceneId: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/persist-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: falUrl, projectId, sceneId }),
    });
    if (!res.ok) {
      console.error("[persist-video] HTTP", res.status);
      return null;
    }
    const data = await res.json();
    return data.url as string;
  } catch (err) {
    console.error("[persist-video]", err);
    return null;
  }
}

/**
 * Mirror a remote (http/https) music URL into our Supabase `music` bucket.
 * Used after AI generation (Fal.ai) so the URL we persist is stable long-term
 * and not subject to the provider's CDN expiry. Returns `null` on failure so
 * the caller can fall back to the original URL without breaking UX.
 */
export async function persistMusicUrlToStorage(
  remoteUrl: string,
  projectId: string | null,
): Promise<string | null> {
  try {
    const res = await fetch("/api/persist-music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        musicUrl: remoteUrl,
        projectId: projectId ?? undefined,
      }),
    });
    if (!res.ok) {
      console.warn("[persist-music] HTTP", res.status);
      return null;
    }
    const data = await res.json();
    return (data.url as string) ?? null;
  } catch (err) {
    console.warn("[persist-music]", err);
    return null;
  }
}

/**
 * Upload a client-side audio File (user MP3 picker) directly to our `music`
 * bucket via multipart. Returns the public URL or `null` on failure.
 */
async function persistMusicFileToStorage(
  file: File,
  projectId: string | null,
): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    if (projectId) fd.append("projectId", projectId);
    const res = await fetch("/api/persist-music", { method: "POST", body: fd });
    if (!res.ok) {
      console.warn("[persist-music] HTTP", res.status);
      return null;
    }
    const data = await res.json();
    return (data.url as string) ?? null;
  } catch (err) {
    console.warn("[persist-music]", err);
    return null;
  }
}

/**
 * Kicks off background staging for a scene after its video is in Supabase
 * storage. Extracts a sprite-sheet of thumbnails and stores the metadata on
 * the scene. Non-blocking; progressive via stagingStatus transitions:
 * undefined -> "pending" -> "ready" | "failed".
 *
 * Defined at module scope using a function declaration (hoisted) so the store
 * methods can reference it before it runs. The useProjectStore reference
 * inside is resolved lazily at call time, so the forward reference is safe.
 */
export async function kickoffStaging(
  sceneId: string,
  videoUrl: string,
  duration: number,
): Promise<void> {
  if (!videoUrl || !videoUrl.startsWith("http")) return;

  const state = useProjectStore.getState();
  const scene = state.scenes.find((s) => s.id === sceneId);
  if (!scene) return;
  // Skip if we already have a sprite for THIS exact videoUrl. If the user
  // regenerates the scene, the new videoUrl will differ and we'll re-stage.
  if (scene.sprite && scene.videoUrl === videoUrl && scene.stagingStatus === "ready") return;
  if (scene.stagingStatus === "pending") return;

  const projectId = state.supabaseProjectId ?? state.projectId;

  useProjectStore.setState((st) => ({
    scenes: st.scenes.map((s) =>
      s.id === sceneId ? { ...s, stagingStatus: "pending" as const } : s,
    ),
  }));

  try {
    const sprite = await stageVideoForTimeline({
      sceneId,
      videoUrl,
      projectId,
      duration,
    });
    if (sprite) {
      useProjectStore.setState((st) => ({
        scenes: st.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, stagingStatus: "ready" as const, sprite }
            : s,
        ),
        isDirty: true,
      }));
      void useProjectStore.getState().saveToSupabase();
    } else {
      useProjectStore.setState((st) => ({
        scenes: st.scenes.map((s) =>
          s.id === sceneId ? { ...s, stagingStatus: "failed" as const } : s,
        ),
      }));
    }
  } catch (err) {
    console.error("[kickoff-staging]", err);
    useProjectStore.setState((st) => ({
      scenes: st.scenes.map((s) =>
        s.id === sceneId ? { ...s, stagingStatus: "failed" as const } : s,
      ),
    }));
  }
}

/**
 * Same staging pipeline as scenes, but targeted at an AI transition. Uses the
 * transition id (`t-{from}-{to}`) as the sprite's "sceneId" inside the staging
 * helper — `/api/persist-sprite` only cares that the id is unique per project.
 * Non-blocking and best-effort: failure degrades to raw `<video>` scrub.
 */
export async function kickoffStagingForTransition(
  transitionId: string,
  videoUrl: string,
  duration: number,
): Promise<void> {
  if (!videoUrl || !videoUrl.startsWith("http")) return;

  const state = useProjectStore.getState();
  const trans = state.transitions.find((t) => t.id === transitionId);
  if (!trans) return;
  if (trans.sprite && trans.videoUrl === videoUrl && trans.stagingStatus === "ready") return;
  if (trans.stagingStatus === "pending") return;

  const projectId = state.supabaseProjectId ?? state.projectId;

  useProjectStore.setState((st) => ({
    transitions: st.transitions.map((t) =>
      t.id === transitionId ? { ...t, stagingStatus: "pending" as const } : t,
    ),
  }));

  try {
    const sprite = await stageVideoForTimeline({
      sceneId: transitionId,
      videoUrl,
      projectId,
      duration,
    });
    if (sprite) {
      useProjectStore.setState((st) => ({
        transitions: st.transitions.map((t) =>
          t.id === transitionId
            ? { ...t, stagingStatus: "ready" as const, sprite }
            : t,
        ),
        isDirty: true,
      }));
      void useProjectStore.getState().saveToSupabase();
    } else {
      useProjectStore.setState((st) => ({
        transitions: st.transitions.map((t) =>
          t.id === transitionId ? { ...t, stagingStatus: "failed" as const } : t,
        ),
      }));
    }
  } catch (err) {
    console.error("[kickoff-staging-transition]", err);
    useProjectStore.setState((st) => ({
      transitions: st.transitions.map((t) =>
        t.id === transitionId ? { ...t, stagingStatus: "failed" as const } : t,
      ),
    }));
  }
}

async function uploadPhoto(file: File, projectId: string): Promise<string> {
  // Use signed-URL pattern to bypass Vercel's 4.5MB function body limit.
  // Client PUTs the file directly to Supabase Storage.
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name || `photo.${(file.type.split("/")[1] ?? "jpg")}`,
      contentType: file.type || "image/jpeg",
      projectId,
    }),
  });
  if (!res.ok) throw new Error("Failed to get signed upload URL");
  const { signedUrl, publicUrl } = (await res.json()) as {
    signedUrl: string;
    publicUrl: string;
  };

  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!putRes.ok) throw new Error("Photo upload failed");
  return publicUrl;
}

async function uploadVideoToStorage(
  file: File,
  projectId: string,
): Promise<string> {
  const res = await fetch("/api/upload-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      projectId,
    }),
  });
  if (!res.ok) throw new Error("Failed to get signed upload URL");
  const { signedUrl, publicUrl } = await res.json();

  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Video upload failed");
  return publicUrl;
}

async function resolveSceneFile(
  scene: Scene,
  photoFiles: Record<string, File>,
): Promise<File | null> {
  let file = photoFiles[scene.id];
  if (!file && scene.photoDataUrl && scene.photoDataUrl !== PLACEHOLDER_IMG) {
    try {
      file = await dataUrlToFile(scene.photoDataUrl, `${scene.id}.jpg`);
    } catch {
      /* fallback to photoUrl fetch below */
    }
  }
  if (!file && scene.photoUrl && !scene.photoUrl.startsWith("blob:") && !scene.photoUrl.startsWith("data:")) {
    try {
      const res = await fetch(scene.photoUrl);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const blob = await res.blob();
      const mime = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
      file = new File([blob], `${scene.id}.jpg`, { type: mime });
    } catch (e) {
      console.error("[resolveSceneFile]", e);
    }
  }
  return file ?? null;
}

// In-memory cache for cropped derivatives. Key = `${baseUrl}::${cropHash}`.
// Avoids re-rendering+re-uploading on retries within the same session (the
// most common cause: failed Fal generation that the user clicks Generate
// again on). Server-side persistence is unnecessary because the next page
// load will resolve the same key against `scene.photoUrl` (still the
// original) and trigger a fresh render+upload — Supabase storage de-dupes
// by content hash anyway in practice. The cache holds string URLs only, so
// memory pressure is negligible.
const croppedUrlCache = new Map<string, string>();

function cropCacheKey(baseUrl: string, crop: ImageCrop): string {
  return `${baseUrl}::${crop.x.toFixed(4)},${crop.y.toFixed(4)},${crop.width.toFixed(4)},${crop.height.toFixed(4)}`;
}

/**
 * Loads `baseUrl` into an off-screen <img>, crops the region defined by
 * `crop` (normalized 0..1 over the source image's natural dimensions) onto
 * a canvas, and uploads the resulting JPEG to Supabase Storage. Returns
 * the public URL. Throws if any step fails — the caller falls back to the
 * uncropped baseUrl in that case (better a slightly off video than no
 * generation at all).
 *
 * `crossOrigin = "anonymous"` is required because the canvas would
 * otherwise be tainted (Supabase Storage serves with appropriate CORS
 * headers, so this works in practice). For data: URLs no CORS handshake
 * happens, so the attribute is a no-op there.
 */
async function renderCroppedAndUpload(
  baseUrl: string,
  crop: ImageCrop,
  projectId: string,
  sceneId: string,
): Promise<string> {
  const cacheKey = cropCacheKey(baseUrl, crop);
  const cached = croppedUrlCache.get(cacheKey);
  if (cached) return cached;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("crop image load failed"));
    img.src = baseUrl;
  });

  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) {
    throw new Error("crop source has zero dimensions");
  }

  const sx = Math.round(crop.x * naturalW);
  const sy = Math.round(crop.y * naturalH);
  const sw = Math.max(1, Math.round(crop.width * naturalW));
  const sh = Math.max(1, Math.round(crop.height * naturalH));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("crop canvas 2d context unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("crop canvas toBlob returned null");

  const file = new File([blob], `${sceneId}-crop.jpg`, { type: "image/jpeg" });
  const url = await uploadPhoto(file, projectId);
  croppedUrlCache.set(cacheKey, url);
  return url;
}

/**
 * Ensures the scene has a usable HTTPS URL (Supabase Storage) that can be sent
 * to `/api/generate-scene` as JSON, bypassing Vercel's 4.5MB request body limit.
 * If the scene only has a blob:/data: URL or a pending upload, this uploads
 * on-demand and patches the store so subsequent calls are cheap. When a
 * non-destructive crop is set on the scene, the upload returns the cropped
 * derivative URL instead of the original (the original `scene.photoUrl` is
 * left untouched so the crop remains editable).
 */
export async function ensureSceneHttpsPhotoUrl(
  scene: Scene,
  photoFiles: Record<string, File>,
  projectId: string,
): Promise<string | null> {
  let baseUrl: string | null = null;
  if (
    scene.photoUrl &&
    scene.photoUrl.startsWith("https://") &&
    scene.photoUrl !== PLACEHOLDER_IMG
  ) {
    baseUrl = scene.photoUrl;
  } else {
    const file = await resolveSceneFile(scene, photoFiles);
    if (!file) return null;
    try {
      baseUrl = await uploadPhoto(file, projectId);
      useProjectStore.setState((state) => ({
        scenes: state.scenes.map((s) =>
          s.id === scene.id ? { ...s, photoUrl: baseUrl ?? s.photoUrl } : s,
        ),
        isDirty: true,
      }));
    } catch (err) {
      console.error("[ensureSceneHttpsPhotoUrl]", err);
      return null;
    }
  }

  if (!scene.crop || !baseUrl) return baseUrl;
  try {
    return await renderCroppedAndUpload(baseUrl, scene.crop, projectId, scene.id);
  } catch (err) {
    // Falling back to the uncropped URL is intentional: the user's intent
    // was to generate, not to enforce the crop perfectly. A noticeable
    // ratio mismatch in the resulting video is recoverable; failing the
    // generation outright with no asset is not.
    console.error("[ensureSceneHttpsPhotoUrl] crop render failed", err);
    return baseUrl;
  }
}

export async function resolveSceneHttpsUrl(
  scene: Scene,
  photoFiles: Record<string, File>,
  projectId: string,
): Promise<string | null> {
  let baseUrl: string | null = null;
  if (scene.photoUrl && scene.photoUrl.startsWith("https://")) {
    if (!photoFiles[scene.id]) {
      baseUrl = scene.photoUrl;
    }
  }
  if (!baseUrl) {
    const file = await resolveSceneFile(scene, photoFiles);
    if (!file) {
      baseUrl = scene.photoUrl?.startsWith("https://") ? scene.photoUrl : null;
    } else {
      try {
        baseUrl = await uploadPhoto(file, projectId);
      } catch (e) {
        console.error("[resolveSceneHttpsUrl] upload failed", e);
        baseUrl = scene.photoUrl?.startsWith("https://") ? scene.photoUrl : null;
      }
    }
  }
  if (!baseUrl) return null;
  if (!scene.crop) return baseUrl;
  try {
    return await renderCroppedAndUpload(baseUrl, scene.crop, projectId, scene.id);
  } catch (e) {
    console.error("[resolveSceneHttpsUrl] crop render failed", e);
    return baseUrl;
  }
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projectId: "",
      supabaseProjectId: null,
      projectName: "Novo Projeto",
      modelId: DEFAULT_MODEL_ID,
      scenes: [],
      transitions: [],
      selectedSceneId: null,
      hasEditNode: false,
      editNodeSelected: false,
      musicPrompt: "Calm ambient instrumental, warm piano, soft strings, real estate luxury, 90 BPM, elegant and inviting",
      musicUrl: null,
      exportAspectRatio: "16:9",
      audioMix: { ...DEFAULT_AUDIO_MIX },
      isLoading: false,
      isDirty: false,
      isSaving: false,
      _photoFiles: {},

      setProjectName: (name) => {
        set({ projectName: name, isDirty: true });
        const id = get().supabaseProjectId;
        if (id) {
          fetch(`/api/projects/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          })
            .then((res) => {
              if (!res.ok) console.error("[setProjectName] PATCH failed:", res.status);
            })
            .catch((err) => console.error("[setProjectName]", err));
        }
      },
      setModelId: (modelId) => set({ modelId, isDirty: true }),
      selectScene: (id) =>
        set((state) => ({
          selectedSceneId: state.selectedSceneId === id ? null : id,
          editNodeSelected: false,
        })),

      addPhotos: (files) => {
        const ids = files.map(() => uuid());
        const newScenes: Scene[] = files.map((file, i) => ({
          id: ids[i]!,
          photoUrl: URL.createObjectURL(file),
          presetId: "push_in_serene",
          duration: 5,
          status: "idle" as const,
          videoVersions: [],
          activeVersion: 0,
          costCredits: 5,
        }));

        const fileMap: Record<string, File> = {};
        files.forEach((file, i) => {
          fileMap[ids[i]!] = file;
        });

        set((state) => {
          const scenes = [...state.scenes, ...newScenes];
          return {
            scenes,
            transitions: rebuildTransitions(scenes, state.transitions),
            selectedSceneId: newScenes[0]?.id ?? state.selectedSceneId,
            isDirty: true,
            _photoFiles: { ...state._photoFiles, ...fileMap },
          };
        });

        const projectId = get().supabaseProjectId ?? get().projectId;
        files.forEach(async (file, i) => {
          try {
            const [dataUrl, supabaseUrl] = await Promise.all([
              fileToDataUrl(file),
              uploadPhoto(file, projectId),
            ]);
            set((state) => ({
              scenes: state.scenes.map((s) =>
                s.id === ids[i]
                  ? { ...s, photoDataUrl: dataUrl, photoUrl: supabaseUrl }
                  : s,
              ),
              isDirty: true,
            }));
          } catch (err) {
            console.error("[upload] photo failed:", err);
            fileToDataUrl(file).then((dataUrl) => {
              set((state) => ({
                scenes: state.scenes.map((s) =>
                  s.id === ids[i] ? { ...s, photoDataUrl: dataUrl } : s,
                ),
              }));
            });
          }
        });
      },

      insertPhotoAt: (index, file) => {
        const id = uuid();
        const newScene: Scene = {
          id,
          photoUrl: URL.createObjectURL(file),
          presetId: "push_in_serene",
          duration: 5,
          status: "idle",
          videoVersions: [],
          activeVersion: 0,
          costCredits: 5,
        };
        set((state) => {
          const scenes = [...state.scenes];
          scenes.splice(index, 0, newScene);

          const newPairs = new Set<string>();
          for (let i = 0; i < scenes.length - 1; i++) {
            newPairs.add(`t-${scenes[i]!.id}-${scenes[i + 1]!.id}`);
          }
          const orphaned = state.transitions.filter(
            (t) => t.status === "ready" && t.videoUrl && !newPairs.has(t.id),
          );
          const promoted = orphaned.map(promoteReadyTransition);
          for (const p of promoted) {
            scenes.splice(Math.max(0, index), 0, p);
          }

          return {
            scenes,
            transitions: rebuildTransitions(scenes, state.transitions),
            selectedSceneId: id,
            isDirty: true,
            _photoFiles: { ...state._photoFiles, [id]: file },
          };
        });

        const projectId = get().supabaseProjectId ?? get().projectId;
        Promise.all([fileToDataUrl(file), uploadPhoto(file, projectId)])
          .then(([dataUrl, supabaseUrl]) => {
            set((state) => ({
              scenes: state.scenes.map((s) =>
                s.id === id
                  ? { ...s, photoDataUrl: dataUrl, photoUrl: supabaseUrl }
                  : s,
              ),
              isDirty: true,
            }));
          })
          .catch(() => {
            fileToDataUrl(file).then((dataUrl) => {
              set((state) => ({
                scenes: state.scenes.map((s) =>
                  s.id === id ? { ...s, photoDataUrl: dataUrl } : s,
                ),
              }));
            });
          });
      },

      addVideoUploads: (files) => {
        const projectId = get().supabaseProjectId ?? get().projectId;
        for (const file of files) {
          const id = uuid();
          const placeholder: Scene = {
            id,
            photoUrl: PLACEHOLDER_IMG,
            photoDataUrl: PLACEHOLDER_IMG,
            presetId: "push_in_serene",
            duration: 5,
            status: "processing",
            videoVersions: [],
            activeVersion: 0,
            costCredits: 0,
            sourceType: "video-upload",
          };
          set((state) => {
            const scenes = [...state.scenes, placeholder];
            return {
              scenes,
              transitions: rebuildTransitions(scenes, state.transitions),
              selectedSceneId: id,
              isDirty: true,
            };
          });

          (async () => {
            try {
              const thumb = await extractVideoThumbnail(file);
              set((state) => ({
                scenes: state.scenes.map((s) =>
                  s.id === id ? { ...s, photoDataUrl: thumb.dataUrl, duration: thumb.duration } : s,
                ),
              }));
              const thumbFile = await dataUrlToFile(thumb.dataUrl, `${id}.jpg`);
              const [photoUrl, videoUrl] = await Promise.all([
                uploadPhoto(thumbFile, projectId),
                uploadVideoToStorage(file, projectId),
              ]);
              set((state) => ({
                scenes: state.scenes.map((s) =>
                  s.id === id
                    ? {
                        ...s,
                        photoUrl,
                        videoUrl,
                        status: "ready" as const,
                        duration: thumb.duration,
                        videoVersions: [{ url: videoUrl, duration: thumb.duration }],
                      }
                    : s,
                ),
                isDirty: true,
              }));
              void kickoffStaging(id, videoUrl, thumb.duration);
            } catch (err) {
              console.error("[addVideoUpload]", err);
              set((state) => ({
                scenes: state.scenes.map((s) =>
                  s.id === id ? { ...s, status: "failed" as const } : s,
                ),
              }));
            }
          })();
        }
      },

      insertVideoAt: (index, file) => {
        const id = uuid();
        const projectId = get().supabaseProjectId ?? get().projectId;
        const placeholder: Scene = {
          id,
          photoUrl: PLACEHOLDER_IMG,
          photoDataUrl: PLACEHOLDER_IMG,
          presetId: "push_in_serene",
          duration: 5,
          status: "processing",
          videoVersions: [],
          activeVersion: 0,
          costCredits: 0,
          sourceType: "video-upload",
        };
        set((state) => {
          const scenes = [...state.scenes];
          scenes.splice(index, 0, placeholder);
          return {
            scenes,
            transitions: rebuildTransitions(scenes, state.transitions),
            selectedSceneId: id,
            isDirty: true,
          };
        });

        (async () => {
          try {
            const thumb = await extractVideoThumbnail(file);
            set((state) => ({
              scenes: state.scenes.map((s) =>
                s.id === id ? { ...s, photoDataUrl: thumb.dataUrl, duration: thumb.duration } : s,
              ),
            }));
            const thumbFile = await dataUrlToFile(thumb.dataUrl, `${id}.jpg`);
            const [photoUrl, videoUrl] = await Promise.all([
              uploadPhoto(thumbFile, projectId),
              uploadVideoToStorage(file, projectId),
            ]);
            set((state) => ({
              scenes: state.scenes.map((s) =>
                s.id === id
                  ? {
                      ...s,
                      photoUrl,
                      videoUrl,
                      status: "ready" as const,
                      duration: thumb.duration,
                      videoVersions: [{ url: videoUrl, duration: thumb.duration }],
                    }
                  : s,
              ),
              isDirty: true,
            }));
            void kickoffStaging(id, videoUrl, thumb.duration);
          } catch (err) {
            console.error("[insertVideoAt]", err);
            set((state) => ({
              scenes: state.scenes.map((s) =>
                s.id === id ? { ...s, status: "failed" as const } : s,
              ),
            }));
          }
        })();
      },

      insertPlaceholder: (index) => {
        const id = uuid();
        const newScene: Scene = {
          id,
          photoUrl: PLACEHOLDER_IMG,
          photoDataUrl: PLACEHOLDER_IMG,
          presetId: "push_in_serene",
          duration: 5,
          status: "processing",
          videoVersions: [],
          activeVersion: 0,
          costCredits: 0,
        };
        set((state) => {
          const scenes = [...state.scenes];
          scenes.splice(index, 0, newScene);
          return {
            scenes,
            transitions: rebuildTransitions(scenes, state.transitions),
            isDirty: true,
          };
        });
        return id;
      },

      updatePlaceholderImage: async (sceneId, file) => {
        const dataUrl = await fileToDataUrl(file);
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId
              ? { ...s, photoUrl: dataUrl, photoDataUrl: dataUrl, status: "idle" as const }
              : s,
          ),
          isDirty: true,
          _photoFiles: { ...state._photoFiles, [sceneId]: file },
        }));

        const projectId = get().supabaseProjectId ?? get().projectId;
        try {
          const supabaseUrl = await uploadPhoto(file, projectId);
          set((state) => ({
            scenes: state.scenes.map((s) =>
              s.id === sceneId ? { ...s, photoUrl: supabaseUrl } : s,
            ),
            isDirty: true,
          }));
        } catch (err) {
          console.error("[updatePlaceholderImage] upload failed:", err);
        }
      },

      removeScene: (id) => {
        set((state) => {
          const sceneIndex = state.scenes.findIndex((s) => s.id === id);
          let scenes = [...state.scenes];

          const readyTransitions = state.transitions.filter(
            (t) => (t.fromSceneId === id || t.toSceneId === id) && t.status === "ready" && t.videoUrl,
          );

          const newScenes = readyTransitions.map(promoteReadyTransition);

          scenes = scenes.filter((s) => s.id !== id);

          if (newScenes.length > 0) {
            const insertAt = Math.min(sceneIndex, scenes.length);
            scenes.splice(insertAt, 0, ...newScenes);
          }

          const files = { ...state._photoFiles };
          delete files[id];

          return {
            scenes,
            transitions: rebuildTransitions(scenes, state.transitions),
            selectedSceneId:
              state.selectedSceneId === id
                ? (scenes[0]?.id ?? null)
                : state.selectedSceneId,
            isDirty: true,
            _photoFiles: files,
          };
        });
      },

      reorderScenes: (fromIndex, toIndex) => {
        set((state) => {
          const scenes = [...state.scenes];
          const [moved] = scenes.splice(fromIndex, 1);
          if (!moved) return state;
          scenes.splice(toIndex, 0, moved);

          const newPairs = new Set<string>();
          for (let i = 0; i < scenes.length - 1; i++) {
            newPairs.add(`t-${scenes[i]!.id}-${scenes[i + 1]!.id}`);
          }

          const orphaned = state.transitions.filter(
            (t) => t.status === "ready" && t.videoUrl && !newPairs.has(t.id),
          );

          const promoted = orphaned.map(promoteReadyTransition);
          for (const p of promoted) {
            const fromIdx = scenes.findIndex((s) => s.id === moved.id);
            const insertAt = Math.max(0, fromIdx);
            scenes.splice(insertAt, 0, p);
          }

          return {
            scenes,
            transitions: rebuildTransitions(scenes, state.transitions),
            isDirty: true,
          };
        });
      },

      setScenePreset: (sceneId, presetId) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, presetId } : s,
          ),
          isDirty: true,
        }));
      },

      setSceneDuration: (sceneId, duration) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, duration, costCredits: s.status === "ready" ? s.costCredits : duration } : s,
          ),
          isDirty: true,
        }));
      },

      setSceneGenerationTarget: (sceneId, seconds) => {
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            const next = seconds === null ? undefined : Math.max(1, Math.min(60, seconds));
            // For idle scenes (not yet generated), also preview the target on
            // the card by mirroring it to `duration` so the hover pill shows
            // what will be asked. Generated scenes keep `duration` == effective
            // clip length; the target is a future-only intent.
            const isUngenerated = !(s.status === "ready" && s.videoUrl);
            return {
              ...s,
              generationTargetSeconds: next,
              duration: isUngenerated && typeof next === "number" ? next : s.duration,
              costCredits:
                isUngenerated && typeof next === "number"
                  ? next
                  : s.costCredits,
            };
          }),
          isDirty: true,
        }));
      },

      setSceneTrim: (sceneId, trim) => {
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;

            const prevStart = s.trimStart;
            const prevEnd = s.trimEnd;

            const nextStart =
              trim.trimStart === null
                ? undefined
                : trim.trimStart === undefined
                  ? prevStart
                  : Math.max(0, trim.trimStart);
            const nextEnd =
              trim.trimEnd === null
                ? undefined
                : trim.trimEnd === undefined
                  ? prevEnd
                  : Math.max(0, trim.trimEnd);

            // For video-backed scenes, update effective duration from the
            // trim window so the timeline + inspector stay in sync without
            // extra bookkeeping downstream.
            const isVideo = s.status === "ready" && !!s.videoUrl;
            let nextDuration = s.duration;
            if (isVideo) {
              const activeVer = s.videoVersions?.[s.activeVersion];
              const native =
                activeVer?.duration && activeVer.duration > 0
                  ? activeVer.duration
                  : s.duration;
              const start = nextStart ?? 0;
              const end = nextEnd ?? native;
              nextDuration = Math.max(0.1, end - start);
            }

            return {
              ...s,
              trimStart: nextStart,
              trimEnd: nextEnd,
              duration: nextDuration,
            };
          }),
          isDirty: true,
        }));
      },

      setSceneCrop: (sceneId, crop) => {
        // `null` removes the crop entirely (image renders at full extent
        // again). Setting a crop bumps `isDirty` so the project save
        // pipeline picks it up; the actual rasterization happens later in
        // ensureSceneHttpsPhotoUrl when the user clicks Generate.
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            const next: Scene = { ...s };
            if (crop === null) {
              delete next.crop;
            } else {
              next.crop = crop;
            }
            return next;
          }),
          isDirty: true,
        }));
      },

      setActiveVersion: (sceneId, version) => {
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            const versions = s.videoVersions ?? [];
            const clamped = Math.max(0, Math.min(version, versions.length - 1));
            const ver = versions[clamped];
            return {
              ...s,
              activeVersion: clamped,
              videoUrl: ver?.url ?? s.videoUrl,
              duration: ver?.duration ?? s.duration,
            };
          }),
          isDirty: true,
        }));
      },

      updateSceneImage: (sceneId, newImageUrl) => {
        set((state) => {
          const files = { ...state._photoFiles };
          delete files[sceneId];
          return {
            scenes: state.scenes.map((s) => {
              if (s.id !== sceneId) return s;
              // Drop any saved crop: it referenced the *previous* image's
              // pixel layout, and the IA-generated replacement may have an
              // entirely different composition. Forcing a re-crop here is
              // less surprising than silently applying a misaligned region.
              const next: Scene = {
                ...s,
                photoUrl: newImageUrl,
                photoDataUrl: newImageUrl,
                status: "idle" as const,
                videoUrl: undefined,
                videoVersions: [],
                activeVersion: 0,
              };
              delete next.crop;
              return next;
            }),
            isDirty: true,
            _photoFiles: files,
          };
        });
      },

      toggleTransition: (transitionId) => {
        set((state) => ({
          transitions: state.transitions.map((t) =>
            t.id === transitionId ? { ...t, enabled: !t.enabled } : t,
          ),
          isDirty: true,
        }));
      },

      generateTransition: async (fromSceneId, toSceneId, duration = 5) => {
        const state = get();
        const fromScene = state.scenes.find((s) => s.id === fromSceneId);
        const toScene = state.scenes.find((s) => s.id === toSceneId);
        if (!fromScene || !toScene) return;

        const transitionId = `t-${fromSceneId}-${toSceneId}`;
        const pid = state.supabaseProjectId ?? state.projectId;

        const batchId = useBatchesStore.getState().createPreview(
          [
            {
              targetId: transitionId,
              label: `Transição · ${duration}s`,
              estimatedCost: duration,
              type: "video.transition" as const,
              payload: {
                transitionId,
                fromSceneId,
                toSceneId,
                projectId: pid,
                duration,
                modelId: state.modelId,
              },
            },
          ],
          {
            title: "1 transição",
            projectId: pid,
          },
        );
        useBatchesStore.getState().dispatch(batchId);
      },

      setHasEditNode: (has) => set({ hasEditNode: has, editNodeSelected: has, isDirty: true }),

      removeTransition: (transitionId) => {
        set((state) => ({
          transitions: state.transitions.map((t) =>
            t.id === transitionId ? { ...t, status: "idle" as const, videoUrl: undefined } : t,
          ),
          isDirty: true,
        }));
      },

      selectEditNode: () => set({ editNodeSelected: true, selectedSceneId: null }),

      setMusicPrompt: (prompt) => set({ musicPrompt: prompt, isDirty: true }),

      generateMusic: async () => {
        const state = get();
        const pid = state.supabaseProjectId;

        // Dedupe: if any music job is already queued/running, ignore the
        // click. Covered by both per-batch status and the global `music`
        // selector in batches-store so double-binds (toolbar + inspector)
        // don't stack requests.
        const hasActive = useJobsStore
          .getState()
          .jobs.some(
            (j) =>
              j.type === "music" &&
              (j.status === "queued" || j.status === "running"),
          );
        if (hasActive) return;

        const batchId = useBatchesStore.getState().createPreview(
          [
            {
              targetId: "music",
              label: `Música · ${state.musicPrompt.slice(0, 40) || "(sem prompt)"}`,
              estimatedCost: 10,
              type: "music" as const,
              payload: {
                prompt: state.musicPrompt,
                projectId: pid,
                instrumental: true,
              },
            },
          ],
          {
            title: "Música",
            projectId: pid,
          },
        );
        useBatchesStore.getState().dispatch(batchId);
      },

      uploadMusicFile: async (file: File) => {
        // Instant local preview via ObjectURL so playback/UX doesn't wait on
        // the roundtrip. Swap to the stable Supabase URL once the upload
        // finishes; if it fails, the blob URL keeps the session working.
        const localUrl = URL.createObjectURL(file);
        set({ musicUrl: localUrl, isDirty: true });

        const stableUrl = await persistMusicFileToStorage(
          file,
          get().supabaseProjectId,
        );
        if (stableUrl) {
          set({ musicUrl: stableUrl, isDirty: true });
          try { URL.revokeObjectURL(localUrl); } catch { /* ignore */ }
        }
      },

      clearMusic: () => set({ musicUrl: null, isDirty: true }),

      setExportAspectRatio: (ratio) => set({ exportAspectRatio: ratio, isDirty: true }),

      setAudioMixSetting: (key, val) => set((state) => ({
        audioMix: { ...state.audioMix, [key]: typeof val === "number" ? Math.max(0, val) : val },
        isDirty: true,
      })),

      setSceneAudioVolume: (sceneId, vol) => set((state) => ({
        scenes: state.scenes.map((s) =>
          s.id === sceneId ? { ...s, audioVolume: Math.max(0, Math.min(2, vol)) } : s,
        ),
        isDirty: true,
      })),

      reconcileVideoVersionDuration: (sceneId, versionIndex, realDuration) => {
        // Guard: browsers hand back 0 / NaN / Infinity before metadata settles
        // for streamed content.
        if (!Number.isFinite(realDuration) || realDuration <= 0) return;
        // Tolerances differ by direction:
        //  - GROW_TOLERANCE (50ms): codec rounding can produce sub-frame diffs
        //    that aren't worth a store thrash.
        //  - SHRINK_TOLERANCE (500ms): defends against partial-load duration
        //    reports on streaming sources. Fal/upload MP4s aren't streamed,
        //    but the wider window is cheap insurance against future sources.
        const GROW_TOLERANCE = 0.05;
        const SHRINK_TOLERANCE = 0.5;
        set((state) => {
          let changed = false;
          const scenes = state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            const versions = s.videoVersions ?? [];
            const ver = versions[versionIndex];
            if (!ver) return s;
            const stored = ver.duration ?? 0;
            const diff = realDuration - stored;
            const grow = diff > GROW_TOLERANCE;
            const shrink = diff < -SHRINK_TOLERANCE;
            if (!grow && !shrink) return s;
            const nextVersions = versions.map((v, i) =>
              i === versionIndex ? { ...v, duration: realDuration } : v,
            );
            // On shrink, clamp trimEnd into the real file range and recompute
            // scene.duration so segments.ts builds the correct slot. Only
            // touches fields that would otherwise reference frames that
            // physically don't exist — the user can't "lose" content that
            // was never reproducible. Skip when this isn't the active
            // version: trim is a per-scene field, not per-version, so other
            // versions' shrink shouldn't perturb the active trim.
            if (shrink && versionIndex === s.activeVersion) {
              const trimStart = s.trimStart ?? 0;
              const clampedEnd =
                typeof s.trimEnd === "number" && s.trimEnd > realDuration
                  ? realDuration
                  : s.trimEnd;
              const window =
                (clampedEnd ?? realDuration) - trimStart;
              const nextDuration = Math.max(0.01, window);
              changed = true;
              return {
                ...s,
                videoVersions: nextVersions,
                trimEnd: clampedEnd,
                duration: nextDuration,
              };
            }
            changed = true;
            return { ...s, videoVersions: nextVersions };
          });
          // Don't flip isDirty for reconciliation-only updates — the user
          // didn't *do* anything; we're just healing stale metadata. Saving
          // will happen next time they make a real edit.
          return changed ? { scenes } : state;
        });
      },

      updateSceneStatus: (sceneId, status, videoUrl, costCredits, videoDuration) => {
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            const update: Partial<Scene> = { status };
            if (videoUrl) {
              const d = videoDuration ?? s.duration;
              const versions = [...(s.videoVersions ?? []), { url: videoUrl, duration: d }];
              update.videoUrl = videoUrl;
              update.videoVersions = versions;
              update.activeVersion = versions.length - 1;
              update.duration = d;
            }
            if (typeof costCredits === "number") {
              update.costCredits = costCredits;
            }
            return { ...s, ...update };
          }),
          isDirty: true,
        }));
      },

      initProject: async (urlProjectId) => {
        if (get().isLoading) return;

        set({
          isLoading: true,
          scenes: [],
          transitions: [],
          projectName: "",
          selectedSceneId: null,
          editNodeSelected: false,
          isDirty: false,
          _photoFiles: {},
        });

        try {
          const res = await fetch(`/api/projects/${urlProjectId}`);
          if (res.ok) {
            await get().loadFromSupabase(urlProjectId);
            return;
          }
        } catch { /* not found, create new */ }

        try {
          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Novo Projeto" }),
          });
          if (res.ok) {
            const project = await res.json();
            set({
              supabaseProjectId: project.id,
              projectId: urlProjectId,
              projectName: project.name,
              scenes: [],
              transitions: [],
              isLoading: false,
              isDirty: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (err) {
          console.error("[initProject]", err);
          set({ isLoading: false });
        }
      },

      loadFromSupabase: async (supabaseId) => {
        try {
          const res = await fetch(`/api/projects/${supabaseId}`);
          if (!res.ok) { set({ isLoading: false }); return; }
          const data = await res.json();

          const scenes: Scene[] = (data.scenes ?? []).map((s: { id: string; photo_url: string; prompt_generated: string; duration: number; status: string; video_url: string; cost_credits: number; video_versions?: VideoVersion[]; active_version?: number; source_type?: string; audio_volume?: number; trim_start?: number | null; trim_end?: number | null; generation_target_seconds?: number | null; crop?: unknown }) => {
            const dur = Number(s.duration) || 5;
            const dbVersions: VideoVersion[] = Array.isArray(s.video_versions) && s.video_versions.length > 0
              ? s.video_versions
              : s.video_url ? [{ url: s.video_url, duration: dur }] : [];
            const activeVer = Number(s.active_version) || 0;
            const clampedVer = Math.min(activeVer, Math.max(0, dbVersions.length - 1));
            const trimStart = typeof s.trim_start === "number" ? s.trim_start : undefined;
            const trimEnd = typeof s.trim_end === "number" ? s.trim_end : undefined;
            const generationTargetSeconds =
              typeof s.generation_target_seconds === "number"
                ? s.generation_target_seconds
                : undefined;
            // Validate the crop blob defensively — JSONB columns can hold
            // anything if a future migration writes other shapes, and trying
            // to render an invalid crop would break the inspector.
            const crop = parseCropFromDb(s.crop);
            return {
              id: s.id,
              photoUrl: s.photo_url,
              photoDataUrl: s.photo_url,
              presetId: s.prompt_generated ?? "push_in_serene",
              duration: dur,
              status: s.status === "pending" ? "idle" : s.status,
              videoUrl: dbVersions[clampedVer]?.url ?? s.video_url ?? undefined,
              videoVersions: dbVersions,
              activeVersion: clampedVer,
              costCredits: s.cost_credits,
              sourceType: s.source_type === "video-upload" ? "video-upload" : undefined,
              audioVolume: typeof s.audio_volume === "number" ? s.audio_volume : undefined,
              trimStart,
              trimEnd,
              generationTargetSeconds,
              crop,
            };
          });

          const dbTransitions: Transition[] = (data.transitions ?? []).map(
            (t: {
              from_scene_id: string;
              to_scene_id: string;
              video_url: string;
              status: string;
              cost_credits: number;
              duration_seconds?: number | string | null;
              sprite_json?: SceneSprite | null;
              staging_status?: SceneStagingStatus | null;
            }) => {
              const duration =
                typeof t.duration_seconds === "number"
                  ? t.duration_seconds
                  : typeof t.duration_seconds === "string"
                    ? Number(t.duration_seconds) || undefined
                    : undefined;
              const sprite =
                t.sprite_json && typeof t.sprite_json === "object" && "url" in t.sprite_json
                  ? (t.sprite_json as SceneSprite)
                  : undefined;
              return {
                id: `t-${t.from_scene_id}-${t.to_scene_id}`,
                fromSceneId: t.from_scene_id,
                toSceneId: t.to_scene_id,
                presetId: "soft_dissolve_drift",
                enabled: true,
                status: t.status === "pending" ? "idle" : t.status,
                videoUrl: t.video_url ?? undefined,
                costCredits: t.cost_credits,
                duration,
                sprite,
                stagingStatus: t.staging_status ?? undefined,
              };
            },
          );

          const meta = data.project.metadata ?? {};

          const restoredMix: AudioMixSettings = meta.audioMix
            ? { ...DEFAULT_AUDIO_MIX, ...meta.audioMix }
            : {
                ...DEFAULT_AUDIO_MIX,
                musicVolume: typeof meta.musicVolume === "number" ? meta.musicVolume : DEFAULT_AUDIO_MIX.musicVolume,
              };

          const sceneStaging: Record<string, SceneSprite> = meta.sceneStaging ?? {};
          scenes.forEach((s) => {
            const sprite = sceneStaging[s.id];
            if (sprite && typeof sprite.url === "string") {
              s.sprite = sprite;
              s.stagingStatus = "ready";
            }
          });

          set({
            supabaseProjectId: supabaseId,
            projectId: supabaseId,
            projectName: data.project.name,
            modelId: DEFAULT_MODEL_ID,
            scenes,
            transitions: rebuildTransitions(scenes, dbTransitions),
            hasEditNode: !!meta.hasEditNode,
            editNodeSelected: false,
            musicPrompt: meta.musicPrompt ?? "",
            musicUrl: meta.musicUrl ?? "",
            exportAspectRatio: meta.exportAspectRatio === "9:16" ? "9:16" : "16:9",
            audioMix: restoredMix,
            selectedSceneId: null,
            isLoading: false,
            isDirty: false,
          });

          // Backfill sprite staging for scenes that already have a persisted
          // videoUrl but no sprite yet (older projects, or new scenes loaded
          // before their staging completed). Runs sequentially with a small
          // delay so we don't saturate the network on project open.
          if (typeof window !== "undefined") {
            const toStage = scenes.filter(
              (s) =>
                s.status === "ready" &&
                s.videoUrl &&
                s.videoUrl.startsWith("http") &&
                !s.sprite,
            );
            const transitionsToStage = get().transitions.filter(
              (t) =>
                t.status === "ready" &&
                t.videoUrl &&
                t.videoUrl.startsWith("http") &&
                !t.sprite,
            );
            if (toStage.length > 0 || transitionsToStage.length > 0) {
              setTimeout(() => {
                void (async () => {
                  for (const s of toStage) {
                    if (!s.videoUrl) continue;
                    try {
                      await kickoffStaging(s.id, s.videoUrl, s.duration);
                    } catch {
                      /* continue to next scene */
                    }
                  }
                  for (const t of transitionsToStage) {
                    if (!t.videoUrl) continue;
                    const dur = t.duration ?? t.costCredits ?? 5;
                    try {
                      await kickoffStagingForTransition(t.id, t.videoUrl, dur);
                    } catch {
                      /* continue to next transition */
                    }
                  }
                })();
              }, 1500);
            }
          }
        } catch (err) {
          console.error("[loadFromSupabase]", err);
          set({ isLoading: false });
        }
      },

      exportProjectJson: () => {
        const state = get();
        const { data, skippedSceneIds } = buildPortableProject({
          projectName: state.projectName,
          modelId: state.modelId,
          scenes: state.scenes,
          transitions: state.transitions,
          hasEditNode: state.hasEditNode,
          musicPrompt: state.musicPrompt,
          musicUrl: state.musicUrl,
        });
        return {
          json: JSON.stringify(data, null, 2),
          skippedSceneIds,
        };
      },

      importPortableProject: (json) => {
        const parsed = parsePortableProjectJson(json);
        if (!parsed.ok) return parsed;

        const data = parsed.data;
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const scenes = data.scenes.map((ps) => {
          const s = portableToScene(ps);
          if (!uuidRe.test(s.id)) s.id = crypto.randomUUID();
          return s;
        });

        set({
          projectName: data.projectName,
          modelId: data.modelId,
          scenes,
          transitions: rebuildTransitions(scenes),
          hasEditNode: data.hasEditNode,
          editNodeSelected: false,
          musicPrompt: data.musicPrompt,
          musicUrl: data.musicUrl,
          selectedSceneId: null,
          isDirty: true,
          _photoFiles: {},
        });

        queueMicrotask(() => {
          get().saveToSupabase();
        });

        return { ok: true, skippedSceneIds: [] };
      },

      saveToSupabase: async () => {
        const state = get();
        if (!state.supabaseProjectId || state.isSaving) return;
        set({ isSaving: true });

        try {
          const scenesPayload = state.scenes
            .filter((s) => s.status !== "processing")
            .map((s) => {
              const photoUrl = s.photoUrl.startsWith("http") ? s.photoUrl : undefined;
              if (!photoUrl) return null;
              return {
                id: s.id,
                photo_url: photoUrl,
                preset_key: s.presetId,
                duration: s.duration,
                status: s.status,
                video_url: s.videoUrl,
                cost_credits: s.costCredits,
                video_versions: s.videoVersions ?? [],
                active_version: s.activeVersion ?? 0,
                source_type: s.sourceType ?? "image",
                audio_volume: s.audioVolume ?? 1,
                trim_start: typeof s.trimStart === "number" ? s.trimStart : null,
                trim_end: typeof s.trimEnd === "number" ? s.trimEnd : null,
                generation_target_seconds:
                  typeof s.generationTargetSeconds === "number"
                    ? s.generationTargetSeconds
                    : null,
                crop: s.crop ?? null,
              };
            })
            .filter(Boolean);

          const readyTransitions = state.transitions.filter(
            (t) => t.status === "ready" || t.status === "generating" || t.status === "failed",
          );
          const transitionsPayload = readyTransitions.map((t) => ({
            from_scene_id: t.fromSceneId,
            to_scene_id: t.toSceneId,
            video_url: t.videoUrl,
            status: t.status,
            cost_credits: t.costCredits,
            duration_seconds: typeof t.duration === "number" ? t.duration : null,
            sprite_json: t.sprite ?? null,
            staging_status: t.stagingStatus ?? null,
          }));

          const sceneStaging: Record<string, SceneSprite> = {};
          state.scenes.forEach((s) => {
            if (s.sprite) sceneStaging[s.id] = s.sprite;
          });

          const payload: Record<string, unknown> = {
            name: state.projectName,
            metadata: {
              hasEditNode: state.hasEditNode,
              musicPrompt: state.musicPrompt || undefined,
              musicUrl: state.musicUrl || undefined,
              exportAspectRatio: state.exportAspectRatio !== "16:9" ? state.exportAspectRatio : undefined,
              audioMix: state.audioMix,
              sceneStaging: Object.keys(sceneStaging).length > 0 ? sceneStaging : undefined,
            },
          };

          if (transitionsPayload.length > 0) {
            payload.transitions = transitionsPayload;
          } else {
            payload.transitions = [];
          }

          if (scenesPayload.length > 0) {
            payload.scenes = scenesPayload;
          } else if (state.scenes.length > 0) {
            console.warn("[saveToSupabase] Skipping scenes — no uploadable URLs yet");
          }

          const res = await fetch(`/api/projects/${state.supabaseProjectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            console.error("[saveToSupabase] HTTP", res.status, await res.text().catch(() => ""));
          } else {
            set({ isDirty: false });
          }
        } catch (err) {
          console.error("[saveToSupabase]", err);
        } finally {
          set({ isSaving: false });
        }
      },

      generateAll: async () => {
        const state = get();
        if (state.scenes.length === 0) return;

        const pid = state.supabaseProjectId ?? state.projectId;
        const pending = state.scenes.filter((s) => s.status !== "ready");
        if (pending.length === 0) return;

        const items = pending.map((scene, idx) => {
          const targetDuration = scene.generationTargetSeconds ?? scene.duration;
          return {
            targetId: scene.id,
            label: `Cena ${idx + 1} · ${scene.presetId.replace(/_/g, " ")} · ${targetDuration}s`,
            estimatedCost: targetDuration,
            type: "video.scene" as const,
            payload: {
              sceneId: scene.id,
              projectId: pid,
              presetId: scene.presetId,
              duration: targetDuration,
              modelId: state.modelId,
            },
          };
        });

        const batchId = useBatchesStore.getState().createPreview(items, {
          title: `${items.length} cena${items.length === 1 ? "" : "s"}`,
          projectId: pid,
        });
        useBatchesStore.getState().dispatch(batchId);
      },

      generateScene: async (sceneId) => {
        const state = get();
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (!scene) return;

        const pid = state.supabaseProjectId ?? state.projectId;
        const targetDuration = scene.generationTargetSeconds ?? scene.duration;

        const sceneIdx = state.scenes.findIndex((s) => s.id === sceneId);
        const batchId = useBatchesStore.getState().createPreview(
          [
            {
              targetId: sceneId,
              label: `Cena ${sceneIdx + 1} · ${scene.presetId.replace(/_/g, " ")} · ${targetDuration}s`,
              estimatedCost: targetDuration,
              type: "video.scene" as const,
              payload: {
                sceneId,
                projectId: pid,
                presetId: scene.presetId,
                duration: targetDuration,
                modelId: state.modelId,
              },
            },
          ],
          {
            title: "1 cena",
            projectId: pid,
          },
        );
        useBatchesStore.getState().dispatch(batchId);
      },

      totalCost: () => {
        const state = get();
        const sceneCost = state.scenes.reduce(
          (sum, s) => sum + s.costCredits,
          0,
        );
        const transitionCost = state.transitions
          .filter((t) => t.enabled)
          .reduce((sum, t) => sum + t.costCredits, 0);
        return sceneCost + transitionCost;
      },

      reset: () =>
        set({
          scenes: [],
          transitions: [],
          selectedSceneId: null,
          isDirty: false,
          _photoFiles: {},
        }),
    }),
    {
      name: "animov-project",
      storage: {
        getItem: (name): StorageValue<ProjectStore> | null => {
          try {
            const val = localStorage.getItem(name);
            return val ? JSON.parse(val) : null;
          } catch {
            localStorage.removeItem(name);
            return null;
          }
        },
        setItem: (name: string, value: StorageValue<ProjectStore>) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch {
            // Quota exceeded — silently skip, Supabase is the source of truth
          }
        },
        removeItem: (name: string) => {
          localStorage.removeItem(name);
        },
      },
      partialize: (state) => ({
        projectId: state.projectId,
        supabaseProjectId: state.supabaseProjectId,
      }) as unknown as ProjectStore,
    },
  ),
);
