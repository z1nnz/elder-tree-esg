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
  { from: [0.02, 0.62, 0.02], to: [-0.55, 0.24, 0.14], radiusBottom: 0.11, radiusTop: 0.035 },
  { from: [0.02, 0.62, 0.02], to: [0.56, 0.28, -0.12], radiusBottom: 0.1, radiusTop: 0.032 },
  { from: [0.01, 1.18, 0], to: [-0.9, 1.7, 0.12], radiusBottom: 0.105, radiusTop: 0.04 },
  { from: [-0.45, 1.46, 0.08], to: [-1.24, 1.96, 0.18], radiusBottom: 0.052, radiusTop: 0.018 },
  { from: [-0.36, 1.38, 0.05], to: [-0.92, 2.25, -0.14], radiusBottom: 0.045, radiusTop: 0.016 },
  { from: [0.02, 1.34, 0], to: [0.92, 1.82, -0.1], radiusBottom: 0.11, radiusTop: 0.04 },
  { from: [0.47, 1.6, -0.06], to: [1.26, 2.18, -0.16], radiusBottom: 0.052, radiusTop: 0.018 },
  { from: [0.38, 1.72, -0.04], to: [0.78, 2.48, 0.22], radiusBottom: 0.04, radiusTop: 0.014 },
  { from: [-0.02, 1.86, 0], to: [-0.48, 2.72, 0.24], radiusBottom: 0.066, radiusTop: 0.02 },
  { from: [0.04, 1.94, -0.02], to: [0.54, 2.82, -0.12], radiusBottom: 0.066, radiusTop: 0.02 },
  { from: [0.02, 2.28, -0.02], to: [-0.18, 3.18, 0.06], radiusBottom: 0.052, radiusTop: 0.014 },
  { from: [0.03, 2.28, -0.02], to: [0.24, 3.1, -0.08], radiusBottom: 0.05, radiusTop: 0.014 },
];

const canopyClusters = [
  { position: [-0.92, 2.12, 0.02] as Vec3Tuple, scale: [0.78, 0.5, 0.5] as Vec3Tuple, color: "#5ea85f" },
  { position: [-0.52, 2.52, 0.18] as Vec3Tuple, scale: [0.82, 0.56, 0.5] as Vec3Tuple, color: "#76bd61" },
  { position: [0.02, 2.68, 0.04] as Vec3Tuple, scale: [0.92, 0.64, 0.58] as Vec3Tuple, color: "#68b65b" },
  { position: [0.6, 2.48, -0.1] as Vec3Tuple, scale: [0.82, 0.54, 0.48] as Vec3Tuple, color: "#79c866" },
  { position: [0.92, 2.1, -0.08] as Vec3Tuple, scale: [0.72, 0.48, 0.43] as Vec3Tuple, color: "#5faa62" },
  { position: [-0.1, 3.08, -0.02] as Vec3Tuple, scale: [0.72, 0.52, 0.46] as Vec3Tuple, color: "#8dd06b" },
  { position: [-0.28, 2.18, 0.44] as Vec3Tuple, scale: [0.64, 0.42, 0.38] as Vec3Tuple, color: "#8ccf68" },
  { position: [0.32, 2.18, -0.44] as Vec3Tuple, scale: [0.68, 0.44, 0.4] as Vec3Tuple, color: "#4f995a" },
];

const leafPalette = ["#4f995a", "#69b85e", "#7bc766", "#8fd66e", "#d6d66a"];

const designedLeaves = canopyClusters.flatMap((cluster, clusterIndex) =>
  Array.from({ length: clusterIndex === 2 ? 68 : 50 }, (_, leafIndex) => {
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
        -0.35 + (((seed * 7) % 100) / 100) * 0.7,
        theta,
        -0.65 + (((seed * 13) % 100) / 100) * 1.3,
      ] as Vec3Tuple,
      scale: 0.44 + (((seed * 19) % 100) / 100) * 0.46,
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
            opacity={0.34}
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
    <group ref={tree} position={[0, -1.55, 0]} scale={1.08}>
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
      <Float speed={reduced ? 0 : 1.2} rotationIntensity={0.08} floatIntensity={0.22}>
        <LifeTreeModel reduced={reduced} />
      </Float>
      <GrowthTrail reduced={reduced} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.44, 0]} receiveShadow>
        <circleGeometry args={[2.75, 80]} />
        <meshStandardMaterial color="#cce7a5" roughness={0.92} />
      </mesh>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        target={[0, 1.05, 0]}
        autoRotate={!reduced}
        autoRotateSpeed={0.45}
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
        camera={{ fov: 41, position: [0, 1.42, 6.35] }}
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

const radarPoints = [
  { position: [-1.8, 0.12, 0.7] as const, color: "#c7eb63" },
  { position: [1.45, 0.16, -0.45] as const, color: "#ffd45c" },
  { position: [0.42, 0.14, 1.35] as const, color: "#9ee8f2" },
  { position: [-0.38, 0.18, -1.45] as const, color: "#f5b56b" },
];

function RadarPulse({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reduced || !group.current) return;
    group.current.rotation.y = clock.elapsedTime * 0.14;
  });

  return (
    <group ref={group}>
      {radarPoints.map((point, index) => (
        <group key={index} position={point.position}>
          <mesh>
            <sphereGeometry args={[0.11, 18, 14]} />
            <meshBasicMaterial color={point.color} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.24, 0.28, 40]} />
            <meshBasicMaterial
              color={point.color}
              transparent
              opacity={0.6}
              blending={AdditiveBlending}
              side={DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function RadarMap3D() {
  const reduced = useReducedMotion();

  return (
    <div className="radar-3d-panel" aria-label="3D 台北任務雷達示意">
      <Canvas camera={{ fov: 48, position: [0, 4.8, 5.8] }} dpr={[1, 1.5]}>
        <color attach="background" args={["#0d3026"]} />
        <fog attach="fog" args={["#0d3026", 6, 13]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.2, 5.2, 18, 18]} />
          <meshStandardMaterial color="#5ccf86" wireframe transparent opacity={0.52} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
          <ringGeometry args={[0.78, 0.8, 80]} />
          <meshBasicMaterial color="#ffd45c" transparent opacity={0.75} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.18, 24, 18]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <RadarPulse reduced={reduced} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate={!reduced}
          autoRotateSpeed={0.35}
          maxPolarAngle={MathUtils.degToRad(72)}
          minPolarAngle={MathUtils.degToRad(48)}
        />
      </Canvas>
      <div className="radar-3d-caption">
        <b>台北任務雷達</b>
        <span>光點代表任務，圓環代表可接取範圍。</span>
      </div>
    </div>
  );
}
