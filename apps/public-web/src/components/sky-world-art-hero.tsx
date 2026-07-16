"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const posterImage = "/images/sky-world-tree-hero.png";
const motionVideo = "/videos/sky-world-tree-loop-seamless.mp4";

const artIslands = [
  {
    key: "explore",
    href: "/explore",
    title: "城市探索",
    body: "讓城市像溫柔的冒險地圖。走近一點，任務才會亮起來。",
    x: 8,
    y: 58,
    width: 22,
    height: 22,
    card: "right",
  },
  {
    key: "radar",
    href: "/explore",
    title: "任務雷達",
    body: "光點提醒你停一下。今天也許只要喝水、看一片葉子，就很好。",
    x: 74,
    y: 44,
    width: 20,
    height: 22,
    card: "left",
  },
  {
    key: "tree",
    href: "/product",
    title: "生命樹成長",
    body: "一棵樹長得慢，但它會記得每一次被照顧。",
    x: 29,
    y: 58,
    width: 24,
    height: 20,
    card: "bottom",
  },
  {
    key: "care",
    href: "/partners",
    title: "陪伴網絡",
    body: "一個人也能開始。需要時，再讓可信任的人靠近。",
    x: 2,
    y: 42,
    width: 24,
    height: 22,
    card: "right",
  },
  {
    key: "impact",
    href: "/impact",
    title: "ESG 影響力",
    body: "照顧自己，也可以成為對世界溫柔的一部分。",
    x: 68,
    y: 31,
    width: 24,
    height: 20,
    card: "top",
  },
] as const;

type ArtIsland = (typeof artIslands)[number];

function islandStyle(island: ArtIsland) {
  return {
    "--island-x": `${island.x}%`,
    "--island-y": `${island.y}%`,
    "--island-w": `${island.width}%`,
    "--island-h": `${island.height}%`,
  } as CSSProperties;
}

export function SkyWorldArtHero() {
  const [activeIsland, setActiveIsland] = useState<ArtIsland["key"] | null>(null);
  const [isExploreMode, setIsExploreMode] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const exploreModeRef = useRef(false);
  const activeData = useMemo(
    () => artIslands.find((island) => island.key === activeIsland) ?? null,
    [activeIsland],
  );

  const updateExploreMode = (nextValue: boolean) => {
    if (exploreModeRef.current === nextValue) return;
    exploreModeRef.current = nextValue;
    setIsExploreMode(nextValue);
  };

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        updateExploreMode(true);
        return;
      }

      const intro = section.querySelector(".sky-video-intro");
      const hotspots = section.querySelector(".sky-video-hotspots");
      const cue = section.querySelector(".sky-scroll-cue");
      const media = section.querySelectorAll(".sky-video-media");

      gsap.set(hotspots, { autoAlpha: 0 });
      gsap.set(intro, { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)" });
      gsap.set(cue, { autoAlpha: 1, y: 0 });

      const pinDistance = () => Math.max(window.innerHeight * 1.25, 820);
      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${pinDistance()}`,
          scrub: 0.85,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => updateExploreMode(self.progress >= 0.34),
          onLeave: () => updateExploreMode(true),
          onLeaveBack: () => updateExploreMode(false),
        },
      });

      timeline
        .to(intro, { autoAlpha: 0, y: -54, scale: 0.96, filter: "blur(10px)", duration: 0.36 }, 0)
        .to(cue, { autoAlpha: 0, y: 18, duration: 0.18 }, 0)
        .to(media, { scale: 1.035, duration: 1 }, 0)
        .to(hotspots, { autoAlpha: 1, duration: 0.28 }, 0.32);
    },
    { scope: sectionRef },
  );

  return (
    <section
      className={`sky-video-hero sky-cinematic-hero ${isExploreMode ? "is-explore-mode" : ""}`}
      id="top"
      ref={sectionRef}
      aria-label="天空島世界樹首頁互動場景"
    >
      <div className="sky-video-sticky">
        <video
          aria-hidden="true"
          autoPlay
          className="sky-video-media sky-video-motion"
          loop
          muted
          playsInline
          poster={posterImage}
          preload="metadata"
        >
          <source src={motionVideo} type="video/mp4" />
        </video>
        <img
          className="sky-video-media sky-video-poster"
          src={posterImage}
          alt="天空島中央有巨大世界樹，周圍漂浮著島嶼、雲海、瀑布與海洋。"
        />
        <div className="sky-video-vignette" aria-hidden="true" />
        <img
          aria-hidden="true"
          className="sky-generated-overlay"
          src="/images/generated/world-tree-overlay.svg"
          alt=""
        />
        <div className="sky-video-particles" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i key={index} />
          ))}
        </div>

        <nav className="sky-video-hotspots" aria-label="天空島功能導覽">
          {artIslands.map((island) => {
            const isActive = activeIsland === island.key;
            return (
              <Link
                aria-label={`${island.title}：${island.body}`}
                className={`sky-video-hotspot ${isActive ? "is-active" : ""}`}
                data-card={island.card}
                href={island.href}
                key={island.key}
                onBlur={() => setActiveIsland(null)}
                onClick={(event) => {
                  const coarsePointer =
                    typeof window !== "undefined" &&
                    window.matchMedia("(hover: none)").matches;
                  if (coarsePointer && !isActive) {
                    event.preventDefault();
                    setActiveIsland(island.key);
                  }
                }}
                onFocus={() => setActiveIsland(island.key)}
                onMouseEnter={() => setActiveIsland(island.key)}
                onMouseLeave={() =>
                  setActiveIsland((current) => (current === island.key ? null : current))
                }
                onPointerEnter={() => setActiveIsland(island.key)}
                onPointerLeave={() =>
                  setActiveIsland((current) => (current === island.key ? null : current))
                }
                style={islandStyle(island)}
              >
                <span className="sky-video-hotspot-glow" aria-hidden="true" />
                <span className="sky-video-hotspot-label" aria-hidden="true">
                  {island.title}
                </span>
                <span className="sky-video-card">
                  <strong>{island.title}</strong>
                  <small>{island.body}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        {activeData ? (
          <div className="sky-video-live-caption" aria-live="polite">
            <strong>{activeData.title}</strong>
            <span>{activeData.body}</span>
          </div>
        ) : null}

        <div className="sky-video-intro" aria-label="綠伴公開前台入口">
          <span>綠伴 Elder Tree · 城市探索 × 陪伴網絡 × 生命樹</span>
          <strong>
            <span>追逐一個更願意生活的</span>
            <span>自己。</span>
          </strong>
          <div>
            <Link href="/product">開始了解</Link>
            <Link href="/partners">成為陪伴者</Link>
          </div>
        </div>
        <div className="sky-scroll-cue" aria-hidden="true">
          <span>{isExploreMode ? "探索世界樹周圍光點" : "向下探索世界樹"}</span>
          <i />
        </div>
      </div>
    </section>
  );
}
