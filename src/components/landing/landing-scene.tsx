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

/* ─── Tweakable parameters ─── */
const SPIRAL = {
  radius: 3.2,
  turns: 2.5,
  heightPerTurn: 2.4,
  bandWidth: 1.6,
  segments: 256,
  tiltX: 0.15,
  tiltZ: -0.1,
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

    const tangentX = -Math.sin(angle);
    const tangentZ = Math.cos(angle);
    const len = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ);
    const nx = tangentX / len;
    const nz = tangentZ / len;

    const halfBand = bandWidth / 2;
    positions.push(cx - nz * halfBand, y - halfBand * 0.15, cz + nx * halfBand);
    positions.push(cx + nz * halfBand, y + halfBand * 0.15, cz - nx * halfBand);

    uvs.push(t, 0);
    uvs.push(t, 1);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
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

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;

    meshRef.current.rotation.y = t * Math.PI * 0.8;
    meshRef.current.rotation.x = SPIRAL.tiltX;
    meshRef.current.rotation.z = SPIRAL.tiltZ;

    const fadeStart = 0.4;
    const fadeEnd = 0.6;
    const opacity = t < fadeStart ? 1 : t > fadeEnd ? 0 : 1 - (t - fadeStart) / (fadeEnd - fadeStart);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;

    meshRef.current.position.y = THREE.MathUtils.lerp(0, -1.5, Math.min(t * 1.5, 1));
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        map={atlasTexture}
        side={THREE.DoubleSide}
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
  const baseZ = -row * 0.8 + ((index * 7) % 5 - 2) * 0.15;
  const rotZ = ((index * 13) % 7 - 3) * 0.02;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;

    const appearStart = 0.45;
    const appearEnd = 0.7;

    if (t < appearStart) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const p = Math.min(1, (t - appearStart) / (appearEnd - appearStart));
    const ease = 1 - Math.pow(1 - p, 3);

    meshRef.current.position.x = THREE.MathUtils.lerp(0, baseX, ease);
    meshRef.current.position.y = THREE.MathUtils.lerp(-4, baseY, ease);
    meshRef.current.position.z = THREE.MathUtils.lerp(-6, baseZ, ease);
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
      <SpiralStrip progressRef={progressRef} />
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
