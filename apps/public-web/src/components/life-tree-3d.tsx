"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  OrbitControls,
  Trail,
} from "@react-three/drei";
import {
  Bloom,
  EffectComposer,
} from "@react-three/postprocessing";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  MathUtils,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  Texture,
  Vector3,
  type Group,
  type InstancedMesh,
} from "three";
import { taipeiDistrictBoundaries, type TaipeiDistrictBoundary } from "./taipei-district-boundaries";

const leafShape = new Shape();
leafShape.moveTo(0, 0.16);
leafShape.bezierCurveTo(0.13, 0.09, 0.14, -0.08, 0, -0.18);
leafShape.bezierCurveTo(-0.14, -0.08, -0.13, 0.09, 0, 0.16);

const fallingLeaves = [
  [-1.7, 3.25, 0.4],
  [1.45, 3.05, -0.35],
  [0.25, 3.45, 0.75],
  [-0.45, 3.15, -0.7],
] as const;

type Vec3Tuple = readonly [number, number, number];

type BranchSpec = {
  from: Vec3Tuple;
  to: Vec3Tuple;
  radiusBottom: number;
  radiusTop: number;
  color?: string;
};

const trunkSegments: BranchSpec[] = [
  { from: [0, -0.06, 0], to: [0.02, 0.72, 0.02], radiusBottom: 0.38, radiusTop: 0.28 },
  { from: [0.02, 0.72, 0.02], to: [-0.04, 1.42, 0.01], radiusBottom: 0.29, radiusTop: 0.21 },
  { from: [-0.04, 1.42, 0.01], to: [0.05, 2.05, -0.01], radiusBottom: 0.22, radiusTop: 0.14 },
  { from: [0.05, 2.05, -0.01], to: [0.01, 2.78, 0], radiusBottom: 0.14, radiusTop: 0.064 },
];

const branchSegments: BranchSpec[] = [
  { from: [-0.03, 0.22, 0.02], to: [-0.84, -0.02, 0.18], radiusBottom: 0.14, radiusTop: 0.038 },
  { from: [0.03, 0.2, 0.02], to: [0.82, -0.03, 0.18], radiusBottom: 0.14, radiusTop: 0.038 },
  { from: [-0.02, 0.52, 0], to: [-0.62, 0.34, 0.26], radiusBottom: 0.1, radiusTop: 0.026 },
  { from: [0.02, 0.52, 0], to: [0.62, 0.34, 0.26], radiusBottom: 0.1, radiusTop: 0.026 },
  { from: [-0.01, 1.18, 0], to: [-1.16, 1.74, 0.1], radiusBottom: 0.11, radiusTop: 0.034 },
  { from: [-0.54, 1.48, 0.05], to: [-1.55, 2.06, 0.14], radiusBottom: 0.06, radiusTop: 0.018 },
  { from: [-0.42, 1.5, 0.03], to: [-0.82, 2.36, -0.06], radiusBottom: 0.05, radiusTop: 0.016 },
  { from: [0.02, 1.26, 0], to: [1.18, 1.86, 0.08], radiusBottom: 0.11, radiusTop: 0.034 },
  { from: [0.58, 1.58, 0.04], to: [1.56, 2.18, 0.12], radiusBottom: 0.06, radiusTop: 0.018 },
  { from: [0.44, 1.62, 0.02], to: [0.86, 2.48, -0.08], radiusBottom: 0.05, radiusTop: 0.016 },
  { from: [-0.04, 1.82, 0], to: [-0.56, 2.76, 0.12], radiusBottom: 0.076, radiusTop: 0.02 },
  { from: [0.04, 1.88, 0], to: [0.6, 2.78, 0.1], radiusBottom: 0.076, radiusTop: 0.02 },
  { from: [0.01, 2.18, 0], to: [-0.24, 3.16, 0.08], radiusBottom: 0.056, radiusTop: 0.014 },
  { from: [0.02, 2.2, 0], to: [0.28, 3.12, 0.08], radiusBottom: 0.056, radiusTop: 0.014 },
];

const canopyClusters = [
  { position: [-1.18, 2.1, 0.1] as Vec3Tuple, scale: [1.14, 0.7, 0.45] as Vec3Tuple, color: "#5ea85f" },
  { position: [-0.62, 2.5, 0.18] as Vec3Tuple, scale: [1.18, 0.75, 0.48] as Vec3Tuple, color: "#76bd61" },
  { position: [0, 2.7, 0.16] as Vec3Tuple, scale: [1.34, 0.86, 0.54] as Vec3Tuple, color: "#68b65b" },
  { position: [0.66, 2.5, 0.16] as Vec3Tuple, scale: [1.18, 0.74, 0.48] as Vec3Tuple, color: "#79c866" },
  { position: [1.18, 2.12, 0.08] as Vec3Tuple, scale: [1.12, 0.68, 0.44] as Vec3Tuple, color: "#5faa62" },
  { position: [-0.04, 3.08, 0.12] as Vec3Tuple, scale: [1.08, 0.72, 0.44] as Vec3Tuple, color: "#8dd06b" },
  { position: [-0.54, 2.12, 0.5] as Vec3Tuple, scale: [1.02, 0.58, 0.34] as Vec3Tuple, color: "#8ccf68" },
  { position: [0.56, 2.12, 0.5] as Vec3Tuple, scale: [1.02, 0.58, 0.34] as Vec3Tuple, color: "#4f995a" },
  { position: [-0.24, 1.88, 0.36] as Vec3Tuple, scale: [0.9, 0.5, 0.34] as Vec3Tuple, color: "#5ea85f" },
  { position: [0.34, 1.9, 0.34] as Vec3Tuple, scale: [0.9, 0.5, 0.34] as Vec3Tuple, color: "#6db85c" },
  { position: [-0.9, 2.76, 0.02] as Vec3Tuple, scale: [0.82, 0.5, 0.32] as Vec3Tuple, color: "#6dbf62" },
  { position: [0.9, 2.76, 0.02] as Vec3Tuple, scale: [0.82, 0.5, 0.32] as Vec3Tuple, color: "#75c461" },
];

type TreeVariant = "card" | "world";

type QualityProfile = {
  leafCount: number;
  postprocessing: boolean;
  dpr: [number, number];
};

type LeafInstance = {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  phase: number;
  wind: number;
};

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function createLeafInstances(count: number, variant: TreeVariant): LeafInstance[] {
  const worldScale = variant === "world" ? 1.14 : 0.98;
  return Array.from({ length: count }, (_, index) => {
    const clusterIndex = index % canopyClusters.length;
    const cluster = canopyClusters[clusterIndex]!;
    const seed = index * 19 + clusterIndex * 73;
    const theta = seed * 2.399963;
    const shell = Math.sqrt(seededUnit(seed + 1));
    const vertical = (seededUnit(seed + 2) - 0.5) * 1.08;
    const frontBias = seededUnit(seed + 3) > 0.72 ? 0.42 : 0;
    const x = (cluster.position[0] + Math.cos(theta) * shell * cluster.scale[0]) * worldScale;
    const y = cluster.position[1] + vertical * cluster.scale[1];
    const z =
      cluster.position[2] +
      Math.sin(theta) * shell * cluster.scale[2] * 0.68 +
      frontBias;
    const size = 0.28 + seededUnit(seed + 4) * 0.28;
    const tilt = -0.28 + seededUnit(seed + 5) * 0.56;
    const turnToCamera = MathUtils.lerp(-0.32, 0.32, seededUnit(seed + 6));

    return {
      position: [x, y, z] as Vec3Tuple,
      rotation: [
        tilt,
        turnToCamera,
        theta + seededUnit(seed + 7) * 0.8,
      ] as Vec3Tuple,
      scale: [
        size * (0.72 + seededUnit(seed + 8) * 0.34),
        size * (1.02 + seededUnit(seed + 9) * 0.38),
        size,
      ] as Vec3Tuple,
      phase: seededUnit(seed + 10) * Math.PI * 2,
      wind: 0.35 + seededUnit(seed + 11) * 0.75,
    };
  });
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useVisualQuality(reduced: boolean, variant: TreeVariant): QualityProfile {
  const [profile, setProfile] = useState<QualityProfile>({
    leafCount: variant === "world" ? 1200 : 620,
    postprocessing: false,
    dpr: [1, 1.35],
  });

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const isDesktop = width >= 1120;
      const isTablet = width >= 760 && width < 1120;
      const isWorld = variant === "world";
      setProfile({
        leafCount: reduced
          ? isWorld
            ? 520
            : 320
          : isDesktop
            ? isWorld
              ? 1550
              : 840
            : isTablet
              ? isWorld
                ? 880
                : 560
              : isWorld
                ? 440
                : 320,
        postprocessing: !reduced && width >= 760,
        dpr: isDesktop ? [1, 1.75] : [1, 1.35],
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [reduced, variant]);

  return profile;
}

function useCanvasTexture(draw: (context: CanvasRenderingContext2D, size: number) => void) {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return null;
    draw(context, size);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.8, 2.8);
    return texture;
  }, [draw]);
}

function useBarkTexture() {
  return useCanvasTexture((context, size) => {
    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#3b2014");
    gradient.addColorStop(0.32, "#805236");
    gradient.addColorStop(0.68, "#4a2918");
    gradient.addColorStop(1, "#9b6a45");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 9) {
      context.beginPath();
      context.strokeStyle = x % 27 === 0 ? "rgba(255, 214, 147, .28)" : "rgba(29, 15, 9, .34)";
      context.lineWidth = 2 + seededUnit(x) * 3;
      context.moveTo(x + Math.sin(x) * 4, 0);
      for (let y = 0; y <= size; y += 18) {
        context.lineTo(x + Math.sin(y * 0.08 + x) * 9, y);
      }
      context.stroke();
    }
    for (let i = 0; i < 360; i += 1) {
      const alpha = seededUnit(i + 20) * 0.18;
      context.fillStyle = `rgba(20, 9, 4, ${alpha})`;
      context.fillRect(seededUnit(i) * size, seededUnit(i + 3) * size, 1.4, 1.4);
    }
  });
}

function OrganicBranch({
  from,
  to,
  radiusBottom,
  radiusTop,
  color = "#7b5538",
  barkTexture,
}: BranchSpec & { barkTexture: Texture | null }) {
  const { curve, barkLines } = useMemo(() => {
    const start = new Vector3(...from);
    const end = new Vector3(...to);
    const delta = end.clone().sub(start);
    const side = new Vector3(-delta.z, 0, delta.x).normalize().multiplyScalar(radiusBottom * 0.75);
    const lift = Math.max(0.08, delta.length() * 0.08);
    const curve = new CatmullRomCurve3([
      start,
      start.clone().lerp(end, 0.38).add(side).add(new Vector3(0, lift, 0)),
      start.clone().lerp(end, 0.72).add(side.clone().multiplyScalar(-0.45)),
      end,
    ]);
    const barkLines = [0.22, 0.52, 0.78].map((offset, index) => ({
      curve: new CatmullRomCurve3(
        curve.points.map((point) =>
          point
            .clone()
            .add(new Vector3(Math.sin(offset * 6 + index) * radiusBottom * 0.34, 0, Math.cos(offset * 5 + index) * radiusBottom * 0.34)),
        ),
      ),
      radius: Math.max(0.004, radiusTop * 0.18),
    }));

    return { curve, barkLines };
  }, [from, to]);

  return (
    <group>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 18, (radiusBottom + radiusTop) / 2, 14, false]} />
        <meshStandardMaterial
          color={color}
          map={barkTexture ?? undefined}
          roughness={0.96}
          metalness={0.01}
          bumpMap={barkTexture ?? undefined}
          bumpScale={0.045}
        />
      </mesh>
      {barkLines.map((line, index) => (
        <mesh key={index}>
          <tubeGeometry args={[line.curve, 12, line.radius, 5, false]} />
          <meshStandardMaterial color="#9a6a43" roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
}

function InstancedLeaves({
  leaves,
  reduced,
}: {
  leaves: LeafInstance[];
  reduced: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const veinMesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const applyMatrices = (time = 0) => {
    leaves.forEach((leaf, index) => {
      const flutter = reduced ? 0 : Math.sin(time * 1.25 * leaf.wind + leaf.phase) * 0.07;
      dummy.position.set(leaf.position[0], leaf.position[1] + flutter * 0.08, leaf.position[2]);
      dummy.rotation.set(
        leaf.rotation[0] + flutter * 0.45,
        leaf.rotation[1] + flutter * 0.3,
        leaf.rotation[2] + flutter,
      );
      dummy.scale.set(leaf.scale[0], leaf.scale[1], leaf.scale[2]);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(leaf.position[0], leaf.position[1] + flutter * 0.08 - 0.018, leaf.position[2] + 0.006);
      dummy.scale.set(leaf.scale[0] * 0.08, leaf.scale[1] * 0.82, leaf.scale[2] * 0.08);
      dummy.updateMatrix();
      veinMesh.current?.setMatrixAt(index, dummy.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    if (veinMesh.current) veinMesh.current.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    if (!mesh.current || !veinMesh.current) return;
    mesh.current.instanceMatrix.setUsage(DynamicDrawUsage);
    veinMesh.current.instanceMatrix.setUsage(DynamicDrawUsage);
    applyMatrices();
  }, [leaves]);

  useFrame(({ clock }) => {
    if (reduced) return;
    applyMatrices(clock.elapsedTime);
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, leaves.length]}>
        <shapeGeometry args={[leafShape, 10]} />
        <meshBasicMaterial
          color="#8fd66e"
          transparent
          opacity={0.9}
          alphaTest={0.14}
          side={DoubleSide}
        />
      </instancedMesh>
      <instancedMesh ref={veinMesh} args={[undefined, undefined, leaves.length]}>
        <boxGeometry args={[0.012, 0.25, 0.008]} />
        <meshBasicMaterial color="#eef7a4" />
      </instancedMesh>
    </>
  );
}

function LeafCanopy({
  reduced,
  variant,
  quality,
}: {
  reduced: boolean;
  variant: TreeVariant;
  quality: QualityProfile;
}) {
  const canopy = useRef<Group>(null);
  const leaves = useMemo(
    () => createLeafInstances(quality.leafCount, variant),
    [quality.leafCount, variant],
  );

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    if (canopy.current) {
      canopy.current.rotation.z = Math.sin(t * 0.72) * 0.016;
      canopy.current.rotation.y = Math.sin(t * 0.42) * 0.016;
    }
  });

  return (
    <group ref={canopy}>
      {canopyClusters.map((cluster) => (
        <mesh
          key={cluster.position.join("-")}
          position={cluster.position}
          scale={cluster.scale}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.58, 30, 18]} />
          <meshStandardMaterial
            color={cluster.color}
            transparent
            opacity={variant === "world" ? 0.52 : 0.44}
            roughness={0.9}
            depthWrite={false}
          />
        </mesh>
      ))}
      <InstancedLeaves leaves={leaves} reduced={reduced} />
    </group>
  );
}

function FloatingLeaves({ reduced }: { reduced: boolean }) {
  const refs = useRef<Group[]>([]);

  useFrame(({ clock }) => {
    if (reduced) return;
    refs.current.forEach((leaf, index) => {
      const t = clock.elapsedTime + index * 1.7;
      leaf.position.y =
        fallingLeaves[index][1] - ((t * 0.18 + index * 0.12) % 1.35) * 2.3;
      leaf.position.x = fallingLeaves[index][0] + Math.sin(t * 1.1) * 0.22;
      leaf.rotation.set(t * 0.7, t * 1.1, Math.sin(t) * 0.6);
      if (leaf.position.y < 0.55) leaf.position.y = fallingLeaves[index][1];
    });
  });

  return (
    <group>
      {fallingLeaves.map((position, index) => (
        <group
          key={`${position.join("-")}-${index}`}
          ref={(node) => {
            if (node) refs.current[index] = node;
          }}
          position={position}
        >
          <mesh rotation={[0.1, 0.45, 0.7]}>
            <planeGeometry args={[0.16, 0.28, 1, 1]} />
            <meshStandardMaterial
              color={index % 2 ? "#f0d66a" : "#8fd45e"}
              side={DoubleSide}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LifeTreeModel({
  reduced,
  variant = "card",
  quality,
}: {
  reduced: boolean;
  variant?: TreeVariant;
  quality: QualityProfile;
}) {
  const tree = useRef<Group>(null);
  const barkTexture = useBarkTexture();

  useFrame(({ clock }) => {
    if (reduced) return;
    const sway = Math.sin(clock.elapsedTime * 0.68) * 0.026;
    if (tree.current) tree.current.rotation.z = sway;
  });

  const isWorld = variant === "world";

  return (
    <group
      ref={tree}
      position={isWorld ? [0.36, -1.34, 0] : [0, -1.48, 0]}
      scale={isWorld ? 1.08 : 0.98}
      rotation={[0, isWorld ? -0.03 : 0, 0]}
    >
      {trunkSegments.map((segment, index) => (
        <OrganicBranch key={`trunk-${index}`} barkTexture={barkTexture} {...segment} />
      ))}
      {branchSegments.map((segment, index) => (
        <OrganicBranch key={`branch-${index}`} barkTexture={barkTexture} color="#6b472f" {...segment} />
      ))}
      {[
        [0.02, 1.18, 0.01, 0.18],
        [0.03, 1.72, 0, 0.13],
        [0.04, 2.18, -0.01, 0.08],
      ].map(([x, y, z, radius], index) => (
        <mesh key={`tree-knot-${index}`} position={[x, y, z]} castShadow receiveShadow>
          <sphereGeometry args={[radius, 18, 12]} />
          <meshStandardMaterial
            color={index === 0 ? "#6f472f" : "#775037"}
            map={barkTexture ?? undefined}
            roughness={0.96}
            bumpMap={barkTexture ?? undefined}
            bumpScale={0.035}
          />
        </mesh>
      ))}
      <LeafCanopy reduced={reduced} variant={variant} quality={quality} />
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[1.75, 1.32, 0.16, 64]} />
        <meshStandardMaterial color="#b8d88b" roughness={0.92} />
      </mesh>
      <FloatingLeaves reduced={reduced} />
    </group>
  );
}

function GrowthTrail({ reduced }: { reduced: boolean }) {
  const follower = useRef<Group>(null);
  const growthCurve = useMemo(
    () =>
      new CatmullRomCurve3([
      new Vector3(-1.72, -0.9, 0.65),
      new Vector3(-0.72, 0.12, 0.72),
      new Vector3(0.1, 1.15, 0.6),
      new Vector3(0.72, 2.08, 0.42),
      new Vector3(0.18, 2.72, 0.1),
    ]),
    [],
  );

  useFrame(({ clock }) => {
    if (reduced || !follower.current) return;
    const progress = (clock.elapsedTime * 0.18) % 1;
    follower.current.position.copy(growthCurve.getPoint(progress));
  });

  return (
    <>
      <mesh>
        <tubeGeometry args={[growthCurve, 72, 0.012, 6, false]} />
        <meshBasicMaterial color="#fff0a3" transparent opacity={0.18} blending={AdditiveBlending} />
      </mesh>
      <Trail
        width={0.18}
        length={8}
        color={new Color("#fff0a3")}
        attenuation={(t) => t * t}
      >
        <group ref={follower} position={growthCurve.getPoint(0)}>
          <mesh>
            <sphereGeometry args={[0.07, 18, 14]} />
            <meshBasicMaterial color="#fff6a5" transparent opacity={0.9} blending={AdditiveBlending} />
          </mesh>
        </group>
      </Trail>
    </>
  );
}

function TreeScene({
  reduced,
  variant = "card",
  quality,
}: {
  reduced: boolean;
  variant?: TreeVariant;
  quality: QualityProfile;
}) {
  return (
    <>
      <color attach="background" args={["#dff8e8"]} />
      <fog attach="fog" args={["#dff8e8", 7, 13]} />
      <ambientLight intensity={1.02} />
      <directionalLight castShadow position={[4, 6, 3]} intensity={1.85} />
      <pointLight position={[-2.6, 2.6, 2.8]} color="#fff1a6" intensity={4.2} />
      <Float speed={reduced ? 0 : 0.85} rotationIntensity={0} floatIntensity={0.12}>
        <LifeTreeModel reduced={reduced} variant={variant} quality={quality} />
      </Float>
      <GrowthTrail reduced={reduced} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.44, 0]} receiveShadow>
        <circleGeometry args={[2.75, 80]} />
        <meshStandardMaterial color="#cce7a5" roughness={0.92} />
      </mesh>
      <OrbitControls
        enablePan={false}
        enableRotate={false}
        enableZoom={false}
        target={[0, 1.05, 0]}
        maxPolarAngle={MathUtils.degToRad(77)}
        minPolarAngle={MathUtils.degToRad(48)}
      />
      {quality.postprocessing ? (
        <EffectComposer multisampling={2}>
          <Bloom luminanceThreshold={0.62} luminanceSmoothing={0.78} intensity={0.18} />
        </EffectComposer>
      ) : null}
    </>
  );
}

export function LifeTree3D({ variant = "card" }: { variant?: TreeVariant }) {
  const reduced = useReducedMotion();
  const isWorld = variant === "world";
  const quality = useVisualQuality(reduced, variant);

  return (
    <div className={`tree-lab tree-lab-${variant}`}>
      <Canvas
        camera={{
          fov: isWorld ? 40 : 43,
          position: isWorld ? [0, 1.48, 6.25] : [0, 1.48, 6.75],
        }}
        dpr={quality.dpr}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <TreeScene reduced={reduced} variant={variant} quality={quality} />
      </Canvas>
      <div className="tree-lab-card">
        <b>自己建模的生命樹</b>
        <span>單棵完整樹，枝幹、葉片與葉脈都由前台程式生成。</span>
      </div>
    </div>
  );
}

type Vec2Tuple = readonly [number, number];

type TaipeiDistrict = {
  name: string;
  officialId: string;
  areaSquareMeters: number;
  center: readonly [number, number];
  points: readonly Vec2Tuple[];
  height: number;
  color: string;
};

type HeatSpot = {
  position: Vec3Tuple;
  scale: number;
  label: string;
  color: string;
  value: number;
};

const districtVisuals = {
  北投區: { height: 0.2, color: "#d6dfc2" },
  士林區: { height: 0.26, color: "#c3d9ad" },
  內湖區: { height: 0.22, color: "#a8c98d" },
  中山區: { height: 0.3, color: "#93bc83" },
  大同區: { height: 0.24, color: "#b7cc91" },
  松山區: { height: 0.25, color: "#b2ce93" },
  南港區: { height: 0.18, color: "#c8d6a0" },
  中正區: { height: 0.28, color: "#9fc185" },
  信義區: { height: 0.31, color: "#a0c385" },
  萬華區: { height: 0.21, color: "#d2d4a6" },
  大安區: { height: 0.33, color: "#8fba7e" },
  文山區: { height: 0.2, color: "#d8d8a8" },
} satisfies Record<string, { height: number; color: string }>;

const taipeiDistricts: TaipeiDistrict[] = taipeiDistrictBoundaries.map((district) => ({
  ...district,
  height: districtVisuals[district.name]?.height ?? 0.22,
  color: districtVisuals[district.name]?.color ?? "#b8d29b",
}));

function districtCenter(name: TaipeiDistrictBoundary["name"], lift = 0.42): Vec3Tuple {
  const district = taipeiDistrictBoundaries.find((item) => item.name === name);
  return district ? [district.center[0], lift, district.center[1]] : [0, lift, 0];
}

const heatSpots: HeatSpot[] = [
  { position: districtCenter("北投區", 0.38), scale: 1.12, label: "補水", color: "#ff3d2e", value: 96 },
  { position: districtCenter("士林區", 0.42), scale: 0.86, label: "花草", color: "#ffb020", value: 72 },
  { position: districtCenter("中山區", 0.46), scale: 0.92, label: "步行", color: "#ff6b21", value: 81 },
  { position: districtCenter("大安區", 0.52), scale: 1.2, label: "伸展", color: "#ef233c", value: 104 },
  { position: districtCenter("信義區", 0.44), scale: 0.78, label: "聆聽", color: "#ffbe0b", value: 64 },
  { position: districtCenter("內湖區", 0.4), scale: 0.72, label: "觀察", color: "#fb8500", value: 58 },
  { position: districtCenter("中正區", 0.5), scale: 1.02, label: "陪伴", color: "#14b8a6", value: 89 },
];

function shapeFromPoints(points: readonly Vec2Tuple[]) {
  const shape = new Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function HeatBloom({
  position,
  scale,
  color,
  label,
  value,
  index,
  reduced,
}: {
  position: Vec3Tuple;
  scale: number;
  color: string;
  label: string;
  value: number;
  index: number;
  reduced: boolean;
}) {
  const pulse = useRef<Group>(null);
  const labelWidth = 0.28 + label.length * 0.065;

  useFrame(({ clock }) => {
    if (reduced || !pulse.current) return;
    const wave = 1 + Math.sin(clock.elapsedTime * 1.6 + index) * 0.08;
    pulse.current.scale.setScalar(wave);
  });

  return (
    <group ref={pulse} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.52 * scale, 64]} />
        <meshBasicMaterial color="#15d5c8" transparent opacity={0.38} side={DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.34 * scale, 64]} />
        <meshBasicMaterial color="#ffe45e" transparent opacity={0.58} side={DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]}>
        <circleGeometry args={[0.18 * scale, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.72, 10]} />
        <meshBasicMaterial color="#fff0a3" transparent opacity={0.74} blending={AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.055, 14, 10]} />
        <meshBasicMaterial color="#fff7ad" transparent opacity={0.95} blending={AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.98, 0]} rotation={[0, 0, -0.2]}>
        <planeGeometry args={[labelWidth, 0.16]} />
        <meshBasicMaterial color="#fffdf7" transparent opacity={0.84} />
      </mesh>
      <mesh position={[0, 1.11, 0]} rotation={[0, 0, -0.2]}>
        <planeGeometry args={[0.2 + value / 420, 0.024]} />
        <meshBasicMaterial color={color} transparent opacity={0.92} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

function TaipeiDistrictPlate({ district, index }: { district: TaipeiDistrict; index: number }) {
  const shape = useMemo(() => shapeFromPoints(district.points), [district.points]);
  const topShape = useMemo(() => shapeFromPoints(district.points), [district.points]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -district.height, 0]} castShadow receiveShadow>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: district.height,
              bevelEnabled: true,
              bevelSize: 0.026,
              bevelThickness: 0.018,
              bevelSegments: 2,
            },
          ]}
        />
        <meshStandardMaterial color="#f3ead8" roughness={0.86} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02 + index * 0.002, 0]}>
        <shapeGeometry args={[topShape]} />
        <meshStandardMaterial
          color={district.color}
          roughness={0.72}
          metalness={0.03}
          emissive="#244d35"
          emissiveIntensity={0.04}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035 + index * 0.002, 0]}>
        <shapeGeometry args={[topShape]} />
        <meshBasicMaterial color="#fff8d5" transparent opacity={0.11} wireframe />
      </mesh>
    </group>
  );
}

function FlightLine({
  from,
  to,
  index,
  reduced,
}: {
  from: Vec3Tuple;
  to: Vec3Tuple;
  index: number;
  reduced: boolean;
}) {
  const follower = useRef<Group>(null);
  const curve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(from[0], from[1] + 0.28, from[2]),
        new Vector3((from[0] + to[0]) / 2, 1.08 + index * 0.035, (from[2] + to[2]) / 2),
        new Vector3(to[0], to[1] + 0.28, to[2]),
      ]),
    [from, to, index],
  );

  useFrame(({ clock }) => {
    if (reduced || !follower.current) return;
    const progress = (clock.elapsedTime * 0.16 + index * 0.13) % 1;
    follower.current.position.copy(curve.getPoint(progress));
  });

  return (
    <>
      <mesh>
        <tubeGeometry args={[curve, 40, 0.008, 5, false]} />
        <meshBasicMaterial color="#fff2a6" transparent opacity={0.28} blending={AdditiveBlending} />
      </mesh>
      <Trail width={0.08} length={5} color={new Color("#fff0a3")} attenuation={(t) => t * t}>
        <group ref={follower} position={curve.getPoint(0)}>
          <mesh>
            <sphereGeometry args={[0.035, 12, 8]} />
            <meshBasicMaterial color="#fff8b8" transparent opacity={0.86} blending={AdditiveBlending} />
          </mesh>
        </group>
      </Trail>
    </>
  );
}

function CityDataTerrain({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reduced || !group.current) return;
    group.current.position.y = Math.sin(clock.elapsedTime * 0.85) * 0.025;
  });

  return (
    <group ref={group} rotation={[0, -0.18, 0]} position={[0.18, -0.28, 0.16]} scale={1.08}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <circleGeometry args={[3.55, 128]} />
        <meshBasicMaterial color="#f5d99b" transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, 0]}>
        <ringGeometry args={[2.72, 3.02, 96]} />
        <meshBasicMaterial color="#f0b85d" transparent opacity={0.18} side={DoubleSide} />
      </mesh>
      {taipeiDistricts.map((district, index) => (
        <TaipeiDistrictPlate key={district.name} district={district} index={index} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <planeGeometry args={[5.6, 4.4, 22, 16]} />
        <meshBasicMaterial color="#5bc6d7" wireframe transparent opacity={0.12} />
      </mesh>
      {heatSpots.slice(1).map((spot, index) => (
        <FlightLine
          key={`flight-${spot.label}`}
          from={heatSpots[0]!.position}
          to={spot.position}
          index={index}
          reduced={reduced}
        />
      ))}
      {heatSpots.map((spot, index) => (
        <HeatBloom key={spot.label} {...spot} index={index} reduced={reduced} />
      ))}
    </group>
  );
}

export function RadarMap3D() {
  const reduced = useReducedMotion();

  return (
    <div className="radar-3d-panel" aria-label="3D 台北任務雷達示意">
      <div className="radar-3d-title">
        <span>ELDER TREE CITY BRAIN</span>
        <b>台北任務探索大屏</b>
      </div>
      <Canvas camera={{ fov: 40, position: [0, 4.35, 5.7] }} dpr={[1, 1.5]}>
        <color attach="background" args={["#fff1dc"]} />
        <fog attach="fog" args={["#fff1dc", 7, 13]} />
        <ambientLight intensity={0.96} />
        <directionalLight position={[3, 5, 4]} intensity={2.15} />
        <pointLight position={[-2.4, 2.4, 2.8]} color="#ffe2a2" intensity={2.2} />
        <CityDataTerrain reduced={reduced} />
        {!reduced ? (
          <EffectComposer multisampling={2}>
            <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.74} intensity={0.38} />
          </EffectComposer>
        ) : null}
        <OrbitControls
          enablePan={false}
          enableRotate={false}
          enableZoom={false}
          maxPolarAngle={MathUtils.degToRad(72)}
          minPolarAngle={MathUtils.degToRad(48)}
        />
      </Canvas>
      <div className="radar-3d-side-panel">
        <span>今日任務熱區</span>
        <b>28</b>
        <small>安全任務池 · 前景定位</small>
        <i>+42% 城市探索活躍</i>
      </div>
      <div className="radar-3d-stats">
        <span>OPEN QUESTS <b>07</b></span>
        <span>SAFE RADIUS <b>150m</b></span>
        <span>TREE ENERGY <b>1.8k</b></span>
      </div>
      <div className="radar-3d-caption">
        <b>城市任務熱力圖</b>
        <span>台北輪廓板塊、任務光柱與飛線，示意城市任務正在流向生命樹。</span>
      </div>
    </div>
  );
}
