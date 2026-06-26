"use client";

/**
 * Compact segmented toggle used across the editor inspectors (reference panel,
 * scene/transition generation options). Premium dark styling with the accent
 * gold active state, matching the rest of the editor chrome.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center rounded-lg border border-white/10 p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-md px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-all ${
              active
                ? "bg-accent-gold/15 text-accent-gold"
                : "text-text-secondary hover:text-white"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
