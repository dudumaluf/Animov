import type { Scene, Transition, VideoVersion } from "@/stores/project-store";

export const PORTABLE_VERSION = 1 as const;

export type PortableProjectV1 = {
  version: typeof PORTABLE_VERSION;
  exportedAt: string;
  projectName: string;
  modelId: string;
  hasEditNode: boolean;
  musicPrompt: string;
  musicUrl: string | null;
  scenes: PortableScene[];
  transitions: Transition[];
};

export type PortableScene = Omit<Scene, "photoDataUrl">;

function isHttpUrl(u: string | undefined | null): u is string {
  return !!u && (u.startsWith("https://") || u.startsWith("http://"));
}

/** Prefer still image URL; fall back to video URL (fal CDN) so video-only nodes export. */
export function resolvePublicAssetUrl(s: Scene): string | null {
  if (isHttpUrl(s.photoUrl) && !s.photoUrl.includes("blob:")) return s.photoUrl;
  if (isHttpUrl(s.photoDataUrl)) return s.photoDataUrl;
  if (isHttpUrl(s.videoUrl)) return s.videoUrl;
  return null;
}

export function sceneToPortable(s: Scene): PortableScene | null {
  const photo = resolvePublicAssetUrl(s);
  if (!photo) return null;

  const versions = s.videoVersions?.length
    ? s.videoVersions.filter((v) => isHttpUrl(v.url))
    : s.videoUrl && isHttpUrl(s.videoUrl)
      ? [{ url: s.videoUrl, duration: s.duration }]
      : [];

  return {
    id: s.id,
    photoUrl: photo,
    presetId: s.presetId,
    duration: s.duration,
    status: s.status,
    videoUrl: isHttpUrl(s.videoUrl) ? s.videoUrl : undefined,
    videoVersions: versions,
    activeVersion: s.activeVersion ?? 0,
    costCredits: s.costCredits,
    sourceType: s.sourceType,
  };
}

export function portableToScene(p: PortableScene): Scene {
  const rawVersions = (p.videoVersions ?? []) as (VideoVersion | string)[];
  const versions: VideoVersion[] = rawVersions.map((v) => {
    if (typeof v === "string") return { url: v, duration: p.duration };
    return v as VideoVersion;
  });
  const active = p.activeVersion ?? 0;
  const ver = versions[active];
  return {
    id: p.id,
    photoUrl: p.photoUrl,
    photoDataUrl: p.photoUrl,
    presetId: p.presetId,
    duration: ver?.duration ?? p.duration,
    status: (p.status === "processing" ? "idle" : p.status) as Scene["status"],
    videoUrl: ver?.url ?? p.videoUrl,
    videoVersions: versions.length ? versions : p.videoUrl ? [{ url: p.videoUrl, duration: p.duration }] : [],
    activeVersion: active,
    costCredits: p.costCredits,
    sourceType: p.sourceType,
  };
}

export function buildPortableProject(
  input: {
    projectName: string;
    modelId: string;
    scenes: Scene[];
    transitions: Transition[];
    hasEditNode: boolean;
    musicPrompt: string;
    musicUrl: string | null;
  },
): { data: PortableProjectV1; skippedSceneIds: string[] } {
  const skippedSceneIds: string[] = [];
  const scenes: PortableScene[] = [];

  for (const s of input.scenes) {
    const row = sceneToPortable(s);
    if (!row) {
      skippedSceneIds.push(s.id);
      continue;
    }
    scenes.push(row);
  }

  const musicUrl =
    input.musicUrl && isHttpUrl(input.musicUrl) ? input.musicUrl : null;

  return {
    data: {
      version: PORTABLE_VERSION,
      exportedAt: new Date().toISOString(),
      projectName: input.projectName,
      modelId: input.modelId,
      hasEditNode: input.hasEditNode,
      musicPrompt: input.musicPrompt,
      musicUrl,
      scenes,
      transitions: input.transitions,
    },
    skippedSceneIds,
  };
}

export function parsePortableProjectJson(
  text: string,
): { ok: true; data: PortableProjectV1 } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Formato inválido." };
  }
  const o = parsed as Record<string, unknown>;
  if (o.version !== 1) {
    return { ok: false, error: "Versão do backup não suportada." };
  }
  if (!Array.isArray(o.scenes) || !Array.isArray(o.transitions)) {
    return { ok: false, error: "Backup incompleto (scenes/transitions)." };
  }
  return { ok: true, data: o as PortableProjectV1 };
}
