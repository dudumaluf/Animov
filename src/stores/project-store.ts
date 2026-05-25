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
import {
  type AudioMixSettings,
  DEFAULT_AUDIO_MIX,
  RATIO_DIMS,
} from "@/lib/composition/compose";
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

/**
 * Aspect ratio of the final exported video / project canvas. Drives
 * `composeVideos` output dimensions and the FrameOverlay shown in the
 * consolidated previews (Foco / headline / inspector). Now also drives the
 * frame inside which each scene's image is placed via `imageTransform`.
 */
export type ExportAspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

const VALID_EXPORT_ASPECTS = new Set<ExportAspectRatio>([
  "16:9",
  "9:16",
  "1:1",
  "4:5",
]);

/**
 * Background fill used when the image transform leaves area visible outside
 * the photo (letterbox). `color` accepts any CSS color string (hex, rgb, hsl,
 * named colors). `blur` uses the source image itself blown up + blurred to
 * fill the margins (cinematic look).
 */
export type ImageBackground =
  | { type: "color"; color: string }
  | { type: "blur" };

/**
 * Non-destructive transform that places a scene's source photo inside the
 * project's global canvas (whose aspect = `exportAspectRatio`). Replaces the
 * old `crop` rect with a single coherent model:
 *
 * - `scale`: 1 = "cover" (image just covers the canvas, smallest dim aligned).
 *   `>1` zooms in (effectively cropping the image). `<1` zooms out and leaves
 *   margins on the canvas (letterbox), filled by `background`.
 * - `offsetX/offsetY`: -1..1 normalized translation. 0 = centered. 1 means
 *   the image is shifted by one full canvas dimension in that direction.
 *
 * Default (transform absent) = `{ scale: 1, offsetX: 0, offsetY: 0 }` =
 * cover-centered. The original `photoUrl` is never mutated; the transform is
 * applied at generation time (canvas + uploadPhoto) and reflected in the UI
 * via the `<TransformedImage>` component.
 */
export type ImageTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  background?: ImageBackground;
};

/** Cover-centered: the safe default when no user adjustment exists. */
export const DEFAULT_TRANSFORM: ImageTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

/**
 * Conflict descriptor surfaced when `saveToSupabase` hits a 409 because the
 * server's `updated_at` no longer matches the cached `lastKnownUpdatedAt`.
 * UI consumes this to render the conflict-resolution modal. `null` once
 * cleared or successfully resolved.
 */
export type ProjectConflict = {
  /** updated_at currently in the DB — the value the user is conflicting with. */
  currentUpdatedAt: string | null;
  /** updated_at the client thought was current when it tried to save. */
  attemptedUpdatedAt: string | null;
  /** When the conflict was detected (used for "stale conflict" expiry checks). */
  detectedAt: number;
};

/** Shape of a snapshot row as returned by the snapshots listing endpoint. */
export type ProjectSnapshotEntry = {
  id: string;
  reason: "auto" | "manual" | "pre-restore" | "pre-overwrite";
  createdAt: string;
  projectName: string | null;
  sceneCount: number;
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
   * Optional non-destructive transform that places the source photo inside
   * the project's global canvas (whose aspect = `exportAspectRatio`). Applied
   * at generation time (rasterized + uploaded as derivative) and reflected in
   * previews via the `<TransformedImage>` component. Reset automatically when
   * the photo is replaced via IA-edit.
   */
  imageTransform?: ImageTransform;
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
  exportAspectRatio: ExportAspectRatio;
  audioMix: AudioMixSettings;
  isLoading: boolean;
  isDirty: boolean;
  isSaving: boolean;

  /**
   * Latest `updated_at` we've observed for this project — set on load and
   * after every successful save. The PATCH handler uses it as the optimistic
   * concurrency check: if the row moved on while we held a stale value, the
   * server rejects with 409 and we surface a `ProjectConflict`.
   */
  lastKnownUpdatedAt: string | null;

  /**
   * Populated when a save fails with 409. UI shows the resolution modal;
   * `clearConflict()` dismisses without resolving, `loadFromSupabase()` or
   * `saveToSupabase({ force: true })` both clear it on success.
   */
  conflict: ProjectConflict | null;

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
  setSceneTransform: (sceneId: string, transform: ImageTransform | null) => void;
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
  setExportAspectRatio: (ratio: ExportAspectRatio) => void;
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

  /**
   * Persist current state to Supabase.
   *
   * @param opts.force - skip the optimistic concurrency check (used by the
   *   "Sobrescrever" action in the conflict modal). Server captures a
   *   `pre-overwrite` snapshot before clobbering, so the user can still recover.
   * @param opts.system - background system update (executor finishing a job).
   *   Implies `force: true` semantics (bypasses concurrency) AND suppresses
   *   snapshot creation so the history doesn't fill with auto-generated noise.
   */
  saveToSupabase: (opts?: { force?: boolean; system?: boolean }) => Promise<void>;
  loadFromSupabase: (supabaseId: string) => Promise<void>;

  /** Dismiss a 409 conflict descriptor without resolving it. */
  clearConflict: () => void;

  /** Replace current state with the contents of a previously saved snapshot. */
  restoreSnapshot: (snapshotId: string) => Promise<void>;

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

/**
 * Defensive parse for the `image_transform` JSONB column. Returns undefined
 * for any malformed payload — keeps consumers free of defensive checks at
 * every render. Old `crop` payloads (rect-based) are not handled here:
 * they're silently ignored at load time and scenes default to cover.
 */
function parseTransformFromDb(raw: unknown): ImageTransform | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Partial<Record<keyof ImageTransform, unknown>>;
  if (
    typeof t.scale !== "number" ||
    typeof t.offsetX !== "number" ||
    typeof t.offsetY !== "number"
  ) {
    return undefined;
  }
  if (!Number.isFinite(t.scale) || t.scale <= 0) return undefined;
  if (!Number.isFinite(t.offsetX) || !Number.isFinite(t.offsetY)) return undefined;
  // Background is best-effort: kept if structurally valid, otherwise dropped.
  let background: ImageBackground | undefined;
  if (t.background && typeof t.background === "object") {
    const b = t.background as Partial<Record<string, unknown>>;
    if (b.type === "color" && typeof b.color === "string") {
      background = { type: "color", color: b.color };
    } else if (b.type === "blur") {
      background = { type: "blur" };
    }
  }
  return {
    scale: Math.max(0.05, Math.min(20, t.scale)),
    offsetX: Math.max(-5, Math.min(5, t.offsetX)),
    offsetY: Math.max(-5, Math.min(5, t.offsetY)),
    ...(background ? { background } : {}),
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
      // System save: bypass optimistic concurrency (we may be racing with
      // the user's own concurrent save) and skip snapshot creation so the
      // history doesn't fill with sprite-staging noise.
      void useProjectStore.getState().saveToSupabase({ system: true });
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
      // System save (same rationale as kickoffStaging above).
      void useProjectStore.getState().saveToSupabase({ system: true });
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

// In-memory cache for transformed derivatives. Key bundles the source URL,
// the project aspect, and the transform JSON so the cache invalidates the
// moment any of those change. Avoids re-rendering+re-uploading on retries
// within the same session (most common: failed Fal generation that the user
// clicks Generate again on). The cache holds string URLs only, so memory
// pressure is negligible.
const transformedUrlCache = new Map<string, string>();

function transformCacheKey(
  baseUrl: string,
  aspectRatio: ExportAspectRatio,
  transform: ImageTransform,
): string {
  const bg =
    transform.background?.type === "color"
      ? `c:${transform.background.color}`
      : transform.background?.type === "blur"
        ? "blur"
        : "none";
  return `${baseUrl}::${aspectRatio}::${transform.scale.toFixed(4)},${transform.offsetX.toFixed(4)},${transform.offsetY.toFixed(4)}::${bg}`;
}

/**
 * Computes the destination rectangle inside the canvas for an image of
 * `(naturalW, naturalH)` placed under `transform`. With `scale=1` the image
 * exactly covers the canvas (smallest dimension aligned). `>1` zooms in (image
 * spills outside, gets cropped); `<1` zooms out (image is smaller than the
 * canvas, leaves margins). `offsetX/offsetY` are normalized translations in
 * canvas units.
 */
function computeImageRect(
  canvasW: number,
  canvasH: number,
  naturalW: number,
  naturalH: number,
  transform: ImageTransform,
): { dx: number; dy: number; dw: number; dh: number } {
  const imgAspect = naturalW / naturalH;
  const canvasAspect = canvasW / canvasH;
  // Cover-fit base: pick the dimension whose ratio drives the other.
  let baseW: number, baseH: number;
  if (imgAspect > canvasAspect) {
    // image is wider — match heights, image overflows horizontally
    baseH = canvasH;
    baseW = canvasH * imgAspect;
  } else {
    // image is taller — match widths, image overflows vertically
    baseW = canvasW;
    baseH = canvasW / imgAspect;
  }
  const dw = baseW * transform.scale;
  const dh = baseH * transform.scale;
  const dx = (canvasW - dw) / 2 + transform.offsetX * canvasW;
  const dy = (canvasH - dh) / 2 + transform.offsetY * canvasH;
  return { dx, dy, dw, dh };
}

/**
 * Loads `baseUrl` into an off-screen <img>, paints it onto a canvas sized at
 * `RATIO_DIMS[aspectRatio]` according to `transform` (scale, offset,
 * background), and uploads the resulting JPEG to Supabase Storage. Returns
 * the public URL. Throws if any step fails — the caller falls back to the
 * untransformed baseUrl in that case (better a slightly off video than no
 * generation at all).
 *
 * `crossOrigin = "anonymous"` is required because the canvas would otherwise
 * be tainted (Supabase Storage serves with appropriate CORS headers, so this
 * works in practice). For data: URLs no CORS handshake happens, so the
 * attribute is a no-op there.
 */
async function renderTransformedAndUpload(
  baseUrl: string,
  aspectRatio: ExportAspectRatio,
  transform: ImageTransform,
  projectId: string,
  sceneId: string,
): Promise<string> {
  const cacheKey = transformCacheKey(baseUrl, aspectRatio, transform);
  const cached = transformedUrlCache.get(cacheKey);
  if (cached) return cached;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("transform image load failed"));
    img.src = baseUrl;
  });

  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) {
    throw new Error("transform source has zero dimensions");
  }

  const dims = RATIO_DIMS[aspectRatio];
  const canvas = document.createElement("canvas");
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("transform canvas 2d context unavailable");

  // Background: paint the full canvas first so any letterbox margin shows
  // through. Default = black (matches the player chrome). `blur` paints the
  // image covering the canvas with a heavy filter so margins look like a
  // soft extension of the photo.
  const bg = transform.background;
  if (bg?.type === "color") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, dims.w, dims.h);
  } else if (bg?.type === "blur") {
    // Cover the canvas with the source, then blur. Canvas filters are
    // supported in all evergreen browsers we target.
    const coverRect = computeImageRect(dims.w, dims.h, naturalW, naturalH, {
      scale: 1.1, // slight overshoot so blur edges don't show seams
      offsetX: 0,
      offsetY: 0,
    });
    ctx.save();
    ctx.filter = "blur(36px)";
    ctx.drawImage(img, coverRect.dx, coverRect.dy, coverRect.dw, coverRect.dh);
    ctx.restore();
  } else {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, dims.w, dims.h);
  }

  const rect = computeImageRect(dims.w, dims.h, naturalW, naturalH, transform);
  ctx.drawImage(img, rect.dx, rect.dy, rect.dw, rect.dh);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("transform canvas toBlob returned null");

  const file = new File([blob], `${sceneId}-frame.jpg`, { type: "image/jpeg" });
  const url = await uploadPhoto(file, projectId);
  transformedUrlCache.set(cacheKey, url);
  return url;
}

/**
 * Decides whether the rasterized derivative MUST be produced. We always run
 * the pipeline when:
 *   - the scene has an explicit transform (user adjusted pan/zoom/background)
 *   - the source image's natural aspect ≠ project aspect (so the model
 *     receives a frame in the correct ratio rather than an arbitrary photo)
 *
 * If neither condition is true we can short-circuit and use the source URL
 * directly, saving an upload round-trip.
 */
async function shouldRenderForExport(
  baseUrl: string,
  scene: Scene,
  aspectRatio: ExportAspectRatio,
): Promise<boolean> {
  if (scene.imageTransform) return true;
  // Probe the natural aspect of the source. Any failure (CORS, network) =
  // err on the side of rendering, since cover-default is a safe no-op when
  // the aspects already match.
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("aspect probe failed"));
      img.src = baseUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) return true;
    const naturalAspect = img.naturalWidth / img.naturalHeight;
    const dims = RATIO_DIMS[aspectRatio];
    const projectAspect = dims.w / dims.h;
    return Math.abs(naturalAspect - projectAspect) > 0.01;
  } catch {
    return true;
  }
}

/**
 * Ensures the scene has a usable HTTPS URL (Supabase Storage) that can be sent
 * to `/api/generate-scene` as JSON, bypassing Vercel's 4.5MB request body
 * limit. If the scene only has a blob:/data: URL or a pending upload, this
 * uploads on-demand and patches the store so subsequent calls are cheap.
 *
 * When the scene has an `imageTransform` OR its source aspect differs from
 * the project's `exportAspectRatio`, the pipeline renders a derivative
 * sized to the project canvas (with letterbox/background applied) and
 * returns its URL. The original `scene.photoUrl` is left untouched so the
 * transform remains editable.
 */
export async function ensureSceneHttpsPhotoUrl(
  scene: Scene,
  photoFiles: Record<string, File>,
  projectId: string,
  aspectRatio: ExportAspectRatio,
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

  if (!baseUrl) return baseUrl;
  const transform = scene.imageTransform ?? DEFAULT_TRANSFORM;
  if (!(await shouldRenderForExport(baseUrl, scene, aspectRatio))) {
    return baseUrl;
  }
  try {
    return await renderTransformedAndUpload(
      baseUrl,
      aspectRatio,
      transform,
      projectId,
      scene.id,
    );
  } catch (err) {
    // Falling back to the untransformed URL is intentional: the user's
    // intent was to generate, not to enforce framing perfectly. A noticeable
    // ratio mismatch in the resulting video is recoverable; failing the
    // generation outright with no asset is not.
    console.error("[ensureSceneHttpsPhotoUrl] transform render failed", err);
    return baseUrl;
  }
}

export async function resolveSceneHttpsUrl(
  scene: Scene,
  photoFiles: Record<string, File>,
  projectId: string,
  aspectRatio: ExportAspectRatio,
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
  const transform = scene.imageTransform ?? DEFAULT_TRANSFORM;
  if (!(await shouldRenderForExport(baseUrl, scene, aspectRatio))) {
    return baseUrl;
  }
  try {
    return await renderTransformedAndUpload(
      baseUrl,
      aspectRatio,
      transform,
      projectId,
      scene.id,
    );
  } catch (e) {
    console.error("[resolveSceneHttpsUrl] transform render failed", e);
    return baseUrl;
  }
}

/**
 * Returns true when at least one scene is mid-upload — either we still hold
 * its `File` in `_photoFiles` (the upload promise hasn't resolved yet) or its
 * `photoUrl` is still a local `blob:` / `data:` URL (we haven't received a
 * Storage URL back).
 *
 * The debounced save in the editor consults this before firing `PATCH`,
 * because otherwise the save would filter out the in-flight scene and (prior
 * to the safety refactor) the backend would delete it. With the refactor the
 * backend no longer deletes — but the scene still wouldn't get its real URL
 * persisted, so the save would just leave stale data. Waiting is correct.
 */
export function hasPendingPhotoUploads(
  state: Pick<ProjectStore, "scenes" | "_photoFiles">,
): boolean {
  if (Object.keys(state._photoFiles).length > 0) return true;
  return state.scenes.some(
    (s) =>
      s.photoUrl &&
      (s.photoUrl.startsWith("blob:") || s.photoUrl.startsWith("data:")) &&
      s.photoUrl !== PLACEHOLDER_IMG,
  );
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
      lastKnownUpdatedAt: null,
      conflict: null,
      _photoFiles: {},

      setProjectName: (name) => {
        // Marks dirty so the debounced save in the editor page picks the
        // name change up alongside any other pending edits, all gated by
        // optimistic concurrency. Previously this path made its own inline
        // PATCH which bumped `projects.updated_at` outside the store's
        // tracking — the next debounced save would then 409 against its
        // own earlier write.
        set({ projectName: name, isDirty: true });
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

        // Explicit DELETE on the server. PATCH no longer prunes scenes
        // missing from the payload, so removal must be intentional.
        // Fire-and-forget — if the request fails the next save will
        // upsert the still-existing scene back into the local list on
        // reload, which is the safest possible outcome.
        const sid = get().supabaseProjectId;
        if (sid) {
          fetch(`/api/projects/${sid}/scenes/${id}`, { method: "DELETE" })
            .then(async (res) => {
              if (!res.ok) {
                console.error(
                  "[removeScene] DELETE failed",
                  res.status,
                  await res.text().catch(() => ""),
                );
                return;
              }
              const body = (await res.json().catch(() => null)) as
                | { updatedAt?: string | null }
                | null;
              if (body?.updatedAt) {
                set({ lastKnownUpdatedAt: body.updatedAt });
              }
            })
            .catch((err) => console.error("[removeScene]", err));
        }
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

      setSceneTransform: (sceneId, transform) => {
        // `null` clears the transform (image goes back to cover-centered
        // default). Setting a transform bumps `isDirty` so the project save
        // pipeline picks it up; the actual rasterization happens later in
        // ensureSceneHttpsPhotoUrl when the user clicks Generate.
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            const next: Scene = { ...s };
            if (transform === null) {
              delete next.imageTransform;
            } else {
              next.imageTransform = transform;
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
              // Drop any saved transform: it referenced the *previous*
              // image's pixel layout, and the IA-generated replacement may
              // have an entirely different composition. Forcing a re-frame
              // here is less surprising than silently applying a misaligned
              // pan/zoom.
              const next: Scene = {
                ...s,
                photoUrl: newImageUrl,
                photoDataUrl: newImageUrl,
                status: "idle" as const,
                videoUrl: undefined,
                videoVersions: [],
                activeVersion: 0,
              };
              delete next.imageTransform;
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

        // Server-side: explicit DELETE. The PATCH-driven save will no
        // longer prune "idle" transitions on its own (intentional — the
        // backend never deletes implicitly anymore), so the row would
        // otherwise linger with stale data.
        const sid = get().supabaseProjectId;
        if (sid) {
          fetch(`/api/projects/${sid}/transitions/${transitionId}`, {
            method: "DELETE",
          })
            .then(async (res) => {
              if (!res.ok) {
                console.error(
                  "[removeTransition] DELETE failed",
                  res.status,
                  await res.text().catch(() => ""),
                );
                return;
              }
              const body = (await res.json().catch(() => null)) as
                | { updatedAt?: string | null }
                | null;
              if (body?.updatedAt) {
                set({ lastKnownUpdatedAt: body.updatedAt });
              }
            })
            .catch((err) => console.error("[removeTransition]", err));
        }
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

          const scenes: Scene[] = (data.scenes ?? []).map((s: { id: string; photo_url: string; prompt_generated: string; duration: number; status: string; video_url: string; cost_credits: number; video_versions?: VideoVersion[]; active_version?: number; source_type?: string; audio_volume?: number; trim_start?: number | null; trim_end?: number | null; generation_target_seconds?: number | null; crop?: unknown; image_transform?: unknown }) => {
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
            // Validate the image_transform blob defensively — JSONB columns
            // can hold anything if a future migration writes other shapes,
            // and trying to render an invalid transform would break the
            // inspector. Old `crop` payloads are silently dropped: scenes
            // re-default to cover-centered (no best-effort migration).
            const imageTransform = parseTransformFromDb(s.image_transform);
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
              imageTransform,
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
            exportAspectRatio: VALID_EXPORT_ASPECTS.has(
              meta.exportAspectRatio as ExportAspectRatio,
            )
              ? (meta.exportAspectRatio as ExportAspectRatio)
              : "16:9",
            audioMix: restoredMix,
            selectedSceneId: null,
            isLoading: false,
            isDirty: false,
            // Cache the version we just observed so the next save can pass
            // it as `expected_updated_at`. Clearing `conflict` here is what
            // makes "Recarregar" in the conflict modal resolve cleanly.
            lastKnownUpdatedAt:
              typeof data.project.updated_at === "string"
                ? data.project.updated_at
                : null,
            conflict: null,
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
          // Import is a deliberate full-state replacement, so we force the
          // save (bypassing optimistic concurrency) — the user has already
          // implicitly opted in to overwriting whatever was there.
          get().saveToSupabase({ force: true });
        });

        return { ok: true, skippedSceneIds: [] };
      },

      saveToSupabase: async (opts) => {
        const state = get();
        if (!state.supabaseProjectId || state.isSaving) return;

        const force = opts?.force === true;
        const isSystem = opts?.system === true;

        // ─── Upload guard: refuse to save while photos are still uploading.
        // The previous behaviour silently filtered such scenes from the
        // payload; with the new "PATCH never deletes" backend that means
        // they'd just go stale on the server. Either way, we want to wait.
        // Caller (debounce effect in the editor page) reschedules.
        if (hasPendingPhotoUploads(state)) {
          console.warn(
            "[saveToSupabase] Pending photo uploads — deferring save",
          );
          return;
        }

        set({ isSaving: true });

        try {
          // Track scenes we intentionally skip (status === "processing")
          // versus scenes we'd be silently dropping (no usable URL).
          // The former is fine; the latter is a bug we MUST abort on.
          const eligibleScenes = state.scenes.filter(
            (s) => s.status !== "processing",
          );
          const scenesPayload: Array<Record<string, unknown>> = [];
          const silentlySkipped: string[] = [];

          for (const s of eligibleScenes) {
            const photoUrl = s.photoUrl.startsWith("http") ? s.photoUrl : undefined;
            if (!photoUrl) {
              silentlySkipped.push(s.id);
              continue;
            }
            scenesPayload.push({
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
              image_transform: s.imageTransform ?? null,
            });
          }

          // Belt-and-suspenders against the very bug class this whole
          // refactor exists to prevent. If `hasPendingPhotoUploads` ever
          // misses a case (e.g. an https URL was nulled mid-flight), abort
          // rather than send a partial payload.
          if (silentlySkipped.length > 0) {
            console.error(
              "[saveToSupabase] Refusing to save — would silently skip scenes:",
              silentlySkipped,
            );
            set({ isSaving: false });
            return;
          }

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
            transitions: transitionsPayload,
          };

          if (scenesPayload.length > 0) {
            payload.scenes = scenesPayload;
          } else if (state.scenes.length > 0) {
            console.warn("[saveToSupabase] No scenes have uploadable URLs yet");
          }

          // ─── Concurrency hints.
          // User saves carry expected_updated_at; the server rejects 409 if
          // the row moved on. System saves (executors finalising a model
          // job) and forced saves (post-conflict-modal overwrite) skip it.
          if (isSystem || force) {
            payload.force = true;
          } else if (state.lastKnownUpdatedAt) {
            payload.expected_updated_at = state.lastKnownUpdatedAt;
          }
          if (isSystem) {
            payload.system = true;
          }

          const res = await fetch(`/api/projects/${state.supabaseProjectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.status === 409) {
            const body = (await res.json().catch(() => null)) as
              | { currentUpdatedAt?: string | null }
              | null;
            // Surface the conflict to the UI; do NOT clear isDirty so the
            // user's local changes stay queued for the resolution path.
            set({
              conflict: {
                currentUpdatedAt: body?.currentUpdatedAt ?? null,
                attemptedUpdatedAt: state.lastKnownUpdatedAt,
                detectedAt: Date.now(),
              },
            });
            return;
          }

          if (!res.ok) {
            console.error(
              "[saveToSupabase] HTTP",
              res.status,
              await res.text().catch(() => ""),
            );
            return;
          }

          const body = (await res.json().catch(() => null)) as
            | { updatedAt?: string }
            | null;

          set({
            isDirty: false,
            // Advance the concurrency cache so the next save can pass it
            // through; null leaves us conservative (next save won't gate).
            lastKnownUpdatedAt: body?.updatedAt ?? null,
            // Successful save clears any stale conflict descriptor.
            conflict: null,
          });
        } catch (err) {
          console.error("[saveToSupabase]", err);
        } finally {
          set({ isSaving: false });
        }
      },

      clearConflict: () => set({ conflict: null }),

      restoreSnapshot: async (snapshotId) => {
        const state = get();
        if (!state.supabaseProjectId) return;

        try {
          const res = await fetch(
            `/api/projects/${state.supabaseProjectId}/snapshots/${snapshotId}?action=restore`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            },
          );
          if (!res.ok) {
            console.error(
              "[restoreSnapshot] HTTP",
              res.status,
              await res.text().catch(() => ""),
            );
            return;
          }
          // Reload from the now-restored state so the store reflects what
          // the server holds. The endpoint already captured a pre-restore
          // snapshot, so this is reversible from the version-history UI.
          await get().loadFromSupabase(state.supabaseProjectId);
        } catch (err) {
          console.error("[restoreSnapshot]", err);
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
          lastKnownUpdatedAt: null,
          conflict: null,
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
