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
  Bot,
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
  contactHref,
  formatRemaining,
  futureFeatures,
  impactPrinciples,
  participationPaths,
  productHighlights,
  proofItems,
  radarMissions,
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
            gsap.set("[data-reveal], .hero-copy > *, .hero-visual", {
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
              { scale: 0.9, rotation: -2, autoAlpha: 0 },
              "<0.2",
            )
            .from(
              ".orbit-card, .feature-pill",
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

function HeroVisual() {
  return (
    <div className="hero-visual hero-visual-3d" aria-label="3D 生命樹主視覺">
      <LifeTree3D />
      <div className="orbit-card card-map">
        <MapPinned size={19} />
        <span>任務雷達亮起</span>
      </div>
      <div className="orbit-card card-tree">
        <Trees size={19} />
        <span>生命樹長出新葉 +40</span>
      </div>
      <div className="orbit-card card-care">
        <HeartHandshake size={19} />
        <span>陪伴由你選擇</span>
      </div>
    </div>
  );
}

function HomeHero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">
          <Sparkles size={16} /> 城市探索 × 高齡陪伴 × 永續共好
        </p>
        <h1>
          一個人的一步，
          <br />
          長成一座城市的森林。
        </h1>
        <p className="hero-lead">
          綠伴把城市探索、任務雷達與生命樹放在一起；不要求你先有家人，
          也不拿連續簽到懲罰生活。想自己走可以，想有人同行也可以。
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/product">
            開始使用 <ArrowRight size={17} />
          </Link>
          <a className="button ghost" href={contactHref("綠伴合作與陪伴計畫")}>
            成為合作夥伴／陪伴者
          </a>
        </div>
        <div className="trust-row">
          <span>
            <ShieldCheck size={17} /> 位置只保存必要事件
          </span>
          <span>
            <HeartHandshake size={17} /> 陪伴可以選擇與撤回
          </span>
        </div>
      </div>
      <HeroVisual />
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
        <ShieldCheck size={15} /> 靠近只解鎖任務；完成 SELF_CHECK/TIMER 才讓生命樹成長。
      </p>
    </div>
  );
}

function RadarShowcase({ publicRadar }: { publicRadar: RadarState | null }) {
  return (
    <section className="radar-showcase">
      <div className="section-shell radar-layout">
        <div className="section-heading light" data-reveal>
          <p className="eyebrow">城市探索：任務像光點一樣長出來</p>
          <h2>追逐一個更願意生活的自己。</h2>
          <p>
            這版用 sc-datav 的 3D 大屏思路改寫成台北任務雷達：光點、半徑、脈衝與成長回流，
            但任務仍由後台發布，不會把人導向危險地點。
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
      <p data-reveal>我們不是要修理一個人。</p>
      <h2 data-reveal>我們想讓「自主」與「有人可以找」同時存在。</h2>
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

function RouteMap({ routeData }: { routeData: ExplorationRouteSummary | null }) {
  const nodes = routeData?.quests.slice(0, 5) ?? [];
  return (
    <section className="journey section-shell">
      <div className="section-heading" data-reveal>
        <p className="eyebrow">首發路線：都市綠肺初探</p>
        <h2>固定路線適合完整旅程，任務雷達適合城市裡的限時事件。</h2>
      </div>
      <div className="journey-map" data-reveal>
        <svg viewBox="0 0 1000 430" aria-label="大安森林公園路線示意">
          <rect className="city-block" x="30" y="45" width="210" height="120" rx="24" />
          <rect className="city-block" x="280" y="30" width="180" height="150" rx="24" />
          <rect className="city-block" x="500" y="58" width="190" height="132" rx="24" />
          <rect className="city-block" x="735" y="40" width="210" height="142" rx="24" />
          <rect className="city-block" x="90" y="240" width="230" height="126" rx="24" />
          <rect className="city-block" x="390" y="245" width="230" height="112" rx="24" />
          <rect className="city-block" x="705" y="235" width="210" height="128" rx="24" />
          <path
            className="route-path"
            d="M110 320 C170 230 230 210 320 242 S470 310 520 220 S640 110 740 160 S850 245 890 120"
          />
          {(nodes.length ? nodes : Array.from({ length: 5 })).map((_, index) => {
            const points = [
              [110, 320],
              [320, 242],
              [520, 220],
              [740, 160],
              [890, 120],
            ];
            const [x, y] = points[index]!;
            return (
              <g className="map-node" key={index} transform={`translate(${x} ${y})`}>
                <circle r="28" />
                <text y="7" textAnchor="middle">
                  {index + 1}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="map-legend">
          <span>
            <i /> 地標任務
          </span>
          <span>
            <i className="yellow" /> 完成後生命樹成長
          </span>
          {routeData ? (
            <span className="route-badge">{routeData.name} 已讀取公開路線 API</span>
          ) : (
            <span className="route-badge">API 不可用時顯示安全靜態路線示意</span>
          )}
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
          <p className="eyebrow">技術不是炫技，是把陪伴做得可靠</p>
          <h2>手機、地圖、實體樹與營運後台，最後都要服務人的尊嚴。</h2>
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
        <h2>想先自己開始，或想一起把城市接住，都可以。</h2>
      </div>
      <div className="action-grid">
        <Link href="/product">
          <Trees size={26} />
          <strong>開始使用</strong>
          <span>給一般使用者：城市探索、任務雷達、家庭樹與生命樹。</span>
          <ArrowRight size={22} />
        </Link>
        <a href={contactHref("綠伴合作與陪伴計畫")}>
          <HeartHandshake size={26} />
          <strong>成為合作夥伴／陪伴者</strong>
          <span>給社福、長照、志工與社區組織：一起建立安全陪伴網。</span>
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
              回首頁看 3D 生命樹 <ArrowRight size={17} />
            </Link>
            <a className="button ghost" href={contactHref("綠伴合作與陪伴計畫")}>
              聯絡合作
            </a>
          </div>
        </div>
        <HeroVisual />
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
        <ImpactStatement />
        <section className="paths section-shell">
          <div className="section-heading" data-reveal>
            <p className="eyebrow">三條路，都是真正的參與</p>
            <h2>今天想自己走，或想有人同行，都可以。</h2>
          </div>
          <ParticipationCards />
        </section>
        <section className="product section-shell">
          <div className="section-heading" data-reveal>
            <p className="eyebrow">科技產品型：不是普通長照 App</p>
            <h2>地圖、任務與樹，讓照顧變成城市裡可被看見的行動。</h2>
          </div>
          <ProductCards />
        </section>
        <RadarShowcase publicRadar={publicRadar} />
        <RouteMap routeData={routeData} />
        <TechSection />
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
          title="把任務、地圖、生命樹與陪伴做成一個循環。"
          body="產品不是單純記錄步數，而是把低風險任務、城市探索、家庭樹與未來實體樹整理成可持續的日常體驗。"
          icon={Trees}
        />
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
          body="路線適合一段完整旅程；雷達適合城市裡短時間出現的小任務。所有任務都先解鎖、再完成，不用危險競速。"
          icon={Radar}
        />
        <RadarShowcase publicRadar={publicRadar} />
        <RouteMap routeData={routeData} />
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
          title="讓沒有家人可綁定的人，也能被城市接住。"
          body="這個入口給社福、長照、志工、社區組織與願意陪伴的人。未來會以審核、權限最小化與可撤回關係作為安全底線。"
          icon={HeartHandshake}
        />
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
          title="高齡孤獨、尊嚴與永續，不該被拆成三個問題。"
          body="綠伴想做的是一個城市共好平台：讓人願意出門、願意照顧自己、願意被陪伴，也讓每個行動可以回到一棵看得見的樹。"
          icon={Bot}
        />
        <ImpactStatement />
        <section className="impact-roadmap section-shell">
          <div className="section-heading" data-reveal>
            <p className="eyebrow">下一步功能想像</p>
            <h2>先把產品核心做穩，再把社福媒合與實體樹接上。</h2>
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
