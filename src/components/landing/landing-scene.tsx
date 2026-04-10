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

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

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

const spiralVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spiralFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;

  // edge fade: start/end positions for each axis (0-1 UV space)
  uniform float uFadeLeftStart;
  uniform float uFadeLeftEnd;
  uniform float uFadeRightStart;
  uniform float uFadeRightEnd;
  uniform float uFadeTopStart;
  uniform float uFadeTopEnd;
  uniform float uFadeBottomStart;
  uniform float uFadeBottomEnd;

  // fade mode: 0 = alpha, 1 = color blend
  uniform float uFadeMode;
  uniform vec3 uFadeColor;

  // backside
  uniform float uShowBack;
  uniform vec3 uBackColorA;
  uniform vec3 uBackColorB;
  uniform float uBackGradientDir; // 0=horizontal, 1=vertical

  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uMap, vUv);

    float fadeL = smoothstep(uFadeLeftStart, uFadeLeftEnd, vUv.x);
    float fadeR = smoothstep(uFadeRightStart, uFadeRightEnd, 1.0 - vUv.x);
    float fadeT = smoothstep(uFadeTopStart, uFadeTopEnd, 1.0 - vUv.y);
    float fadeB = smoothstep(uFadeBottomStart, uFadeBottomEnd, vUv.y);
    float fade = fadeL * fadeR * fadeT * fadeB;

    vec3 frontColor;
    float frontAlpha;

    if (uFadeMode < 0.5) {
      // alpha mode
      frontColor = tex.rgb;
      frontAlpha = fade * uOpacity;
    } else {
      // color blend mode
      frontColor = mix(uFadeColor, tex.rgb, fade);
      frontAlpha = uOpacity;
    }

    if (gl_FrontFacing) {
      gl_FragColor = vec4(frontColor, frontAlpha);
    } else {
      float gradT = uBackGradientDir < 0.5 ? vUv.x : vUv.y;
      vec3 backCol = mix(uBackColorA, uBackColorB, gradT);
      // blend original texture with back gradient
      vec3 backFinal = mix(backCol, tex.rgb * backCol, 0.3);
      float backAlpha = uShowBack * fade * uOpacity * 0.7;
      gl_FragColor = vec4(backFinal, backAlpha);
    }
  }
`;

function SpiralStrip({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textures = useTexture(IMAGES);

  const shape = useControls("Spiral.Shape", {
    radius: { value: 4.0, step: 0.1 },
    turns: { value: 2.5, step: 0.1 },
    heightPerTurn: { value: 6.0, step: 0.1 },
    bandWidth: { value: 2.1, step: 0.1 },
    imageGap: { value: 0.0, step: 0.01 },
    imageGapPx: { value: 0, step: 2 },
    gapColor: { value: "#0D0D0B" },
  });

  const start = useControls("Spiral.Start", {
    posX: { value: 0, step: 0.1 },
    posY: { value: 0, step: 0.1 },
    posZ: { value: -2.5, step: 0.1 },
    rotX: { value: 0.02, step: 0.01 },
    rotY: { value: 0.3, step: 0.01 },
    rotZ: { value: 0.26, step: 0.01 },
    scale: { value: 1.0, step: 0.01 },
    opacity: { value: 1.0, step: 0.01 },
  });

  const end = useControls("Spiral.End", {
    posX: { value: 0, step: 0.1 },
    posY: { value: 6.0, step: 0.1 },
    posZ: { value: -2.5, step: 0.1 },
    rotX: { value: 0.5, step: 0.01 },
    rotY: { value: 0.8, step: 0.01 },
    rotZ: { value: 0.26, step: 0.01 },
    scale: { value: 1.0, step: 0.01 },
    opacity: { value: 0.0, step: 0.01 },
  });

  const mat = useControls("Spiral.Material", {
    uvScrollSpeed: { value: 0.015, step: 0.001 },
    fadeMode: { options: { alpha: 0, colorBlend: 1 } },
    fadeColor: { value: "#0D0D0B" },
    fadeLeftStart: { value: 0.0, step: 0.01 },
    fadeLeftEnd: { value: 0.08, step: 0.01 },
    fadeRightStart: { value: 0.0, step: 0.01 },
    fadeRightEnd: { value: 0.08, step: 0.01 },
    fadeTopStart: { value: 0.0, step: 0.01 },
    fadeTopEnd: { value: 0.15, step: 0.01 },
    fadeBottomStart: { value: 0.0, step: 0.01 },
    fadeBottomEnd: { value: 0.15, step: 0.01 },
    showBack: { value: true },
    backColorA: { value: "#0D0D0B" },
    backColorB: { value: "#1a1a18" },
    backGradientDir: { options: { horizontal: 0, vertical: 1 } },
  });

  const geometry = useMemo(
    () => createSpiralGeometry(shape.radius, shape.turns, shape.heightPerTurn, shape.bandWidth, 300, shape.imageGap),
    [shape.radius, shape.turns, shape.heightPerTurn, shape.bandWidth, shape.imageGap],
  );

  const atlasTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const cols = IMAGES.length;
    const cW = 512, cH = 320;
    const gap = Math.max(0, Math.round(shape.imageGapPx));
    canvas.width = cW * cols + gap * (cols - 1);
    canvas.height = cH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = shape.gapColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    textures.forEach((tex, i) => {
      if (tex.image) {
        const img = tex.image as HTMLImageElement;
        const sa = img.width / img.height, ca = cW / cH;
        let sw: number, sh: number, sx: number, sy: number;
        if (sa > ca) { sh = img.height; sw = sh * ca; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / ca; sx = 0; sy = (img.height - sh) / 2; }
        const dx = i * (cW + gap);
        ctx.drawImage(img, sx, sy, sw, sh, dx, 0, cW, cH);
      }
    });
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [textures, shape.imageGapPx, shape.gapColor]);

  const uniforms = useRef({
    uMap: { value: atlasTexture },
    uOpacity: { value: 1.0 },
    uFadeLeftStart: { value: 0.0 },
    uFadeLeftEnd: { value: 0.08 },
    uFadeRightStart: { value: 0.0 },
    uFadeRightEnd: { value: 0.08 },
    uFadeTopStart: { value: 0.0 },
    uFadeTopEnd: { value: 0.15 },
    uFadeBottomStart: { value: 0.0 },
    uFadeBottomEnd: { value: 0.15 },
    uFadeMode: { value: 0.0 },
    uFadeColor: { value: new THREE.Color("#0D0D0B") },
    uShowBack: { value: 1.0 },
    uBackColorA: { value: new THREE.Color("#0D0D0B") },
    uBackColorB: { value: new THREE.Color("#1a1a18") },
    uBackGradientDir: { value: 0.0 },
  });

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const p = progressRef.current;

    atlasTexture.offset.x += mat.uvScrollSpeed * delta;

    meshRef.current.position.set(
      mix(start.posX, end.posX, p),
      mix(start.posY, end.posY, p),
      mix(start.posZ, end.posZ, p),
    );
    meshRef.current.rotation.set(
      mix(start.rotX, end.rotX, p),
      mix(start.rotY, end.rotY, p),
      mix(start.rotZ, end.rotZ, p),
    );
    meshRef.current.scale.setScalar(mix(start.scale, end.scale, p));

    const u = uniforms.current;
    u.uOpacity.value = mix(start.opacity, end.opacity, p);
    u.uFadeMode.value = mat.fadeMode as number;
    u.uFadeColor.value.set(mat.fadeColor);
    u.uFadeLeftStart.value = mat.fadeLeftStart;
    u.uFadeLeftEnd.value = mat.fadeLeftEnd;
    u.uFadeRightStart.value = mat.fadeRightStart;
    u.uFadeRightEnd.value = mat.fadeRightEnd;
    u.uFadeTopStart.value = mat.fadeTopStart;
    u.uFadeTopEnd.value = mat.fadeTopEnd;
    u.uFadeBottomStart.value = mat.fadeBottomStart;
    u.uFadeBottomEnd.value = mat.fadeBottomEnd;
    u.uShowBack.value = mat.showBack ? 1.0 : 0.0;
    u.uBackColorA.value.set(mat.backColorA);
    u.uBackColorB.value.set(mat.backColorB);
    u.uBackGradientDir.value = mat.backGradientDir as number;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        vertexShader={spiralVert}
        fragmentShader={spiralFrag}
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
    columns: { value: 3, step: 1 },
    spreadX: { value: 2.4, step: 0.1 },
    spreadY: { value: 1.6, step: 0.1 },
    zigzagX: { value: 0.5, step: 0.1 },
    depthVar: { value: 1.2, step: 0.1 },
    cardW: { value: 2.8, step: 0.1 },
    cardH: { value: 1.75, step: 0.1 },
  });

  const transform = useControls("Cards.Transform", {
    offsetX: { value: -1.5, step: 0.1 },
    offsetY: { value: 0, step: 0.1 },
    offsetZ: { value: 0, step: 0.1 },
    rotX: { value: 0, step: 0.01 },
    rotY: { value: 0, step: 0.01 },
    rotZ: { value: 0, step: 0.01 },
  });

  const anim = useControls("Cards.Animation", {
    startAt: { value: 0.35, step: 0.01 },
    stagger: { value: 0.03, step: 0.005 },
    duration: { value: 0.25, step: 0.01 },
    entryX: { value: 3, step: 0.5 },
    entryY: { value: -5, step: 0.5 },
    entryZ: { value: -4, step: 0.5 },
  });

  const cols = Math.max(1, layout.columns);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const zigzag = row % 2 === 0 ? 0 : layout.zigzagX;
  const centerCol = (cols - 1) / 2;

  const baseX = (col - centerCol + zigzag) * layout.spreadX + transform.offsetX;
  const baseY = -row * layout.spreadY + transform.offsetY;
  const baseZ = -(col % 2) * layout.depthVar - row * 0.3 + transform.offsetZ;

  useFrame(() => {
    if (!meshRef.current) return;
    const t = progressRef.current;
    const s = anim.startAt + index * anim.stagger;
    const e = s + anim.duration;

    if (t < s) { meshRef.current.visible = false; return; }
    meshRef.current.visible = true;

    const raw = Math.min(1, (t - s) / (e - s));
    const ease = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;

    meshRef.current.position.x = mix(baseX + anim.entryX, baseX, ease);
    meshRef.current.position.y = mix(baseY + anim.entryY, baseY, ease);
    meshRef.current.position.z = mix(baseZ + anim.entryZ, baseZ, ease);
    meshRef.current.rotation.set(transform.rotX, transform.rotY, transform.rotZ);

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
