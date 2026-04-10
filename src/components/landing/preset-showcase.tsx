"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { ScrollControls } from "@react-three/drei";
import { PresetShowcaseScene } from "./preset-showcase-scene";

export function PresetShowcase() {
  return (
    <section id="presets" className="relative h-[400vh]">
      <div className="sticky top-0 h-screen w-full">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <ScrollControls pages={4} damping={0.3}>
              <PresetShowcaseScene />
            </ScrollControls>
          </Suspense>
        </Canvas>
      </div>
    </section>
  );
}
