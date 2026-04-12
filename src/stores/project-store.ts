import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import { nanoid } from "nanoid";

export type Scene = {
  id: string;
  photoUrl: string;
  photoDataUrl?: string;
  presetId: string;
  duration: number;
  status: "idle" | "generating" | "ready" | "failed";
  videoUrl?: string;
  videoVersions: string[];
  activeVersion: number;
  costCredits: number;
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
  isDirty: boolean;
  isGenerating: boolean;
  isSaving: boolean;

  _photoFiles: Record<string, File>;

  setProjectName: (name: string) => void;
  setModelId: (modelId: string) => void;
  selectScene: (id: string | null) => void;

  addPhotos: (files: File[]) => void;
  insertPhotoAt: (index: number, file: File) => void;
  removeScene: (id: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  setScenePreset: (sceneId: string, presetId: string) => void;
  setSceneDuration: (sceneId: string, duration: number) => void;
  setActiveVersion: (sceneId: string, version: number) => void;

  toggleTransition: (transitionId: string) => void;
  generateTransition: (fromSceneId: string, toSceneId: string) => Promise<void>;
  setHasEditNode: (has: boolean) => void;
  selectEditNode: () => void;
  setMusicPrompt: (prompt: string) => void;
  generateMusic: () => Promise<void>;
  clearMusic: () => void;

  updateSceneStatus: (sceneId: string, status: Scene["status"], videoUrl?: string) => void;
  generateAll: () => Promise<void>;
  generateScene: (sceneId: string) => Promise<void>;

  initProject: (urlProjectId: string) => Promise<void>;
  saveToSupabase: () => Promise<void>;
  loadFromSupabase: (supabaseId: string) => Promise<void>;

  totalCost: () => number;
  reset: () => void;
};

function rebuildTransitions(scenes: Scene[]): Transition[] {
  const transitions: Transition[] = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    transitions.push({
      id: `t-${scenes[i]!.id}-${scenes[i + 1]!.id}`,
      fromSceneId: scenes[i]!.id,
      toSceneId: scenes[i + 1]!.id,
      presetId: "soft_dissolve_drift",
      enabled: true,
      status: "idle",
      costCredits: 1,
    });
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

async function uploadPhoto(file: File, projectId: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("projectId", projectId);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projectId: "",
      supabaseProjectId: null,
      projectName: "Novo Projeto",
      modelId: "kling-o1-pro",
      scenes: [],
      transitions: [],
      selectedSceneId: null,
      hasEditNode: false,
      editNodeSelected: false,
      musicPrompt: "Calm ambient instrumental, warm piano, soft strings, real estate luxury, 90 BPM, elegant and inviting",
      musicUrl: null,
      isMusicGenerating: false,
      isDirty: false,
      isGenerating: false,
      isSaving: false,
      _photoFiles: {},

      setProjectName: (name) => set({ projectName: name, isDirty: true }),
      setModelId: (modelId) => set({ modelId, isDirty: true }),
      selectScene: (id) =>
        set((state) => ({
          selectedSceneId: state.selectedSceneId === id ? null : id,
          editNodeSelected: false,
        })),

      addPhotos: (files) => {
        const ids = files.map(() => nanoid(8));
        const newScenes: Scene[] = files.map((file, i) => ({
          id: ids[i]!,
          photoUrl: URL.createObjectURL(file),
          presetId: "push_in_serene",
          duration: 5,
          status: "idle" as const,
          videoVersions: [],
          activeVersion: 0,
          costCredits: 1,
        }));

        const fileMap: Record<string, File> = {};
        files.forEach((file, i) => {
          fileMap[ids[i]!] = file;
        });

        set((state) => {
          const scenes = [...state.scenes, ...newScenes];
          return {
            scenes,
            transitions: rebuildTransitions(scenes),
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
        const id = nanoid(8);
        const newScene: Scene = {
          id,
          photoUrl: URL.createObjectURL(file),
          presetId: "push_in_serene",
          duration: 5,
          status: "idle",
          videoVersions: [],
          activeVersion: 0,
          costCredits: 1,
        };
        set((state) => {
          const scenes = [...state.scenes];
          scenes.splice(index, 0, newScene);
          return {
            scenes,
            transitions: rebuildTransitions(scenes),
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

      removeScene: (id) => {
        set((state) => {
          const scenes = state.scenes.filter((s) => s.id !== id);
          const files = { ...state._photoFiles };
          delete files[id];
          return {
            scenes,
            transitions: rebuildTransitions(scenes),
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
          return {
            scenes,
            transitions: rebuildTransitions(scenes),
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
            s.id === sceneId ? { ...s, duration } : s,
          ),
          isDirty: true,
        }));
      },

      setActiveVersion: (sceneId, version) => {
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            const clamped = Math.max(0, Math.min(version, s.videoVersions.length - 1));
            return { ...s, activeVersion: clamped, videoUrl: s.videoVersions[clamped] ?? s.videoUrl };
          }),
          isDirty: true,
        }));
      },

      toggleTransition: (transitionId) => {
        set((state) => ({
          transitions: state.transitions.map((t) =>
            t.id === transitionId ? { ...t, enabled: !t.enabled } : t,
          ),
          isDirty: true,
        }));
      },

      generateTransition: async (fromSceneId, toSceneId) => {
        const state = get();
        const fromScene = state.scenes.find((s) => s.id === fromSceneId);
        const toScene = state.scenes.find((s) => s.id === toSceneId);
        if (!fromScene || !toScene) return;

        const startImageUrl = fromScene.photoUrl.startsWith("blob:") ? fromScene.photoDataUrl : fromScene.photoUrl;
        const endImageUrl = toScene.photoUrl.startsWith("blob:") ? toScene.photoDataUrl : toScene.photoUrl;
        if (!startImageUrl || !endImageUrl) return;

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
            body: JSON.stringify({ startImageUrl, endImageUrl, duration: 3 }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? "Failed");
          }

          const data = await res.json();
          set((state) => ({
            transitions: state.transitions.map((t) =>
              t.id === transitionId ? { ...t, status: "ready" as const, videoUrl: data.videoUrl } : t,
            ),
            isDirty: true,
          }));
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

      updateSceneStatus: (sceneId, status, videoUrl) => {
        set((state) => ({
          scenes: state.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            if (videoUrl) {
              const versions = [...s.videoVersions, videoUrl];
              return { ...s, status, videoUrl, videoVersions: versions, activeVersion: versions.length - 1 };
            }
            return { ...s, status };
          }),
          isDirty: true,
        }));
      },

      initProject: async (urlProjectId) => {
        const state = get();
        if (state.supabaseProjectId === urlProjectId) return;
        if (state.projectId === urlProjectId && state.supabaseProjectId) return;

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
              isDirty: false,
            });
          }
        } catch (err) {
          console.error("[initProject]", err);
        }
      },

      loadFromSupabase: async (supabaseId) => {
        try {
          const res = await fetch(`/api/projects/${supabaseId}`);
          if (!res.ok) return;
          const data = await res.json();

          const scenes: Scene[] = (data.scenes ?? []).map((s: { id: string; photo_url: string; prompt_generated: string; duration: number; status: string; video_url: string; cost_credits: number }) => ({
            id: s.id,
            photoUrl: s.photo_url,
            photoDataUrl: s.photo_url,
            presetId: s.prompt_generated ?? "push_in_serene",
            duration: Number(s.duration) || 5,
            status: s.status === "pending" ? "idle" : s.status,
            videoUrl: s.video_url ?? undefined,
            costCredits: s.cost_credits,
          }));

          set({
            supabaseProjectId: supabaseId,
            projectId: supabaseId,
            projectName: data.project.name,
            modelId: "kling-o1-pro",
            scenes,
            transitions: rebuildTransitions(scenes),
            selectedSceneId: null,
            isDirty: false,
            isGenerating: false,
          });
        } catch (err) {
          console.error("[loadFromSupabase]", err);
        }
      },

      saveToSupabase: async () => {
        const state = get();
        if (!state.supabaseProjectId || state.isSaving) return;
        set({ isSaving: true });

        try {
          await fetch(`/api/projects/${state.supabaseProjectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: state.projectName,
              scenes: state.scenes.map((s) => ({
                photo_url: s.photoUrl.startsWith("blob:") ? (s.photoDataUrl ?? s.photoUrl) : s.photoUrl,
                preset_key: s.presetId,
                duration: s.duration,
                status: s.status,
                video_url: s.videoUrl,
                cost_credits: s.costCredits,
              })),
            }),
          });
          set({ isDirty: false });
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

          let file = state._photoFiles[scene.id];
          if (!file && scene.photoDataUrl) {
            file = await dataUrlToFile(scene.photoDataUrl, `${scene.id}.jpg`);
          }
          if (!file && scene.photoUrl && !scene.photoUrl.startsWith("blob:")) {
            const res = await fetch(scene.photoUrl);
            const blob = await res.blob();
            file = new File([blob], `${scene.id}.jpg`, { type: blob.type });
          }
          if (!file) continue;

          get().updateSceneStatus(scene.id, "generating");

          try {
            const formData = new FormData();
            formData.append("photo", file);
            formData.append("presetId", scene.presetId);
            formData.append("duration", String(scene.duration));
            formData.append("modelId", state.modelId);

            const res = await fetch("/api/generate-scene", {
              method: "POST",
              body: formData,
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error ?? "Failed");
            }

            const data = await res.json();
            get().updateSceneStatus(scene.id, "ready", data.videoUrl);
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

        let file = state._photoFiles[scene.id];
        if (!file && scene.photoDataUrl) {
          file = await dataUrlToFile(scene.photoDataUrl, `${scene.id}.jpg`);
        }
        if (!file && scene.photoUrl && !scene.photoUrl.startsWith("blob:")) {
          const res = await fetch(scene.photoUrl);
          const blob = await res.blob();
          file = new File([blob], `${scene.id}.jpg`, { type: blob.type });
        }
        if (!file) { set({ isGenerating: false }); return; }

        get().updateSceneStatus(sceneId, "generating");

        try {
          const formData = new FormData();
          formData.append("photo", file);
          formData.append("presetId", scene.presetId);
          formData.append("duration", String(scene.duration));
          formData.append("modelId", state.modelId);

          const res = await fetch("/api/generate-scene", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? "Failed");
          }

          const data = await res.json();
          get().updateSceneStatus(sceneId, "ready", data.videoUrl);
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
        projectName: state.projectName,
        modelId: state.modelId,
        scenes: state.scenes.map((s) => ({
          id: s.id,
          photoUrl: s.photoUrl.startsWith("blob:") ? "" : s.photoUrl,
          presetId: s.presetId,
          duration: s.duration,
          status: s.status,
          videoUrl: s.videoUrl,
          costCredits: s.costCredits,
        })),
        transitions: state.transitions,
      }) as unknown as ProjectStore,
    },
  ),
);
