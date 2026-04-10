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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ─── Spiral geometry ─── */
function createSpiralGeometry(
  radius: number, turns: number, hpt: number,
  bandWidth: number, segs: number, imageGap: number,
) {
  const totalAngle = turns * Math.PI * 2;
  const totalHeight = turns * hpt;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const angle = t * totalAngle;
    const y = t * totalHeight - totalHeight / 2;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const half = (bandWidth - imageGap) / 2;

    pos.push(cx, y + half, cz);
    pos.push(cx, y - half, cz);
    uvs.push(t, 1);
    uvs.push(t, 0);

    if (i < segs) {
      const b = i * 2;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ─── Spiral shader with edge fade ─── */
const spiralVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spiralFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uEdgeFadeX;
  uniform float uEdgeFadeY;
  uniform vec3 uBackColor;
  uniform float uShowBack;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uMap, vUv);

    float fadeX = smoothstep(0.0, uEdgeFadeX, vUv.x) * smoothstep(0.0, uEdgeFadeX, 1.0 - vUv.x);
    float fadeY = smoothstep(0.0, uEdgeFadeY, vUv.y) * smoothstep(0.0, uEdgeFadeY, 1.0 - vUv.y);
    float fade = fadeX * fadeY;

    vec3 color = gl_FrontFacing ? tex.rgb : uBackColor;
    float alpha = gl_FrontFacing ? fade * uOpacity : uShowBack * fade * uOpacity * 0.6;

    gl_FragColor = vec4(color, alpha);
  }
`;

function SpiralStrip({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textures = useTexture(IMAGES);

  const shape = useControls("Spiral.Shape", {
    radius: { value: 4.0, min: 1, max: 10, step: 0.1 },
    turns: { value: 2.5, min: 0.5, max: 5, step: 0.1 },
    heightPerTurn: { value: 6.0, min: 1, max: 10, step: 0.1 },
    bandWidth: { value: 2.1, min: 0.5, max: 5, step: 0.1 },
    imageGap: { value: 0.0, min: 0, max: 1, step: 0.05 },
  });

  const transformStart = useControls("Spiral.Start", {
    posX: { value: 0, min: -10, max: 10, step: 0.1 },
    posY: { value: 0, min: -10, max: 10, step: 0.1 },
    posZ: { value: -2.5, min: -15, max: 5, step: 0.1 },
    rotX: { value: 0.02, min: -3.14, max: 3.14, step: 0.01 },
    rotY: { value: 0.3, min: -3.14, max: 3.14, step: 0.01 },
    rotZ: { value: 0.26, min: -3.14, max: 3.14, step: 0.01 },
    scale: { value: 1.0, min: 0.1, max: 3, step: 0.05 },
    opacity: { value: 1.0, min: 0, max: 1, step: 0.05 },
  });

  const transformEnd = useControls("Spiral.End", {
    posX: { value: 0, min: -10, max: 10, step: 0.1 },
    posY: { value: 6.0, min: -10, max: 20, step: 0.1 },
    posZ: { value: -2.5, min: -15, max: 5, step: 0.1 },
    rotX: { value: 0.5, min: -3.14, max: 3.14, step: 0.01 },
    rotY: { value: 0.8, min: -3.14, max: 3.14, step: 0.01 },
    rotZ: { value: 0.26, min: -3.14, max: 3.14, step: 0.01 },
    scale: { value: 1.0, min: 0.1, max: 3, step: 0.05 },
    opacity: { value: 0.0, min: 0, max: 1, step: 0.05 },
  });

  const material = useControls("Spiral.Material", {
    edgeFadeX: { value: 0.08, min: 0, max: 0.5, step: 0.01 },
    edgeFadeY: { value: 0.15, min: 0, max: 0.5, step: 0.01 },
    showBack: { value: true },
    backColor: { value: "#0D0D0B" },
    uvScrollSpeed: { value: 0.0, min: -0.1, max: 0.1, step: 0.002 },
  });

  const geometry = useMemo(
    () => createSpiralGeometry(shape.radius, shape.turns, shape.heightPerTurn, shape.bandWidth, 300, shape.imageGap),
    [shape.radius, shape.turns, shape.heightPerTurn, shape.bandWidth, shape.imageGap],
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

  const uniforms = useRef({
    uMap: { value: atlasTexture },
    uOpacity: { value: 1.0 },
    uEdgeFadeX: { value: 0.08 },
    uEdgeFadeY: { value: 0.15 },
    uBackColor: { value: new THREE.Color("#0D0D0B") },
    uShowBack: { value: 1.0 },
  });

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const p = progressRef.current;

    atlasTexture.offset.x += material.uvScrollSpeed * delta * 10;

    meshRef.current.position.set(
      lerp(transformStart.posX, transformEnd.posX, p),
      lerp(transformStart.posY, transformEnd.posY, p),
      lerp(transformStart.posZ, transformEnd.posZ, p),
    );
    meshRef.current.rotation.set(
      lerp(transformStart.rotX, transformEnd.rotX, p),
      lerp(transformStart.rotY, transformEnd.rotY, p),
      lerp(transformStart.rotZ, transformEnd.rotZ, p),
    );
    const s = lerp(transformStart.scale, transformEnd.scale, p);
    meshRef.current.scale.setScalar(s);

    const u = uniforms.current;
    u.uOpacity.value = lerp(transformStart.opacity, transformEnd.opacity, p);
    u.uEdgeFadeX.value = material.edgeFadeX;
    u.uEdgeFadeY.value = material.edgeFadeY;
    u.uBackColor.value.set(material.backColor);
    u.uShowBack.value = material.showBack ? 1.0 : 0.0;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        vertexShader={spiralVertexShader}
        fragmentShader={spiralFragmentShader}
        uniforms={uniforms.current}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ─── Cards ─── */
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

  const layout = useControls("Cards.Layout", {
    columns: { value: 3, min: 1, max: 5, step: 1 },
    spreadX: { value: 2.4, min: 0.5, max: 6, step: 0.1 },
    spreadY: { value: 1.6, min: 0.5, max: 5, step: 0.1 },
    zigzagX: { value: 0.5, min: 0, max: 2, step: 0.1 },
    depthVar: { value: 1.2, min: 0, max: 5, step: 0.1 },
    cardW: { value: 2.8, min: 0.5, max: 5, step: 0.1 },
    cardH: { value: 1.75, min: 0.5, max: 4, step: 0.1 },
  });

  const transform = useControls("Cards.Transform", {
    offsetX: { value: -1.5, min: -8, max: 8, step: 0.1 },
    offsetY: { value: 0, min: -5, max: 5, step: 0.1 },
    offsetZ: { value: 0, min: -5, max: 5, step: 0.1 },
    rotX: { value: 0, min: -1, max: 1, step: 0.01 },
    rotY: { value: 0, min: -1, max: 1, step: 0.01 },
  });

  const anim = useControls("Cards.Animation", {
    startAt: { value: 0.35, min: 0, max: 0.9, step: 0.01 },
    stagger: { value: 0.03, min: 0, max: 0.1, step: 0.005 },
    duration: { value: 0.25, min: 0.05, max: 0.5, step: 0.01 },
    entryOffsetX: { value: 3, min: -5, max: 10, step: 0.5 },
    entryOffsetY: { value: -5, min: -10, max: 5, step: 0.5 },
    entryOffsetZ: { value: -4, min: -10, max: 0, step: 0.5 },
  });

  const col = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  const zigzag = row % 2 === 0 ? 0 : layout.zigzagX;
  const centerCol = (layout.columns - 1) / 2;

  const baseX = (col - centerCol + zigzag) * layout.spreadX + transform.offsetX;
  const baseY = -row * layout.spreadY + transform.offsetY;
  const baseZ = -(col % 2) * layout.depthVar - row * 0.3 + transform.offsetZ;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;
    const start = anim.startAt + index * anim.stagger;
    const end = start + anim.duration;

    if (t < start) { meshRef.current.visible = false; return; }
    meshRef.current.visible = true;

    const raw = Math.min(1, (t - start) / (end - start));
    const ease = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;

    meshRef.current.position.x = lerp(baseX + anim.entryOffsetX, baseX, ease);
    meshRef.current.position.y = lerp(baseY + anim.entryOffsetY, baseY, ease);
    meshRef.current.position.z = lerp(baseZ + anim.entryOffsetZ, baseZ, ease);
    meshRef.current.rotation.x = transform.rotX;
    meshRef.current.rotation.y = transform.rotY;

    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = ease;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <planeGeometry args={[layout.cardW, layout.cardH]} />
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
