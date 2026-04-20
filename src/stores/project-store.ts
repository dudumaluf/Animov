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
  isMusicGenerating: boolean;
  exportAspectRatio: "16:9" | "9:16";
  audioMix: AudioMixSettings;
  isLoading: boolean;
  isDirty: boolean;
  isGenerating: boolean;
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
  setActiveVersion: (sceneId: string, version: number) => void;
  updateSceneImage: (sceneId: string, newImageUrl: string) => void;

  toggleTransition: (transitionId: string) => void;
  generateTransition: (fromSceneId: string, toSceneId: string, duration?: number) => Promise<void>;
  removeTransition: (transitionId: string) => void;
  setHasEditNode: (has: boolean) => void;
  selectEditNode: () => void;
  setMusicPrompt: (prompt: string) => void;
  generateMusic: () => Promise<void>;
  clearMusic: () => void;
  setExportAspectRatio: (ratio: "16:9" | "9:16") => void;
  setAudioMixSetting: <K extends keyof AudioMixSettings>(key: K, val: AudioMixSettings[K]) => void;
  setSceneAudioVolume: (sceneId: string, vol: number) => void;

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

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}

async function persistVideoToStorage(
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
 * Kicks off background staging for a scene after its video is in Supabase
 * storage. Extracts a sprite-sheet of thumbnails and stores the metadata on
 * the scene. Non-blocking; progressive via stagingStatus transitions:
 * undefined -> "pending" -> "ready" | "failed".
 *
 * Defined at module scope using a function declaration (hoisted) so the store
 * methods can reference it before it runs. The useProjectStore reference
 * inside is resolved lazily at call time, so the forward reference is safe.
 */
async function kickoffStaging(
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
async function kickoffStagingForTransition(
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

/**
 * Ensures the scene has a usable HTTPS URL (Supabase Storage) that can be sent
 * to `/api/generate-scene` as JSON, bypassing Vercel's 4.5MB request body limit.
 * If the scene only has a blob:/data: URL or a pending upload, this uploads
 * on-demand and patches the store so subsequent calls are cheap.
 */
async function ensureSceneHttpsPhotoUrl(
  scene: Scene,
  photoFiles: Record<string, File>,
  projectId: string,
): Promise<string | null> {
  if (
    scene.photoUrl &&
    scene.photoUrl.startsWith("https://") &&
    scene.photoUrl !== PLACEHOLDER_IMG
  ) {
    return scene.photoUrl;
  }
  const file = await resolveSceneFile(scene, photoFiles);
  if (!file) return null;
  try {
    const url = await uploadPhoto(file, projectId);
    useProjectStore.setState((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === scene.id ? { ...s, photoUrl: url } : s,
      ),
      isDirty: true,
    }));
    return url;
  } catch (err) {
    console.error("[ensureSceneHttpsPhotoUrl]", err);
    return null;
  }
}

async function resolveSceneHttpsUrl(
  scene: Scene,
  photoFiles: Record<string, File>,
  projectId: string,
): Promise<string | null> {
  if (scene.photoUrl && scene.photoUrl.startsWith("https://")) {
    if (!photoFiles[scene.id]) return scene.photoUrl;
  }
  const file = await resolveSceneFile(scene, photoFiles);
  if (!file) return scene.photoUrl?.startsWith("https://") ? scene.photoUrl : null;
  try {
    return await uploadPhoto(file, projectId);
  } catch (e) {
    console.error("[resolveSceneHttpsUrl] upload failed", e);
    return scene.photoUrl?.startsWith("https://") ? scene.photoUrl : null;
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
      isMusicGenerating: false,
      exportAspectRatio: "16:9",
      audioMix: { ...DEFAULT_AUDIO_MIX },
      isLoading: false,
      isDirty: false,
      isGenerating: false,
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
            scenes: state.scenes.map((s) =>
              s.id === sceneId
                ? { ...s, photoUrl: newImageUrl, photoDataUrl: newImageUrl, status: "idle" as const, videoUrl: undefined, videoVersions: [], activeVersion: 0 }
                : s,
            ),
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

        const pid = state.supabaseProjectId ?? state.projectId;
        const [startUrl, endUrl] = await Promise.all([
          resolveSceneHttpsUrl(fromScene, state._photoFiles, pid),
          resolveSceneHttpsUrl(toScene, state._photoFiles, pid),
        ]);
        if (!startUrl || !endUrl) {
          console.error("[generateTransition] Could not resolve image URLs");
          return;
        }

        const transitionId = `t-${fromSceneId}-${toSceneId}`;

        set((state) => ({
          transitions: state.transitions.map((t) =>
            t.id === transitionId ? { ...t, status: "generating" as const, enabled: true } : t,
          ),
        }));

        try {
          const res = await fetch("/api/generate-transition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startImageUrl: startUrl,
              endImageUrl: endUrl,
              duration,
              modelId: state.modelId,
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? "Failed");
          }

          const data = await res.json();
          const realCost = typeof data.creditsCost === "number" ? data.creditsCost : duration;
          const realDuration = typeof data.duration === "number" && data.duration > 0 ? data.duration : duration;
          set((state) => ({
            transitions: state.transitions.map((t) =>
              t.id === transitionId
                ? { ...t, status: "ready" as const, videoUrl: data.videoUrl, costCredits: realCost, duration: realDuration }
                : t,
            ),
            isDirty: true,
          }));

          const pid = get().supabaseProjectId ?? get().projectId;
          persistVideoToStorage(data.videoUrl, pid, transitionId).then((permUrl) => {
            if (!permUrl) return;
            set((state) => ({
              transitions: state.transitions.map((t) =>
                t.id === transitionId ? { ...t, videoUrl: permUrl } : t,
              ),
              isDirty: true,
            }));
            void kickoffStagingForTransition(transitionId, permUrl, realDuration);
          });
        } catch (err) {
          console.error(`[generateTransition] ${transitionId}:`, err);
          set((state) => ({
            transitions: state.transitions.map((t) =>
              t.id === transitionId ? { ...t, status: "failed" as const } : t,
            ),
          }));
        }
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
        if (state.isMusicGenerating) return;
        set({ isMusicGenerating: true });

        try {
          const res = await fetch("/api/generate-music", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: state.musicPrompt, instrumental: true }),
          });
          if (!res.ok) throw new Error("Music generation failed");
          const data = await res.json();
          set({ musicUrl: data.audioUrl, isMusicGenerating: false, isDirty: true });
        } catch (err) {
          console.error("[generateMusic]", err);
          set({ isMusicGenerating: false });
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

          const scenes: Scene[] = (data.scenes ?? []).map((s: { id: string; photo_url: string; prompt_generated: string; duration: number; status: string; video_url: string; cost_credits: number; video_versions?: VideoVersion[]; active_version?: number; source_type?: string; audio_volume?: number; trim_start?: number | null; trim_end?: number | null; generation_target_seconds?: number | null }) => {
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
            isGenerating: false,
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
        if (state.isGenerating || state.scenes.length === 0) return;
        set({ isGenerating: true });

        for (const scene of state.scenes) {
          if (scene.status === "ready") continue;

          const pid = state.supabaseProjectId ?? state.projectId;
          const httpsUrl = await ensureSceneHttpsPhotoUrl(
            scene,
            state._photoFiles,
            pid,
          );
          if (!httpsUrl) continue;

          get().updateSceneStatus(scene.id, "generating");

          const targetDuration = scene.generationTargetSeconds ?? scene.duration;

          try {
            const res = await fetch("/api/generate-scene", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                photoUrl: httpsUrl,
                presetId: scene.presetId,
                duration: targetDuration,
                modelId: state.modelId,
              }),
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
              throw new Error(err.error ?? "Failed");
            }

            const data = await res.json();
            const realCost = typeof data.creditsCost === "number" ? data.creditsCost : targetDuration;
            const realDuration = typeof data.duration === "number" ? data.duration : targetDuration;
            get().updateSceneStatus(scene.id, "ready", data.videoUrl, realCost, realDuration);

            // Clear the generation target now that we have the real duration
            // bound to `scene.duration`. Keeps future inspector tweaks honest.
            set((st) => ({
              scenes: st.scenes.map((s) =>
                s.id === scene.id ? { ...s, generationTargetSeconds: undefined } : s,
              ),
            }));

            const falVideoUrl = data.videoUrl;
            persistVideoToStorage(falVideoUrl, pid, scene.id).then((permUrl) => {
              if (!permUrl) return;
              set((st) => ({
                scenes: st.scenes.map((s) => {
                  if (s.id !== scene.id) return s;
                  return {
                    ...s,
                    videoUrl: permUrl,
                    videoVersions: s.videoVersions.map((v) =>
                      v.url === falVideoUrl ? { ...v, url: permUrl } : v,
                    ),
                  };
                }),
                isDirty: true,
              }));
              void kickoffStaging(scene.id, permUrl, realDuration);
            });
          } catch (err) {
            console.error(`[generate] scene ${scene.id}:`, err);
            get().updateSceneStatus(scene.id, "failed");
          }
        }

        set({ isGenerating: false });
        get().saveToSupabase();
      },

      generateScene: async (sceneId) => {
        const state = get();
        const scene = state.scenes.find((s) => s.id === sceneId);
        if (!scene || state.isGenerating) return;

        set({ isGenerating: true });

        const pid = state.supabaseProjectId ?? state.projectId;
        const httpsUrl = await ensureSceneHttpsPhotoUrl(
          scene,
          state._photoFiles,
          pid,
        );
        if (!httpsUrl) {
          console.error(`[generate] No photo URL available for scene ${sceneId}`);
          set({ isGenerating: false });
          return;
        }

        get().updateSceneStatus(sceneId, "generating");

        const targetDuration = scene.generationTargetSeconds ?? scene.duration;

        try {
          const res = await fetch("/api/generate-scene", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photoUrl: httpsUrl,
              presetId: scene.presetId,
              duration: targetDuration,
              modelId: state.modelId,
            }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            console.error(`[generate] API error for scene ${sceneId}:`, errBody);
            throw new Error(errBody.error ?? "Failed");
          }

          const data = await res.json();
          const realCost = typeof data.creditsCost === "number" ? data.creditsCost : targetDuration;
          const realDuration = typeof data.duration === "number" ? data.duration : targetDuration;
          get().updateSceneStatus(sceneId, "ready", data.videoUrl, realCost, realDuration);

          // Clear the generation target now that we have the real duration
          // bound to `scene.duration`. Keeps future inspector tweaks honest.
          set((st) => ({
            scenes: st.scenes.map((s) =>
              s.id === sceneId ? { ...s, generationTargetSeconds: undefined } : s,
            ),
          }));

          const falVideoUrl = data.videoUrl;
          persistVideoToStorage(falVideoUrl, pid, sceneId).then((permUrl) => {
            if (!permUrl) return;
            set((st) => ({
              scenes: st.scenes.map((s) => {
                if (s.id !== sceneId) return s;
                return {
                  ...s,
                  videoUrl: permUrl,
                  videoVersions: s.videoVersions.map((v) =>
                    v.url === falVideoUrl ? { ...v, url: permUrl } : v,
                  ),
                };
              }),
              isDirty: true,
            }));
            void kickoffStaging(sceneId, permUrl, realDuration);
          });
        } catch (err) {
          console.error(`[generate] scene ${sceneId}:`, err);
          get().updateSceneStatus(sceneId, "failed");
        }

        set({ isGenerating: false });
        get().saveToSupabase();
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
