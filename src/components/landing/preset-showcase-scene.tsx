"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll, useTexture, Html } from "@react-three/drei";
import * as THREE from "three";

const IMAGES = [
  "/mock/Park_Avenue_1.png",
  "/mock/Park_Avenue_3.png",
  "/mock/Park_Avenue_5.png",
  "/mock/Park_Avenue_8.png",
  "/mock/Park_Avenue_12.png",
  "/mock/Park_Avenue_15.png",
  "/mock/Park_Avenue_20.png",
  "/mock/Park_Avenue_25.png",
  "/mock/Park_Avenue_30.png",
  "/mock/Park_Avenue_35.png",
  "/mock/Park_Avenue_40.png",
  "/mock/Park_Avenue_45.png",
];

const PRESETS = [
  { name: "Dolly In", subtitle: "Câmera avança suavemente" },
  { name: "Orbit", subtitle: "Gira ao redor do espaço" },
  { name: "Ken Burns", subtitle: "Zoom lento + pan lateral" },
  { name: "Reveal", subtitle: "Descobre o ambiente" },
  { name: "Float Up", subtitle: "Sobe como um drone" },
  { name: "Cinematic Pan", subtitle: "Pan horizontal" },
];

function ImageCard({
  url,
  index,
  total,
  scrollProgress,
}: {
  url: string;
  index: number;
  total: number;
  scrollProgress: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(url);

  const cardWidth = 1.6;
  const cardHeight = 1.0;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = scrollProgress.current;

    const cols = 4;
    const row = Math.floor(index / cols);
    const col = index % cols;

    const gridX = (col - (cols - 1) / 2) * (cardWidth + 0.3);
    const gridY = (1 - row) * (cardHeight + 0.3);
    const gridZ = -row * 0.5;

    const angle = (index / total) * Math.PI * 2;
    const radius = 3.5;
    const cylX = Math.sin(angle) * radius;
    const cylZ = Math.cos(angle) * radius - radius;
    const cylY = 0;

    const spiralAngle = (index / total) * Math.PI * 4;
    const spiralRadius = 2 + (index / total) * 2;
    const spiralX = Math.sin(spiralAngle) * spiralRadius;
    const spiralZ = Math.cos(spiralAngle) * spiralRadius - spiralRadius;
    const spiralY = ((index / total) - 0.5) * 4;

    let targetX: number, targetY: number, targetZ: number;
    let rotY = 0;

    if (t < 0.33) {
      const p = t / 0.33;
      targetX = gridX;
      targetY = gridY;
      targetZ = gridZ + p * -1;
      rotY = 0;
    } else if (t < 0.66) {
      const p = (t - 0.33) / 0.33;
      targetX = THREE.MathUtils.lerp(gridX, cylX, p);
      targetY = THREE.MathUtils.lerp(gridY, cylY, p);
      targetZ = THREE.MathUtils.lerp(gridZ - 1, cylZ, p);
      rotY = THREE.MathUtils.lerp(0, -angle, p);
    } else {
      const p = (t - 0.66) / 0.34;
      targetX = THREE.MathUtils.lerp(cylX, spiralX, p);
      targetY = THREE.MathUtils.lerp(cylY, spiralY, p);
      targetZ = THREE.MathUtils.lerp(cylZ, spiralZ, p);
      rotY = THREE.MathUtils.lerp(-angle, -spiralAngle, p);
    }

    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.08);
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.08);
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.08);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, rotY, 0.08);
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[cardWidth, cardHeight]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

export function PresetShowcaseScene() {
  const scroll = useScroll();
  const scrollProgress = useRef(0);

  const currentPresetIndex = useRef(0);

  useFrame(() => {
    scrollProgress.current = scroll.offset;
    currentPresetIndex.current = Math.min(
      Math.floor(scroll.offset * PRESETS.length),
      PRESETS.length - 1,
    );
  });

  return (
    <group>
      <ambientLight intensity={1} />

      {IMAGES.map((url, i) => (
        <ImageCard
          key={url}
          url={url}
          index={i}
          total={IMAGES.length}
          scrollProgress={scrollProgress}
        />
      ))}

      <PresetLabels scrollProgress={scrollProgress} />
    </group>
  );
}

function PresetLabels({
  scrollProgress,
}: {
  scrollProgress: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const activeIndex = useRef(0);

  useFrame(() => {
    activeIndex.current = Math.min(
      Math.floor(scrollProgress.current * PRESETS.length),
      PRESETS.length - 1,
    );
  });

  return (
    <group ref={groupRef}>
      <Html
        center
        position={[0, -2.5, 0]}
        style={{ pointerEvents: "none", width: "400px" }}
      >
        <PresetLabel />
      </Html>
    </group>
  );
}

function PresetLabel() {
  return (
    <div className="text-center">
      <p className="eyebrow">— Movimentos de câmera</p>
      <p className="mt-2 font-display text-3xl text-[var(--text)]">
        Seis formas de mostrar um espaço.
      </p>
    </div>
  );
}
