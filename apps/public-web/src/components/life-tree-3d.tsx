"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  OrbitControls,
  Trail,
} from "@react-three/drei";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  MathUtils,
  Shape,
  Vector3,
  type Group,
} from "three";

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
  { from: [0, 0, 0], to: [0.04, 0.82, 0.02], radiusBottom: 0.28, radiusTop: 0.22 },
  { from: [0.04, 0.82, 0.02], to: [-0.03, 1.58, -0.02], radiusBottom: 0.22, radiusTop: 0.16 },
  { from: [-0.03, 1.58, -0.02], to: [0.04, 2.24, 0.02], radiusBottom: 0.16, radiusTop: 0.095 },
  { from: [0.04, 2.24, 0.02], to: [0.02, 2.86, -0.04], radiusBottom: 0.095, radiusTop: 0.045 },
];

const branchSegments: BranchSpec[] = [
  { from: [0.02, 0.78, 0.02], to: [-0.52, 0.42, 0.14], radiusBottom: 0.08, radiusTop: 0.028 },
  { from: [0.02, 0.78, 0.02], to: [0.54, 0.44, -0.12], radiusBottom: 0.075, radiusTop: 0.026 },
  { from: [0.01, 1.18, 0], to: [-0.9, 1.74, 0.12], radiusBottom: 0.09, radiusTop: 0.034 },
  { from: [-0.45, 1.46, 0.08], to: [-1.24, 1.96, 0.18], radiusBottom: 0.052, radiusTop: 0.018 },
  { from: [-0.36, 1.38, 0.05], to: [-0.92, 2.25, -0.14], radiusBottom: 0.045, radiusTop: 0.016 },
  { from: [0.02, 1.34, 0], to: [0.92, 1.86, -0.1], radiusBottom: 0.09, radiusTop: 0.034 },
  { from: [0.47, 1.6, -0.06], to: [1.26, 2.18, -0.16], radiusBottom: 0.052, radiusTop: 0.018 },
  { from: [0.38, 1.72, -0.04], to: [0.78, 2.48, 0.22], radiusBottom: 0.04, radiusTop: 0.014 },
  { from: [-0.02, 1.86, 0], to: [-0.48, 2.72, 0.24], radiusBottom: 0.066, radiusTop: 0.02 },
  { from: [0.04, 1.94, -0.02], to: [0.54, 2.82, -0.12], radiusBottom: 0.066, radiusTop: 0.02 },
  { from: [0.02, 2.28, -0.02], to: [-0.18, 3.18, 0.06], radiusBottom: 0.052, radiusTop: 0.014 },
  { from: [0.03, 2.28, -0.02], to: [0.24, 3.1, -0.08], radiusBottom: 0.05, radiusTop: 0.014 },
];

const canopyClusters = [
  { position: [-1.08, 2.12, 0.1] as Vec3Tuple, scale: [1.08, 0.64, 0.42] as Vec3Tuple, color: "#5ea85f" },
  { position: [-0.58, 2.5, 0.22] as Vec3Tuple, scale: [1.04, 0.66, 0.46] as Vec3Tuple, color: "#76bd61" },
  { position: [0.02, 2.68, 0.18] as Vec3Tuple, scale: [1.18, 0.78, 0.5] as Vec3Tuple, color: "#68b65b" },
  { position: [0.6, 2.48, 0.12] as Vec3Tuple, scale: [1.04, 0.64, 0.44] as Vec3Tuple, color: "#79c866" },
  { position: [1.08, 2.14, 0.04] as Vec3Tuple, scale: [1, 0.6, 0.42] as Vec3Tuple, color: "#5faa62" },
  { position: [-0.08, 3.08, 0.12] as Vec3Tuple, scale: [0.96, 0.62, 0.42] as Vec3Tuple, color: "#8dd06b" },
  { position: [-0.38, 2.18, 0.5] as Vec3Tuple, scale: [0.9, 0.54, 0.34] as Vec3Tuple, color: "#8ccf68" },
  { position: [0.42, 2.15, 0.44] as Vec3Tuple, scale: [0.9, 0.54, 0.34] as Vec3Tuple, color: "#4f995a" },
  { position: [-0.2, 1.9, 0.28] as Vec3Tuple, scale: [0.84, 0.46, 0.32] as Vec3Tuple, color: "#5ea85f" },
  { position: [0.36, 1.92, 0.24] as Vec3Tuple, scale: [0.82, 0.46, 0.32] as Vec3Tuple, color: "#6db85c" },
  { position: [-0.78, 2.72, 0.02] as Vec3Tuple, scale: [0.76, 0.46, 0.32] as Vec3Tuple, color: "#6dbf62" },
  { position: [0.78, 2.7, 0.02] as Vec3Tuple, scale: [0.76, 0.46, 0.32] as Vec3Tuple, color: "#75c461" },
];

const leafPalette = ["#4f995a", "#69b85e", "#7bc766", "#8fd66e", "#d6d66a"];

const designedLeaves = canopyClusters.flatMap((cluster, clusterIndex) =>
  Array.from({ length: clusterIndex === 2 ? 110 : 78 }, (_, leafIndex) => {
    const seed = clusterIndex * 37 + leafIndex * 11;
    const theta = seed * 2.399963;
    const radius = 0.08 + ((seed * 17) % 100) / 100 * 0.94;
    const vertical = (((seed * 29) % 100) / 100 - 0.5) * 0.9;
    const x = cluster.position[0] + Math.cos(theta) * radius * cluster.scale[0];
    const y = cluster.position[1] + vertical * cluster.scale[1];
    const z = cluster.position[2] + Math.sin(theta) * radius * cluster.scale[2];

    return {
      position: [x, y, z] as Vec3Tuple,
      rotation: [
        -0.18 + (((seed * 7) % 100) / 100) * 0.36,
        -0.28 + (((seed * 23) % 100) / 100) * 0.56,
        theta + (((seed * 13) % 100) / 100) * 0.42,
      ] as Vec3Tuple,
      scale: 0.27 + (((seed * 19) % 100) / 100) * 0.27,
      color: leafPalette[(seed + clusterIndex) % leafPalette.length],
      delay: (seed % 17) * 0.09,
    };
  }),
);

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

function OrganicBranch({ from, to, radiusBottom, radiusTop, color = "#7b5538" }: BranchSpec) {
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
        <meshStandardMaterial color={color} roughness={0.92} metalness={0.02} />
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

function IndividualLeaf({
  position,
  rotation,
  scale,
  color,
}: {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: number;
  color: string;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow receiveShadow>
        <shapeGeometry args={[leafShape, 12]} />
        <meshStandardMaterial color={color} roughness={0.72} side={DoubleSide} />
      </mesh>
      <mesh position={[0, -0.02, 0.012]}>
        <boxGeometry args={[0.012, 0.24, 0.008]} />
        <meshStandardMaterial color="#eef7a4" roughness={0.64} />
      </mesh>
      <mesh position={[0, -0.18, 0.004]} rotation={[0, 0, 0.28]}>
        <boxGeometry args={[0.008, 0.08, 0.006]} />
        <meshStandardMaterial color="#67883e" roughness={0.75} />
      </mesh>
    </group>
  );
}

function LeafCanopy({ reduced }: { reduced: boolean }) {
  const canopy = useRef<Group>(null);
  const leaves = useRef<Group[]>([]);

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    if (canopy.current) {
      canopy.current.rotation.z = Math.sin(t * 0.72) * 0.024;
      canopy.current.rotation.y = Math.sin(t * 0.42) * 0.034;
    }
    leaves.current.forEach((leaf, index) => {
      const motion = Math.sin(t * 1.18 + designedLeaves[index].delay);
      leaf.rotation.z += motion * 0.0012;
      leaf.position.y += motion * 0.0008;
    });
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
            opacity={0.44}
            roughness={0.88}
          />
        </mesh>
      ))}
      {designedLeaves.map((leaf, index) => (
        <group
          key={`${leaf.position.join("-")}-${index}`}
          ref={(node) => {
            if (node) leaves.current[index] = node;
          }}
        >
          <IndividualLeaf {...leaf} />
        </group>
      ))}
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

function LifeTreeModel({ reduced }: { reduced: boolean }) {
  const tree = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (reduced) return;
    const sway = Math.sin(clock.elapsedTime * 0.68) * 0.026;
    if (tree.current) tree.current.rotation.z = sway;
  });

  return (
    <group ref={tree} position={[0, -1.48, 0]} scale={0.98}>
      {trunkSegments.map((segment, index) => (
        <OrganicBranch key={`trunk-${index}`} {...segment} />
      ))}
      {branchSegments.map((segment, index) => (
        <OrganicBranch key={`branch-${index}`} color="#6b472f" {...segment} />
      ))}
      {[
        [0.02, 1.18, 0.01, 0.18],
        [0.03, 1.72, 0, 0.13],
        [0.04, 2.18, -0.01, 0.08],
      ].map(([x, y, z, radius], index) => (
        <mesh key={`tree-knot-${index}`} position={[x, y, z]} castShadow receiveShadow>
          <sphereGeometry args={[radius, 18, 12]} />
          <meshStandardMaterial color={index === 0 ? "#6f472f" : "#775037"} roughness={0.92} />
        </mesh>
      ))}
      <LeafCanopy reduced={reduced} />
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

function TreeScene({ reduced }: { reduced: boolean }) {
  return (
    <>
      <color attach="background" args={["#dff8e8"]} />
      <fog attach="fog" args={["#dff8e8", 7, 13]} />
      <ambientLight intensity={0.72} />
      <directionalLight castShadow position={[4, 6, 3]} intensity={1.65} />
      <pointLight position={[-2.6, 2.6, 2.8]} color="#fff1a6" intensity={3.8} />
      <Float speed={reduced ? 0 : 0.85} rotationIntensity={0} floatIntensity={0.12}>
        <LifeTreeModel reduced={reduced} />
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
    </>
  );
}

export function LifeTree3D() {
  const reduced = useReducedMotion();

  return (
    <div className="tree-lab">
      <Canvas
        camera={{ fov: 43, position: [0, 1.48, 6.75] }}
        dpr={[1, 1.65]}
        gl={{ antialias: true, alpha: false }}
      >
        <TreeScene reduced={reduced} />
      </Canvas>
      <div className="tree-lab-card">
        <b>自己建模的生命樹</b>
        <span>單棵完整樹，枝幹、葉片與葉脈都由前台程式生成。</span>
      </div>
    </div>
  );
}

const cityBlocks = [
  { position: [-1.95, 0, -0.85] as Vec3Tuple, scale: [1.1, 0.16, 0.72] as Vec3Tuple, color: "#d6d5bc" },
  { position: [-1.18, 0, 0.18] as Vec3Tuple, scale: [0.92, 0.2, 1.3] as Vec3Tuple, color: "#b5d39b" },
  { position: [-0.12, 0, -0.62] as Vec3Tuple, scale: [1.18, 0.18, 0.82] as Vec3Tuple, color: "#a9c98e" },
  { position: [0.64, 0, 0.42] as Vec3Tuple, scale: [1.34, 0.2, 1.05] as Vec3Tuple, color: "#9fc185" },
  { position: [1.72, 0, -0.34] as Vec3Tuple, scale: [0.92, 0.17, 0.78] as Vec3Tuple, color: "#c6d6a2" },
  { position: [1.82, 0, 0.82] as Vec3Tuple, scale: [0.72, 0.14, 0.54] as Vec3Tuple, color: "#a9c88a" },
];

const heatSpots = [
  { position: [-1.72, 0.18, -0.82] as Vec3Tuple, scale: 1.04, label: "補水", color: "#f04438" },
  { position: [-0.95, 0.24, 0.42] as Vec3Tuple, scale: 0.82, label: "花草", color: "#ffb020" },
  { position: [-0.12, 0.22, -0.38] as Vec3Tuple, scale: 0.94, label: "步行", color: "#ff6b21" },
  { position: [0.78, 0.26, 0.22] as Vec3Tuple, scale: 1.12, label: "伸展", color: "#ef233c" },
  { position: [1.48, 0.22, -0.38] as Vec3Tuple, scale: 0.78, label: "聆聽", color: "#ffbe0b" },
  { position: [1.72, 0.2, 0.84] as Vec3Tuple, scale: 0.64, label: "觀察", color: "#fb8500" },
];

function HeatBloom({
  position,
  scale,
  color,
  index,
  reduced,
}: {
  position: Vec3Tuple;
  scale: number;
  color: string;
  index: number;
  reduced: boolean;
}) {
  const pulse = useRef<Group>(null);

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
        <planeGeometry args={[0.34, 0.13]} />
        <meshBasicMaterial color="#fffdf7" transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

function CityDataTerrain({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reduced || !group.current) return;
    group.current.position.y = Math.sin(clock.elapsedTime * 0.85) * 0.025;
  });

  return (
    <group ref={group} rotation={[0, -0.18, 0]} position={[0, -0.28, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <circleGeometry args={[3.25, 96]} />
        <meshBasicMaterial color="#f5d99b" transparent opacity={0.22} />
      </mesh>
      {cityBlocks.map((block, index) => (
        <group key={index} position={block.position}>
          <mesh position={[0, -block.scale[1] * 0.5, 0]}>
            <boxGeometry args={[block.scale[0], block.scale[1], block.scale[2]]} />
            <meshStandardMaterial color="#f1ead8" roughness={0.86} />
          </mesh>
          <mesh position={[0, block.scale[1] * 0.08, 0]}>
            <boxGeometry args={[block.scale[0] * 0.96, 0.035, block.scale[2] * 0.96]} />
            <meshStandardMaterial color={block.color} roughness={0.78} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <planeGeometry args={[4.8, 3.2, 18, 12]} />
        <meshBasicMaterial color="#5bc6d7" wireframe transparent opacity={0.18} />
      </mesh>
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
      <Canvas camera={{ fov: 42, position: [0, 4.05, 5.45] }} dpr={[1, 1.5]}>
        <color attach="background" args={["#fff1dc"]} />
        <fog attach="fog" args={["#fff1dc", 7, 13]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 4]} intensity={1.85} />
        <pointLight position={[-2.4, 2.4, 2.8]} color="#ffe2a2" intensity={1.8} />
        <CityDataTerrain reduced={reduced} />
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
      </div>
      <div className="radar-3d-caption">
        <b>城市任務熱力圖</b>
        <span>熱區代表任務密度，光柱代表可接取事件。</span>
      </div>
    </div>
  );
}
