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
  CornerDownLeft,
  Undo2,
  Redo2,
  Clapperboard,
  Play,
  PenLine,
  Settings,
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
  | { type: "info"; label: string; value: string };

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
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-xl border border-white/10 bg-[#141412] py-1 shadow-xl">
            {items.map((item, i) => {
              if (item.type === "separator") {
                return (
                  <div key={i} className="mx-2 my-1 border-t border-white/5" />
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
    modelId,
  } = useProjectStore();

  const [editing, setEditing] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importBackupRef = useRef<HTMLInputElement>(null);

  const cost = totalCost();

  const handleExportBackup = useCallback(() => {
    const { json, skippedSceneIds } = exportProjectJson();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    const safeName = projectName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "animov";
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}-backup.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    if (skippedSceneIds.length > 0) {
      window.alert(
        `Backup salvo. ${skippedSceneIds.length} cena(s) sem URL pública foram omitidas.`,
      );
    }
  }, [exportProjectJson, projectName]);

  const handleImportBackup = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        const res = importPortableProject(text);
        if (!res.ok) {
          window.alert(res.error);
        }
      };
      reader.readAsText(file);
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

  const fileItems: MenuItem[] = [
    {
      type: "action",
      label: "Salvar",
      icon: <Save size={14} />,
      shortcut: `${mod}S`,
      onClick: () => saveToSupabase(),
    },
    { type: "separator" },
    {
      type: "action",
      label: "Exportar backup (.json)",
      icon: <Download size={14} />,
      disabled: scenes.length === 0,
      onClick: handleExportBackup,
    },
    {
      type: "action",
      label: "Importar backup (.json)",
      icon: <Upload size={14} />,
      onClick: () => importBackupRef.current?.click(),
    },
    {
      type: "action",
      label: "Exportar video final",
      icon: <Film size={14} />,
      disabled:
        !onExportVideo ||
        scenes.filter((s) => s.status === "ready").length < 1,
      onClick: () => onExportVideo?.(),
    },
    { type: "separator" },
    {
      type: "action",
      label: "Voltar ao dashboard",
      icon: <CornerDownLeft size={14} />,
      onClick: () => {
        window.location.href = "/dashboard";
      },
    },
  ];

  const editItems: MenuItem[] = [
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

  const projectItems: MenuItem[] = [
    {
      type: "action",
      label: "Renomear projeto",
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
    {
      type: "info",
      label: "Cenas",
      value: String(scenes.length),
    },
    {
      type: "info",
      label: "Custo estimado",
      value: `${cost} cr.`,
    },
    {
      type: "info",
      label: "Modelo",
      value: modelId.replace(/-/g, " "),
    },
  ];

  return (
    <div className="shrink-0 border-b border-white/5">
      {/* Row 1: Title bar */}
      <div className="flex h-10 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/5 hover:text-[var(--text)]"
          >
            <ArrowLeft size={14} />
          </Link>

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
              className="bg-transparent font-display text-base outline-none ring-1 ring-white/10 rounded px-2 py-0.5"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="font-display text-base hover:text-accent-gold transition-colors"
            >
              {projectName}
            </button>
          )}

          <span className="font-mono text-[10px] text-text-secondary">
            {isSaving && "Salvando..."}
            {!isSaving && isDirty && "Nao salvo"}
            {!isSaving && !isDirty && scenes.length > 0 && "Salvo"}
          </span>
        </div>

        <CreditsChip balance={creditBalance} />
      </div>

      {/* Row 2: Menu bar */}
      <div className="flex h-8 items-center gap-0.5 border-t border-white/[0.03] px-3">
        <MenuDropdown
          label="Arquivo"
          items={fileItems}
          open={openMenu === "file"}
          onToggle={() => toggleMenu("file")}
          onClose={closeMenu}
        />
        <MenuDropdown
          label="Editar"
          items={editItems}
          open={openMenu === "edit"}
          onToggle={() => toggleMenu("edit")}
          onClose={closeMenu}
        />
        <MenuDropdown
          label="Projeto"
          items={projectItems}
          open={openMenu === "project"}
          onToggle={() => toggleMenu("project")}
          onClose={closeMenu}
        />

        <input
          ref={importBackupRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportBackup}
        />
      </div>
    </div>
  );
}
