"use client";

import { Leva } from "leva";
import { useEffect, useState } from "react";

export function LevaToggle() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "M") {
        setHidden((h) => !h);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return <Leva hidden={hidden} collapsed />;
}
