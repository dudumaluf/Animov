"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { ReferenceImage } from "@/stores/project-store";

type MenuState = {
  query: string;
  top: number;
  left: number;
};

type Props = {
  images: ReferenceImage[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Compact actions rendered on the right of the "Prompt" label row. */
  actions?: ReactNode;
};

/**
 * Reference prompt editor with inline `@ImageN` mention chips.
 *
 * A contenteditable surface renders each `@ImageN` token as an atomic chip
 * (tiny thumbnail + label) right where it sits in the text. Typing `@` opens a
 * picker filtered by number / role / description; choosing inserts the chip.
 * The plain-text serialization (with literal `@ImageN` tokens) is always the
 * source of truth handed back via `onChange`, so the value stays clean for
 * Seedance and for the compose/enhance endpoints.
 */
export function ReferencePromptEditor({ images, value, onChange, placeholder, actions }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>("");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isEmpty, setIsEmpty] = useState(!value);

  const imageByToken = useCallback(
    (token: string) => images.find((im) => im.label.toLowerCase() === token.toLowerCase()) ?? null,
    [images],
  );

  // Build the contenteditable DOM from a plain-text value.
  const renderInto = useCallback(
    (el: HTMLDivElement, text: string) => {
      el.innerHTML = "";
      const frag = document.createDocumentFragment();
      const lines = text.split("\n");
      lines.forEach((line, li) => {
        if (li > 0) frag.appendChild(document.createElement("br"));
        const re = /@Image\d+/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
          const start = m.index;
          if (start > last) {
            frag.appendChild(document.createTextNode(line.slice(last, start)));
          }
          frag.appendChild(makeChip(m[0], imageByToken(m[0])));
          last = start + m[0].length;
        }
        if (last < line.length) {
          frag.appendChild(document.createTextNode(line.slice(last)));
        }
      });
      el.appendChild(frag);
    },
    [imageByToken],
  );

  const serialize = useCallback((el: HTMLElement): string => {
    let out = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent ?? "";
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const eln = node as HTMLElement;
      const token = eln.dataset.token;
      if (token) {
        out += token;
        return;
      }
      if (eln.tagName === "BR") {
        out += "\n";
        return;
      }
      const inner = serialize(eln);
      out += eln.tagName === "DIV" ? `\n${inner}` : inner;
    });
    return out;
  }, []);

  // Sync external value → DOM (preset switch, regenerate, enhance). Skips when
  // the incoming value is exactly what we last emitted, so typing isn't clobbered.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Don't clobber the caret while the user is actively typing (the value we
    // just emitted comes back unchanged). Rebuild for any external change, or
    // when images change while the field isn't focused.
    const focused = document.activeElement === el;
    if (value === lastEmitted.current && focused) return;
    renderInto(el, value);
    lastEmitted.current = value;
    setIsEmpty(value.trim().length === 0);
  }, [value, renderInto]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const text = serialize(el);
    lastEmitted.current = text;
    setIsEmpty(text.trim().length === 0);
    onChange(text);
  }, [serialize, onChange]);

  // Detect an active "@query" immediately before the caret.
  const refreshMenu = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      setMenu(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      setMenu(null);
      return;
    }
    const textBefore = (node.textContent ?? "").slice(0, range.startOffset);
    const m = textBefore.match(/@(\w*)$/);
    if (!m) {
      setMenu(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setActiveIdx(0);
    setMenu({
      query: m[1] ?? "",
      top: rect.bottom > 0 ? rect.bottom + 4 : 0,
      left: rect.left,
    });
  }, []);

  const handleInput = useCallback(() => {
    emit();
    refreshMenu();
  }, [emit, refreshMenu]);

  const filtered = useMemo(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    if (!q) return images;
    return images.filter(
      (im) =>
        im.label.toLowerCase().includes(q) ||
        im.role.toLowerCase().includes(q) ||
        im.description.toLowerCase().includes(q),
    );
  }, [menu, images]);

  const insertMention = useCallback(
    (image: ReferenceImage) => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;

      const offset = range.startOffset;
      const before = (node.textContent ?? "").slice(0, offset);
      const at = before.lastIndexOf("@");
      if (at < 0) return;

      // Replace "@query" with the chip + a trailing space.
      const replaceRange = document.createRange();
      replaceRange.setStart(node, at);
      replaceRange.setEnd(node, offset);
      replaceRange.deleteContents();

      const chip = makeChip(image.label, image);
      const space = document.createTextNode("\u00a0");
      const frag = document.createDocumentFragment();
      frag.appendChild(chip);
      frag.appendChild(space);
      replaceRange.insertNode(frag);

      // Caret right after the inserted space.
      const after = document.createRange();
      after.setStartAfter(space);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);

      setMenu(null);
      emit();
    },
    [emit],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!menu || filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = filtered[Math.min(activeIdx, filtered.length - 1)];
        if (pick) insertMention(pick);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMenu(null);
      }
    },
    [menu, filtered, activeIdx, insertMention],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-[1.25rem] items-center justify-between gap-2">
        <label className="font-mono text-label-xs uppercase tracking-widest text-text-secondary">
          Prompt
        </label>
        {actions}
      </div>

      <div className="relative rounded-lg border border-white/5 bg-black/20 focus-within:border-accent-gold/30">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setMenu(null), 120)}
          className="min-h-[7rem] max-h-[200px] w-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[var(--text)] outline-none [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5 [&_[data-token]]:align-middle"
        />
        {isEmpty && (
          <div className="pointer-events-none absolute left-2.5 top-2 font-mono text-[11px] leading-relaxed text-text-secondary/40">
            {placeholder ?? "Escreva o prompt. Digite @ para inserir uma referência…"}
          </div>
        )}
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-text-secondary/50">
        Digite <span className="text-accent-gold/70">@</span> para inserir uma
        referência (@Image1, @Image2…) como miniatura no texto.
      </p>

      {menu &&
        filtered.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] max-h-64 w-64 overflow-y-auto overflow-x-hidden rounded-lg border border-white/10 bg-[#141412] p-1 shadow-2xl"
            style={{ top: menu.top, left: menu.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtered.map((im, i) => (
              <button
                key={im.id}
                type="button"
                onClick={() => insertMention(im)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors ${
                  i === activeIdx ? "bg-accent-gold/10" : "hover:bg-white/5"
                }`}
              >
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-black/40">
                  {im.url.startsWith("http") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={im.url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`font-mono text-[10px] ${i === activeIdx ? "text-accent-gold" : "text-white"}`}
                    >
                      {im.label}
                    </span>
                    <span className="rounded-full border border-white/10 px-1 font-mono text-[8px] uppercase text-text-secondary">
                      {im.role}
                    </span>
                  </span>
                  {im.description && (
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-text-secondary">
                      {im.description}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Build an atomic, non-editable inline chip for an `@ImageN` token. */
function makeChip(token: string, image: ReferenceImage | null): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.token = token;
  span.contentEditable = "false";
  span.className =
    "mx-0.5 inline-flex items-center gap-1 rounded border border-accent-gold/40 bg-accent-gold/10 px-1 py-0.5 align-middle text-[10px] text-accent-gold";
  if (image?.url?.startsWith("http")) {
    const img = document.createElement("img");
    img.src = image.url;
    img.alt = "";
    img.draggable = false;
    img.className = "h-3.5 w-3.5 rounded-sm object-cover";
    span.appendChild(img);
  }
  const label = document.createElement("span");
  label.textContent = token.replace(/^@/, "");
  span.appendChild(label);
  return span;
}
