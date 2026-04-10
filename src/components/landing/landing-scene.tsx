"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useControls } from "leva";
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

function createSpiralGeometry(
  radius: number,
  turns: number,
  heightPerTurn: number,
  bandWidth: number,
  segments: number,
) {
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
    const half = bandWidth / 2;

    positions.push(cx, y + half, cz);
    positions.push(cx, y - half, cz);
    uvs.push(t, 1);
    uvs.push(t, 0);

    if (i < segments) {
      const b = i * 2;
      indices.push(b, b + 2, b + 1);
      indices.push(b + 1, b + 2, b + 3);
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

  const spiral = useControls("Spiral", {
    radius: { value: 4.5, min: 2, max: 8, step: 0.1 },
    turns: { value: 2.0, min: 0.5, max: 4, step: 0.1 },
    heightPerTurn: { value: 3.2, min: 1, max: 6, step: 0.1 },
    bandWidth: { value: 2.2, min: 0.5, max: 4, step: 0.1 },
    tiltX: { value: 0.18, min: -1, max: 1, step: 0.01 },
    tiltZ: { value: -0.08, min: -1, max: 1, step: 0.01 },
    posZ: { value: -5, min: -12, max: 0, step: 0.5 },
    scrollSpeed: { value: 0.5, min: 0, max: 2, step: 0.05 },
    uvScrollSpeed: { value: 0.02, min: 0, max: 0.1, step: 0.002 },
    exitRotX: { value: 0.8, min: 0, max: 2, step: 0.05 },
    exitUpSpeed: { value: 6, min: 0, max: 15, step: 0.5 },
  });

  const geometry = useMemo(
    () => createSpiralGeometry(spiral.radius, spiral.turns, spiral.heightPerTurn, spiral.bandWidth, 300),
    [spiral.radius, spiral.turns, spiral.heightPerTurn, spiral.bandWidth],
  );

  const atlasTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const cols = IMAGES.length;
    const cW = 512, cH = 320;
    canvas.width = cW * cols;
    canvas.height = cH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0D0D0B";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    textures.forEach((tex, i) => {
      if (tex.image) {
        const img = tex.image as HTMLImageElement;
        const sa = img.width / img.height, ca = cW / cH;
        let sw: number, sh: number, sx: number, sy: number;
        if (sa > ca) { sh = img.height; sw = sh * ca; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / ca; sx = 0; sy = (img.height - sh) / 2; }
        ctx.drawImage(img, sx, sy, sw, sh, i * cW, 0, cW, cH);
      }
    });
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [textures]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const p = progressRef.current;

    atlasTexture.offset.x += spiral.uvScrollSpeed * delta * 10;

    meshRef.current.rotation.y = p * Math.PI * spiral.scrollSpeed + 0.3;
    meshRef.current.rotation.x = spiral.tiltX + p * spiral.exitRotX;
    meshRef.current.rotation.z = spiral.tiltZ;

    meshRef.current.position.y = p * spiral.exitUpSpeed;
    meshRef.current.position.z = spiral.posZ;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        map={atlasTexture}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

function Card({
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

  const cards = useControls("Cards", {
    scale: { value: 1.4, min: 0.5, max: 3, step: 0.1 },
    spreadX: { value: 2.4, min: 1, max: 5, step: 0.1 },
    spreadY: { value: 1.6, min: 0.5, max: 4, step: 0.1 },
    offsetX: { value: -1.5, min: -5, max: 5, step: 0.1 },
    depth: { value: 1.2, min: 0, max: 4, step: 0.1 },
    stagger: { value: 0.03, min: 0, max: 0.1, step: 0.005 },
    startAt: { value: 0.35, min: 0, max: 0.8, step: 0.05 },
  });

  const col = index % 3;
  const row = Math.floor(index / 3);
  const zigzag = row % 2 === 0 ? 0 : 1;

  const baseX = (col - 1 + zigzag * 0.5) * cards.spreadX + cards.offsetX;
  const baseY = (2 - row) * cards.spreadY;
  const baseZ = -(col % 2) * cards.depth - row * 0.3;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;
    const start = cards.startAt + index * cards.stagger;
    const end = start + 0.25;

    if (t < start) { meshRef.current.visible = false; return; }
    meshRef.current.visible = true;

    const raw = Math.min(1, (t - start) / (end - start));
    const ease = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;

    meshRef.current.position.x = THREE.MathUtils.lerp(baseX + 3, baseX, ease);
    meshRef.current.position.y = THREE.MathUtils.lerp(baseY - 5, baseY, ease);
    meshRef.current.position.z = THREE.MathUtils.lerp(baseZ - 4, baseZ, ease);

    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = ease;
  });

  const w = 2.0 * cards.scale;
  const h = 1.25 * cards.scale;

  return (
    <mesh ref={meshRef} visible={false}>
      <planeGeometry args={[w, h]} />
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
      {IMAGES.slice(0, 9).map((url, i) => (
        <Card key={url} url={url} index={i} progressRef={progressRef} />
      ))}
    </group>
  );
}
