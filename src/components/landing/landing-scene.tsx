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

  return createRibbonGeometry(curvePoints, bandWidth, segments, twistStart, twistEnd, twistCenter, false);
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

  // back: 3-color gradient (edge → center → edge)
  uniform float uShowBack;
  uniform vec3 uBackEdgeColor;
  uniform vec3 uBackCenterColor;
  uniform float uBackGradientDir; // 0=along path(x), 1=across band(y)

  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uMap, vUv);

    float fadeL = smoothstep(uFadeLeftStart, uFadeLeftEnd, vUv.x);
    float fadeR = smoothstep(uFadeRightStart, uFadeRightEnd, 1.0 - vUv.x);
    float fadeT = smoothstep(uFadeTopStart, uFadeTopEnd, 1.0 - vUv.y);
    float fadeB = smoothstep(uFadeBottomStart, uFadeBottomEnd, vUv.y);
    float fade = fadeL * fadeR * fadeT * fadeB;

    if (gl_FrontFacing) {
      // front: always fully opaque, blend color toward bg at edges
      vec3 color = mix(uBgColor, tex.rgb, fade);
      gl_FragColor = vec4(color, uOpacity);
    } else {
      // back: 3-color gradient
      float gradT = uBackGradientDir < 0.5 ? vUv.x : vUv.y;
      float centerMix = 1.0 - abs(gradT - 0.5) * 2.0; // 0 at edges, 1 at center
      vec3 backCol = mix(uBackEdgeColor, uBackCenterColor, centerMix);
      vec3 backFinal = mix(uBgColor, backCol, fade);
      gl_FragColor = vec4(backFinal, uShowBack * uOpacity);
    }
  }
`;

function RibbonStrip({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textures = useTexture(IMAGES);

  const mode = useControls("Strip.Mode", {
    type: { options: { spiral: "spiral", ribbon: "ribbon" } },
  });

  const shape = useControls("Strip.Shape", {
    bandWidth: { value: 2.1, step: 0.1 },
    segments: { value: 300, step: 10 },
    closed: false,
  });

  const spiral = useControls("Strip.Spiral", {
    radius: { value: 4.0, step: 0.1 },
    turns: { value: 2.5, step: 0.1 },
    heightPerTurn: { value: 6.0, step: 0.1 },
  });

  const path = useControls("Strip.Ribbon", {
    p0x: { value: -6, step: 0.1 }, p0y: { value: 4, step: 0.1 }, p0z: { value: 2, step: 0.1 },
    p1x: { value: -3, step: 0.1 }, p1y: { value: 2, step: 0.1 }, p1z: { value: -3, step: 0.1 },
    p2x: { value: 2, step: 0.1 },  p2y: { value: 0, step: 0.1 }, p2z: { value: -2, step: 0.1 },
    p3x: { value: 5, step: 0.1 },  p3y: { value: -1, step: 0.1 }, p3z: { value: 1, step: 0.1 },
    p4x: { value: 3, step: 0.1 },  p4y: { value: -3, step: 0.1 }, p4z: { value: -4, step: 0.1 },
    p5x: { value: -2, step: 0.1 }, p5y: { value: -5, step: 0.1 }, p5z: { value: -1, step: 0.1 },
  });

  const twist = useControls("Strip.Twist", {
    twistStart: { value: 0.4, step: 0.01 },
    twistCenter: { value: 0.0, step: 0.01 },
    twistEnd: { value: -0.3, step: 0.01 },
  });

  const start = useControls("Strip.Start", {
    posX: { value: 0, step: 0.1 }, posY: { value: 0, step: 0.1 }, posZ: { value: -2.5, step: 0.1 },
    rotX: { value: 0.02, step: 0.01 }, rotY: { value: 0.3, step: 0.01 }, rotZ: { value: 0.26, step: 0.01 },
    scale: { value: 1.0, step: 0.01 }, opacity: { value: 1.0, step: 0.01 },
  });

  const end = useControls("Strip.End", {
    posX: { value: 0, step: 0.1 }, posY: { value: 6.0, step: 0.1 }, posZ: { value: -2.5, step: 0.1 },
    rotX: { value: 0.5, step: 0.01 }, rotY: { value: 0.8, step: 0.01 }, rotZ: { value: 0.26, step: 0.01 },
    scale: { value: 1.0, step: 0.01 }, opacity: { value: 0.0, step: 0.01 },
  });

  const mat = useControls("Strip.Material", {
    uvScrollSpeed: { value: 0.015, step: 0.001 },
    bgColor: { value: "#0D0D0B" },
    fadeLeftStart: { value: 0.0, step: 0.005 },
    fadeLeftEnd: { value: 0.08, step: 0.005 },
    fadeRightStart: { value: 0.0, step: 0.005 },
    fadeRightEnd: { value: 0.08, step: 0.005 },
    fadeTopStart: { value: 0.0, step: 0.005 },
    fadeTopEnd: { value: 0.15, step: 0.005 },
    fadeBottomStart: { value: 0.0, step: 0.005 },
    fadeBottomEnd: { value: 0.15, step: 0.005 },
    showBack: { value: true },
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

  const geometry = useMemo(() => {
    if (mode.type === "spiral") {
      return createSpiralGeometry(
        spiral.radius, spiral.turns, spiral.heightPerTurn,
        shape.bandWidth, shape.segments,
        twist.twistStart, twist.twistEnd, twist.twistCenter,
      );
    }
    return createRibbonGeometry(
      ribbonPoints, shape.bandWidth, shape.segments,
      twist.twistStart, twist.twistEnd, twist.twistCenter, shape.closed,
    );
  }, [mode.type, spiral.radius, spiral.turns, spiral.heightPerTurn,
      ribbonPoints, shape.bandWidth, shape.segments,
      twist.twistStart, twist.twistEnd, twist.twistCenter, shape.closed]);

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

  const uniforms = useRef({
    uMap: { value: atlasTexture },
    uOpacity: { value: 1.0 },
    uBgColor: { value: new THREE.Color("#0D0D0B") },
    uFadeLeftStart: { value: 0.0 }, uFadeLeftEnd: { value: 0.08 },
    uFadeRightStart: { value: 0.0 }, uFadeRightEnd: { value: 0.08 },
    uFadeTopStart: { value: 0.0 }, uFadeTopEnd: { value: 0.15 },
    uFadeBottomStart: { value: 0.0 }, uFadeBottomEnd: { value: 0.15 },
    uShowBack: { value: 1.0 },
    uBackEdgeColor: { value: new THREE.Color("#0D0D0B") },
    uBackCenterColor: { value: new THREE.Color("#1a1a18") },
    uBackGradientDir: { value: 0.0 },
  });

  uniforms.current.uMap.value = atlasTexture;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const p = progressRef.current;

    atlasTexture.offset.x += mat.uvScrollSpeed * delta;

    meshRef.current.position.set(mix(start.posX, end.posX, p), mix(start.posY, end.posY, p), mix(start.posZ, end.posZ, p));
    meshRef.current.rotation.set(mix(start.rotX, end.rotX, p), mix(start.rotY, end.rotY, p), mix(start.rotZ, end.rotZ, p));
    meshRef.current.scale.setScalar(mix(start.scale, end.scale, p));

    const u = uniforms.current;
    u.uOpacity.value = mix(start.opacity, end.opacity, p);
    u.uBgColor.value.set(mat.bgColor);
    u.uFadeLeftStart.value = mat.fadeLeftStart;   u.uFadeLeftEnd.value = mat.fadeLeftEnd;
    u.uFadeRightStart.value = mat.fadeRightStart; u.uFadeRightEnd.value = mat.fadeRightEnd;
    u.uFadeTopStart.value = mat.fadeTopStart;     u.uFadeTopEnd.value = mat.fadeTopEnd;
    u.uFadeBottomStart.value = mat.fadeBottomStart; u.uFadeBottomEnd.value = mat.fadeBottomEnd;
    u.uShowBack.value = mat.showBack ? 1.0 : 0.0;
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
        depthWrite={false}
      />
    </mesh>
  );
}

/* ─── Cards ─── */
function Card({ url, index, progressRef }: { url: string; index: number; progressRef: React.MutableRefObject<number> }) {
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
  useFrame(() => { progressRef.current += (progress - progressRef.current) * 0.05; });

  return (
    <group>
      <ambientLight intensity={1} />
      <RibbonStrip progressRef={progressRef} />
      {IMAGES.slice(0, 9).map((url, i) => (
        <Card key={url} url={url} index={i} progressRef={progressRef} />
      ))}
    </group>
  );
}
