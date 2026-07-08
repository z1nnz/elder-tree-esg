"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

const posterImage = "/images/sky-world-tree-hero.png";
const motionVideo = "/videos/sky-world-tree-loop-seamless.mp4";

const artIslands = [
  {
    key: "explore",
    href: "/explore",
    title: "城市探索",
    body: "讓城市像溫柔的冒險地圖。走近一點，任務才會亮起來。",
    x: 5,
    y: 60,
    width: 25,
    height: 28,
    card: "right",
  },
  {
    key: "radar",
    href: "/explore",
    title: "任務雷達",
    body: "光點提醒你停一下。今天也許只要喝水、看一片葉子，就很好。",
    x: 72,
    y: 42,
    width: 22,
    height: 28,
    card: "left",
  },
  {
    key: "tree",
    href: "/product",
    title: "生命樹",
    body: "一棵樹長得慢，但它會記得每一次被照顧。",
    x: 31,
    y: 13,
    width: 39,
    height: 55,
    card: "bottom",
  },
  {
    key: "care",
    href: "/partners",
    title: "陪伴網絡",
    body: "一個人也能開始。需要時，再讓可信任的人靠近。",
    x: 10,
    y: 26,
    width: 25,
    height: 29,
    card: "right",
  },
  {
    key: "impact",
    href: "/impact",
    title: "永續公益",
    body: "照顧自己，也可以成為對世界溫柔的一部分。",
    x: 43,
    y: 66,
    width: 28,
    height: 28,
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
  const activeData = useMemo(
    () => artIslands.find((island) => island.key === activeIsland) ?? null,
    [activeIsland],
  );

  return (
    <section className="sky-video-hero" id="top" aria-label="天空島世界樹首頁互動場景">
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
        <span>城市探索 × 陪伴網絡 × 生命樹</span>
        <strong>追逐一個更願意生活的自己。</strong>
        <div>
          <Link href="/product">開始了解</Link>
          <Link href="/partners">成為陪伴者</Link>
        </div>
      </div>
    </section>
  );
}
