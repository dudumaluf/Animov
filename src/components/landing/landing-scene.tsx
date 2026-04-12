"use client";

import { useRef, useMemo, useEffect } from "react";
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

/*
  Ribbon geometry extruded along a CatmullRomCurve3.
  Twist = rotation of the band around the tangent at each point.
*/
function createRibbonGeometry(
  points: THREE.Vector3[],
  bandWidth: number,
  segments: number,
  twistStart: number,
  twistEnd: number,
  twistCenter: number,
  closed: boolean,
) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.5);
  const frenetFrames = curve.computeFrenetFrames(segments, closed);

  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const normal = frenetFrames.normals[i]!;
    const binormal = frenetFrames.binormals[i]!;

    const twistT = t < 0.5
      ? mix(twistStart, twistCenter, t * 2)
      : mix(twistCenter, twistEnd, (t - 0.5) * 2);

    const cosT = Math.cos(twistT);
    const sinT = Math.sin(twistT);
    const rotNormalX = normal.x * cosT + binormal.x * sinT;
    const rotNormalY = normal.y * cosT + binormal.y * sinT;
    const rotNormalZ = normal.z * cosT + binormal.z * sinT;

    const half = bandWidth / 2;

    pos.push(
      point.x + rotNormalX * half,
      point.y + rotNormalY * half,
      point.z + rotNormalZ * half,
    );
    pos.push(
      point.x - rotNormalX * half,
      point.y - rotNormalY * half,
      point.z - rotNormalZ * half,
    );

    uvs.push(t, 1);
    uvs.push(t, 0);

    if (i < segments) {
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

/*
  Spiral geometry: helix path, same UV/face winding as ribbon.
*/
function createSpiralGeometry(
  radius: number, turns: number, hpt: number,
  bandWidth: number, segments: number,
  twistStart: number, twistEnd: number, twistCenter: number,
  closed: boolean,
) {
  const totalAngle = turns * Math.PI * 2;
  const totalHeight = turns * hpt;

  const curvePoints: THREE.Vector3[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * totalAngle;
    const y = t * totalHeight - totalHeight / 2;
    curvePoints.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
  }

  return createRibbonGeometry(curvePoints, bandWidth, segments, twistStart, twistEnd, twistCenter, closed);
}

const ribbonVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ribbonFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uUvOffsetX;

  // front: color blend to bg (no alpha change)
  uniform vec3 uBgColor;
  uniform float uFadeLeftStart;
  uniform float uFadeLeftEnd;
  uniform float uFadeRightStart;
  uniform float uFadeRightEnd;
  uniform float uFadeTopStart;
  uniform float uFadeTopEnd;
  uniform float uFadeBottomStart;
  uniform float uFadeBottomEnd;

  // back
  uniform float uShowBack;
  uniform float uBackMode;       // 0=gradient, 1=photo, 2=photoDark
  uniform vec3 uBackEdgeColor;
  uniform vec3 uBackCenterColor;
  uniform float uBackGradientDir;
  uniform float uBackDarken;     // 0.0–1.0 how much to darken back photos

  varying vec2 vUv;

  void main() {
    vec2 scrolledUv = vec2(fract(vUv.x + uUvOffsetX), vUv.y);
    vec4 tex = texture2D(uMap, scrolledUv);

    float fadeL = smoothstep(uFadeLeftStart, uFadeLeftEnd, vUv.x);
    float fadeR = smoothstep(uFadeRightStart, uFadeRightEnd, 1.0 - vUv.x);
    float fadeT = smoothstep(uFadeTopStart, uFadeTopEnd, 1.0 - vUv.y);
    float fadeB = smoothstep(uFadeBottomStart, uFadeBottomEnd, vUv.y);
    float fade = fadeL * fadeR * fadeT * fadeB;

    if (gl_FrontFacing) {
      vec3 color = mix(uBgColor, tex.rgb, fade);
      gl_FragColor = vec4(color, uOpacity);
    } else {
      vec3 backCol;
      if (uBackMode < 0.5) {
        float gradT = uBackGradientDir < 0.5 ? vUv.x : vUv.y;
        float centerMix = 1.0 - abs(gradT - 0.5) * 2.0;
        backCol = mix(uBackEdgeColor, uBackCenterColor, centerMix);
      } else {
        backCol = tex.rgb * (1.0 - uBackDarken);
      }
      vec3 backFinal = mix(uBgColor, backCol, fade);
      gl_FragColor = vec4(backFinal, uShowBack * uOpacity);
    }
  }
`;

type StripPreset = {
  spiral: { radius: number; turns: number; heightPerTurn: number };
  twist: { enable: boolean; twistStart: number; twistCenter: number; twistEnd: number };
  start: { posX: number; posY: number; posZ: number; rotX: number; rotY: number; rotZ: number; scale: number; opacity: number };
  end: { posX: number; posY: number; posZ: number; rotX: number; rotY: number; rotZ: number; scale: number; opacity: number };
};

const STRIP_PRESETS: Record<string, StripPreset> = {
  "Espiral Torcida": {
    spiral: { radius: 2.8, turns: 2.4, heightPerTurn: -4.4 },
    twist: { enable: true, twistStart: -2.06, twistCenter: 0.72, twistEnd: 0.91 },
    start: { posX: 2.7, posY: -1.6, posZ: 0.0, rotX: 0.47, rotY: 1.18, rotZ: -0.41, scale: 0.87, opacity: 1.0 },
    end: { posX: 4.3, posY: 20.2, posZ: 7.2, rotX: -0.63, rotY: 2.27, rotZ: 0.0, scale: 1.0, opacity: 1.0 },
  },
  "Cilindro Suave": {
    spiral: { radius: 3.6, turns: 1.1, heightPerTurn: -14.0 },
    twist: { enable: false, twistStart: 0.4, twistCenter: 0.0, twistEnd: -0.3 },
    start: { posX: 3.1, posY: 0, posZ: 0.0, rotX: 0.69, rotY: 0.69, rotZ: -0.47, scale: 0.87, opacity: 1.0 },
    end: { posX: 24.8, posY: 12.1, posZ: 15.3, rotX: 0.0, rotY: 0.0, rotZ: 0.0, scale: 1.0, opacity: 1.0 },
  },
};

const PRESET_NAMES = Object.keys(STRIP_PRESETS);
const DEFAULT_PRESET = PRESET_NAMES[0]!;

function RibbonStrip({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textures = useTexture(IMAGES);

  const [{ preset }] = useControls("Strip.Preset", () => ({
    preset: { options: PRESET_NAMES },
  }));

  const mode = useControls("Strip.Mode", {
    type: { options: { spiral: "spiral", ribbon: "ribbon" } },
  });

  const shape = useControls("Strip.Shape", {
    bandWidth: { value: 2.1, step: 0.1 },
    segments: { value: 600, step: 10 },
    closed: false,
  });

  const [spiral, setSpiral] = useControls("Strip.Spiral", () => ({
    radius: { value: STRIP_PRESETS[DEFAULT_PRESET]!.spiral.radius, step: 0.1 },
    turns: { value: STRIP_PRESETS[DEFAULT_PRESET]!.spiral.turns, step: 0.1 },
    heightPerTurn: { value: STRIP_PRESETS[DEFAULT_PRESET]!.spiral.heightPerTurn, step: 0.1 },
  }));

  const path = useControls("Strip.Ribbon", {
    p0x: { value: -6, step: 0.1 }, p0y: { value: 4, step: 0.1 }, p0z: { value: 2, step: 0.1 },
    p1x: { value: -3, step: 0.1 }, p1y: { value: 2, step: 0.1 }, p1z: { value: -3, step: 0.1 },
    p2x: { value: 2, step: 0.1 },  p2y: { value: 0, step: 0.1 }, p2z: { value: -2, step: 0.1 },
    p3x: { value: 5, step: 0.1 },  p3y: { value: -1, step: 0.1 }, p3z: { value: 1, step: 0.1 },
    p4x: { value: 3, step: 0.1 },  p4y: { value: -3, step: 0.1 }, p4z: { value: -4, step: 0.1 },
    p5x: { value: -2, step: 0.1 }, p5y: { value: -5, step: 0.1 }, p5z: { value: -1, step: 0.1 },
  });

  const [twist, setTwist] = useControls("Strip.Twist", () => ({
    enable: STRIP_PRESETS[DEFAULT_PRESET]!.twist.enable,
    twistStart: { value: STRIP_PRESETS[DEFAULT_PRESET]!.twist.twistStart, step: 0.01 },
    twistCenter: { value: STRIP_PRESETS[DEFAULT_PRESET]!.twist.twistCenter, step: 0.01 },
    twistEnd: { value: STRIP_PRESETS[DEFAULT_PRESET]!.twist.twistEnd, step: 0.01 },
  }));

  const [start, setStart] = useControls("Strip.Start", () => {
    const s = STRIP_PRESETS[DEFAULT_PRESET]!.start;
    return {
      posX: { value: s.posX, step: 0.1 }, posY: { value: s.posY, step: 0.1 }, posZ: { value: s.posZ, step: 0.1 },
      rotX: { value: s.rotX, step: 0.01 }, rotY: { value: s.rotY, step: 0.01 }, rotZ: { value: s.rotZ, step: 0.01 },
      scale: { value: s.scale, step: 0.01 }, opacity: { value: s.opacity, step: 0.01 },
    };
  });

  const [end, setEnd] = useControls("Strip.End", () => {
    const e = STRIP_PRESETS[DEFAULT_PRESET]!.end;
    return {
      posX: { value: e.posX, step: 0.1 }, posY: { value: e.posY, step: 0.1 }, posZ: { value: e.posZ, step: 0.1 },
      rotX: { value: e.rotX, step: 0.01 }, rotY: { value: e.rotY, step: 0.01 }, rotZ: { value: e.rotZ, step: 0.01 },
      scale: { value: e.scale, step: 0.01 }, opacity: { value: e.opacity, step: 0.01 },
    };
  });

  const prevPreset = useRef(preset);
  useEffect(() => {
    if (preset === prevPreset.current) return;
    prevPreset.current = preset;
    const p = STRIP_PRESETS[preset];
    if (!p) return;
    setSpiral(p.spiral);
    setTwist(p.twist);
    setStart(p.start);
    setEnd(p.end);
  }, [preset, setSpiral, setTwist, setStart, setEnd]);

  const mat = useControls("Strip.Material", {
    uvScrollSpeed: { value: 0.01, step: 0.001 },
    bgColor: { value: "#0D0D0B" },
    fadeLeftStart: { value: 0.0, step: 0.005 },
    fadeLeftEnd: { value: 0.08, step: 0.005 },
    fadeRightStart: { value: 0.0, step: 0.005 },
    fadeRightEnd: { value: 0.08, step: 0.005 },
    fadeTopStart: { value: 0.0, step: 0.005 },
    fadeTopEnd: { value: 0.0, step: 0.005 },
    fadeBottomStart: { value: 0.0, step: 0.005 },
    fadeBottomEnd: { value: 0.0, step: 0.005 },
    showBack: { value: true },
    backMode: { options: { gradient: 0, photo: 1 }, value: 1 },
    backDarken: { value: 0.75, min: 0, max: 1, step: 0.05 },
    backEdgeColor: { value: "#0D0D0B" },
    backCenterColor: { value: "#1a1a18" },
    backGradientDir: { options: { alongPath: 0, acrossBand: 1 } },
  });

  const atlas = useControls("Strip.Atlas", {
    imageGapPx: { value: 0, step: 2 },
    gapColor: { value: "#0D0D0B" },
  });

  const ribbonPoints = useMemo(() => [
    new THREE.Vector3(path.p0x, path.p0y, path.p0z),
    new THREE.Vector3(path.p1x, path.p1y, path.p1z),
    new THREE.Vector3(path.p2x, path.p2y, path.p2z),
    new THREE.Vector3(path.p3x, path.p3y, path.p3z),
    new THREE.Vector3(path.p4x, path.p4y, path.p4z),
    new THREE.Vector3(path.p5x, path.p5y, path.p5z),
  ], [path.p0x, path.p0y, path.p0z, path.p1x, path.p1y, path.p1z,
      path.p2x, path.p2y, path.p2z, path.p3x, path.p3y, path.p3z,
      path.p4x, path.p4y, path.p4z, path.p5x, path.p5y, path.p5z]);

  const tStart = twist.enable ? twist.twistStart : 0;
  const tCenter = twist.enable ? twist.twistCenter : 0;
  const tEnd = twist.enable ? twist.twistEnd : 0;

  const geometry = useMemo(() => {
    if (mode.type === "spiral") {
      return createSpiralGeometry(
        spiral.radius, spiral.turns, spiral.heightPerTurn,
        shape.bandWidth, shape.segments,
        tStart, tEnd, tCenter, shape.closed,
      );
    }
    return createRibbonGeometry(
      ribbonPoints, shape.bandWidth, shape.segments,
      tStart, tEnd, tCenter, shape.closed,
    );
  }, [mode.type, spiral.radius, spiral.turns, spiral.heightPerTurn,
      ribbonPoints, shape.bandWidth, shape.segments,
      tStart, tEnd, tCenter, shape.closed]);

  const atlasTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const cols = IMAGES.length;
    const cW = 512, cH = 320;
    const gap = Math.max(0, Math.round(atlas.imageGapPx));
    canvas.width = cW * cols + gap * (cols - 1);
    canvas.height = cH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = atlas.gapColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    textures.forEach((tex, i) => {
      if (tex.image) {
        const img = tex.image as HTMLImageElement;
        const sa = img.width / img.height, ca = cW / cH;
        let sw: number, sh: number, sx: number, sy: number;
        if (sa > ca) { sh = img.height; sw = sh * ca; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / ca; sx = 0; sy = (img.height - sh) / 2; }
        ctx.drawImage(img, sx, sy, sw, sh, i * (cW + gap), 0, cW, cH);
      }
    });
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [textures, atlas.imageGapPx, atlas.gapColor]);

  const uvOffsetX = useRef(0);

  const uniforms = useRef({
    uMap: { value: atlasTexture },
    uOpacity: { value: 1.0 },
    uUvOffsetX: { value: 0.0 },
    uBgColor: { value: new THREE.Color("#0D0D0B") },
    uFadeLeftStart: { value: 0.0 }, uFadeLeftEnd: { value: 0.08 },
    uFadeRightStart: { value: 0.0 }, uFadeRightEnd: { value: 0.08 },
    uFadeTopStart: { value: 0.0 }, uFadeTopEnd: { value: 0.0 },
    uFadeBottomStart: { value: 0.0 }, uFadeBottomEnd: { value: 0.0 },
    uShowBack: { value: 1.0 },
    uBackMode: { value: 1.0 },
    uBackDarken: { value: 0.4 },
    uBackEdgeColor: { value: new THREE.Color("#0D0D0B") },
    uBackCenterColor: { value: new THREE.Color("#1a1a18") },
    uBackGradientDir: { value: 0.0 },
  });

  uniforms.current.uMap.value = atlasTexture;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const p = progressRef.current;

    atlasTexture.needsUpdate = false;
    uvOffsetX.current += mat.uvScrollSpeed * delta;

    meshRef.current.position.set(mix(start.posX, end.posX, p), mix(start.posY, end.posY, p), mix(start.posZ, end.posZ, p));
    meshRef.current.rotation.set(mix(start.rotX, end.rotX, p), mix(start.rotY, end.rotY, p), mix(start.rotZ, end.rotZ, p));
    meshRef.current.scale.setScalar(mix(start.scale, end.scale, p));

    const u = uniforms.current;
    u.uOpacity.value = mix(start.opacity, end.opacity, p);
    u.uUvOffsetX.value = uvOffsetX.current;
    u.uBgColor.value.set(mat.bgColor);
    u.uFadeLeftStart.value = mat.fadeLeftStart;   u.uFadeLeftEnd.value = mat.fadeLeftEnd;
    u.uFadeRightStart.value = mat.fadeRightStart; u.uFadeRightEnd.value = mat.fadeRightEnd;
    u.uFadeTopStart.value = mat.fadeTopStart;     u.uFadeTopEnd.value = mat.fadeTopEnd;
    u.uFadeBottomStart.value = mat.fadeBottomStart; u.uFadeBottomEnd.value = mat.fadeBottomEnd;
    u.uShowBack.value = mat.showBack ? 1.0 : 0.0;
    u.uBackMode.value = mat.backMode as number;
    u.uBackDarken.value = mat.backDarken;
    u.uBackEdgeColor.value.set(mat.backEdgeColor);
    u.uBackCenterColor.value.set(mat.backCenterColor);
    u.uBackGradientDir.value = mat.backGradientDir as number;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        vertexShader={ribbonVert}
        fragmentShader={ribbonFrag}
        uniforms={uniforms.current}
        transparent
        side={THREE.DoubleSide}
        depthWrite
      />
    </mesh>
  );
}

/* ─── Cards ─── */
function Card({
  url, index, totalCards, progressRef, loopElapsed,
}: {
  url: string;
  index: number;
  totalCards: number;
  progressRef: React.MutableRefObject<number>;
  loopElapsed: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useTexture(url);

  const layout = useControls("Cards.Layout", {
    columns: { value: 1, step: 1 },
    spreadX: { value: 3.0, step: 0.1 },
    spreadY: { value: 1.7, step: 0.1 },
    zigzagX: { value: 1.7, step: 0.1 },
    depthVar: { value: 2.3, step: 0.1 },
    cardW: { value: 4.0, step: 0.1 },
    cardH: { value: 2.5, step: 0.1 },
  });

  const transform = useControls("Cards.Transform", {
    offsetX: { value: -5.2, step: 0.1 },
    offsetY: { value: 6.7, step: 0.1 },
    offsetZ: { value: -2.2, step: 0.1 },
    rotX: { value: -0.26, step: 0.01 },
    rotY: { value: 0.47, step: 0.01 },
    rotZ: { value: 0.25, step: 0.01 },
  });

  const anim = useControls("Cards.Animation", {
    startAt: { value: 0.18, step: 0.01 },
    stagger: { value: 0.03, step: 0.005 },
    duration: { value: 0.20, step: 0.01 },
    entryX: { value: -10.0, step: 0.5 },
    entryY: { value: 0.0, step: 0.5 },
    entryZ: { value: -11.5, step: 0.5 },
  });

  const exit = useControls("Cards.Exit", {
    startAt: { value: 0.70, step: 0.01 },
    duration: { value: 0.25, step: 0.01 },
    exitX: { value: -10.0, step: 0.5 },
    exitY: { value: 0.0, step: 0.5 },
    exitZ: { value: -11.5, step: 0.5 },
  });

  const loop = useControls("Cards.Loop", {
    enable: true,
    speed: { value: 1.0, min: 0, max: 2, step: 0.01 },
  });

  const cols = Math.max(1, layout.columns);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const zigzag = row % 2 === 0 ? 0 : layout.zigzagX;

  const baseX = (col - (cols - 1) / 2 + zigzag) * layout.spreadX + transform.offsetX;
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
    const entryEase = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;

    const exitS = exit.startAt + index * anim.stagger;
    const exitE = exitS + exit.duration;
    const exitRaw = Math.max(0, Math.min(1, (t - exitS) / (exitE - exitS)));
    const exitEase = exitRaw < 0.5 ? 4 * exitRaw * exitRaw * exitRaw : 1 - Math.pow(-2 * exitRaw + 2, 3) / 2;

    const totalRows = Math.ceil(totalCards / cols);
    const totalSpanY = totalRows * layout.spreadY;

    let targetX = baseX;
    let targetY = baseY;
    let targetZ = baseZ;

    if (loop.enable) {
      const drift = loopElapsed.current * loop.speed;
      const ySlot = row * layout.spreadY;
      const wrappedSlot = (((ySlot - drift) % totalSpanY) + totalSpanY) % totalSpanY;
      targetY = -wrappedSlot + transform.offsetY;
    }

    if (entryEase < 1) {
      meshRef.current.position.x = mix(targetX + anim.entryX, targetX, entryEase);
      meshRef.current.position.y = mix(targetY + anim.entryY, targetY, entryEase);
      meshRef.current.position.z = mix(targetZ + anim.entryZ, targetZ, entryEase);
    } else if (exitEase > 0) {
      meshRef.current.position.x = mix(targetX, targetX + exit.exitX, exitEase);
      meshRef.current.position.y = mix(targetY, targetY + exit.exitY, exitEase);
      meshRef.current.position.z = mix(targetZ, targetZ + exit.exitZ, exitEase);
    } else {
      meshRef.current.position.x = targetX;
      meshRef.current.position.y = targetY;
      meshRef.current.position.z = targetZ;
    }

    const opacity = entryEase * (1 - exitEase);
    meshRef.current.rotation.set(transform.rotX, transform.rotY, transform.rotZ);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
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
  const loopElapsed = useRef(0);
  const cardCount = IMAGES.slice(0, 9).length;

  useFrame((_, delta) => {
    progressRef.current += (progress - progressRef.current) * 0.05;
    loopElapsed.current += delta;
  });

  return (
    <group>
      <ambientLight intensity={1} />
      <RibbonStrip progressRef={progressRef} />
      {IMAGES.slice(0, 9).map((url, i) => (
        <Card
          key={url}
          url={url}
          index={i}
          totalCards={cardCount}
          progressRef={progressRef}
          loopElapsed={loopElapsed}
        />
      ))}
    </group>
  );
}
