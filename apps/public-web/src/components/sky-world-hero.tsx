"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Object3D,
  Shape,
  Vector3,
  type Group,
  type InstancedMesh,
} from "three";

type Vec3Tuple = readonly [number, number, number];

const islandLinks = [
  {
    key: "explore",
    href: "/explore",
    title: "城市探索島",
    body: "讓城市像溫柔的冒險地圖，路線、地標與任務在安全範圍內被解鎖。",
    className: "island-explore",
  },
  {
    key: "radar",
    href: "/explore",
    title: "任務雷達島",
    body: "限時任務像光點一樣出現，靠近只解鎖，完成後才讓生命樹成長。",
    className: "island-radar",
  },
  {
    key: "tree",
    href: "/product",
    title: "生命樹主島",
    body: "任務不是冷冰冰的點數，而是長成一棵看得見、會呼吸的世界樹。",
    className: "island-tree",
  },
  {
    key: "care",
    href: "/partners",
    title: "陪伴網絡島",
    body: "一個人也能開始；需要時，再邀請家人、志工、社工或長照團體同行。",
    className: "island-care",
  },
  {
    key: "impact",
    href: "/impact",
    title: "永續公益島",
    body: "每次自我照顧與城市行動，都可以累積成家庭樹、社區與永續成果。",
    className: "island-impact",
  },
] as const;

const leafShape = new Shape();
leafShape.moveTo(0, 0.18);
leafShape.bezierCurveTo(0.13, 0.1, 0.14, -0.1, 0, -0.2);
leafShape.bezierCurveTo(-0.14, -0.1, -0.13, 0.1, 0, 0.18);

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
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

function useSkyQuality(reduced: boolean) {
  const [quality, setQuality] = useState({
    leafCount: 1100,
    particleCount: 90,
    dpr: [1, 1.6] as [number, number],
    bloom: false,
  });

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const desktop = width >= 1120;
      const tablet = width >= 760 && width < 1120;
      setQuality({
        leafCount: reduced ? 520 : desktop ? 2200 : tablet ? 1250 : 560,
        particleCount: reduced ? 0 : desktop ? 82 : tablet ? 54 : 24,
        dpr: desktop ? [1, 1.7] : [1, 1.35],
        bloom: !reduced && width >= 760,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [reduced]);

  return quality;
}

function TubeBranch({
  points,
  radius,
  color = "#6a3f24",
}: {
  points: Vec3Tuple[];
  radius: number;
  color?: string;
}) {
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map((point) => new Vector3(...point))),
    [points],
  );
  return (
    <mesh castShadow receiveShadow>
      <tubeGeometry args={[curve, 24, radius, 12, false]} />
      <meshStandardMaterial color={color} roughness={0.94} metalness={0.02} />
    </mesh>
  );
}

function SkyTreeLeaves({ count, reduced }: { count: number; reduced: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const leaves = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const seed = index * 17;
        const theta = seed * 2.399963;
        const shell = Math.sqrt(seededUnit(seed + 1));
        const canopyBand = seededUnit(seed + 2);
        const radiusX = 1.55 + canopyBand * 0.72;
        const radiusZ = 0.62 + seededUnit(seed + 3) * 0.4;
        const y = 1.72 + (seededUnit(seed + 4) - 0.34) * 1.08;
        return {
          position: [
            Math.cos(theta) * radiusX * shell,
            y,
            Math.sin(theta) * radiusZ * shell + seededUnit(seed + 5) * 0.28,
          ] as Vec3Tuple,
          rotation: [
            -0.24 + seededUnit(seed + 6) * 0.48,
            -0.28 + seededUnit(seed + 7) * 0.56,
            theta,
          ] as Vec3Tuple,
          scale: 0.36 + seededUnit(seed + 8) * 0.34,
          color: ["#7fcb66", "#9ada72", "#c4eb84", "#68b85f", "#d8d872"][index % 5]!,
          phase: seededUnit(seed + 9) * Math.PI * 2,
        };
      }),
    [count],
  );

  const applyMatrices = (time = 0) => {
    leaves.forEach((leaf, index) => {
      const flutter = reduced ? 0 : Math.sin(time * 1.08 + leaf.phase) * 0.055;
      dummy.position.set(leaf.position[0], leaf.position[1] + flutter, leaf.position[2]);
      dummy.rotation.set(
        leaf.rotation[0] + flutter * 0.8,
        leaf.rotation[1] + flutter * 0.45,
        leaf.rotation[2] + flutter,
      );
      dummy.scale.set(leaf.scale * 0.82, leaf.scale * 1.14, leaf.scale);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    if (!mesh.current) return;
    mesh.current.instanceMatrix.setUsage(DynamicDrawUsage);
    leaves.forEach((leaf, index) => mesh.current?.setColorAt(index, new Color(leaf.color)));
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    applyMatrices();
  }, [leaves]);

  useFrame(({ clock }) => {
    if (reduced) return;
    applyMatrices(clock.elapsedTime);
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, leaves.length]}>
      <shapeGeometry args={[leafShape, 10]} />
      <meshBasicMaterial transparent opacity={0.92} alphaTest={0.12} side={DoubleSide} vertexColors />
    </instancedMesh>
  );
}

function WorldTree({ leafCount, reduced }: { leafCount: number; reduced: boolean }) {
  const tree = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reduced || !tree.current) return;
    tree.current.rotation.z = Math.sin(clock.elapsedTime * 0.38) * 0.012;
  });

  return (
    <group ref={tree} position={[0, -0.68, 0]} scale={1.2}>
      <TubeBranch points={[[0, -1.06, 0], [0.08, -0.26, 0.02], [-0.05, 0.58, 0], [0.02, 1.42, 0.04]]} radius={0.24} />
      <TubeBranch points={[[0.02, 0.34, 0.02], [-0.82, 0.86, 0.12], [-1.45, 1.42, 0.02]]} radius={0.065} color="#5a351f" />
      <TubeBranch points={[[0.04, 0.46, 0.02], [0.86, 0.98, 0.08], [1.48, 1.44, 0.04]]} radius={0.065} color="#5a351f" />
      <TubeBranch points={[[0, 0.86, 0.02], [-0.42, 1.54, 0.06], [-0.68, 2.1, 0.02]]} radius={0.044} color="#694023" />
      <TubeBranch points={[[0.02, 0.92, 0.02], [0.48, 1.58, 0.08], [0.78, 2.12, 0.02]]} radius={0.044} color="#694023" />
      <TubeBranch points={[[0, -0.9, 0], [-0.62, -1.2, 0.28], [-1.1, -1.34, 0.42]]} radius={0.075} color="#4b2b19" />
      <TubeBranch points={[[0, -0.88, 0], [0.64, -1.18, 0.26], [1.04, -1.34, 0.42]]} radius={0.075} color="#4b2b19" />
      <mesh position={[0, 1.52, 0]} scale={[1.7, 0.8, 0.5]}>
        <sphereGeometry args={[1, 36, 22]} />
        <meshBasicMaterial color="#89c96c" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh position={[-0.62, 1.38, 0.1]} scale={[0.94, 0.54, 0.36]}>
        <sphereGeometry args={[1, 28, 18]} />
        <meshBasicMaterial color="#5da85b" transparent opacity={0.26} depthWrite={false} />
      </mesh>
      <mesh position={[0.72, 1.42, 0.1]} scale={[1, 0.56, 0.36]}>
        <sphereGeometry args={[1, 28, 18]} />
        <meshBasicMaterial color="#77bd62" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <SkyTreeLeaves count={leafCount} reduced={reduced} />
      <mesh position={[0, 0.02, 0.18]}>
        <sphereGeometry args={[0.08, 18, 12]} />
        <meshBasicMaterial color="#b8f7ff" transparent opacity={0.92} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function FloatingIsland({
  position,
  scale = 1,
  accent = "#8fd66e",
  waterfall = false,
}: {
  position: Vec3Tuple;
  scale?: number;
  accent?: string;
  waterfall?: boolean;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.78, 0.9, 7]} />
        <meshStandardMaterial color="#866649" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.05, 0]} scale={[1.14, 0.16, 0.82]} receiveShadow>
        <sphereGeometry args={[0.72, 28, 14]} />
        <meshStandardMaterial color={accent} roughness={0.84} />
      </mesh>
      <mesh position={[-0.2, 0.2, 0.12]} scale={[0.18, 0.18, 0.18]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#5aa45e" transparent opacity={0.84} />
      </mesh>
      <mesh position={[0.22, 0.24, 0.02]} scale={[0.14, 0.18, 0.14]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#78bf5e" transparent opacity={0.82} />
      </mesh>
      <mesh position={[-0.38, 0.14, -0.12]} scale={[0.22, 0.09, 0.16]} rotation={[0.08, 0.4, -0.1]}>
        <sphereGeometry args={[1, 14, 8]} />
        <meshStandardMaterial color="#f2e1a1" roughness={0.72} />
      </mesh>
      <mesh position={[0.38, 0.16, -0.1]} scale={[0.18, 0.08, 0.12]} rotation={[0.02, -0.28, 0.08]}>
        <sphereGeometry args={[1, 14, 8]} />
        <meshStandardMaterial color="#f7e8b2" roughness={0.7} />
      </mesh>
      <mesh position={[-0.02, 0.24, -0.24]} scale={[0.2, 0.15, 0.14]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshBasicMaterial color="#3f8955" transparent opacity={0.82} />
      </mesh>
      {waterfall ? (
        <mesh position={[0.46, -0.36, 0.18]} rotation={[0.2, 0, -0.06]}>
          <planeGeometry args={[0.12, 0.84]} />
          <meshBasicMaterial color="#c7f9ff" transparent opacity={0.62} blending={AdditiveBlending} />
        </mesh>
      ) : null}
    </group>
  );
}

function CloudPuffs({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reduced || !group.current) return;
    group.current.position.x = Math.sin(clock.elapsedTime * 0.12) * 0.16;
  });
  const clouds = [
    [-3.1, -1.18, -0.8, 1.2],
    [2.8, -1.08, -0.7, 1.06],
    [-1.9, -1.42, 0.7, 0.82],
    [1.72, -1.34, 0.9, 0.92],
    [0.1, -1.62, 1.1, 1.1],
  ] as const;

  return (
    <group ref={group}>
      {clouds.map(([x, y, z, scale], index) => (
        <mesh key={index} position={[x, y, z]} scale={[scale * 1.3, scale * 0.24, scale * 0.42]}>
          <sphereGeometry args={[1, 24, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function SkyParticles({ count, reduced }: { count: number; reduced: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const points = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        position: [
          -3.1 + seededUnit(index + 1) * 6.2,
          -0.6 + seededUnit(index + 2) * 3.6,
          -1.2 + seededUnit(index + 3) * 2.4,
        ] as Vec3Tuple,
        scale: 0.012 + seededUnit(index + 4) * 0.024,
        phase: seededUnit(index + 5) * Math.PI * 2,
      })),
    [count],
  );

  const applyMatrices = (time = 0) => {
    points.forEach((point, index) => {
      const lift = reduced ? 0 : Math.sin(time * 0.46 + point.phase) * 0.08;
      dummy.position.set(point.position[0], point.position[1] + lift, point.position[2]);
      dummy.scale.setScalar(point.scale);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    if (!mesh.current) return;
    mesh.current.instanceMatrix.setUsage(DynamicDrawUsage);
    applyMatrices();
  }, [points]);

  useFrame(({ clock }) => {
    if (reduced) return;
    applyMatrices(clock.elapsedTime);
  });

  if (count === 0) return null;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, points.length]}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#fff8b6" transparent opacity={0.78} blending={AdditiveBlending} />
    </instancedMesh>
  );
}

export function WorldTreeIslandScene({
  reduced,
  leafCount,
  particleCount,
}: {
  reduced: boolean;
  leafCount: number;
  particleCount: number;
}) {
  const scene = useRef<Group>(null);
  useFrame(({ clock, pointer }) => {
    if (reduced || !scene.current) return;
    scene.current.rotation.y = pointer.x * 0.05 + Math.sin(clock.elapsedTime * 0.12) * 0.018;
    scene.current.rotation.x = -pointer.y * 0.018;
  });

  return (
    <>
      <color attach="background" args={["#78c8ff"]} />
      <fog attach="fog" args={["#c9f3ff", 7.2, 15.5]} />
      <ambientLight intensity={1.05} />
      <directionalLight position={[3.8, 5.2, 3.2]} intensity={2.2} />
      <pointLight position={[0, 1.8, 1.8]} color="#c8f7ff" intensity={2.6} />
      <group ref={scene} position={[0, -0.34, 0]}>
        <mesh position={[0, -1.16, 0]} scale={[1.55, 0.24, 1.05]} receiveShadow>
          <sphereGeometry args={[1, 42, 18]} />
          <meshStandardMaterial color="#82c86a" roughness={0.72} />
        </mesh>
        <mesh position={[0, -1.52, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[1.34, 1.2, 9]} />
          <meshStandardMaterial color="#84634a" roughness={0.9} />
        </mesh>
        <WorldTree leafCount={leafCount} reduced={reduced} />
        <FloatingIsland position={[-2.55, -0.52, -0.76]} scale={0.64} accent="#8ad66d" waterfall />
        <FloatingIsland position={[2.48, -0.48, -0.82]} scale={0.62} accent="#b8d96e" />
        <FloatingIsland position={[-2.08, -1.04, 0.92]} scale={0.5} accent="#79c96a" />
        <FloatingIsland position={[2.08, -1.0, 0.92]} scale={0.5} accent="#9ad36e" waterfall />
        <FloatingIsland position={[0, -1.16, 1.16]} scale={0.38} accent="#d7d36c" />
        <mesh position={[0, -1.9, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[4.4, 96]} />
          <meshBasicMaterial color="#0a77c2" transparent opacity={0.28} />
        </mesh>
        <CloudPuffs reduced={reduced} />
        <SkyParticles count={particleCount} reduced={reduced} />
      </group>
      {!reduced ? (
        <EffectComposer multisampling={2}>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.78} intensity={0.18} />
        </EffectComposer>
      ) : null}
    </>
  );
}

export function SkyWorldHero() {
  const reduced = useReducedMotion();
  const quality = useSkyQuality(reduced);
  const [activeIsland, setActiveIsland] =
    useState<(typeof islandLinks)[number]["key"] | null>(null);

  return (
    <section className="sky-world-hero" id="top" aria-label="3D 天空島世界樹首頁">
      <div className="sky-world-canvas" aria-hidden="true">
        <Canvas
          camera={{ fov: 48, position: [0, 0.92, 7.8] }}
          dpr={quality.dpr}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <WorldTreeIslandScene
            reduced={reduced}
            leafCount={quality.leafCount}
            particleCount={quality.particleCount}
          />
        </Canvas>
      </div>
      <nav className="sky-island-nav" aria-label="天空島功能導覽">
        {islandLinks.map((item) => (
          <Link
            aria-label={`${item.title}：${item.body}`}
            className={`sky-island-link ${item.className}${
              activeIsland === item.key ? " is-active" : ""
            }`}
            href={item.href}
            key={item.key}
            onBlur={() => setActiveIsland(null)}
            onClick={(event) => {
              const coarsePointer =
                typeof window !== "undefined" &&
                window.matchMedia("(hover: none)").matches;
              if (coarsePointer && activeIsland !== item.key) {
                event.preventDefault();
                setActiveIsland(item.key);
              }
            }}
            onFocus={() => setActiveIsland(item.key)}
            onMouseEnter={() => setActiveIsland(item.key)}
            onMouseLeave={() => setActiveIsland((current) => (current === item.key ? null : current))}
            onPointerEnter={() => setActiveIsland(item.key)}
            onPointerLeave={() => setActiveIsland((current) => (current === item.key ? null : current))}
          >
            <span className="sky-island-card">
              <strong>{item.title}</strong>
              <small>{item.body}</small>
            </span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
