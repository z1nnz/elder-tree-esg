"use client";

import type { ExplorationRouteSummary } from "@elder-tree/contracts";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowDown,
  ArrowUpRight,
  Bot,
  Building2,
  Cpu,
  HeartHandshake,
  MapPinned,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sprout,
  Trees,
  Users,
} from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

const participationPaths = [
  {
    icon: Sprout,
    eyebrow: "自主模式",
    title: "一個人，也能開始",
    body: "不用先綁定任何人。選擇舒服的任務、探索自己的城市，照顧一棵屬於自己的樹。",
  },
  {
    icon: Users,
    eyebrow: "親友模式",
    title: "想一起，就邀請重要的人",
    body: "家人、朋友可以共享家庭樹、交換訊息與互相確認任務，但陪伴從來不是使用資格。",
  },
  {
    icon: HeartHandshake,
    eyebrow: "社區陪伴",
    title: "沒有家人，也有人接得住",
    body: "由社工、長照單位、協會與審核志工建立安全的陪伴關係，權限最小化，也能隨時撤回。",
  },
];

const techFlow = [
  { icon: Smartphone, label: "手機", detail: "探索、任務與自主選擇" },
  { icon: MapPinned, label: "開源地圖", detail: "距離與地標觸發" },
  { icon: Bot, label: "AI 驗證", detail: "低信心交給人判斷" },
  { icon: Cpu, label: "實體樹", detail: "把成長帶進生活空間" },
  { icon: Building2, label: "營運平台", detail: "安全、稽核與機構協作" },
];

const contactHref = (subject: string) => {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return email
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : "https://github.com/z1nnz/elder-tree-esg";
};

export function PublicExperience() {
  const root = useRef<HTMLElement>(null);
  const [routeData, setRouteData] = useState<ExplorationRouteSummary | null>(
    null,
  );

  useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api/v1";
    const controller = new AbortController();
    void fetch(
      `${apiUrl}/public/exploration/routes/daan-forest-first-walk`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("route unavailable");
        return (await response.json()) as {
          data: ExplorationRouteSummary;
        };
      })
      .then(({ data }) => setRouteData(data))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

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
            .from(".site-header", { y: -24, autoAlpha: 0 })
            .from(
              ".hero-copy > *",
              { y: 34, autoAlpha: 0, stagger: 0.1 },
              "<0.15",
            )
            .from(
              ".hero-visual",
              { scale: 0.86, rotation: -3, autoAlpha: 0 },
              "<0.2",
            )
            .from(
              ".orbit-card",
              { scale: 0.6, autoAlpha: 0, stagger: 0.08 },
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
            gsap.to(".tree-crown", {
              y: -10,
              rotation: 1.5,
              duration: 2.8,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            });
          }
        },
      );
      return () => media.revert();
    },
    { scope: root },
  );

  useGSAP(
    () => {
      if (
        !routeData ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      const route = gsap.timeline({
        scrollTrigger: {
          trigger: ".journey-map",
          start: "top 74%",
          end: "bottom 45%",
          scrub: 0.8,
        },
      });
      route
        .fromTo(
          ".route-path",
          { strokeDashoffset: 860 },
          { strokeDashoffset: 0, ease: "none" },
        )
        .from(
          ".map-node",
          { scale: 0, transformOrigin: "center", stagger: 0.1 },
          "<0.08",
        );
    },
    {
      scope: root,
      dependencies: [routeData?.id],
      revertOnUpdate: true,
    },
  );

  return (
    <main ref={root}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="綠伴首頁">
          <span>
            <Sprout size={21} />
          </span>
          綠伴 Elder Tree
        </a>
        <nav aria-label="主要導覽">
          <a href="#why">為什麼</a>
          <a href="#join">如何參與</a>
          <a href="#technology">技術</a>
        </nav>
        <a className="header-cta" href="#action">
          找到我的方式 <ArrowUpRight size={16} />
        </a>
      </header>

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
            不要求你先有家人，也不拿連續簽到懲罰生活。綠伴讓每個人用自己的步調開始；
            想有人同行時，親友、社工、機構與志工都能安全地接住。
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#join">
              看看怎麼參與 <ArrowDown size={17} />
            </a>
            <a className="button ghost" href="#technology">
              看見背後科技
            </a>
          </div>
          <div className="trust-row">
            <span>
              <ShieldCheck size={17} /> 位置只保存粗略事件
            </span>
            <span>
              <HeartHandshake size={17} /> 陪伴可以選擇與撤回
            </span>
          </div>
        </div>

        <div className="hero-visual" aria-label="從種子長成城市森林的視覺">
          <div className="sun" />
          <svg viewBox="0 0 520 600" role="img" aria-hidden="true">
            <path className="hill hill-back" d="M0 480 Q130 380 260 470 T520 450 V600 H0Z" />
            <path className="hill hill-front" d="M0 520 Q120 430 270 520 T520 490 V600 H0Z" />
            <g className="tree">
              <path className="tree-trunk" d="M260 505 C248 410 274 350 260 250" />
              <g className="tree-crown">
                <circle cx="260" cy="224" r="92" />
                <circle cx="195" cy="282" r="66" />
                <circle cx="330" cy="286" r="72" />
                <circle cx="250" cy="315" r="82" />
              </g>
            </g>
            <path className="walk-path" d="M70 552 C160 500 205 540 270 510 S400 480 470 520" />
          </svg>
          <div className="orbit-card card-map">
            <MapPinned size={19} />
            <span>探索任務已解鎖</span>
          </div>
          <div className="orbit-card card-tree">
            <Trees size={19} />
            <span>家庭樹 +40</span>
          </div>
          <div className="orbit-card card-care">
            <HeartHandshake size={19} />
            <span>陪伴由你選擇</span>
          </div>
        </div>
      </section>

      <section className="statement" id="why">
        <p data-reveal>我們不是要修理一個人。</p>
        <h2 data-reveal>
          我們想讓「自主」與「有人可以找」同時存在。
        </h2>
        <div className="statement-grid">
          <article data-reveal>
            <strong>不以家庭作門票</strong>
            <p>沒有可綁定對象，仍能使用完整的任務、探索與成長系統。</p>
          </article>
          <article data-reveal>
            <strong>不以焦慮作誘因</strong>
            <p>沒有斷簽懲罰，也不鼓勵超出身體能力的競賽。</p>
          </article>
          <article data-reveal>
            <strong>不把永續當口號</strong>
            <p>模擬與真實成果分開標示，每筆成長都有可追溯來源。</p>
          </article>
        </div>
      </section>

      <section className="paths section-shell" id="join">
        <div className="section-heading" data-reveal>
          <p className="eyebrow">三條路，都是真正的參與</p>
          <h2>今天想自己走，或想有人同行，都可以。</h2>
        </div>
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
      </section>

      <section className="journey section-shell">
        <div className="section-heading" data-reveal>
          <p className="eyebrow">把城市變成溫柔的遊戲場</p>
          <h2>{routeData?.name ?? "首發探索路線載入中"}</h2>
          <p>
            {routeData?.description ??
              "公開路線只包含任務內容與地標，不含任何使用者位置或個人進度。"}
          </p>
        </div>
        <div className="journey-map" data-reveal>
          <svg viewBox="0 0 1000 470" role="img" aria-label="城市探索任務路徑">
            <path
              className="city-block"
              d="M40 70H310V205H40ZM370 38H650V185H370ZM705 80H960V240H705ZM90 265H360V430H90ZM430 245H700V425H430ZM760 300H955V440H760Z"
            />
            <path
              className="route-path"
              pathLength="860"
              d="M95 350 C210 250 275 355 420 315 S620 90 760 170 S840 355 920 370"
            />
            {(routeData?.quests ?? []).map((quest, index) => {
              const positions = [
                ["120", "340"],
                ["270", "292"],
                ["420", "315"],
                ["570", "185"],
                ["700", "150"],
                ["825", "255"],
                ["920", "370"],
              ];
              const [cx, cy] = positions[index] ?? ["920", "370"];
              return (
                <g className="map-node" key={cx}>
                  <circle cx={cx} cy={cy} r="23" />
                  <text x={cx} y={Number(cy) + 6} textAnchor="middle">
                    {quest.sequence}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="map-legend">
            {(routeData?.quests ?? []).map((quest) => (
              <span key={quest.id}>
                <i
                  className={
                    quest.triggerType === "DISTANCE" ? "yellow" : "green"
                  }
                />
                {quest.locationName}・{quest.title}
              </span>
            ))}
            {routeData ? (
              <strong className="route-badge">
                完成 {routeData.totalQuestCount} 站，取得「{routeData.badgeName}」
              </strong>
            ) : null}
          </div>
        </div>
      </section>

      <section className="technology" id="technology">
        <div className="section-shell">
          <div className="section-heading light" data-reveal>
            <p className="eyebrow">理念不是簡報，它有一套可以運作的系統</p>
            <h2>手機、AI、開源地圖與實體樹，組成一個陪伴循環。</h2>
          </div>
          <div className="tech-flow">
            {techFlow.map(({ icon: Icon, label, detail }, index) => (
              <article data-reveal key={label}>
                <span className="tech-index">0{index + 1}</span>
                <Icon size={27} />
                <h3>{label}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
          <div className="tech-proof" data-reveal>
            <div>
              <ShieldCheck size={25} />
              <strong>隱私先於功能</strong>
              <p>精確位置只暫存最新一點；照片服務未開放前保持鎖定；陪伴者只取得最低必要權限。</p>
            </div>
            <div>
              <Bot size={25} />
              <strong>AI 不取代人的判斷</strong>
              <p>照片驗證啟用後，高信心才自動通過；不確定時仍交由可信任的人覆核。</p>
            </div>
            <div>
              <Cpu size={25} />
              <strong>數位成長走進真實空間</strong>
              <p>實體陪伴樹透過燈光、螢幕與按鍵回應，不裝相機與麥克風。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="action section-shell" id="action">
        <div className="action-copy" data-reveal>
          <p className="eyebrow">每一種加入，都讓城市多一點照應</p>
          <h2>你不必先成為誰的家人，才值得被陪伴。</h2>
        </div>
        <div className="action-grid">
          <a href={contactHref("我想開始使用綠伴")} data-reveal>
            <Sprout size={24} />
            <strong>我想開始</strong>
            <span>自主探索與生活任務</span>
            <ArrowUpRight />
          </a>
          <a href={contactHref("我想成為陪伴志工")} data-reveal>
            <HeartHandshake size={24} />
            <strong>我想陪伴</strong>
            <span>志工、朋友與社區夥伴</span>
            <ArrowUpRight />
          </a>
          <a href={contactHref("綠伴機構合作")} data-reveal>
            <Building2 size={24} />
            <strong>機構合作</strong>
            <span>長照、社福、協會與企業</span>
            <ArrowUpRight />
          </a>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top">
          <span><Sprout size={19} /></span>
          綠伴 Elder Tree
        </a>
        <p>讓自主與陪伴，不再是二選一。</p>
        <small>本平台的公益換算不等同碳權；真實與模擬成果將清楚分開。</small>
      </footer>
    </main>
  );
}
