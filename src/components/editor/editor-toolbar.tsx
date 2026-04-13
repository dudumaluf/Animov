"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/stores/project-store";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Save,
  Download,
  Upload,
  Film,
  Image as ImageIcon,
  FileJson,
  FolderOpen,
  FilePlus,
  Undo2,
  Redo2,
  Clapperboard,
  Play,
  PenLine,
  Settings,
  ChevronRight,
  ChevronDown,
  Coins,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */

type MenuItem =
  | {
      type: "action";
      label: string;
      icon?: React.ReactNode;
      shortcut?: string;
      disabled?: boolean;
      onClick: () => void;
    }
  | { type: "separator" }
  | { type: "heading"; label: string }
  | { type: "info"; label: string; value: string }
  | {
      type: "submenu";
      label: string;
      icon?: React.ReactNode;
      children: MenuItem[];
    };

/* ── MenuPanel (recursive) ─────────────────────────────────────── */

function MenuPanel({
  items,
  onClose,
  depth = 0,
}: {
  items: MenuItem[];
  onClose: () => void;
  depth?: number;
}) {
  const [hoveredSub, setHoveredSub] = useState<number | null>(null);

  return (
    <div
      className={`${
        depth === 0 ? "absolute left-0 top-full mt-1" : "absolute left-full top-0 -mt-1"
      } z-50 min-w-[220px] rounded-xl border border-white/10 bg-[#141412] py-1 shadow-xl`}
    >
      {items.map((item, i) => {
        if (item.type === "separator") {
          return <div key={i} className="mx-2 my-1 border-t border-white/5" />;
        }
        if (item.type === "heading") {
          return (
            <div
              key={i}
              className="px-3 pb-0.5 pt-2 font-mono text-[9px] uppercase tracking-widest text-text-secondary"
            >
              {item.label}
            </div>
          );
        }
        if (item.type === "info") {
          return (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-1.5 font-mono text-[11px]"
            >
              <span className="text-text-secondary">{item.label}</span>
              <span className="text-[var(--text)]">{item.value}</span>
            </div>
          );
        }
        if (item.type === "submenu") {
          return (
            <div
              key={i}
              className="relative"
              onMouseEnter={() => setHoveredSub(i)}
              onMouseLeave={() => setHoveredSub(null)}
            >
              <div className="flex w-full items-center gap-2.5 px-3 py-1.5 font-mono text-[12px] text-[var(--text)] transition-colors hover:bg-white/5">
                {item.icon && (
                  <span className="flex w-4 shrink-0 items-center justify-center text-text-secondary">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                <ChevronRight size={10} className="text-text-secondary" />
              </div>
              {hoveredSub === i && (
                <MenuPanel
                  items={item.children}
                  onClose={onClose}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }
        return (
          <button
            key={i}
            onClick={() => {
              if (!item.disabled) {
                onClose();
                item.onClick();
              }
            }}
            disabled={item.disabled}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left font-mono text-[12px] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {item.icon && (
              <span className="flex w-4 shrink-0 items-center justify-center text-text-secondary">
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="ml-4 text-[10px] text-text-secondary">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── MenuDropdown ──────────────────────────────────────────────── */

function MenuDropdown({
  label,
  items,
  open,
  onToggle,
  onClose,
}: {
  label: string;
  items: MenuItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex h-7 items-center gap-1 rounded px-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
          open
            ? "bg-white/5 text-[var(--text)]"
            : "text-text-secondary hover:bg-white/5 hover:text-[var(--text)]"
        }`}
      >
        {label}
        <ChevronDown
          size={10}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <MenuPanel items={items} onClose={onClose} />
        </>
      )}
    </div>
  );
}

/* ── CreditsChip ───────────────────────────────────────────────── */

function CreditsChip({ balance }: { balance: number | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (balance === null) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-7 items-center gap-1.5 rounded-full border border-white/10 px-3 font-mono text-[11px] text-text-secondary transition-colors hover:border-white/20 hover:text-[var(--text)]"
      >
        <Coins size={12} className="text-accent-gold" />
        <span className="text-accent-gold">{balance}</span>
        <span>cr.</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-white/10 bg-[#141412] p-3 shadow-xl">
            <div className="mb-3 text-center">
              <div className="font-mono text-[24px] text-accent-gold">
                {balance}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                creditos disponiveis
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/planos");
                }}
                className="w-full rounded-lg bg-accent-gold py-1.5 font-mono text-[11px] uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80"
              >
                Comprar creditos
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/planos");
                }}
                className="w-full rounded-lg border border-white/10 py-1.5 font-mono text-[11px] uppercase tracking-widest text-text-secondary transition-colors hover:border-white/20 hover:text-[var(--text)]"
              >
                Ver planos
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── SaveIndicator ─────────────────────────────────────────────── */

function SaveIndicator({ isSaving, isDirty, hasScenes }: { isSaving: boolean; isDirty: boolean; hasScenes: boolean }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(fadeTimer.current);

    if (isSaving) {
      setText("Salvando...");
      setVisible(true);
    } else if (isDirty) {
      setText("Nao salvo");
      setVisible(true);
    } else if (hasScenes) {
      setText("Salvo");
      setVisible(true);
      fadeTimer.current = setTimeout(() => setVisible(false), 2000);
    } else {
      setVisible(false);
    }

    return () => clearTimeout(fadeTimer.current);
  }, [isSaving, isDirty, hasScenes]);

  return (
    <span
      className="ml-2 font-mono text-[10px] text-text-secondary transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {text}
    </span>
  );
}

/* ── EditorToolbar ─────────────────────────────────────────────── */

export function EditorToolbar({
  onExportVideo,
}: {
  onExportVideo?: () => void;
}) {
  const {
    projectName,
    setProjectName,
    totalCost,
    scenes,
    isGenerating,
    generateAll,
    generateScene,
    isSaving,
    isDirty,
    selectedSceneId,
    saveToSupabase,
    exportProjectJson,
    importPortableProject,
    hasEditNode,
    setHasEditNode,
    modelId,
  } = useProjectStore();

  const [editing, setEditing] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const cost = totalCost();

  const handleExportBackup = useCallback(() => {
    const { json, skippedSceneIds } = exportProjectJson();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    const safeName =
      projectName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "animov";
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}-backup.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    if (skippedSceneIds.length > 0) {
      window.alert(
        `Backup salvo. ${skippedSceneIds.length} cena(s) sem URL publica foram omitidas.`,
      );
    }
  }, [exportProjectJson, projectName]);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = String(reader.result ?? "");
          const res = importPortableProject(text);
          if (!res.ok) window.alert(res.error);
        };
        reader.readAsText(file);
      } else {
        useProjectStore.getState().addPhotos([file]);
      }

      e.target.value = "";
    },
    [importPortableProject],
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from("credits")
          .select("balance")
          .eq("user_id", data.user.id)
          .single()
          .then(({ data: credits }) => {
            if (credits) setCreditBalance(credits.balance);
          });
      }
    });
  }, [isGenerating]);

  const closeMenu = () => setOpenMenu(null);
  const toggleMenu = (name: string) =>
    setOpenMenu((prev) => (prev === name ? null : name));

  const isMac =
    typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl+";

  const readyCount = scenes.filter((s) => s.status === "ready").length;

  const fileMenuItems: MenuItem[] = [
    {
      type: "action",
      label: "Novo projeto",
      icon: <FilePlus size={14} />,
      onClick: () => {
        window.location.href = "/editor/new";
      },
    },
    {
      type: "action",
      label: "Abrir projeto",
      icon: <FolderOpen size={14} />,
      onClick: () => {
        window.location.href = "/dashboard";
      },
    },
    { type: "separator" },
    {
      type: "action",
      label: "Salvar",
      icon: <Save size={14} />,
      shortcut: `${mod}S`,
      onClick: () => saveToSupabase(),
    },
    { type: "separator" },
    {
      type: "submenu",
      label: "Exportar",
      icon: <Download size={14} />,
      children: [
        {
          type: "action",
          label: "Videos individuais",
          icon: <Film size={14} />,
          disabled: readyCount < 1,
          onClick: () => {
            /* TODO: download individual scene videos */
          },
        },
        {
          type: "action",
          label: "Edit final (.mp4)",
          icon: <Clapperboard size={14} />,
          disabled: readyCount < 1,
          onClick: () => {
            if (!hasEditNode) setHasEditNode(true);
            onExportVideo?.();
          },
        },
        { type: "separator" },
        {
          type: "action",
          label: "Backup do projeto (.json)",
          icon: <FileJson size={14} />,
          disabled: scenes.length === 0,
          onClick: handleExportBackup,
        },
      ],
    },
    {
      type: "submenu",
      label: "Importar",
      icon: <Upload size={14} />,
      children: [
        {
          type: "action",
          label: "Imagens",
          icon: <ImageIcon size={14} />,
          onClick: () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = () => {
              if (input.files && input.files.length > 0) {
                useProjectStore.getState().addPhotos(Array.from(input.files));
              }
            };
            input.click();
          },
        },
        {
          type: "action",
          label: "Backup do projeto (.json)",
          icon: <FileJson size={14} />,
          onClick: () => importFileRef.current?.click(),
        },
      ],
    },
    { type: "separator" },
    { type: "heading", label: "Projeto" },
    {
      type: "action",
      label: "Renomear",
      icon: <PenLine size={14} />,
      onClick: () => setEditing(true),
    },
    {
      type: "action",
      label: "Configuracoes",
      icon: <Settings size={14} />,
      disabled: true,
      onClick: () => {},
    },
    { type: "separator" },
    { type: "info", label: "Cenas", value: String(scenes.length) },
    { type: "info", label: "Custo estimado", value: `${cost} cr.` },
    {
      type: "info",
      label: "Modelo",
      value: modelId.replace(/-/g, " "),
    },
  ];

  const editMenuItems: MenuItem[] = [
    {
      type: "action",
      label: "Desfazer",
      icon: <Undo2 size={14} />,
      shortcut: `${mod}Z`,
      disabled: true,
      onClick: () => {},
    },
    {
      type: "action",
      label: "Refazer",
      icon: <Redo2 size={14} />,
      shortcut: `${mod}⇧Z`,
      disabled: true,
      onClick: () => {},
    },
    { type: "separator" },
    { type: "heading", label: "Gerar" },
    {
      type: "action",
      label: "Gerar todas as cenas",
      icon: <Clapperboard size={14} />,
      disabled: scenes.length === 0 || isGenerating,
      onClick: () => generateAll(),
    },
    {
      type: "action",
      label: "Gerar cena selecionada",
      icon: <Play size={14} />,
      disabled: !selectedSceneId || isGenerating,
      onClick: () => {
        if (selectedSceneId) generateScene(selectedSceneId);
      },
    },
  ];

  return (
    <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-white/5 px-3">
      {/* Left: back + menus */}
      <div className="flex items-center gap-1">
        <Link
          href="/dashboard"
          onClick={() => {
            if (useProjectStore.getState().isDirty) saveToSupabase();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="mx-1 h-4 w-px bg-white/5" />

        <MenuDropdown
          label="Arquivo"
          items={fileMenuItems}
          open={openMenu === "file"}
          onToggle={() => toggleMenu("file")}
          onClose={closeMenu}
        />
        <MenuDropdown
          label="Editar"
          items={editMenuItems}
          open={openMenu === "edit"}
          onToggle={() => toggleMenu("edit")}
          onClose={closeMenu}
        />
      </div>

      {/* Center: project name + save indicator */}
      <div className="flex items-center justify-center gap-1">
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={projectName}
            onBlur={(e) => {
              setProjectName(e.target.value || "Novo Projeto");
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="bg-transparent font-display text-sm outline-none ring-1 ring-white/10 rounded px-2 py-0.5 text-center"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-display text-sm hover:text-accent-gold transition-colors"
            title="Clique para renomear"
          >
            {projectName}
          </button>
        )}

        <SaveIndicator isSaving={isSaving} isDirty={isDirty} hasScenes={scenes.length > 0} />
      </div>

      {/* Right: credits */}
      <div className="flex justify-end">
        <CreditsChip balance={creditBalance} />
      </div>

      {/* Hidden file input for JSON import */}
      <input
        ref={importFileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />
    </header>
  );
}
