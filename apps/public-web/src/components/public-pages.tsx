"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type {
  ExplorationRouteSummary,
  RadarState,
} from "@elder-tree/contracts";
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
import type { LucideIcon } from "lucide-react";
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
import {
  getTaipeiDistrictMission,
  missionModeLabel,
  taipeiMissionDistricts,
} from "./taipei-quest-data";

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
            gsap.set(
              "[data-reveal], .hero-copy > *, .hero-visual, .world-tree-node",
              {
                autoAlpha: 1,
                clearProps: "transform",
              },
            );
            return;
          }

          ScrollTrigger.batch("[data-reveal], [data-v2-reveal]", {
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
            if (root.current?.querySelector(".v2-story")) {
              const v2StoryTimeline = gsap.timeline({
                scrollTrigger: {
                  trigger: ".v2-story",
                  start: "top top",
                  end: "bottom bottom",
                  scrub: 0.8,
                },
              });
              v2StoryTimeline
                .to(".v2-route-line", { scaleX: 1, ease: "none" }, 0)
                .to(
                  ".v2-route-node",
                  { autoAlpha: 1, y: 0, stagger: 0.08, ease: "none" },
                  0.08,
                )
                .to(".v2-phone-orbit", { y: -26, rotate: -2, ease: "none" }, 0.22)
                .to(".v2-tree-pulse", { autoAlpha: 1, scale: 1, ease: "none" }, 0.46);
            }
            if (root.current?.querySelector(".scroll-story")) {
              const storyTimeline = gsap.timeline({
                scrollTrigger: {
                  trigger: ".scroll-story",
                  start: "top top",
                  end: "bottom bottom",
                  scrub: 0.8,
                },
              });
              storyTimeline
                .to(
                  ".story-phone",
                  { y: -22, rotate: -3, scale: 0.96, ease: "none" },
                  0,
                )
                .to(
                  ".story-map",
                  { autoAlpha: 1, y: 0, scale: 1, ease: "none" },
                  0.16,
                )
                .to(
                  ".story-beam",
                  { scaleY: 1, autoAlpha: 1, ease: "none" },
                  0.28,
                )
                .to(
                  ".story-leaf",
                  { autoAlpha: 1, y: -40, stagger: 0.04, ease: "none" },
                  0.45,
                )
                .to(
                  ".story-care",
                  { autoAlpha: 1, y: 0, scale: 1, ease: "none" },
                  0.64,
                );
            }
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

const storySteps = [
  {
    eyebrow: "01 出門",
    title: "走出去",
    body: "不用很遠，今天先有一個願意出門的理由。",
    district: "中正區",
    metric: "定位開啟",
  },
  {
    eyebrow: "02 亮起",
    title: "任務亮起",
    body: "靠近只是解鎖，完成才會讓生命樹成長。",
    district: "大安區",
    metric: "150m 內",
  },
  {
    eyebrow: "03 完成",
    title: "做一件小事",
    body: "喝水、伸展、看一片葉子。小到不需要用力。",
    district: "士林區",
    metric: "+8 成長",
  },
  {
    eyebrow: "04 長葉",
    title: "長出新葉",
    body: "同一件事重送也只算一次，成長被好好留下。",
    district: "內湖區",
    metric: "已保存",
  },
  {
    eyebrow: "05 靠近",
    title: "陪伴靠近",
    body: "需要時，再讓家人、志工或合作單位看見必要摘要。",
    district: "文山區",
    metric: "可選擇",
  },
];

const natureSystems: Array<{
  icon: LucideIcon;
  title: string;
  label: string;
  body: string;
}> = [
  {
    icon: Trees,
    title: "生命樹系統",
    label: "TREE CORE",
    body: "把任務完成變成看得見的成長，不用排名，也能留下每天願意生活的痕跡。",
  },
  {
    icon: Radar,
    title: "城市感測",
    label: "QUEST SIGNAL",
    body: "任務只在靠近時亮起，範圍、安全半徑與完成條件都由系統守住。",
  },
  {
    icon: ShieldCheck,
    title: "陪伴邊界",
    label: "CARE GATE",
    body: "陪伴不是無限開放資料，而是需要時讓可信任的人看到必要摘要。",
  },
  {
    icon: Leaf,
    title: "永續回流",
    label: "IMPACT LOOP",
    body: "照顧自己的小行動，未來可以進入公益批次，而不是只有漂亮數字。",
  },
];

const productPanels = [
  {
    label: "今日陪伴",
    title: "打開 App，先看到今天最適合做的一件事。",
    body: "長者不需要理解所有功能。首頁只保留下一步、生命樹、提醒與陪伴訊息。",
  },
  {
    label: "任務卡",
    title: "任務像卡片，不像表單。",
    body: "SELF_CHECK、TIMER、PHOTO_AI 都用同一套語言：可開始、進行中、待覆核、已完成。",
  },
  {
    label: "照片 AI",
    title: "拍花草、喝水、完成一件小事。",
    body: "照片由 App 上傳到私有 Storage，後端產生短效 URL，再交給 AI verifier 判斷。",
  },
  {
    label: "生命樹",
    title: "完成後，樹長出新葉。",
    body: "成長值只相信後端結果，同一任務重送不會重複增加。",
  },
];

function CinematicStoryExperience() {
  return (
    <section className="v2-story" aria-label="綠伴產品主流程">
      <div className="v2-story-sticky">
        <div className="v2-story-copy" data-v2-reveal>
          <span>SCROLL EXPERIENCE</span>
          <h2>把一次出門，變成會被城市回應的旅程。</h2>
          <p>
            這不是把任務塞進清單，而是讓地圖、距離、完成回饋與陪伴提醒變成一段能被感覺到的流程。
          </p>
        </div>
        <div className="v2-story-stage" data-v2-reveal>
          <div className="v2-radar-surface">
            <span className="v2-route-line" />
            {storySteps.map((step, index) => (
              <button
                className={`v2-route-node v2-route-node-${index}`}
                key={step.eyebrow}
                type="button"
              >
                <i />
                <b>{step.title}</b>
                <small>{step.metric}</small>
              </button>
            ))}
            <div className="v2-phone-orbit">
              <span>綠伴 Elder Tree</span>
              <strong>今日陪伴</strong>
              <small>最近任務 · 大安森林公園 · +12</small>
            </div>
            <div className="v2-tree-pulse">
              <Trees size={24} />
              <b>新葉 +12</b>
            </div>
          </div>
          <div className="v2-story-steps">
            {storySteps.map((step) => (
              <article data-v2-reveal key={step.eyebrow}>
                <span>{step.eyebrow}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NatureTechIndex() {
  return (
    <section className="v2-nature-tech section-shell">
      <div className="v2-section-kicker" data-v2-reveal>
        <span>NATURE SYSTEM</span>
        <h2>把一棵樹，拆成可以被理解的陪伴系統。</h2>
        <p>
          樹不是裝飾。它把任務、照片驗證、陪伴邊界與公益回流，整理成使用者能看懂的成長狀態。
        </p>
      </div>
      <div className="v2-system-grid">
        {natureSystems.map(({ icon: Icon, title, label, body }) => (
          <article data-v2-reveal key={title}>
            <span>{label}</span>
            <Icon size={24} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductExperienceLab() {
  return (
    <section className="v2-product-lab section-shell">
      <div className="v2-section-kicker" data-v2-reveal>
        <span>APP V2</span>
        <h2>長者看到的是下一步，不是技術系統。</h2>
        <p>功能仍然完整，但介面只問一件事：現在要不要做一個很小的行動？</p>
      </div>
      <div className="v2-product-grid">
        <div className="v2-app-frame" data-v2-reveal>
          <div className="v2-app-status">
            <span>今日陪伴</span>
            <b>生命樹 128</b>
          </div>
          <div className="v2-app-tree">
            <Trees size={44} />
            <strong>下一個任務</strong>
            <p>喝水確認 · 100m 內 · +6</p>
          </div>
          <div className="v2-app-card is-primary">
            <Radar size={20} />
            <span>任務雷達亮起</span>
            <b>可接取</b>
          </div>
          <div className="v2-app-card">
            <Camera size={20} />
            <span>照片 AI 驗證</span>
            <b>已啟用</b>
          </div>
        </div>
        <div className="v2-product-panels">
          {productPanels.map((panel) => (
            <article data-v2-reveal key={panel.label}>
              <span>{panel.label}</span>
              <h3>{panel.title}</h3>
              <p>{panel.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PartnerNetworkExperience() {
  return (
    <section className="v2-partner-network section-shell">
      <div className="v2-section-kicker" data-v2-reveal>
        <span>CARE NETWORK</span>
        <h2>陪伴要靠近，也要有邊界。</h2>
        <p>沒有家人也能開始；需要時，再把社福、志工、社區與企業支持接進來。</p>
      </div>
      <div className="v2-partner-board">
        {partnerRoles.map(({ icon: Icon, eyebrow, title, body }) => (
          <article data-v2-reveal key={title}>
            <Icon size={24} />
            <span>{eyebrow}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ImpactManifestoV2() {
  return (
    <section className="v2-impact-manifesto">
      <div className="section-shell">
        <p data-v2-reveal>綠伴不把孤獨包裝成流量，也不把永續變成口號。</p>
        <h2 data-v2-reveal>我們做的是一個讓人願意再走出去一次的系統。</h2>
        <div className="v2-impact-principles">
          {impactPrinciples.map((item) => (
            <article data-v2-reveal key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function InteractiveDemoShowcase() {
  const [activeStep, setActiveStep] = useState(1);
  const active = storySteps[activeStep] ?? storySteps[1]!;

  return (
    <section
      className="demo-showcase section-shell"
      aria-label="綠伴互動產品展示"
    >
      <div className="demo-copy" data-reveal>
        <p className="eyebrow">APP V2 · 今日陪伴</p>
        <h2>像打開一張會回應你的城市地圖。</h2>
        <p>
          點一下流程，任務會亮起、距離會靠近、完成後生命樹會長出新葉。
          這段是 App 的主流程展示，不是單純的文字說明。
        </p>
      </div>

      <div className="demo-console" data-demo-step={activeStep} data-reveal>
        <div className="demo-device" aria-hidden="true">
          <div className="demo-orbit-label demo-orbit-a">任務雷達</div>
          <div className="demo-orbit-label demo-orbit-b">PHOTO AI</div>
          <div className="demo-orbit-label demo-orbit-c">生命樹</div>
          <div className="demo-device-top">
            <span>綠伴 RADAR</span>
            <b>{active.title}</b>
            <small>{active.body}</small>
          </div>
          <div className="demo-map">
            <span className="demo-path" />
            {storySteps.map((step, index) => (
              <i
                className={`demo-point demo-point-${index} ${index <= activeStep ? "is-lit" : ""}`}
                key={step.eyebrow}
              />
            ))}
            <div className="demo-player">
              <Footprints size={20} />
            </div>
            <div className="demo-radius" />
          </div>
          <div className="demo-mission-card">
            <span>{active.district}</span>
            <strong>{active.title}</strong>
            <small>{active.metric}</small>
          </div>
          <div className="demo-tree-growth">
            <Trees size={28} />
            <b>生命樹</b>
            <span>新葉 +{activeStep === 0 ? 0 : activeStep * 4}</span>
          </div>
          {Array.from({ length: 10 }, (_, index) => (
            <i className={`demo-leaf demo-leaf-${index}`} key={index} />
          ))}
        </div>

        <div className="demo-steps" role="tablist" aria-label="產品展示步驟">
          <div className="demo-steps-head">
            <span>LIVE STORY</span>
            <strong>滑動與點擊都能推進故事</strong>
          </div>
          {storySteps.map((step, index) => (
            <button
              aria-selected={activeStep === index}
              className={activeStep === index ? "is-active" : ""}
              key={step.eyebrow}
              onClick={() => setActiveStep(index)}
              onMouseEnter={() => setActiveStep(index)}
              role="tab"
              type="button"
            >
              <span>{step.eyebrow}</span>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function BrandLineStrip({ variant = "light" }: { variant?: "light" | "dark" }) {
  return (
    <section
      className={`brand-lines brand-lines-${variant}`}
      aria-label="綠伴品牌短句"
    >
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

function DistrictMissionDisplay({
  activeDistrict,
}: {
  activeDistrict?: string | null;
}) {
  const mission = getTaipeiDistrictMission(activeDistrict);

  if (!activeDistrict || !mission) {
    return (
      <section className="mission-display is-empty" aria-live="polite">
        <span>SELECT DISTRICT</span>
        <strong>台北任務區</strong>
        <p>
          滑到行政區，這裡會顯示可接取任務。點右側任務卡，也會同步高亮地圖板塊。
        </p>
        <div>
          <b>12 區</b>
          <b>150m 安全半徑</b>
          <b>不顯示私人定位</b>
        </div>
      </section>
    );
  }

  return (
    <section className="mission-display" aria-live="polite">
      <span>CURRENT DISTRICT</span>
      <strong>{activeDistrict}</strong>
      <h3>{mission.title}</h3>
      <div className="mission-display-meta">
        <b>{missionModeLabel(mission.mode)}</b>
        <b>+{mission.points} 成長值</b>
        <b>{mission.status}</b>
      </div>
      <p>{mission.summary}</p>
    </section>
  );
}

function MissionList({
  publicRadar,
  activeDistrict,
  onSelectDistrict,
}: {
  publicRadar: RadarState | null;
  activeDistrict?: string | null;
  onSelectDistrict?: (district: string | null) => void;
}) {
  const handleMissionPointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--mx",
      `${((event.clientX - bounds.left) / bounds.width) * 100}%`,
    );
    event.currentTarget.style.setProperty(
      "--my",
      `${((event.clientY - bounds.top) / bounds.height) * 100}%`,
    );
  };

  return (
    <div className="mission-list">
      <DistrictMissionDisplay activeDistrict={activeDistrict} />
      <div className="mission-console-head">
        <span>QUEST CONSOLE</span>
        <strong>任務控制台</strong>
        <small>點選任務卡，右側顯示台與 3D 板塊會同步切換。</small>
      </div>
      {missionShowcase(publicRadar).map(
        ({ icon: Icon, label, distance, time, points }, index) => {
          const district =
            taipeiMissionDistricts[index % taipeiMissionDistricts.length];
          const mission = getTaipeiDistrictMission(district);
          const isActive = activeDistrict === district;
          return (
            <button
              aria-pressed={isActive}
              className={`mission-control-card ${isActive ? "is-active" : ""}`}
              data-district={district}
              key={`${district}-${label}`}
              onClick={() => onSelectDistrict?.(district)}
              onFocus={() => onSelectDistrict?.(district)}
              onPointerMove={handleMissionPointerMove}
              type="button"
            >
              <span>
                <Icon size={19} />
              </span>
              <div>
                <strong>{mission?.title ?? label}</strong>
                <small>
                  {district} ・{" "}
                  {mission ? missionModeLabel(mission.mode) : distance} ・{" "}
                  {time}
                </small>
              </div>
              <b>{mission ? `+${mission.points}` : points}</b>
            </button>
          );
        },
      )}
      <p>
        <ShieldCheck size={15} />{" "}
        靠近只代表可以接取；完成後，生命樹才會長出新葉。
      </p>
    </div>
  );
}

function RadarShowcase({ publicRadar }: { publicRadar: RadarState | null }) {
  const [activeDistrict, setActiveDistrict] = useState<string | null>("大安區");

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
          <RadarMap3D
            activeDistrict={activeDistrict}
            onActiveDistrictChange={setActiveDistrict}
          />
          <MissionList
            activeDistrict={activeDistrict}
            onSelectDistrict={setActiveDistrict}
            publicRadar={publicRadar}
          />
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

function RouteJourneyShowcase({
  routeData,
}: {
  routeData: ExplorationRouteSummary | null;
}) {
  const quests = routeData?.quests.length
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
            <article
              className="route-quest-card"
              data-reveal
              key={`${quest.locationName}-${quest.title}`}
            >
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
          <h2>
            我們用手機、地圖與實體樹，守住一件簡單的事：讓人被溫柔地看見。
          </h2>
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
  variant,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  variant: "product" | "explore" | "partners" | "impact";
  children: ReactNode;
}) {
  return (
    <section className={`page-hero page-hero-${variant}`}>
      <div className="section-shell page-hero-grid">
        <div className="page-hero-copy" data-reveal>
          <p className="eyebrow">
            <Icon size={16} /> {eyebrow}
          </p>
          <h1>{title}</h1>
          <p className="hero-lead">{body}</p>
          <div className="hero-actions">
            <Link className="button primary" href="/">
              回首頁看世界樹 <ArrowRight size={17} />
            </Link>
            <a
              className="button ghost"
              href={contactHref("綠伴合作與陪伴計畫")}
            >
              聯絡合作
            </a>
          </div>
        </div>
        <div className="page-hero-visual" data-reveal>
          {children}
        </div>
      </div>
    </section>
  );
}

function ProductHeroScene() {
  return (
    <div className="product-hero-scene">
      <div className="product-phone-card">
        <span>今天</span>
        <strong>喝水 · 觀察花草 · 走 400m</strong>
        <i />
        <small>完成後，生命樹長出新葉 +12</small>
      </div>
      <div className="product-orbit-card card-a">走出去</div>
      <div className="product-orbit-card card-b">任務亮起</div>
      <div className="product-orbit-card card-c">樹長一點</div>
    </div>
  );
}

function ExploreHero({ publicRadar }: { publicRadar: RadarState | null }) {
  const [activeDistrict, setActiveDistrict] = useState<string | null>("大安區");

  return (
    <section className="explore-hero">
      <div className="section-shell">
        <div className="explore-hero-heading" data-reveal>
          <p className="eyebrow">
            <Radar size={16} /> 城市探索
          </p>
          <h1>讓城市像溫柔的冒險地圖。</h1>
          <p>
            台北行政區化成可以互動的任務板塊。滑到哪一區，右側顯示台就更新該區任務。
          </p>
        </div>
        <div className="explore-hero-board" data-reveal>
          <div className="explore-map-stage">
            <div className="explore-map-topline">
              <span>TAIPEI LAYERED QUEST MAP</span>
              <b>12 區 · 150m 安全半徑 · 07 個公開任務</b>
            </div>
            <RadarMap3D
              activeDistrict={activeDistrict}
              onActiveDistrictChange={setActiveDistrict}
            />
          </div>
          <MissionList
            activeDistrict={activeDistrict}
            onSelectDistrict={setActiveDistrict}
            publicRadar={publicRadar}
          />
        </div>
      </div>
    </section>
  );
}

function PartnerHeroScene() {
  return (
    <div className="partner-hero-scene">
      {partnerRoles.map(({ icon: Icon, eyebrow, title }) => (
        <article key={title}>
          <Icon size={24} />
          <span>{eyebrow}</span>
          <strong>{title}</strong>
        </article>
      ))}
    </div>
  );
}

function ImpactHeroScene() {
  return (
    <div className="impact-hero-scene">
      {impactPrinciples.map((item, index) => (
        <article key={item.title}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{item.title}</strong>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

export function HomePage() {
  const { publicRadar, routeData } = usePublicExploration();
  const root = usePublicAnimations([
    routeData?.id,
    publicRadar?.missions.length,
  ]);

  return (
    <PublicShell>
      <main ref={root}>
        <HomeHero />
        <CinematicStoryExperience />
        <NatureTechIndex />
        <ProductExperienceLab />
        <RadarShowcase publicRadar={publicRadar} />
        <RouteJourneyShowcase routeData={routeData} />
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
          variant="product"
        >
          <ProductHeroScene />
        </PageHero>
        <ProductExperienceLab />
        <NatureTechIndex />
        <ProductFlow />
        <TechSection />
        <ActionSection />
      </main>
    </PublicShell>
  );
}

export function ExplorePage() {
  const { publicRadar, routeData } = usePublicExploration();
  const root = usePublicAnimations([
    routeData?.id,
    publicRadar?.missions.length,
  ]);
  return (
    <PublicShell>
      <main ref={root}>
        <ExploreHero publicRadar={publicRadar} />
        <RadarShowcase publicRadar={publicRadar} />
        <RouteJourneyShowcase routeData={routeData} />
        <ActionSection />
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
          variant="partners"
        >
          <PartnerHeroScene />
        </PageHero>
        <PartnerNetworkExperience />
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
          variant="impact"
        >
          <ImpactHeroScene />
        </PageHero>
        <ImpactManifestoV2 />
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
