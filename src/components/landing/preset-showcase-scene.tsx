"use client";

import { useRef } from "react";
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

function ImageCard({
  url,
  index,
  total,
  progressRef,
}: {
  url: string;
  index: number;
  total: number;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(url);

  const cardW = 1.6;
  const cardH = 1.0;
  const cols = 4;
  const row = Math.floor(index / cols);
  const col = index % cols;

  const gridX = (col - (cols - 1) / 2) * (cardW + 0.3);
  const gridY = (1 - row) * (cardH + 0.3);
  const gridZ = -row * 0.6;

  const angle = (index / total) * Math.PI * 2;
  const cylR = 3.5;
  const cylX = Math.sin(angle) * cylR;
  const cylZ = Math.cos(angle) * cylR - cylR;

  const spiralAngle = (index / total) * Math.PI * 4;
  const spiralR = 2 + (index / total) * 2;
  const spiralX = Math.sin(spiralAngle) * spiralR;
  const spiralZ = Math.cos(spiralAngle) * spiralR - spiralR;
  const spiralY = ((index / total) - 0.5) * 4;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;

    let targetX: number, targetY: number, targetZ: number, rotY: number;

    if (t < 0.33) {
      const p = t / 0.33;
      targetX = gridX;
      targetY = gridY;
      targetZ = gridZ - p * 1.5;
      rotY = 0;
    } else if (t < 0.66) {
      const p = (t - 0.33) / 0.33;
      targetX = THREE.MathUtils.lerp(gridX, cylX, p);
      targetY = THREE.MathUtils.lerp(gridY, 0, p);
      targetZ = THREE.MathUtils.lerp(gridZ - 1.5, cylZ, p);
      rotY = THREE.MathUtils.lerp(0, -angle, p);
    } else {
      const p = (t - 0.66) / 0.34;
      targetX = THREE.MathUtils.lerp(cylX, spiralX, p);
      targetY = THREE.MathUtils.lerp(0, spiralY, p);
      targetZ = THREE.MathUtils.lerp(cylZ, spiralZ, p);
      rotY = THREE.MathUtils.lerp(-angle, -spiralAngle, p);
    }

    meshRef.current.position.x += (targetX - meshRef.current.position.x) * 0.1;
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.1;
    meshRef.current.position.z += (targetZ - meshRef.current.position.z) * 0.1;
    meshRef.current.rotation.y += (rotY - meshRef.current.rotation.y) * 0.1;
  });

  return (
    <mesh ref={meshRef} position={[gridX, gridY, gridZ]}>
      <planeGeometry args={[cardW, cardH]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

export function PresetShowcaseScene({ progress }: { progress: number }) {
  const progressRef = useRef(progress);

  useFrame(() => {
    progressRef.current += (progress - progressRef.current) * 0.08;
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
          progressRef={progressRef}
        />
      ))}
    </group>
  );
}
