"use client";

import { useState } from "react";

export function ModelToggle({
  modelId,
  initialActive,
}: {
  modelId: string;
  initialActive: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = !active;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/models/${modelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (res.ok) {
        setActive(next);
      } else {
        console.error("[ModelToggle] failed:", await res.text());
      }
    } catch (err) {
      console.error("[ModelToggle]", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        active ? "bg-green-500/30" : "bg-white/10"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
          active
            ? "translate-x-4 bg-green-400"
            : "translate-x-0.5 bg-white/30"
        }`}
      />
    </button>
  );
}
