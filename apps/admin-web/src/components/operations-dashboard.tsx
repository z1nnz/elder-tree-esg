"use client";

import { useGSAP } from "@gsap/react";
import type {
  DashboardSnapshot,
  ExplorationRouteSummary,
  ImpactBatchSummary,
  PhotoAiOperationalStatus,
  RadarMissionSummary,
  ReviewItem,
} from "@elder-tree/contracts";
import { gsap } from "gsap";
import {
  Activity,
  BadgeCheck,
  Bell,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Cpu,
  FileCheck2,
  FolderTree,
  Gauge,
  Leaf,
  LoaderCircle,
  Menu,
  MapPinned,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sprout,
  Trees,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { PhotoAiStatusPanel } from "./photo-ai-status-panel";
import { RadarMissionEditor } from "./radar-mission-editor";
import { RouteEditor } from "./route-editor";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

type View = "overview" | "reviews" | "exploration" | "impact" | "devices";

interface DeviceView {
  id: string;
  serialNumber: string;
  name: string;
  claimed: boolean;
  desiredState: {
    treeStage: string;
    ledScene: string;
    growthPoints: number;
  };
  reportedState: {
    online: boolean;
    firmwareVersion: string;
    temperatureC: number | null;
    humidityPercent: number | null;
    ambientLux: number | null;
    presence: boolean | null;
    updatedAt: string;
  };
}

const fallbackSnapshot: DashboardSnapshot = {
  participantCount: 0,
  completedTaskCount: 0,
  pendingReviewCount: 0,
  connectedDeviceCount: 0,
  impactPoolPoints: 0,
  simulatedTreeCount: 0,
};

const navItems = [
  { id: "overview" as const, label: "營運總覽", icon: Gauge },
  { id: "reviews" as const, label: "任務覆核", icon: ClipboardCheck },
  { id: "exploration" as const, label: "城市任務", icon: MapPinned },
  { id: "impact" as const, label: "公益批次", icon: Trees },
  { id: "devices" as const, label: "互動樹裝置", icon: Cpu },
];

export function OperationsDashboard() {
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [photoAiStatus, setPhotoAiStatus] =
    useState<PhotoAiOperationalStatus | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [routes, setRoutes] = useState<ExplorationRouteSummary[]>([]);
  const [radarMissions, setRadarMissions] = useState<RadarMissionSummary[]>([]);
  const [batches, setBatches] = useState<ImpactBatchSummary[]>([]);
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineDemo, setOfflineDemo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchDialog, setBatchDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        nextSnapshot,
        nextPhotoAiStatus,
        nextReviews,
        nextRoutes,
        nextRadarMissions,
        nextBatches,
        nextDevices,
      ] = await Promise.all([
        api.dashboard(),
        api.photoAiStatus(),
        api.reviews(),
        api.explorationRoutes(),
        api.radarMissions(),
        api.impactBatches(),
        api.devices(),
      ]);
      setSnapshot(nextSnapshot);
      setPhotoAiStatus(nextPhotoAiStatus);
      setReviews(nextReviews);
      setRoutes(nextRoutes);
      setRadarMissions(nextRadarMissions);
      setBatches(nextBatches);
      setDevices(nextDevices);
      setOfflineDemo(false);
    } catch {
      setOfflineDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const timeline = gsap.timeline({
        defaults: { duration: 0.45, ease: "power2.out" },
      });
      timeline
        .fromTo(
          ".brand, .sidebar nav .nav-item, .sidebar-meta",
          { x: -10, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, stagger: 0.045 },
        )
        .fromTo(
          ".topbar",
          { y: -10, autoAlpha: 0 },
          { y: 0, autoAlpha: 1 },
          0.08,
        )
        .fromTo(
          ".status-line",
          { y: 8, autoAlpha: 0 },
          { y: 0, autoAlpha: 1 },
          0.22,
        );
    },
    { scope: shellRef },
  );

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        "[data-view-root]",
        { y: 12, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.42,
          ease: "power2.out",
          clearProps: "transform,visibility,opacity",
        },
      );
    },
    {
      dependencies: [view],
      scope: contentRef,
      revertOnUpdate: true,
    },
  );

  const title = useMemo(
    () => navItems.find((item) => item.id === view)?.label ?? "營運總覽",
    [view],
  );

  return (
    <div className="app-shell" ref={shellRef}>
      <aside className={sidebarOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <Sprout size={22} strokeWidth={2.4} />
          </div>
          <div>
            <strong>綠伴</strong>
            <span>永續共創營運台</span>
          </div>
          <button
            className="icon-button mobile-only"
            onClick={() => setSidebarOpen(false)}
            title="關閉導覽"
          >
            <X size={20} />
          </button>
        </div>

        <nav aria-label="主要導覽">
          <p className="nav-label">工作區</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setView(id);
                setSidebarOpen(false);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "reviews" && reviews.length > 0 ? (
                <b>{reviews.length}</b>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-meta">
          <div className="org-row">
            <div className="org-icon">
              <Building2 size={18} />
            </div>
            <div>
              <strong>城市共好協會</strong>
              <span>示範組織</span>
            </div>
          </div>
          <button className="nav-item">
            <Settings size={18} />
            <span>組織設定</span>
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          className="backdrop"
          aria-label="關閉導覽"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main>
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setSidebarOpen(true)}
            title="開啟導覽"
          >
            <Menu size={21} />
          </button>
          <div>
            <p>城市共好協會</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search">
              <Search size={18} />
              <input aria-label="搜尋" placeholder="搜尋任務、裝置或批次" />
            </label>
            <button className="icon-button" title="通知">
              <Bell size={20} />
              <span className="notification-dot" />
            </button>
            <button className="profile-button" title="帳號選單">
              <span>林</span>
              <div>
                <strong>林雨晴</strong>
                <small>組織管理員</small>
              </div>
            </button>
          </div>
        </header>

        <div className="content" ref={contentRef}>
          <div className="status-line">
            <div className={offlineDemo ? "connection offline" : "connection"}>
              <span />
              {offlineDemo ? "API 無法連線，未顯示假資料" : "API 已連線"}
            </div>
            <button className="text-button" onClick={() => void load()}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              重新整理
            </button>
          </div>

          {view === "overview" ? (
            <Overview
              snapshot={snapshot}
              photoAiStatus={photoAiStatus}
              reviews={reviews}
              routes={routes}
              radarMissions={radarMissions}
              devices={devices}
              onNavigate={setView}
            />
          ) : null}
          {view === "reviews" ? (
            <Reviews reviews={reviews} photoAiStatus={photoAiStatus} />
          ) : null}
          {view === "exploration" ? (
            <div className="exploration-stack">
              <RouteEditor routes={routes} onRoutesChange={setRoutes} />
              <RadarMissionEditor
                missions={radarMissions}
                onMissionsChange={setRadarMissions}
              />
            </div>
          ) : null}
          {view === "impact" ? (
            <Impact
              batches={batches}
              onCreate={() => setBatchDialog(true)}
              onPublish={async (id) => {
                setBusyId(id);
                try {
                  const updated = await api.publishBatch(id);
                  setBatches((items) =>
                    items.map((item) => (item.id === id ? updated : item)),
                  );
                } finally {
                  setBusyId(null);
                }
              }}
              busyId={busyId}
            />
          ) : null}
          {view === "devices" ? <Devices devices={devices} /> : null}
        </div>
      </main>

      {batchDialog ? (
        <BatchDialog
          onClose={() => setBatchDialog(false)}
          onCreate={async (title, points) => {
            const batch = await api.createBatch(title, points);
            setBatches((items) => [batch, ...items]);
            setBatchDialog(false);
          }}
        />
      ) : null}
    </div>
  );
}

function Overview({
  snapshot,
  photoAiStatus,
  reviews,
  routes,
  radarMissions,
  devices,
  onNavigate,
}: {
  snapshot: DashboardSnapshot;
  photoAiStatus: PhotoAiOperationalStatus | null;
  reviews: ReviewItem[];
  routes: ExplorationRouteSummary[];
  radarMissions: RadarMissionSummary[];
  devices: DeviceView[];
  onNavigate: (view: View) => void;
}) {
  const publishedRadarCount = radarMissions.filter(
    (mission) => mission.publicationStatus === "PUBLISHED",
  ).length;
  const publishedRouteCount = routes.filter(
    (route) => route.status === "PUBLISHED",
  ).length;
  const photoAiReady =
    photoAiStatus?.photoEvidence.enabled === true &&
    photoAiStatus.geminiPhotoVerification.enabled === true;
  const metrics = [
    {
      label: "參與者",
      value: snapshot.participantCount,
      hint: "本期啟用",
      icon: Users,
      tone: "green",
    },
    {
      label: "完成任務",
      value: snapshot.completedTaskCount,
      hint: "累積行動",
      icon: BadgeCheck,
      tone: "yellow",
    },
    {
      label: "待覆核",
      value: snapshot.pendingReviewCount,
      hint: "需要處理",
      icon: ClipboardCheck,
      tone: "coral",
    },
    {
      label: "公開雷達",
      value: publishedRadarCount,
      hint: `${publishedRouteCount} 條路線`,
      icon: MapPinned,
      tone: "blue",
    },
  ];

  const overviewRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
      });
      timeline
        .fromTo(
          ".metric",
          { y: 10, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.42,
            stagger: 0.06,
            clearProps: "transform,visibility,opacity",
          },
        )
        .fromTo(
          ".bar-track span",
          { scaleY: 0, transformOrigin: "bottom" },
          {
            scaleY: 1,
            duration: 0.7,
            stagger: 0.055,
            ease: "power3.out",
            clearProps: "transform",
          },
          0.14,
        )
        .fromTo(
          ".impact-progress span",
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 0.8,
            ease: "power3.out",
            clearProps: "transform",
          },
          0.22,
        )
        .fromTo(
          ".review-compact, .device-strip",
          { y: 8, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.4,
            stagger: 0.08,
            clearProps: "transform,visibility,opacity",
          },
          0.28,
        );
    },
    { scope: overviewRef },
  );

  const validationItems = [
    {
      label: "App 實機驗收",
      value: `${Math.max(snapshot.completedTaskCount, 0)}`,
      detail: "任務完成紀錄",
      icon: BadgeCheck,
      action: "查看流程",
      view: "exploration" as View,
    },
    {
      label: "PHOTO AI",
      value: `${reviews.length}`,
      detail: "待家人覆核",
      icon: FileCheck2,
      action: "前往覆核",
      view: "reviews" as View,
    },
    {
      label: "互動樹裝置",
      value: `${devices.filter((device) => device.reportedState.online).length}`,
      detail: "目前在線",
      icon: Cpu,
      action: "裝置狀態",
      view: "devices" as View,
    },
    {
      label: "LINE 輔助入口",
      value: "MVP",
      detail: "提醒 / 求助 / 覆核通知",
      icon: Activity,
      action: "查看任務",
      view: "exploration" as View,
    },
  ];

  return (
    <div className="overview-motion-root" data-view-root ref={overviewRef}>
      <section className="ops-hero" aria-label="App V2 營運總控台">
        <div className="ops-hero-copy">
          <span>GREEN COMPANION OPS</span>
          <h2>綠伴營運總控台</h2>
          <p>
            把 App 驗收、城市雷達、照片 AI、家人覆核與互動樹裝置放在同一個畫面。
            這裡只顯示真實狀態，不用假數字撐場面。
          </p>
          <div className="ops-hero-actions">
            <button className="primary-button" onClick={() => onNavigate("exploration")}>
              任務營運 <ChevronRight size={16} />
            </button>
            <button className="secondary-button" onClick={() => onNavigate("reviews")}>
              照片覆核
            </button>
          </div>
        </div>
        <div className="ops-radar" aria-hidden="true">
          <div className="ops-radar-ring ops-radar-ring-a" />
          <div className="ops-radar-ring ops-radar-ring-b" />
          <div className="ops-radar-ring ops-radar-ring-c" />
          <span className="ops-pulse ops-pulse-a" />
          <span className="ops-pulse ops-pulse-b" />
          <span className="ops-pulse ops-pulse-c" />
          <strong>TAIPEI QUEST LIVE</strong>
          <small>雷達任務 · 路線任務 · 安全半徑</small>
        </div>
        <div className="ops-validation-grid">
          {validationItems.map(({ label, value, detail, icon: Icon, action, view }) => (
            <button
              className="ops-validation-card"
              key={label}
              onClick={() => onNavigate(view)}
              type="button"
            >
              <Icon size={20} />
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
              <b>{action}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="ops-command-strip" aria-label="營運狀態列">
        <article>
          <span>APP ADVENTURE V2</span>
          <strong>{publishedRadarCount} 個雷達任務已發布</strong>
          <small>探索頁以定位、半徑與任務 sheet 為主，不再依賴全域底部 nav。</small>
        </article>
        <article>
          <span>PHOTO AI</span>
          <strong>{photoAiReady ? "照片驗證可用" : "需要環境檢查"}</strong>
          <small>一般任務可 PHOTO_AI；雷達任務仍維持 SELF_CHECK / TIMER。</small>
        </article>
        <article>
          <span>LINE COMPANION</span>
          <strong>輔助入口保留</strong>
          <small>LINE 用於提醒、求助與通知，不取代 App 地圖探索。</small>
        </article>
      </section>

      <section className="metric-grid" aria-label="關鍵數據">
        {metrics.map(({ label, value, hint, icon: Icon, tone }) => (
          <article className="metric" key={label}>
            <div className={`metric-icon ${tone}`}>
              <Icon size={21} />
            </div>
            <div>
              <span>{label}</span>
              <AnimatedNumber value={value} />
              <small>{hint}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p>本期行動</p>
              <h2>任務完成趨勢</h2>
            </div>
            <span className="period">近 7 天</span>
          </div>
          <div className="bar-chart" aria-label="七日任務完成長條圖">
            {[38, 52, 45, 68, 61, 84, 72].map((height, index) => (
              <div className="bar-column" key={index}>
                <div className="bar-track">
                  <span style={{ height: `${height}%` }} />
                </div>
                <small>{"一二三四五六日"[index]}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel impact-panel">
          <div className="panel-heading">
            <div>
              <p>公益池</p>
              <h2>可分配成長值</h2>
            </div>
            <Leaf size={21} />
          </div>
          <AnimatedNumber
            className="impact-number"
            value={snapshot.impactPoolPoints}
          />
          <span>成長值</span>
          <div className="impact-progress">
            <span style={{ width: "74%" }} />
          </div>
          <div className="impact-foot">
            <span>
              <Trees size={17} /> 約 {snapshot.simulatedTreeCount} 棵示範樹
            </span>
            <button onClick={() => onNavigate("impact")}>
              查看批次 <ChevronRight size={16} />
            </button>
          </div>
          <p className="simulation-note">
            <CircleAlert size={15} />
            目前為系統模擬換算，並非真實植樹聲明。
          </p>
        </div>
      </section>

      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <p>立即處理</p>
            <h2>待覆核任務</h2>
          </div>
          <button className="secondary-button" onClick={() => onNavigate("reviews")}>
            查看全部
          </button>
        </div>
        {reviews.length ? (
          <div className="review-compact">
            <Image
              src={reviews[0].imageUrl}
              alt="待覆核的植物任務照片"
              width={96}
              height={72}
            />
            <div>
              <strong>{reviews[0].taskTitle}</strong>
              <span>{reviews[0].participantName}</span>
            </div>
            <div className="confidence">
              <small>AI 信心值</small>
              <strong>{Math.round(reviews[0].confidence * 100)}%</strong>
            </div>
            <button className="primary-button" onClick={() => onNavigate("reviews")}>
              開始覆核
            </button>
          </div>
        ) : (
          <EmptyState text="目前沒有待覆核任務" />
        )}
      </section>

      <section className="device-strip">
        <div className="device-status-icon">
          <Cpu size={22} />
        </div>
        <div>
          <span>互動樹狀態</span>
          <strong>{devices[0]?.name ?? "尚未認領裝置"}</strong>
        </div>
        <span className={devices[0]?.reportedState.online ? "online-pill" : "offline-pill"}>
          {devices[0]?.reportedState.online ? "在線" : "離線"}
        </span>
        <div className="sensor-value">
          <small>室溫</small>
          <strong>{devices[0]?.reportedState.temperatureC ?? "--"}°C</strong>
        </div>
        <div className="sensor-value">
          <small>濕度</small>
          <strong>{devices[0]?.reportedState.humidityPercent ?? "--"}%</strong>
        </div>
        <button className="icon-button" title="查看裝置" onClick={() => onNavigate("devices")}>
          <ChevronRight size={20} />
        </button>
      </section>
    </div>
  );
}

function Reviews({
  reviews,
  photoAiStatus,
}: {
  reviews: ReviewItem[];
  photoAiStatus: PhotoAiOperationalStatus | null;
}) {
  const fullyEnabled =
    photoAiStatus?.photoEvidence.enabled === true &&
    photoAiStatus.geminiPhotoVerification.enabled === true;
  return (
    <section className="workspace" data-view-root>
      <div className="workspace-heading">
        <div>
          <h2>照片覆核佇列</h2>
          <p>
            一般 PHOTO_AI 任務已接上 Evidence、Firebase Storage 與 AI
            verifier；雷達任務仍維持 SELF_CHECK / TIMER。
          </p>
        </div>
        <span className={fullyEnabled ? "queue-count" : "queue-count warning"}>
          {fullyEnabled ? "照片 AI 已啟用" : "需檢查環境"}
        </span>
      </div>
      <PhotoAiStatusPanel status={photoAiStatus} reviewCount={reviews.length} />
      {reviews.length ? (
        <div className="review-list">
          {reviews.map((item) => (
            <article className="review-item" key={item.id}>
              <Image
                src={item.imageUrl}
                alt={`${item.taskTitle}的任務照片`}
                width={220}
                height={160}
              />
              <div className="review-detail">
                <div className="review-title">
                  <div>
                    <span>{item.participantName}</span>
                    <h3>{item.taskTitle}</h3>
                  </div>
                  <strong>{Math.round(item.confidence * 100)}%</strong>
                </div>
                <div className="tag-row">
                  {item.labels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <p>{item.explanation}</p>
                <div className="review-actions">
                  <button className="secondary-button" disabled>
                    {fullyEnabled ? "家人覆核決策由 App 處理" : "等待照片 AI 環境完成"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState text="覆核佇列已清空" />
      )}
    </section>
  );
}

function Impact({
  batches,
  onCreate,
  onPublish,
  busyId,
}: {
  batches: ImpactBatchSummary[];
  onCreate: () => void;
  onPublish: (id: string) => Promise<void>;
  busyId: string | null;
}) {
  return (
    <section className="workspace" data-view-root>
      <div className="workspace-heading">
        <div>
          <h2>公益成果批次</h2>
          <p>虛擬成熟樹先進入公益池，再由批次記錄分配與公開狀態。</p>
        </div>
        <button className="primary-button" onClick={onCreate}>
          <Plus size={18} /> 建立模擬批次
        </button>
      </div>
      <div className="warning-band">
        <ShieldCheck size={20} />
        <div>
          <strong>防漂綠保護已啟用</strong>
          <span>第一版只允許建立 simulated=true 的批次，公開頁會持續顯示模擬標記。</span>
        </div>
      </div>
      <div className="batch-table">
        <div className="batch-row batch-head">
          <span>批次</span>
          <span>分配點數</span>
          <span>換算示範</span>
          <span>狀態</span>
          <span />
        </div>
        {batches.map((batch) => (
          <div className="batch-row" key={batch.id}>
            <div>
              <FileCheck2 size={19} />
              <div>
                <strong>{batch.title}</strong>
                <small>模擬批次</small>
              </div>
            </div>
            <span>{batch.allocatedPoints.toLocaleString()}</span>
            <span>{batch.equivalentTrees} 棵</span>
            <span className={`status status-${batch.status.toLowerCase()}`}>
              {batch.status}
            </span>
            {batch.status === "PUBLISHED" ? (
              <span className="published">
                <Check size={16} /> 已公開
              </span>
            ) : (
              <button
                className="secondary-button"
                disabled={busyId === batch.id}
                onClick={() => void onPublish(batch.id)}
              >
                公開模擬成果
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Devices({ devices }: { devices: DeviceView[] }) {
  return (
    <section className="workspace" data-view-root>
      <div className="workspace-heading">
        <div>
          <h2>互動樹裝置</h2>
          <p>查看 Device Shadow、感測資料、韌體版本與最後連線狀態。</p>
        </div>
        <button className="secondary-button">
          <Plus size={18} /> 認領裝置
        </button>
      </div>
      <div className="device-grid">
        {devices.map((device) => (
          <article className="device-card" key={device.id}>
            <div className="device-visual">
              <FolderTree size={46} />
              <span className={device.reportedState.online ? "pulse online" : "pulse"} />
            </div>
            <div className="device-name">
              <div>
                <span>{device.serialNumber}</span>
                <h3>{device.name}</h3>
              </div>
              <span className={device.reportedState.online ? "online-pill" : "offline-pill"}>
                {device.reportedState.online ? "在線" : "離線"}
              </span>
            </div>
            <dl>
              <div>
                <dt>樹階段</dt>
                <dd>{device.desiredState.treeStage}</dd>
              </div>
              <div>
                <dt>成長值</dt>
                <dd>{device.desiredState.growthPoints}</dd>
              </div>
              <div>
                <dt>室溫</dt>
                <dd>{device.reportedState.temperatureC ?? "--"}°C</dd>
              </div>
              <div>
                <dt>濕度</dt>
                <dd>{device.reportedState.humidityPercent ?? "--"}%</dd>
              </div>
              <div>
                <dt>光照</dt>
                <dd>{device.reportedState.ambientLux ?? "--"} lux</dd>
              </div>
              <div>
                <dt>韌體</dt>
                <dd>v{device.reportedState.firmwareVersion}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function BatchDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, points: number) => Promise<void>;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("八月社區綠化示範批次");
  const [points, setPoints] = useState(10000);
  const [busy, setBusy] = useState(false);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const timeline = gsap.timeline({
        defaults: { duration: 0.28, ease: "power2.out" },
      });
      timeline
        .fromTo(
          backdropRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1 },
        )
        .fromTo(
          dialogRef.current,
          { y: 14, scale: 0.98, autoAlpha: 0 },
          { y: 0, scale: 1, autoAlpha: 1 },
          0.05,
        );
    },
    { scope: backdropRef },
  );

  return (
    <div className="dialog-backdrop" ref={backdropRef} role="presentation">
      <form
        className="dialog"
        ref={dialogRef}
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void onCreate(title, points).finally(() => setBusy(false));
        }}
      >
        <div className="dialog-heading">
          <div>
            <span>simulated=true</span>
            <h2>建立模擬公益批次</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="關閉">
            <X size={20} />
          </button>
        </div>
        <label>
          批次名稱
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            minLength={3}
            maxLength={100}
            required
          />
        </label>
        <label>
          分配成長值
          <input
            type="number"
            min={1}
            value={points}
            onChange={(event) => setPoints(Number(event.target.value))}
            required
          />
        </label>
        <p>
          <CircleAlert size={17} />
          此批次只用於展示系統流程，不代表真實植樹或碳權。
        </p>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? <LoaderCircle size={18} className="spin" /> : <Plus size={18} />}
            建立批次
          </button>
        </div>
      </form>
    </div>
  );
}

function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const numberRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const element = numberRef.current;
      if (!element) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        element.textContent = value.toLocaleString("zh-TW");
        return;
      }

      const counter = { value: 0 };
      gsap.to(counter, {
        value,
        duration: 0.8,
        ease: "power2.out",
        onUpdate: () => {
          element.textContent = Math.round(counter.value).toLocaleString("zh-TW");
        },
      });
    },
    {
      dependencies: [value],
      scope: numberRef,
      revertOnUpdate: true,
    },
  );

  return (
    <strong className={className} ref={numberRef}>
      {value.toLocaleString("zh-TW")}
    </strong>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Activity size={25} />
      <strong>{text}</strong>
      <span>新的資料抵達後會顯示在這裡。</span>
    </div>
  );
}
