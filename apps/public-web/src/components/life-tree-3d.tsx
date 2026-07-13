"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
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
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  Texture,
  Vector3,
  type Group,
  type InstancedMesh,
} from "three";
import { taipeiDistrictBoundaries, type TaipeiDistrictBoundary } from "./taipei-district-boundaries";
import {
  getTaipeiDistrictMission,
  taipeiHeatSpots,
} from "./taipei-quest-data";

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
  district: TaipeiDistrictBoundary["name"];
  position: Vec3Tuple;
  scale: number;
  label: string;
  color: string;
  value: number;
};

const districtVisuals = {
  北投區: { height: 0.34, color: "#9fbd76" },
  士林區: { height: 0.42, color: "#88b366" },
  內湖區: { height: 0.32, color: "#83b06f" },
  中山區: { height: 0.28, color: "#70a76c" },
  大同區: { height: 0.24, color: "#a9bb78" },
  松山區: { height: 0.26, color: "#9ab976" },
  南港區: { height: 0.36, color: "#a5bd72" },
  中正區: { height: 0.3, color: "#78a668" },
  信義區: { height: 0.34, color: "#86b16b" },
  萬華區: { height: 0.23, color: "#babc7a" },
  大安區: { height: 0.38, color: "#6ba764" },
  文山區: { height: 0.46, color: "#adbb6e" },
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

const heatSpots: HeatSpot[] = taipeiHeatSpots.map((spot) => ({
  ...spot,
  position: districtCenter(spot.district, spot.lift),
  color: getTaipeiDistrictMission(spot.district)?.heat ?? "#ffb020",
}));

const decorativeRaycast = () => undefined;

function terrainHeight(x: number, y: number) {
  const northWestHills = Math.exp(-((x + 1.55) ** 2 / 0.82 + (y + 1.38) ** 2 / 0.72)) * 0.72;
  const southEastHills = Math.exp(-((x - 1.18) ** 2 / 0.9 + (y - 1.15) ** 2 / 0.64)) * 0.58;
  const southRidge = Math.exp(-((x - 0.12) ** 2 / 2.2 + (y - 1.62) ** 2 / 0.34)) * 0.42;
  const basin = Math.exp(-(x ** 2 / 2.8 + y ** 2 / 1.8)) * 0.22;
  const ripple = (Math.sin(x * 4.4 + y * 1.7) + Math.cos(y * 5.1 - x * 1.2)) * 0.025;
  return Math.max(0.02, northWestHills + southEastHills + southRidge - basin + ripple + 0.08);
}

function createContourTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, size, size);
  context.fillStyle = "rgba(255, 246, 218, 0.06)";
  context.fillRect(0, 0, size, size);

  for (let level = 0.12; level <= 0.72; level += 0.085) {
    context.beginPath();
    let started = false;
    for (let px = 0; px <= size; px += 5) {
      const x = (px / size - 0.5) * 5.8;
      let bestY = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let py = 0; py <= size; py += 5) {
        const y = (py / size - 0.5) * 4.4;
        const distance = Math.abs(terrainHeight(x, y) - level);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestY = py;
        }
      }
      if (bestDistance < 0.035) {
        if (!started) {
          context.moveTo(px, bestY);
          started = true;
        } else {
          context.lineTo(px, bestY);
        }
      } else {
        started = false;
      }
    }
    context.strokeStyle = level > 0.48 ? "rgba(142, 102, 31, .38)" : "rgba(87, 126, 82, .32)";
    context.lineWidth = level > 0.48 ? 2.2 : 1.4;
    context.stroke();
  }

  context.strokeStyle = "rgba(255, 255, 255, .18)";
  context.lineWidth = 1;
  for (let i = 0; i < 9; i += 1) {
    const y = (i / 8) * size;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y + Math.sin(i) * 18);
    context.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

function shapeFromPoints(points: readonly Vec2Tuple[]) {
  const shape = new Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function TaipeiContourTerrain() {
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(5.8, 4.4, 72, 54);
    const position = plane.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      position.setZ(index, terrainHeight(x, y) * 0.42);
    }
    position.needsUpdate = true;
    plane.computeVertexNormals();
    return plane;
  }, []);
  const contourTexture = useMemo(() => createContourTexture(), []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.105, 0]}>
      {[0, 1, 2, 3].map((layer) => (
        <mesh
          key={`terrain-layer-${layer}`}
          position={[0, 0, -0.11 - layer * 0.045]}
          raycast={decorativeRaycast}
        >
          <planeGeometry args={[5.9 + layer * 0.08, 4.5 + layer * 0.08, 1, 1]} />
          <meshBasicMaterial
            color={["#fff1d6", "#f5d39c", "#dba56e", "#a9774f"][layer]}
            transparent
            opacity={0.2 - layer * 0.025}
            side={DoubleSide}
          />
        </mesh>
      ))}
      <mesh geometry={geometry} receiveShadow raycast={decorativeRaycast}>
        <meshStandardMaterial
          color="#c7da9b"
          roughness={0.88}
          metalness={0.02}
          emissive="#274c32"
          emissiveIntensity={0.052}
        />
      </mesh>
      <mesh geometry={geometry} position={[0, 0, 0.018]} raycast={decorativeRaycast}>
        <meshBasicMaterial map={contourTexture} transparent opacity={0.92} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.012]} raycast={decorativeRaycast}>
        <planeGeometry args={[5.8, 4.4, 36, 28]} />
        <meshBasicMaterial color="#fff6de" wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function HeatBloom({
  position,
  scale,
  color,
  index,
  reduced,
  dimmed,
}: {
  position: Vec3Tuple;
  scale: number;
  color: string;
  label: string;
  value: number;
  index: number;
  reduced: boolean;
  dimmed: boolean;
}) {
  const pulse = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (reduced || !pulse.current) return;
    const wave = 1 + Math.sin(clock.elapsedTime * 1.6 + index) * 0.08;
    pulse.current.scale.setScalar(wave);
  });

  return (
    <group ref={pulse} position={position} raycast={decorativeRaycast}>
      <mesh raycast={decorativeRaycast} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.26 * scale, 64]} />
        <meshBasicMaterial color="#15d5c8" transparent opacity={dimmed ? 0.035 : 0.14} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh raycast={decorativeRaycast} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.16 * scale, 64]} />
        <meshBasicMaterial color="#ffe45e" transparent opacity={dimmed ? 0.07 : 0.28} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh raycast={decorativeRaycast} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]}>
        <circleGeometry args={[0.08 * scale, 64]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.16 : 0.68} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh raycast={decorativeRaycast} position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 10]} />
        <meshBasicMaterial color="#fff0a3" transparent opacity={dimmed ? 0.06 : 0.38} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh raycast={decorativeRaycast} position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.04, 14, 10]} />
        <meshBasicMaterial color="#fff7ad" transparent opacity={dimmed ? 0.12 : 0.72} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function TaipeiDistrictPlate({
  district,
  index,
  activeDistrict,
  setActiveDistrict,
}: {
  district: TaipeiDistrict;
  index: number;
  activeDistrict: string | null;
  setActiveDistrict: (name: string | null) => void;
}) {
  const shape = useMemo(() => shapeFromPoints(district.points), [district.points]);
  const topShape = useMemo(() => shapeFromPoints(district.points), [district.points]);
  const group = useRef<Group>(null);
  const mission = getTaipeiDistrictMission(district.name);
  const isActive = activeDistrict === district.name;

  useFrame(() => {
    if (!group.current) return;
    group.current.position.y = MathUtils.lerp(group.current.position.y, isActive ? 0.18 : 0, 0.14);
    group.current.scale.x = MathUtils.lerp(group.current.scale.x, isActive ? 1.026 : 1, 0.14);
    group.current.scale.z = MathUtils.lerp(group.current.scale.z, isActive ? 1.026 : 1, 0.14);
  });

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setActiveDistrict(district.name);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setActiveDistrict(null);
  };

  return (
    <group ref={group}>
      {[0, 1, 2].map((layer) => (
        <mesh
          key={`${district.name}-strata-${layer}`}
          raycast={decorativeRaycast}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -district.height - layer * 0.052, 0]}
          scale={[1 + layer * 0.01, 1 + layer * 0.01, 1]}
          castShadow
          receiveShadow
        >
          <extrudeGeometry
            args={[
              shape,
              {
                depth: 0.05,
                bevelEnabled: false,
              },
            ]}
          />
          <meshStandardMaterial
            color={layer === 0 ? "#fff1dc" : layer === 1 ? "#e8c08c" : "#b6855c"}
            roughness={0.9}
            metalness={0.01}
            transparent
            opacity={0.78 - layer * 0.12}
          />
        </mesh>
      ))}
      <mesh
        raycast={decorativeRaycast}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -district.height, 0]}
        castShadow
        receiveShadow
      >
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
        <meshStandardMaterial
          color={isActive ? "#f7df9a" : "#e9d8bb"}
          roughness={0.82}
          metalness={0.02}
        />
      </mesh>
      <mesh
        raycast={decorativeRaycast}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02 + index * 0.002, 0]}
      >
        <shapeGeometry args={[topShape]} />
        <meshStandardMaterial
          color={isActive ? "#dffc78" : district.color}
          roughness={0.72}
          metalness={0.03}
          emissive={isActive ? mission?.heat ?? "#ffb020" : "#244d35"}
          emissiveIntensity={isActive ? 0.18 : 0.045}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.08 + index * 0.002, 0]}
        onClick={handlePointerOver}
        onPointerMove={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerOver={handlePointerOver}
        renderOrder={20 + index}
      >
        <shapeGeometry args={[topShape]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
      <mesh
        raycast={decorativeRaycast}
        position={[district.center[0], 0.09, district.center[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[isActive ? 0.26 : 0.16, 48]} />
        <meshBasicMaterial
          color={mission?.heat ?? "#ffb020"}
          transparent
          opacity={isActive ? 0.28 : 0.08}
          blending={AdditiveBlending}
          depthWrite={false}
        />
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
      <mesh raycast={decorativeRaycast}>
        <tubeGeometry args={[curve, 40, 0.008, 5, false]} />
        <meshBasicMaterial color="#fff2a6" transparent opacity={0.28} blending={AdditiveBlending} />
      </mesh>
      <Trail width={0.08} length={5} color={new Color("#fff0a3")} attenuation={(t) => t * t}>
        <group ref={follower} position={curve.getPoint(0)}>
          <mesh raycast={decorativeRaycast}>
            <sphereGeometry args={[0.035, 12, 8]} />
            <meshBasicMaterial color="#fff8b8" transparent opacity={0.86} blending={AdditiveBlending} />
          </mesh>
        </group>
      </Trail>
    </>
  );
}

function CityDataTerrain({
  reduced,
  activeDistrict,
  setActiveDistrict,
}: {
  reduced: boolean;
  activeDistrict: string | null;
  setActiveDistrict: (name: string | null) => void;
}) {
  const group = useRef<Group>(null);
  const verticalLift = 0.22;

  useFrame(({ clock }) => {
    if (reduced || !group.current) return;
    group.current.position.y = verticalLift + Math.sin(clock.elapsedTime * 0.85) * 0.025;
  });

  return (
    <group ref={group} rotation={[0, Math.PI / 2 - 0.08, 0]} position={[0.02, verticalLift, 0.02]} scale={[1.36, 1.04, 1.04]}>
      {taipeiDistricts.map((district, index) => (
        <TaipeiDistrictPlate
          key={district.name}
          district={district}
          index={index}
          activeDistrict={activeDistrict}
          setActiveDistrict={setActiveDistrict}
        />
      ))}
      {heatSpots.map((spot, index) => (
        <HeatBloom
          key={spot.label}
          {...spot}
          index={index}
          reduced={reduced}
          dimmed={Boolean(activeDistrict && activeDistrict !== spot.district)}
        />
      ))}
    </group>
  );
}

export function RadarMap3D({
  activeDistrict: controlledActiveDistrict,
  onActiveDistrictChange,
}: {
  activeDistrict?: string | null;
  onActiveDistrictChange?: (name: string | null) => void;
} = {}) {
  const reduced = useReducedMotion();
	  const [internalActiveDistrict, setInternalActiveDistrict] = useState<string | null>(null);
	  const activeDistrict = controlledActiveDistrict ?? internalActiveDistrict;
	  const setActiveDistrict = onActiveDistrictChange ?? setInternalActiveDistrict;

	  return (
    <div className="radar-3d-panel" aria-label="3D 台北任務雷達示意">
      <Canvas camera={{ fov: 28.5, position: [0, 5.4, 7.08] }} dpr={[1, 1.5]}>
        <color attach="background" args={["#fff3de"]} />
        <ambientLight intensity={0.68} />
        <directionalLight position={[3, 5, 4]} intensity={2.05} />
        <pointLight position={[-2.4, 2.4, 2.8]} color="#ffe2a2" intensity={0.88} />
        <CityDataTerrain
          activeDistrict={activeDistrict}
          reduced={reduced}
          setActiveDistrict={setActiveDistrict}
        />
        {!reduced ? (
          <EffectComposer multisampling={2}>
            <Bloom luminanceThreshold={0.54} luminanceSmoothing={0.7} intensity={0.12} />
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
	    </div>
	  );
}
