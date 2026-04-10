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

/* ─── Spiral: backdrop behind hero text ─── */
const SPIRAL = {
  radius: 4.5,
  turns: 2.5,
  heightPerTurn: 2.8,
  bandWidth: 2.0,
  segments: 300,
};

function createSpiralGeometry(params: typeof SPIRAL) {
  const { radius, turns, heightPerTurn, bandWidth, segments } = params;
  const totalAngle = turns * Math.PI * 2;
  const totalHeight = turns * heightPerTurn;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * totalAngle;
    const y = t * totalHeight - totalHeight / 2;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const halfBand = bandWidth / 2;

    positions.push(cx, y + halfBand, cz);
    positions.push(cx, y - halfBand, cz);
    uvs.push(t, 1);
    uvs.push(t, 0);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1);
      indices.push(base + 1, base + 2, base + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function SpiralStrip({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textures = useTexture(IMAGES);
  const geometry = useMemo(() => createSpiralGeometry(SPIRAL), []);

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
        const srcAspect = img.width / img.height;
        const cellAspect = cellW / cellH;
        let sw: number, sh: number, sx: number, sy: number;
        if (srcAspect > cellAspect) {
          sh = img.height; sw = sh * cellAspect;
          sx = (img.width - sw) / 2; sy = 0;
        } else {
          sw = img.width; sh = sw / cellAspect;
          sx = 0; sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, i * cellW, 0, cellW, cellH);
      }
    });
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [textures]);

  useFrame(() => {
    if (!meshRef.current) return;
    const p = progressRef.current;

    meshRef.current.rotation.y = p * Math.PI * 0.5 + 0.3;
    meshRef.current.rotation.x = 0.15;
    meshRef.current.rotation.z = -0.08;

    const opacity = p < 0.2 ? 0.6 : p > 0.35 ? 0 : 0.6 * (1 - (p - 0.2) / 0.15);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, 0, -6]}>
      <meshBasicMaterial
        map={atlasTexture}
        side={THREE.DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

/* ─── Cards: diagonal cascade, left side ─── */
const CARDS = [
  { x: -3.8, y: 2.8, z: -2.0, w: 2.2, h: 1.4 },
  { x: -2.0, y: 1.8, z: -0.8, w: 2.6, h: 1.6 },
  { x: -3.4, y: 0.6, z: -1.6, w: 2.0, h: 1.3 },
  { x: -1.4, y: 0.0, z: -0.4, w: 2.4, h: 1.5 },
  { x: -3.6, y: -1.0, z: -2.2, w: 1.8, h: 1.2 },
  { x: -1.8, y: -1.8, z: -1.0, w: 2.2, h: 1.4 },
  { x: -3.2, y: -2.8, z: -1.8, w: 2.6, h: 1.6 },
];

function Card({
  url,
  layout,
  index,
  progressRef,
}: {
  url: string;
  layout: (typeof CARDS)[number];
  index: number;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(url);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;

    const start = 0.4 + index * 0.04;
    const end = start + 0.25;

    if (t < start) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const raw = Math.min(1, (t - start) / (end - start));
    const ease = raw < 0.5
      ? 4 * raw * raw * raw
      : 1 - Math.pow(-2 * raw + 2, 3) / 2;

    meshRef.current.position.x = THREE.MathUtils.lerp(layout.x + 1, layout.x, ease);
    meshRef.current.position.y = THREE.MathUtils.lerp(layout.y - 4, layout.y, ease);
    meshRef.current.position.z = THREE.MathUtils.lerp(layout.z - 3, layout.z, ease);

    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = ease;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <planeGeometry args={[layout.w, layout.h]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  );
}

export function LandingScene({ progress }: { progress: number }) {
  const progressRef = useRef(progress);

  useFrame(() => {
    progressRef.current += (progress - progressRef.current) * 0.05;
  });

  return (
    <group>
      <ambientLight intensity={1} />
      <SpiralStrip progressRef={progressRef} />
      {CARDS.map((layout, i) => (
        <Card
          key={IMAGES[i]}
          url={IMAGES[i]!}
          layout={layout}
          index={i}
          progressRef={progressRef}
        />
      ))}
    </group>
  );
}
