"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
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

function FilmStrip({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textures = useTexture(IMAGES);

  const atlasTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const cols = IMAGES.length;
    const cellW = 512;
    const cellH = 320;
    canvas.width = cellW * cols;
    canvas.height = cellH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0D0D0B";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    textures.forEach((tex, i) => {
      if (tex.image) {
        const img = tex.image as HTMLImageElement;
        const aspect = img.width / img.height;
        const cellAspect = cellW / cellH;
        let sw: number, sh: number, sx: number, sy: number;
        if (aspect > cellAspect) {
          sh = img.height;
          sw = sh * cellAspect;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          sw = img.width;
          sh = sw / cellAspect;
          sx = 0;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, i * cellW, 0, cellW, cellH);
      }
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [textures]);

  const radius = 5;
  const height = 2.8;
  const segments = 64;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;

    const baseRotation = Math.PI * 0.1;
    const scrollRotation = t * Math.PI * 1.5;
    meshRef.current.rotation.y = baseRotation + scrollRotation;

    const fadeStart = 0.35;
    const fadeEnd = 0.55;
    const opacity = t < fadeStart ? 1 : t > fadeEnd ? 0 : 1 - (t - fadeStart) / (fadeEnd - fadeStart);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;

    meshRef.current.position.y = THREE.MathUtils.lerp(0, -2, Math.min(t * 2, 1));
    const scale = THREE.MathUtils.lerp(1, 0.7, Math.min(t * 2, 1));
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <cylinderGeometry args={[radius, radius, height, segments, 1, true, 0, Math.PI * 1.2]} />
      <meshBasicMaterial
        map={atlasTexture}
        side={THREE.BackSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

function FloatingCard({
  url,
  index,
  progressRef,
}: {
  url: string;
  index: number;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(url);

  const col = index % 4;
  const row = Math.floor(index / 4);
  const baseX = (col - 1.5) * 2.2 + (row % 2 === 0 ? 0 : 1.1);
  const baseY = (1 - row) * 1.8;
  const baseZ = -row * 0.8 + (Math.random() - 0.5) * 0.4;
  const rotZ = (Math.random() - 0.5) * 0.08;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;

    const appearStart = 0.4;
    const appearEnd = 0.65;

    if (t < appearStart) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const p = Math.min(1, (t - appearStart) / (appearEnd - appearStart));
    const ease = 1 - Math.pow(1 - p, 3);

    meshRef.current.position.x = THREE.MathUtils.lerp(0, baseX, ease);
    meshRef.current.position.y = THREE.MathUtils.lerp(-3, baseY, ease);
    meshRef.current.position.z = THREE.MathUtils.lerp(-5, baseZ, ease);
    meshRef.current.rotation.z = rotZ * ease;

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = ease;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <planeGeometry args={[1.8, 1.15]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  );
}

export function LandingScene({ progress }: { progress: number }) {
  const progressRef = useRef(progress);

  useFrame(() => {
    progressRef.current += (progress - progressRef.current) * 0.06;
  });

  return (
    <group>
      <ambientLight intensity={1} />
      <FilmStrip progressRef={progressRef} />
      {IMAGES.map((url, i) => (
        <FloatingCard
          key={url}
          url={url}
          index={i}
          progressRef={progressRef}
        />
      ))}
    </group>
  );
}
