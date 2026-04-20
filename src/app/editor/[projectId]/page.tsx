"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { FilmStrip } from "@/components/editor/film-strip";
import { Inspector } from "@/components/editor/inspector";
import { InspectorRail } from "@/components/editor/inspector-rail";
import { DropZone } from "@/components/editor/drop-zone";
import { VideoPreviewModal } from "@/components/editor/video-preview-modal";
import { ImageEditModal } from "@/components/editor/image-edit-modal";
import { Playhead } from "@/components/editor/playhead";
import { TransportBar } from "@/components/editor/transport-bar";
import { TimelineRuler } from "@/components/editor/timeline-ruler";
import { ViewModeToggle } from "@/components/editor/view-mode-toggle";
import { BackgroundTasksIndicator } from "@/components/editor/background-tasks-indicator";
import { LayoutBar } from "@/components/editor/layout-bar";
import { TheaterView } from "@/components/editor/theater-view";
import { TheaterDivider } from "@/components/editor/theater-divider";
import { HeadlinePreview } from "@/components/editor/headline-preview";
import { SettingsModal } from "@/components/editor/settings-modal";
import { useEditorSettingsStore } from "@/stores/editor-settings-store";
import { composeVideos, downloadBlob, type ComposeProgress } from "@/lib/composition/compose";
import { buildSegments, findNextSceneTime, findPreviousSceneTime, timeToSegment, totalDuration } from "@/lib/timeline/segments";
import { useTimelineEngine } from "@/hooks/use-timeline-engine";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;

type CanvasMode = "fit" | "free";

export default function EditorPage({
  params,
}: {
  params: { projectId: string };
}) {
  const scenes = useProjectStore((s) => s.scenes);
  const transitions = useProjectStore((s) => s.transitions);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const editNodeSelected = useProjectStore((s) => s.editNodeSelected);
  const isDirty = useProjectStore((s) => s.isDirty);
  const isLoading = useProjectStore((s) => s.isLoading);
  const initProject = useProjectStore((s) => s.initProject);
  const saveToSupabase = useProjectStore((s) => s.saveToSupabase);
  const musicUrl = useProjectStore((s) => s.musicUrl);
  const audioMix = useProjectStore((s) => s.audioMix);
  const viewMode = useTimelineStore((s) => s.viewMode);
  const timelineSeek = useTimelineStore((s) => s.seek);
  const timelineTogglePlay = useTimelineStore((s) => s.togglePlay);
  const previewPlacement = useEditorSettingsStore((s) => s.layout.previewPlacement);
  const inspectorDensity = useEditorSettingsStore((s) => s.layout.inspectorDensity);
  const theaterStripHeight = useEditorSettingsStore(
    (s) => s.layout.theaterStripHeight,
  );
  const timelineRibbon = useEditorSettingsStore((s) => s.layout.timelineRibbon);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [composing, setComposing] = useState(false);
  const [exportProgress, setExportProgress] = useState<ComposeProgress | null>(null);
  const [lastExportBlobUrl, setLastExportBlobUrl] = useState<string | null>(null);

  const [canvasMode, setCanvasMode] = useState<CanvasMode>("fit");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0, startTime: 0 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mainFlexRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const inspectorOpen = !!(selectedSceneId || editNodeSelected);

  const segments = useMemo(
    () => buildSegments(scenes, transitions),
    [scenes, transitions],
  );

  const segmentsRef = useRef(segments);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useTimelineEngine({
    segments,
    viewportRef,
    contentRef,
    mainFlexRef,
    musicUrl: musicUrl ?? null,
    musicVolume: audioMix.musicVolume,
    panX,
    setPanX,
    zoom,
  });

  useEffect(() => {
    if (viewMode !== "timeline") return;

    // On timeline mode enter, ensure the inspector is showing the scene at
    // the current playhead. This keeps the preview panel useful by default.
    const initialState = useTimelineStore.getState();
    const initial = timeToSegment(segments, initialState.currentTime).segment;
    let lastSceneId: string | null = null;
    if (initial && initial.kind === "scene") {
      lastSceneId = initial.sceneId;
      useProjectStore.getState().selectScene(initial.sceneId);
    }

    // Keep the preview in sync as the playhead crosses segment boundaries
    // during both playback and scrubbing (only the transition when the
    // scene actually changes — not every frame).
    const unsub = useTimelineStore.subscribe((state) => {
      if (!state.isPlaying && !state.isScrubbing) return;
      const { segment } = timeToSegment(segments, state.currentTime);
      if (!segment || segment.kind !== "scene") return;
      if (segment.sceneId !== lastSceneId) {
        lastSceneId = segment.sceneId;
        useProjectStore.getState().selectScene(segment.sceneId);
      }
    });
    return () => unsub();
  }, [viewMode, segments]);

  useEffect(() => {
    setMounted(true);
    const autoFollowDefault = useEditorSettingsStore.getState().behavior.autoFollowDefault;
    useTimelineStore.getState().setAutoFollow(autoFollowDefault);
  }, []);

  useEffect(() => {
    if (mounted) initProject(params.projectId);
  }, [params.projectId, initProject, mounted]);

  useEffect(() => {
    if (!isDirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveToSupabase(); }, 3000);
    return () => clearTimeout(saveTimer.current);
  }, [isDirty, scenes, saveToSupabase]);

  useEffect(() => {
    const flush = () => {
      if (useProjectStore.getState().isDirty) saveToSupabase();
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [saveToSupabase]);

  // Auto-fit calculation
  const fitToView = useCallback(() => {
    if (!viewportRef.current || !contentRef.current) return;

    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const cw = contentRef.current.scrollWidth;
    const ch = contentRef.current.scrollHeight;

    if (cw === 0 || ch === 0) return;

    const padding = 80;
    const fitZoom = Math.min(
      (vw - padding) / cw,
      (vh - padding) / ch,
      1.2,
    );
    const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));

    setZoom(clampedZoom);
    setPanX(0);
    setPanY(0);
    setCanvasMode("fit");
  }, []);

  // Refit when inspector toggles, scenes change, or window resizes (canvas mode only)
  useEffect(() => {
    if (viewMode !== "canvas") return;
    if (canvasMode === "fit") {
      const timer = setTimeout(fitToView, 50);
      return () => clearTimeout(timer);
    }
  }, [inspectorOpen, scenes.length, canvasMode, fitToView, viewMode]);

  useEffect(() => {
    const onResize = () => {
      if (viewMode === "canvas" && canvasMode === "fit") fitToView();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [canvasMode, fitToView, viewMode]);

  // When switching to timeline mode: reset zoom/pan so the strip is at native
  // scale. With auto-follow ON the engine is the authority over panX (it pans
  // so currentTime lines up with stableCenterX) — resetting panX=0 here would
  // both flash the ruler at x=0 AND linger if the engine's sync effect never
  // re-triggers for the current deps (e.g. preset changes that don't flip
  // currentTime). So we only hard-reset panX when auto-follow is off.
  useLayoutEffect(() => {
    if (viewMode === "timeline") {
      setZoom(1);
      setPanY(0);
      setCanvasMode("free");
      if (!useTimelineStore.getState().autoFollow) {
        setPanX(0);
      }
    }
  }, [viewMode]);

  // When ribbon mode activates, auto-fit horizontal zoom so the whole track
  // fits in the compressed viewport. Recomputes when the window resizes or
  // the segment list changes. Leaving ribbon resets zoom to 1.
  useLayoutEffect(() => {
    if (!timelineRibbon || viewMode !== "timeline") return;
    const compute = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const pps = useTimelineStore.getState().pixelsPerSecond;
      const total = totalDuration(segments);
      if (total <= 0 || pps <= 0) return;
      const vw = vp.clientWidth;
      const contentW = total * pps;
      if (contentW <= 0) return;
      const fit = Math.min(1, vw / contentW);
      setZoom(Math.max(0.1, fit));
      setPanX(0);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (viewportRef.current) ro.observe(viewportRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [timelineRibbon, viewMode, segments]);

  useLayoutEffect(() => {
    if (!timelineRibbon && viewMode === "timeline") {
      // Leaving ribbon — restore neutral zoom so the normal timeline looks
      // like it always did before Foco was entered. Same rationale as the
      // viewMode-reset above: only hard-reset panX if auto-follow is off,
      // otherwise the engine will pan to match stableCenterX and any
      // pre-emptive reset just causes a flash (or sticks if the sync
      // effect doesn't re-fire for this dep combo).
      setZoom(1);
      if (!useTimelineStore.getState().autoFollow) {
        setPanX(0);
      }
    }
  }, [timelineRibbon, viewMode]);

  // Theater is intrinsically a playback experience — if the user ships from
  // canvas to Foco we flip into timeline so the ribbon shows the right cards
  // and the engine can actually play. We remember the previous view mode so
  // exiting Foco restores it.
  const prevViewModeRef = useRef<typeof viewMode | null>(null);
  useLayoutEffect(() => {
    if (previewPlacement !== "theater") return;
    const tl = useTimelineStore.getState();
    if (tl.viewMode !== "timeline") {
      prevViewModeRef.current = tl.viewMode;
      tl.setViewMode("timeline");
    }
  }, [previewPlacement]);
  useLayoutEffect(() => {
    if (previewPlacement === "theater") return;
    const saved = prevViewModeRef.current;
    if (saved && useTimelineStore.getState().viewMode === "timeline") {
      useTimelineStore.getState().setViewMode(saved);
    }
    prevViewModeRef.current = null;
  }, [previewPlacement]);

  useEffect(() => {
    if (viewMode === "canvas") {
      const t = setTimeout(fitToView, 50);
      return () => clearTimeout(t);
    }
  }, [viewMode, fitToView]);

  // Prevent browser-level pinch zoom when over the editor
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
    };
  }, []);

  // Initial fit
  useEffect(() => {
    if (mounted && scenes.length > 0 && viewMode === "canvas") {
      const timer = setTimeout(fitToView, 200);
      return () => clearTimeout(timer);
    }
  }, [mounted, fitToView, scenes.length, viewMode]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target !== viewportRef.current && !target.hasAttribute("data-canvas-bg")) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panY,
      startTime: useTimelineStore.getState().currentTime,
    };
    // In timeline mode, treat canvas drag as scrub — so mark scrubbing active
    if (viewMode === "timeline" && useTimelineStore.getState().autoFollow) {
      useTimelineStore.getState().setScrubbing(true);
    }
  }, [panX, panY, viewMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;

    if (viewMode === "timeline") {
      const state = useTimelineStore.getState();
      if (state.autoFollow) {
        // Pan-as-scrub: dragging the canvas is equivalent to scrubbing.
        // Dragging right (dx>0) should reveal earlier content under the stationary
        // playhead, which means currentTime decreases.
        const pps = state.pixelsPerSecond;
        const total = totalDuration(segments);
        const deltaT = -dx / Math.max(1, pps * Math.max(0.001, zoom));
        const newTime = Math.max(0, Math.min(total, panStart.current.startTime + deltaT));
        timelineSeek(newTime);
      } else {
        // autoFollow off: free-pan horizontally (locked vertically)
        setPanX(panStart.current.panX + dx);
      }
    } else {
      setPanX(panStart.current.panX + dx);
      setPanY(panStart.current.panY + dy);
      setCanvasMode("free");
    }
  }, [isPanning, viewMode, segments, zoom, timelineSeek]);

  const handleMouseUp = useCallback(() => {
    if (isPanning && viewMode === "timeline" && useTimelineStore.getState().isScrubbing) {
      useTimelineStore.getState().setScrubbing(false);
    }
    setIsPanning(false);
  }, [isPanning, viewMode]);

  // Wheel / trackpad zoom toward cursor
  // Must use native listener to be able to preventDefault on non-passive wheel
  // Re-attach when viewport becomes available (it only renders after loading)
  const viewportReady = mounted && !isLoading;
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const tlState = useTimelineStore.getState();

      // Timeline mode: wheel/trackpad scroll = scrub. Pinch is also treated as
      // scrub for now (canvas-zoom doesn't apply to timeline). Use whichever
      // axis has the bigger delta to support both vertical wheels and
      // horizontal trackpad scrolls.
      if (tlState.viewMode === "timeline") {
        const pps = tlState.pixelsPerSecond;
        const z = zoomRef.current || 1;
        const total = totalDuration(segmentsRef.current);
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta === 0) return;
        const deltaT = delta / Math.max(1, pps * z);
        const newTime = Math.max(0, Math.min(total, tlState.currentTime + deltaT));
        tlState.seek(newTime);
        return;
      }

      // Pinch gesture (Mac trackpad) arrives as wheel + ctrlKey/metaKey with
      // small deltas. Two-finger scroll is a plain wheel with larger deltas.
      const isPinch = e.ctrlKey || e.metaKey;
      const sensitivity = isPinch ? 0.012 : 0.002;
      // Clamp raw delta per event so a single aggressive trackpad swipe can't
      // swing zoom by >20% — keeps the anchor feeling stable under the cursor.
      const clamped = Math.max(-80, Math.min(80, e.deltaY));
      // Exponential so each tick multiplies zoom instead of adding a flat
      // amount — feels proportional across the entire zoom range.
      const factor = Math.exp(-clamped * sensitivity);

      setZoom((prevZoom) => {
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prevZoom * factor));
        if (newZoom === prevZoom) return prevZoom;

        // Measure AFTER we know we're zooming — rect is stable within the frame.
        const rect = vp.getBoundingClientRect();
        // transform-origin for contentRef is "center center" and the flex
        // layout centers it inside vp, so contentCenter == vpCenter in screen
        // coords. cx/cy are the cursor's offset from that shared center.
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;

        const scale = newZoom / prevZoom;
        // Keep the content point under the cursor in place:
        //   screen = vpCenter + pan + local*zoom
        //   solving for newPan given same local after zoom →
        //   newPan = cursor - scale*(cursor - pan)
        setPanX((px) => cx - scale * (cx - px));
        setPanY((py) => cy - scale * (cy - py));

        return newZoom;
      });
      setCanvasMode("free");
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [viewportReady]);

  // Remember the last non-foco preset so `Esc` or `F` from foco reverts cleanly.
  const lastNonFocoPreset = useRef<"edicao" | "revisao" | "livre">("edicao");
  useEffect(() => {
    const unsub = useEditorSettingsStore.subscribe((state) => {
      const p = state.layout.preset;
      if (p === "edicao" || p === "revisao" || p === "livre") {
        lastNonFocoPreset.current = p;
      }
    });
    return () => unsub();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveToSupabase();
        return;
      }
      if (isTyping) return;

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
        setCanvasMode("free");
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
        setCanvasMode("free");
      } else if (e.key === "0") {
        fitToView();
      } else if (e.key === "1" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        useEditorSettingsStore.getState().applyPreset("edicao");
      } else if (e.key === "2" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        useEditorSettingsStore.getState().applyPreset("revisao");
      } else if (e.key === "3" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        useEditorSettingsStore.getState().applyPreset("foco");
      } else if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const cur = useEditorSettingsStore.getState().layout.preset;
        if (cur === "foco") {
          useEditorSettingsStore.getState().applyPreset(lastNonFocoPreset.current);
        } else {
          useEditorSettingsStore.getState().applyPreset("foco");
        }
      } else if (e.key === "Escape") {
        const cur = useEditorSettingsStore.getState().layout.preset;
        if (cur === "foco") {
          e.preventDefault();
          useEditorSettingsStore.getState().applyPreset(lastNonFocoPreset.current);
        }
      } else if (viewMode === "timeline" && e.code === "Space") {
        e.preventDefault();
        timelineTogglePlay();
      } else if (viewMode === "timeline" && e.key === "ArrowLeft") {
        e.preventDefault();
        const t = useTimelineStore.getState().currentTime;
        const prev = findPreviousSceneTime(segments, t - 0.05);
        timelineSeek(prev);
      } else if (viewMode === "timeline" && e.key === "ArrowRight") {
        e.preventDefault();
        const t = useTimelineStore.getState().currentTime;
        const next = findNextSceneTime(segments, t);
        timelineSeek(next);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveToSupabase, fitToView, viewMode, segments, timelineTogglePlay, timelineSeek]);

  const handleExport = useCallback(async () => {
    const state = useProjectStore.getState();
    const allScenes = state.scenes;
    const readyScenes = allScenes.filter((s) => s.status === "ready" && s.videoUrl);
    if (readyScenes.length < 1 || composing) return;
    setComposing(true);
    setExportProgress({ message: "Iniciando...", percent: 0 });
    try {
      const clips: { url: string; hasAudio: boolean; durationHint?: number; clipVolume?: number; sourceStart?: number; sourceEnd?: number }[] = [];
      for (let i = 0; i < allScenes.length; i++) {
        const scene = allScenes[i]!;
        if (scene.status === "ready" && scene.videoUrl) {
          const activeVer = scene.videoVersions?.[scene.activeVersion];
          const native =
            activeVer?.duration && activeVer.duration > 0
              ? activeVer.duration
              : scene.duration;
          const sourceStart = scene.trimStart;
          const sourceEnd = scene.trimEnd;
          clips.push({
            url: scene.videoUrl,
            hasAudio: scene.sourceType === "video-upload",
            // durationHint is the effective window so probe logic clamps correctly.
            durationHint:
              sourceStart !== undefined || sourceEnd !== undefined
                ? (sourceEnd ?? native) - (sourceStart ?? 0)
                : scene.duration,
            clipVolume: scene.audioVolume ?? 1,
            sourceStart,
            sourceEnd,
          });
        }
        if (i < allScenes.length - 1) {
          const nextScene = allScenes[i + 1]!;
          const transId = `t-${scene.id}-${nextScene.id}`;
          const trans = state.transitions.find((t) => t.id === transId);
          if (trans?.status === "ready" && trans.videoUrl) {
            clips.push({ url: trans.videoUrl, hasAudio: false });
          }
        }
      }
      if (clips.length === 0) return;
      const isVertical = state.exportAspectRatio === "9:16";
      const blob = await composeVideos({
        clips,
        audioUrl: state.musicUrl ?? undefined,
        audioMix: state.audioMix,
        width: isVertical ? 1080 : 1920,
        height: isVertical ? 1920 : 1080,
        onProgress: setExportProgress,
      });
      const blobUrl = URL.createObjectURL(blob);
      if (lastExportBlobUrl) URL.revokeObjectURL(lastExportBlobUrl);
      setLastExportBlobUrl(blobUrl);
      const safeName = state.projectName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "animov";
      downloadBlob(blob, `${safeName}.mp4`);
    } catch (err) {
      console.error("[export]", err);
    } finally {
      setComposing(false);
      setExportProgress(null);
    }
  }, [composing, lastExportBlobUrl]);

  const handleDownloadLast = useCallback(() => {
    if (!lastExportBlobUrl) return;
    const safeName = useProjectStore.getState().projectName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "animov";
    const a = document.createElement("a");
    a.href = lastExportBlobUrl;
    a.download = `${safeName}.mp4`;
    a.click();
  }, [lastExportBlobUrl]);

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen flex-col bg-[#0A0A09]">
        <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-white/5 px-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-white/5" />
            <div className="h-4 w-14 rounded bg-white/5" />
            <div className="h-4 w-14 rounded bg-white/5" />
          </div>
          <div className="h-4 w-28 rounded bg-white/5 animate-pulse" />
          <div className="flex justify-end">
            <div className="h-7 w-20 rounded-full bg-white/5" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center gap-4 p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex w-48 flex-col gap-2">
              <div className="aspect-[16/10] rounded-xl bg-white/[0.03] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
              <div className="h-3 w-20 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = scenes.length === 0;
  const isTheater = previewPlacement === "theater";
  const inspectorHidden = inspectorDensity === "hidden" || isTheater;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0A0A09]">
      <EditorToolbar onExportVideo={handleExport} onOpenSettings={() => setSettingsOpen(true)} />

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <DropZone />
        </div>
      ) : (
        <div
          ref={mainFlexRef}
          className={`flex flex-1 overflow-hidden ${isTheater ? "flex-col" : "flex-row"}`}
        >
          {/* Theater big preview (Foco preset) */}
          {isTheater && (
            <div className="relative flex-1 overflow-hidden">
              <TheaterView />
              <LayoutBar />
            </div>
          )}

          {/* Drag handle between preview and strip — only in Foco mode */}
          {isTheater && <TheaterDivider />}

          {/* Canvas area — full height in normal modes, user-sized ribbon in theater */}
          <div
            className={`relative overflow-hidden ${
              isTheater ? "shrink-0 border-t border-white/5" : "flex-1"
            }`}
            style={isTheater ? { height: theaterStripHeight } : undefined}
          >
            <div
              ref={viewportRef}
              data-canvas-bg="true"
              className={`relative flex h-full w-full overflow-hidden touch-none select-none ${
                viewMode === "timeline"
                  ? "items-center justify-start"
                  : "items-center justify-center"
              }`}
              style={isPanning ? { cursor: "grabbing" } : undefined}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={(e) => {
                // In timeline mode the inspector should stay open (always
                // showing the current scene under the playhead), so don't
                // deselect on background clicks.
                if (viewMode === "timeline") return;
                if (e.target === e.currentTarget || (e.target as HTMLElement).hasAttribute("data-canvas-bg")) {
                  useProjectStore.getState().selectScene(null);
                }
              }}
            >
              <div
                ref={contentRef}
                className=""
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: viewMode === "timeline" ? "left center" : "center center",
                }}
              >
                <FilmStrip onPreviewVideo={setPreviewVideoUrl} onExport={handleExport} onEditImage={setEditingSceneId} />
              </div>

              <TimelineRuler
                segments={segments}
                viewportRef={viewportRef}
                mainFlexRef={mainFlexRef}
                panX={panX}
                zoom={zoom}
              />

              <Playhead
                segments={segments}
                viewportRef={viewportRef}
                contentRef={contentRef}
                mainFlexRef={mainFlexRef}
                zoom={zoom}
                panX={panX}
                setPanX={setPanX}
              />

              <BackgroundTasksIndicator />
            </div>

            {previewPlacement === "headline" && !isTheater && (
              <HeadlinePreview
                viewportRef={viewportRef}
                mainFlexRef={mainFlexRef}
              />
            )}

            {/* Layout presets anchored in the canvas area (not fixed) so it
                never overlaps the inspector. In theater we render a separate
                instance inside the theater wrapper. */}
            {!isTheater && <LayoutBar />}

            {/* Zoom controls + view mode toggle — hidden in theater (ribbon has no room) */}
            {!isTheater && (
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-[#0A0A09]/90 p-1 backdrop-blur-sm">
                  <button
                    onClick={() => { setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP)); setCanvasMode("free"); }}
                    className="flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                    title="Zoom out (-)"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    onClick={fitToView}
                    className="flex h-7 items-center justify-center rounded px-1.5 font-mono text-[10px] text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                    title="Fit to view (0)"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    onClick={() => { setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP)); setCanvasMode("free"); }}
                    className="flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                    title="Zoom in (+)"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <div className="mx-0.5 h-4 w-px bg-white/5" />
                  <button
                    onClick={fitToView}
                    className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                      canvasMode === "fit" && viewMode === "canvas"
                        ? "text-accent-gold"
                        : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
                    }`}
                    title="Fit all (0)"
                  >
                    <Maximize size={14} />
                  </button>
                </div>
                <ViewModeToggle />
              </div>
            )}

            {/* Mode indicator / Transport bar */}
            {viewMode === "timeline" ? (
              <TransportBar segments={segments} viewportRef={viewportRef} mainFlexRef={mainFlexRef} />
            ) : (
              !isTheater && canvasMode === "free" && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                  <button
                    onClick={fitToView}
                    className="rounded-full border border-white/5 bg-[#0A0A09]/90 px-3 py-1 font-mono text-[9px] text-text-secondary backdrop-blur-sm transition-colors hover:text-accent-gold"
                  >
                    Press 0 or click to refit
                  </button>
                </div>
              )
            )}
          </div>

          {/* Inspector — rendered unless fully hidden (theater or density=hidden).
              "railed" mode swaps the full sidebar for a 44px rail with overlay on demand. */}
          {!inspectorHidden && inspectorDensity === "railed" ? (
            <InspectorRail
              onPreviewVideo={setPreviewVideoUrl}
              onExport={handleExport}
              onDownloadLast={lastExportBlobUrl ? handleDownloadLast : undefined}
              onEditImage={setEditingSceneId}
            />
          ) : null}
          {!inspectorHidden && inspectorDensity === "full" ? (
            <Inspector
              onPreviewVideo={setPreviewVideoUrl}
              onExport={handleExport}
              onDownloadLast={lastExportBlobUrl ? handleDownloadLast : undefined}
              onEditImage={setEditingSceneId}
            />
          ) : null}
        </div>
      )}

      {previewVideoUrl && (
        <VideoPreviewModal
          videoUrl={previewVideoUrl}
          onClose={() => setPreviewVideoUrl(null)}
        />
      )}

      {editingSceneId && (() => {
        const editScene = useProjectStore.getState().scenes.find((s) => s.id === editingSceneId);
        if (!editScene) return null;
        // Prefer Supabase HTTPS URL over the inline data URL: Vercel function
        // bodies are capped at 4.5MB, and a ~8MB photo becomes ~11MB as base64
        // inside a JSON payload and is rejected with 413 before reaching the
        // route handler.
        const imgUrl =
          editScene.photoUrl && editScene.photoUrl.startsWith("https://")
            ? editScene.photoUrl
            : editScene.photoDataUrl ?? editScene.photoUrl;
        return (
          <ImageEditModal
            imageUrl={imgUrl}
            onClose={() => setEditingSceneId(null)}
            onResult={(editedUrl, mode) => {
              if (mode === "replace") {
                useProjectStore.getState().updateSceneImage(editingSceneId, editedUrl);
              } else {
                const idx = useProjectStore.getState().scenes.findIndex((s) => s.id === editingSceneId);
                if (idx >= 0) {
                  fetch(editedUrl)
                    .then((r) => r.blob())
                    .then((blob) => {
                      const file = new File([blob], "edited.png", { type: "image/png" });
                      useProjectStore.getState().insertPhotoAt(idx + 1, file);
                    });
                }
              }
              setEditingSceneId(null);
            }}
          />
        );
      })()}

      {composing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex w-[min(92vw,26rem)] flex-col gap-4 rounded-2xl border border-white/10 bg-[#141413] px-8 py-7 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 animate-spin rounded-full border-[3px] border-white/10 border-t-accent-gold" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-label-sm uppercase tracking-widest text-white/80">
                  Exportando vídeo
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-white/45">
                  {exportProgress?.message ?? "Preparando..."}
                </p>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent-gold transition-[width] duration-300 ease-out"
                style={{ width: `${exportProgress?.percent ?? 0}%` }}
              />
            </div>
            <p className="text-center text-[11px] text-white/25">
              Baixas de rede no CDN dos vídeos podem gerar avisos no console; o export tenta reconectar automaticamente.
            </p>
          </div>
        </div>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
