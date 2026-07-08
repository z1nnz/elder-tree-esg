"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ExplorationRouteSummary, RadarState } from "@elder-tree/contracts";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Camera,
  Footprints,
  HeartHandshake,
  Leaf,
  MapPinned,
  Radar,
  ShieldCheck,
  Sparkles,
  Trees,
} from "lucide-react";
import {
  brandLines,
  contactHref,
  formatRemaining,
  futureFeatures,
  impactJourney,
  impactPrinciples,
  pageHeroTiles,
  partnerProcess,
  partnerRoles,
  participationPaths,
  productFlow,
  productHighlights,
  proofItems,
  radarMissions,
  routeFallbackQuests,
  techFlow,
} from "./public-data";
import { PublicShell } from "./public-shell";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

const LifeTree3D = dynamic(
  () => import("./life-tree-3d").then((module) => module.LifeTree3D),
  {
    ssr: false,
    loading: () => <div className="tree-3d-fallback">生命樹載入中…</div>,
  },
);

const RadarMap3D = dynamic(
  () => import("./life-tree-3d").then((module) => module.RadarMap3D),
  {
    ssr: false,
    loading: () => <div className="tree-3d-fallback">任務雷達載入中…</div>,
  },
);

const SkyWorldArtHero = dynamic(
  () => import("./sky-world-art-hero").then((module) => module.SkyWorldArtHero),
  {
    ssr: false,
    loading: () => <div className="tree-3d-fallback">天空島世界載入中…</div>,
  },
);

function usePublicAnimations(dependencies: unknown[] = []) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          desktop: "(min-width: 900px)",
        },
        (context) => {
          const { motion, desktop } = context.conditions as {
            motion: boolean;
            desktop: boolean;
          };
          if (!motion) {
            gsap.set("[data-reveal], .hero-copy > *, .hero-visual, .world-tree-node", {
              autoAlpha: 1,
              clearProps: "transform",
            });
            return;
          }

          const intro = gsap.timeline({
            defaults: { duration: 0.8, ease: "power3.out" },
          });
          intro
            .from(
              ".hero-copy > *",
              { y: 34, autoAlpha: 0, stagger: 0.1 },
            )
            .from(
              ".hero-visual",
              { scale: 0.94, autoAlpha: 0 },
              "<0.2",
            )
            .from(
              ".world-tree-node, .feature-pill",
              { scale: 0.72, autoAlpha: 0, stagger: 0.08 },
              "<0.2",
            );

          ScrollTrigger.batch("[data-reveal]", {
            start: "top 86%",
            once: true,
            onEnter: (elements) =>
              gsap.fromTo(
                elements,
                { y: 28, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: 0.7,
                  stagger: 0.08,
                  ease: "power2.out",
                  clearProps: "transform,visibility,opacity",
                },
              ),
          });

          if (desktop) {
            if (root.current?.querySelector(".mission-dot")) {
              gsap.to(".mission-dot", {
                scale: 1.16,
                duration: 1.35,
                repeat: -1,
                yoyo: true,
                stagger: 0.22,
                ease: "sine.inOut",
              });
            }
            if (root.current?.querySelector(".feature-pill")) {
              gsap.to(".feature-pill", {
                y: (index) => [-8, 7, -6][index % 3],
                duration: 2.4,
                repeat: -1,
                yoyo: true,
                stagger: 0.2,
                ease: "sine.inOut",
              });
            }
          }
        },
      );
      return () => media.revert();
    },
    { scope: root, dependencies, revertOnUpdate: true },
  );

  return root;
}

function usePublicExploration() {
  const [routeData, setRouteData] = useState<ExplorationRouteSummary | null>(
    null,
  );
  const [publicRadar, setPublicRadar] = useState<RadarState | null>(null);

  useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api/v1";
    const controller = new AbortController();
    void fetch(`${apiUrl}/public/exploration/routes/daan-forest-first-walk`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("route unavailable");
        return (await response.json()) as { data: ExplorationRouteSummary };
      })
      .then(({ data }) => setRouteData(data))
      .catch(() => undefined);
    void fetch(`${apiUrl}/public/exploration/radar`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("radar unavailable");
        return (await response.json()) as { data: RadarState };
      })
      .then(({ data }) => setPublicRadar(data))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return { routeData, publicRadar };
}

function missionShowcase(publicRadar: RadarState | null) {
  return (
    publicRadar?.missions.slice(0, 3).map((mission, index) => ({
      icon:
        mission.category === "HYDRATION"
          ? Camera
          : mission.category === "WALK"
            ? Footprints
            : Leaf,
      label: mission.title,
      distance: `${mission.radiusMeters}m 內`,
      time: formatRemaining(mission.remainingSeconds),
      points: `+${mission.growthPoints}`,
      className: ["mission-plant", "mission-water", "mission-walk"][index]!,
    })) ?? radarMissions
  );
}

function verificationLabel(mode: string) {
  return mode === "TIMER" ? "計時任務" : "自我確認";
}

function HeroVisual() {
  return (
    <div className="hero-visual hero-visual-3d" aria-label="3D 生命樹主視覺">
      <LifeTree3D variant="world" />
      <Link className="world-tree-node node-radar" href="/explore">
        <MapPinned size={22} />
        <span>任務雷達</span>
        <strong>讓城市像溫柔的冒險地圖。</strong>
      </Link>
      <Link className="world-tree-node node-tree" href="/product">
        <Trees size={22} />
        <span>生命樹成長</span>
        <strong>每一次任務，都長成看得見的新葉。</strong>
      </Link>
      <Link className="world-tree-node node-care" href="/partners">
        <HeartHandshake size={22} />
        <span>陪伴網絡</span>
        <strong>一個人也能開始，需要時再邀請家人、志工或機構。</strong>
      </Link>
      <Link className="world-tree-node node-safety" href="/impact">
        <ShieldCheck size={22} />
        <span>安全底線</span>
        <strong>位置與任務資料只保留必要事件，不把焦慮當誘因。</strong>
      </Link>
    </div>
  );
}

function SubHeroPanel() {
  return (
    <div className="sub-hero-panel" aria-label="公開前台功能摘要">
      {pageHeroTiles.map(([title, body], index) => (
        <div className="sub-hero-tile" key={title} data-reveal>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{title}</strong>
          <small>{body}</small>
        </div>
      ))}
    </div>
  );
}

function HomeHero() {
  return <SkyWorldArtHero />;
}

function BrandLineStrip({ variant = "light" }: { variant?: "light" | "dark" }) {
  return (
    <section className={`brand-lines brand-lines-${variant}`} aria-label="綠伴品牌短句">
      <div className="brand-lines-track">
        {[...brandLines, ...brandLines].map((line, index) => (
          <span key={`${line}-${index}`}>{line}</span>
        ))}
      </div>
    </section>
  );
}

function ProductCards() {
  return (
    <div className="product-grid">
      {productHighlights.map(({ icon: Icon, title, body }) => (
        <article className="product-card" data-reveal key={title}>
          <Icon size={26} />
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
    </div>
  );
}

function ProductFlow() {
  return (
    <section className="flow-section section-shell">
      <div className="section-heading" data-reveal>
        <p className="eyebrow">一個人如何開始</p>
        <h2>任務陪你慢慢回到生活。</h2>
      </div>
      <div className="product-flow">
        {productFlow.map(({ icon: Icon, step, title, body }) => (
          <article className="flow-card" data-reveal key={title}>
            <span>{step}</span>
            <Icon size={24} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ParticipationCards() {
  return (
    <div className="path-grid">
      {participationPaths.map(({ icon: Icon, eyebrow, title, body }) => (
        <article className="path-card" data-reveal key={title}>
          <div className="path-icon">
            <Icon size={24} />
          </div>
          <span>{eyebrow}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
    </div>
  );
}

function PartnerRoleGrid() {
  return (
    <section className="partners-board section-shell">
      <div className="section-heading" data-reveal>
        <p className="eyebrow">誰能成為陪伴網絡</p>
        <h2>需要時，有人能安全地靠近。</h2>
      </div>
      <div className="partner-grid">
        {partnerRoles.map(({ icon: Icon, eyebrow, title, body }) => (
          <article className="partner-card" data-reveal key={title}>
            <span>{eyebrow}</span>
            <Icon size={26} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <div className="partner-process" data-reveal>
        {partnerProcess.map((item, index) => (
          <div key={item}>
            <b>{index + 1}</b>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImpactJourney() {
  return (
    <section className="impact-journey section-shell">
      <div className="section-heading" data-reveal>
        <p className="eyebrow">影響力路徑</p>
        <h2>一個人的日常，可以慢慢長成社區看得見的成果。</h2>
      </div>
      <div className="impact-chain">
        {impactJourney.map(({ icon: Icon, title, body }, index) => (
          <article data-reveal key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <Icon size={24} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MissionList({ publicRadar }: { publicRadar: RadarState | null }) {
  return (
    <div className="mission-list">
      {missionShowcase(publicRadar).map(({ icon: Icon, label, distance, time, points }) => (
        <article data-reveal key={label}>
          <span>
            <Icon size={19} />
          </span>
          <div>
            <strong>{label}</strong>
            <small>
              {distance} ・ {time}
            </small>
          </div>
          <b>{points}</b>
        </article>
      ))}
      <p>
        <ShieldCheck size={15} /> 靠近只代表可以接取；完成後，生命樹才會長出新葉。
      </p>
    </div>
  );
}

function RadarShowcase({ publicRadar }: { publicRadar: RadarState | null }) {
  return (
    <section className="radar-showcase">
      <div className="section-shell radar-layout">
        <div className="section-heading light" data-reveal>
          <p className="eyebrow">城市探索</p>
          <h2>讓城市像溫柔的冒險地圖。</h2>
          <p>
            任務會在台北的安全區域亮起。你走近，它才出現；你完成，它才讓生命樹長出新葉。
          </p>
        </div>
        <div className="radar-panel radar-panel-3d">
          <RadarMap3D />
          <MissionList publicRadar={publicRadar} />
        </div>
      </div>
    </section>
  );
}

function ImpactStatement() {
  return (
    <section className="statement" id="why">
      <p data-reveal>一棵樹長得慢。</p>
      <h2 data-reveal>但它會記得每一次被照顧。</h2>
      <div className="statement-grid">
        {impactPrinciples.map((item) => (
          <article data-reveal key={item.title}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RouteJourneyShowcase({ routeData }: { routeData: ExplorationRouteSummary | null }) {
  const quests =
    routeData?.quests.length
      ? routeData.quests.slice(0, 5).map((quest) => ({
          locationName: quest.locationName,
          title: quest.title,
          verificationMode: quest.verificationMode,
          growthPoints: quest.growthPoints,
          safetyNote: quest.safetyNote ?? "安全資訊待確認。",
        }))
      : routeFallbackQuests;

  return (
    <section className="journey section-shell">
      <div className="section-heading" data-reveal>
        <p className="eyebrow">首發路線：都市綠肺初探</p>
        <h2>固定路線是一段旅程；任務雷達是路上忽然亮起的小事件。</h2>
        <p>
          先從大安森林公園開始。慢慢走、停下來看、聽一會兒自然，完成後讓樹長一點。
        </p>
      </div>
      <div className="route-journey-board" data-reveal>
        <div className="route-summary-card">
          <span>DAAN FOREST PARK</span>
          <h3>{routeData?.name ?? "都市綠肺初探"}</h3>
          <p>
            {routeData?.description ??
              "以大安森林公園作為第一條城市探索路線，任務以觀察、補水、聆聽與溫和伸展為主。"}
          </p>
          <b>
            {routeData
              ? `${routeData.completedQuestCount}/${routeData.totalQuestCount} 已完成`
              : "5 個地標任務 · 2 個距離任務"}
          </b>
        </div>
        <div className="route-quest-grid">
          {quests.map((quest, index) => (
            <article className="route-quest-card" data-reveal key={`${quest.locationName}-${quest.title}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{quest.locationName}</small>
              <h3>{quest.title}</h3>
              <p>{quest.safetyNote}</p>
              <div>
                <b>{verificationLabel(quest.verificationMode)}</b>
                <strong>+{quest.growthPoints}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TechSection() {
  return (
    <section className="technology">
      <div className="section-shell">
        <div className="section-heading light" data-reveal>
          <p className="eyebrow">技術放在後面</p>
          <h2>我們用手機、地圖與實體樹，守住一件簡單的事：讓人被溫柔地看見。</h2>
        </div>
        <div className="tech-flow">
          {techFlow.map(({ icon: Icon, label, detail }, index) => (
            <article data-reveal key={label}>
              <span className="tech-index">0{index + 1}</span>
              <Icon size={26} />
              <h3>{label}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
        <div className="tech-proof">
          {proofItems.map(({ icon: Icon, title, body }) => (
            <div data-reveal key={title}>
              <Icon size={24} />
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActionSection() {
  return (
    <section className="action section-shell">
      <div className="action-copy" data-reveal>
        <p className="eyebrow">兩個入口，同一棵樹</p>
        <h2>想先自己開始，或想一起接住城市，都可以。</h2>
      </div>
      <div className="action-grid">
        <Link href="/product">
          <Trees size={26} />
          <strong>開始使用</strong>
          <span>給一般使用者：走進城市，讓今天長出一片新葉。</span>
          <ArrowRight size={22} />
        </Link>
        <a href={contactHref("綠伴合作與陪伴計畫")}>
          <HeartHandshake size={26} />
          <strong>成為合作夥伴／陪伴者</strong>
          <span>給社福、長照、志工與社區組織：一起讓需要的人有人能靠近。</span>
          <ArrowRight size={22} />
        </a>
      </div>
    </section>
  );
}

function PageHero({
  eyebrow,
  title,
  body,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Trees;
}) {
  return (
    <section className="sub-hero">
      <div className="section-shell sub-hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">
            <Icon size={16} /> {eyebrow}
          </p>
          <h1>{title}</h1>
          <p className="hero-lead">{body}</p>
          <div className="hero-actions">
            <Link className="button primary" href="/">
              回首頁看世界樹 <ArrowRight size={17} />
            </Link>
            <a className="button ghost" href={contactHref("綠伴合作與陪伴計畫")}>
              聯絡合作
            </a>
          </div>
        </div>
        <SubHeroPanel />
      </div>
    </section>
  );
}

export function HomePage() {
  const { publicRadar, routeData } = usePublicExploration();
  const root = usePublicAnimations([routeData?.id, publicRadar?.missions.length]);

  return (
    <PublicShell>
      <main ref={root}>
        <HomeHero />
        <BrandLineStrip variant="dark" />
        <RadarShowcase publicRadar={publicRadar} />
        <ProductFlow />
        <RouteJourneyShowcase routeData={routeData} />
        <ImpactStatement />
        <ActionSection />
      </main>
    </PublicShell>
  );
}

export function ProductPage() {
  const root = usePublicAnimations();
  return (
    <PublicShell>
      <main ref={root}>
        <PageHero
          eyebrow="產品功能"
          title="任務陪你慢慢回到生活。"
          body="從一杯水、一段路、一片葉子開始。綠伴把城市探索、生命樹與陪伴網絡接在一起，讓完成感留得下來。"
          icon={Trees}
        />
        <BrandLineStrip />
        <ProductFlow />
        <section className="product section-shell">
          <ProductCards />
        </section>
        <section className="feature-wall section-shell">
          {futureFeatures.map((item) => (
            <article className="feature-pill" data-reveal key={item.title}>
              <Sparkles size={20} />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </section>
        <TechSection />
      </main>
    </PublicShell>
  );
}

export function ExplorePage() {
  const { publicRadar, routeData } = usePublicExploration();
  const root = usePublicAnimations([routeData?.id, publicRadar?.missions.length]);
  return (
    <PublicShell>
      <main ref={root}>
        <PageHero
          eyebrow="城市探索"
          title="讓城市像溫柔的冒險地圖。"
          body="固定路線陪你完成一段旅程；任務雷達讓城市裡的小事忽然亮起。走近，接取，完成，讓生命樹長出新葉。"
          icon={Radar}
        />
        <BrandLineStrip />
        <RadarShowcase publicRadar={publicRadar} />
        <RouteJourneyShowcase routeData={routeData} />
      </main>
    </PublicShell>
  );
}

export function PartnersPage() {
  const root = usePublicAnimations();
  return (
    <PublicShell>
      <main ref={root}>
        <PageHero
          eyebrow="合作夥伴與陪伴者"
          title="一個人也能開始，需要時再讓陪伴靠近。"
          body="這個入口給社福、長照、志工、社區組織與願意陪伴的人。陪伴要安全、清楚、可撤回，才不會變成新的壓力。"
          icon={HeartHandshake}
        />
        <BrandLineStrip />
        <PartnerRoleGrid />
        <section className="paths section-shell">
          <ParticipationCards />
        </section>
        <ActionSection />
      </main>
    </PublicShell>
  );
}

export function ImpactPage() {
  const root = usePublicAnimations();
  return (
    <PublicShell>
      <main ref={root}>
        <PageHero
          eyebrow="理念與影響力"
          title="照顧自己，也可以成為對世界溫柔的一部分。"
          body="我們把孤獨、尊嚴、城市與永續放在同一棵樹下。每一次願意生活的瞬間，都值得被留下。"
          icon={Leaf}
        />
        <BrandLineStrip />
        <ImpactStatement />
        <ImpactJourney />
        <section className="impact-roadmap section-shell">
          <div className="section-heading" data-reveal>
            <p className="eyebrow">下一步功能想像</p>
            <h2>先把日常做穩，再把陪伴、機構與實體樹慢慢接上。</h2>
          </div>
          <div className="product-grid">
            {futureFeatures.map((item) => (
              <article className="product-card" data-reveal key={item.title}>
                <Sparkles size={24} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
        <ActionSection />
      </main>
    </PublicShell>
  );
}
