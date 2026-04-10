"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useRef, useEffect, useState } from "react";
import { PresetShowcaseScene } from "./preset-showcase-scene";

export function PresetShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScroll = containerRef.current.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / totalScroll));
      setProgress(p);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section ref={containerRef} id="presets" className="relative h-[300vh]">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <PresetShowcaseScene progress={progress} />
          </Suspense>
        </Canvas>

        <div className="pointer-events-none absolute inset-x-0 bottom-12 flex flex-col items-center">
          <p className="eyebrow">— Movimentos de câmera</p>
          <p className="mt-2 font-display text-3xl text-[var(--text)]">
            Seis formas de mostrar um espaço.
          </p>
        </div>
      </div>
    </section>
  );
}
