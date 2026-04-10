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

/* ─── Spiral params ─── */
const SPIRAL = {
  radius: 4,
  turns: 2.2,
  heightPerTurn: 3,
  bandWidth: 2.2,
  segments: 300,
  tiltX: 0.2,
  tiltZ: -0.15,
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

    const upX = 0;
    const upY = 1;
    const upZ = 0;

    const tangentX = -Math.sin(angle);
    const tangentZ = Math.cos(angle);

    const binormalX = upY * tangentZ - upZ * 0;
    const binormalY = upZ * tangentX - upX * tangentZ;
    const binormalZ = upX * 0 - upY * tangentX;
    const bLen = Math.sqrt(binormalX ** 2 + binormalY ** 2 + binormalZ ** 2) || 1;

    const halfBand = bandWidth / 2;

    positions.push(
      cx + (binormalX / bLen) * halfBand,
      y + halfBand,
      cz + (binormalZ / bLen) * halfBand,
    );
    positions.push(
      cx - (binormalX / bLen) * halfBand,
      y - halfBand,
      cz - (binormalZ / bLen) * halfBand,
    );

    uvs.push(t, 1);
    uvs.push(t, 0);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1);
      indices.push(base + 1, base + 2, base + 3);
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
    const cellW = 640;
    const cellH = 400;
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

    meshRef.current.rotation.y = t * Math.PI * 0.6;
    meshRef.current.rotation.x = SPIRAL.tiltX;
    meshRef.current.rotation.z = SPIRAL.tiltZ;

    const fadeEnd = 0.5;
    const opacity = t < 0.3 ? 1 : t > fadeEnd ? 0 : 1 - (t - 0.3) / (fadeEnd - 0.3);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;

    meshRef.current.position.y = -t * 2;
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

/*
  Cards: cascading diagonal on the left, staggered depths.
  Inspired by the "Fleeting moments" reference.
*/
const CARD_LAYOUT = [
  { x: -3.2, y: 2.0, z: -1.0, w: 2.0, h: 1.3, rot: 0.02 },
  { x: -1.8, y: 1.2, z: -0.3, w: 2.4, h: 1.5, rot: -0.01 },
  { x: -3.5, y: 0.3, z: -1.5, w: 1.8, h: 1.2, rot: 0.03 },
  { x: -2.0, y: -0.2, z: -0.6, w: 2.2, h: 1.4, rot: -0.02 },
  { x: -3.8, y: -1.0, z: -1.2, w: 1.6, h: 1.0, rot: 0.01 },
  { x: -2.2, y: -1.6, z: -0.4, w: 2.0, h: 1.3, rot: -0.03 },
  { x: -3.4, y: -2.4, z: -1.8, w: 2.4, h: 1.5, rot: 0.02 },
  { x: -1.6, y: -3.0, z: -0.8, w: 1.8, h: 1.2, rot: -0.01 },
  { x: -3.0, y: -3.6, z: -1.4, w: 2.0, h: 1.3, rot: 0.01 },
  { x: -2.4, y: -4.2, z: -0.5, w: 2.2, h: 1.4, rot: -0.02 },
  { x: -3.6, y: -4.8, z: -1.6, w: 1.6, h: 1.0, rot: 0.03 },
  { x: -1.8, y: -5.4, z: -1.0, w: 2.0, h: 1.3, rot: -0.01 },
];

function DiagonalCard({
  url,
  layout,
  index,
  progressRef,
}: {
  url: string;
  layout: (typeof CARD_LAYOUT)[number];
  index: number;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(url);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;

    const appearStart = 0.35 + index * 0.02;
    const appearEnd = appearStart + 0.2;

    if (t < appearStart) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const p = Math.min(1, (t - appearStart) / (appearEnd - appearStart));
    const ease = 1 - Math.pow(1 - p, 4);

    meshRef.current.position.x = THREE.MathUtils.lerp(layout.x + 2, layout.x, ease);
    meshRef.current.position.y = THREE.MathUtils.lerp(layout.y - 3, layout.y, ease);
    meshRef.current.position.z = THREE.MathUtils.lerp(layout.z - 4, layout.z, ease);
    meshRef.current.rotation.z = layout.rot * ease;

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = ease;
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
    progressRef.current += (progress - progressRef.current) * 0.06;
  });

  return (
    <group>
      <ambientLight intensity={1} />
      <SpiralStrip progressRef={progressRef} />
      <group position={[0, 0, 1]}>
        {IMAGES.map((url, i) => (
          <DiagonalCard
            key={url}
            url={url}
            layout={CARD_LAYOUT[i]!}
            index={i}
            progressRef={progressRef}
          />
        ))}
      </group>
    </group>
  );
}
