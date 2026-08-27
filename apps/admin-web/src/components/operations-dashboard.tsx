"use client";

import { useGSAP } from "@gsap/react";
import type {
  AdminLineBindingSummary,
  DashboardSnapshot,
  ExplorationRouteSummary,
  ImpactBatchSummary,
  LineNotificationStatus,
  LineOperationalStatus,
  PhotoAiOperationalStatus,
  PartnerCampaignSummary,
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
  ShieldCheck,
  Sprout,
  MessageCircle,
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

type View =
  | "overview"
  | "reviews"
  | "partners"
  | "exploration"
  | "line"
  | "impact"
  | "devices";

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
  { id: "partners" as const, label: "夥伴提案", icon: FileCheck2 },
  { id: "exploration" as const, label: "城市任務", icon: MapPinned },
  { id: "line" as const, label: "LINE 陪伴", icon: MessageCircle },
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
  const [partnerCampaigns, setPartnerCampaigns] = useState<
    PartnerCampaignSummary[]
  >([]);
  const [routes, setRoutes] = useState<ExplorationRouteSummary[]>([]);
  const [radarMissions, setRadarMissions] = useState<RadarMissionSummary[]>([]);
  const [lineBindings, setLineBindings] = useState<AdminLineBindingSummary[]>(
    [],
  );
  const [lineStatus, setLineStatus] = useState<LineOperationalStatus | null>(
    null,
  );
  const [batches, setBatches] = useState<ImpactBatchSummary[]>([]);
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineDemo, setOfflineDemo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lineBusyId, setLineBusyId] = useState<string | null>(null);
  const [linePushResult, setLinePushResult] =
    useState<LineNotificationStatus | null>(null);
  const [batchDialog, setBatchDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        nextSnapshot,
        nextPhotoAiStatus,
        nextReviews,
        nextPartnerCampaigns,
        nextRoutes,
        nextRadarMissions,
        nextLineBindings,
        nextLineStatus,
        nextBatches,
        nextDevices,
      ] = await Promise.all([
        api.dashboard(),
        api.photoAiStatus(),
        api.reviews(),
        api.adminPartnerCampaigns(),
        api.explorationRoutes(),
        api.radarMissions(),
        api.lineBindings(),
        api.lineStatus(),
        api.impactBatches(),
        api.devices(),
      ]);
      setSnapshot(nextSnapshot);
      setPhotoAiStatus(nextPhotoAiStatus);
      setReviews(nextReviews);
      setPartnerCampaigns(nextPartnerCampaigns);
      setRoutes(nextRoutes);
      setRadarMissions(nextRadarMissions);
      setLineBindings(nextLineBindings);
      setLineStatus(nextLineStatus);
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
            <strong>同行成林</strong>
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
              ) : id === "partners" &&
                partnerCampaigns.some(
                  (campaign) => campaign.status === "SUBMITTED",
                ) ? (
                <b>
                  {
                    partnerCampaigns.filter(
                      (campaign) => campaign.status === "SUBMITTED",
                    ).length
                  }
                </b>
              ) : id === "line" && lineBindings.length > 0 ? (
                <b>
                  {
                    lineBindings.filter(
                      (binding) => binding.status === "ACTIVE",
                    ).length
                  }
                </b>
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
              <strong>平台管理工作區</strong>
              <span>跨組織審核與營運</span>
            </div>
          </div>
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
            <p>同行成林 · 平台管理</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <div className="profile-button">
              <span><ShieldCheck size={18} /></span>
              <div>
                <strong>平台管理員</strong>
                <small>已驗證管理權限</small>
              </div>
            </div>
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
              lineBindings={lineBindings}
              devices={devices}
              onNavigate={setView}
            />
          ) : null}
          {view === "reviews" ? (
            <Reviews reviews={reviews} photoAiStatus={photoAiStatus} />
          ) : null}
          {view === "partners" ? (
            <PartnerCampaignReviews
              campaigns={partnerCampaigns}
              onChange={(updated) =>
                setPartnerCampaigns((campaigns) =>
                  campaigns.map((campaign) =>
                    campaign.id === updated.id ? updated : campaign,
                  ),
                )
              }
            />
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
          {view === "line" ? (
            <LineOps
              bindings={lineBindings}
              status={lineStatus}
              busyId={lineBusyId}
              lastResult={linePushResult}
              onTestPush={async (bindingId) => {
                setLineBusyId(bindingId);
                try {
                  const result = await api.testLinePush(bindingId);
                  setLinePushResult(result);
                  setLineBindings(await api.lineBindings());
                } finally {
                  setLineBusyId(null);
                }
              }}
            />
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
  lineBindings,
  devices,
  onNavigate,
}: {
  snapshot: DashboardSnapshot;
  photoAiStatus: PhotoAiOperationalStatus | null;
  reviews: ReviewItem[];
  routes: ExplorationRouteSummary[];
  radarMissions: RadarMissionSummary[];
  lineBindings: AdminLineBindingSummary[];
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
  const activeLineCount = lineBindings.filter(
    (binding) => binding.status === "ACTIVE",
  ).length;
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
      label: "行動紀錄",
      value: `${Math.max(snapshot.completedTaskCount, 0)}`,
      detail: "任務完成紀錄",
      icon: BadgeCheck,
      action: "查看流程",
      view: "exploration" as View,
    },
    {
      label: "照片見證",
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
      value: `${activeLineCount}`,
      detail: "目前啟用綁定",
      icon: Activity,
      action: "查看 LINE",
      view: "line" as View,
    },
  ];

  return (
    <div className="overview-motion-root" data-view-root ref={overviewRef}>
      <section className="ops-hero" aria-label="營運工作入口">
        <div className="ops-hero-copy">
          <h2>讓每一段同行，安心出發。</h2>
          <p>
            管理城市旅程、檢查行動見證，並追蹤互動樹的連線狀態。
          </p>
          <div className="ops-hero-actions">
            <button
              className="primary-button"
              onClick={() => onNavigate("exploration")}
            >
              任務營運 <ChevronRight size={16} />
            </button>
            <button
              className="secondary-button"
              onClick={() => onNavigate("reviews")}
            >
              照片覆核
            </button>
          </div>
        </div>
        <div className="ops-validation-grid">
          {validationItems.map(
            ({ label, value, detail, icon: Icon, action, view }) => (
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
            ),
          )}
        </div>
      </section>

      <section className="ops-command-strip" aria-label="營運狀態列">
        <article>
          <span>城市探索</span>
          <strong>{publishedRadarCount} 個雷達任務已發布</strong>
          <small>
            參與者可在探索頁查看附近旅程與場域範圍。
          </small>
        </article>
        <article>
          <span>照片見證</span>
          <strong>{photoAiReady ? "照片驗證可用" : "需要環境檢查"}</strong>
          <small>
            一般任務支援照片判讀；城市旅程使用現場確認或停留計時。
          </small>
        </article>
        <article>
          <span>陪伴通知</span>
          <strong>{activeLineCount} 個 LINE 綁定</strong>
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
          <p className="empty-state">尚未提供每日統計。累積完成數請參考上方數據。</p>
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
          <button
            className="secondary-button"
            onClick={() => onNavigate("reviews")}
          >
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
            <button
              className="primary-button"
              onClick={() => onNavigate("reviews")}
            >
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
        <span
          className={
            devices[0]?.reportedState.online ? "online-pill" : "offline-pill"
          }
        >
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
        <button
          className="icon-button"
          title="查看裝置"
          onClick={() => onNavigate("devices")}
        >
          <ChevronRight size={20} />
        </button>
      </section>
    </div>
  );
}

function PartnerCampaignReviews({
  campaigns,
  onChange,
}: {
  campaigns: PartnerCampaignSummary[];
  onChange: (campaign: PartnerCampaignSummary) => void;
}) {
  const submitted = campaigns.filter(
    (campaign) => campaign.status === "SUBMITTED",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    submitted[0]?.id ?? null,
  );
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected =
    campaigns.find((campaign) => campaign.id === selectedId) ?? submitted[0];

  async function review(decision: "approve" | "reject") {
    if (!selected || reviewNote.trim().length < 4) {
      setError("請先留下至少四個字的審查說明。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated =
        decision === "approve"
          ? await api.approvePartnerCampaign(selected.id, reviewNote)
          : await api.rejectPartnerCampaign(selected.id, reviewNote);
      onChange(updated);
      setReviewNote("");
      setSelectedId(
        submitted.find((campaign) => campaign.id !== selected.id)?.id ?? null,
      );
    } catch {
      setError("審查結果未儲存，請重新整理後再試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace partner-review-workspace" data-view-root>
      <div className="workspace-heading">
        <div>
          <h2>旅程提案審核</h2>
          <p>
            夥伴不能自行發布。請確認安全、無障礙、時間窗及「不消費也能完成」後再核准。
          </p>
        </div>
        <span className="queue-count warning">{submitted.length} 件待審</span>
      </div>
      {submitted.length === 0 ? (
        <div className="empty-state">
          <FileCheck2 size={28} />
          <strong>目前沒有等待審核的提案</strong>
          <span>已核准或退回的紀錄仍保留在資料庫與稽核軌跡中。</span>
        </div>
      ) : (
        <div className="partner-review-layout">
          <div className="partner-review-list" aria-label="待審提案">
            {submitted.map((campaign) => (
              <button
                key={campaign.id}
                className={
                  campaign.id === selected?.id
                    ? "partner-review-item active"
                    : "partner-review-item"
                }
                onClick={() => {
                  setSelectedId(campaign.id);
                  setReviewNote("");
                  setError(null);
                }}
              >
                <span>{campaign.organizationName}</span>
                <strong>{campaign.title}</strong>
                <small>{campaign.venueName}</small>
              </button>
            ))}
          </div>
          {selected ? (
            <article className="partner-review-detail">
              <span className="eyebrow">{selected.organizationName}</span>
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <dl className="partner-review-facts">
                <div>
                  <dt>旅程據點</dt>
                  <dd>{selected.venueName}</dd>
                </div>
                <div>
                  <dt>精確位置</dt>
                  <dd>
                    {selected.latitude.toFixed(6)},{" "}
                    {selected.longitude.toFixed(6)}
                  </dd>
                </div>
                <div>
                  <dt>時間</dt>
                  <dd>
                    {new Date(selected.startsAt).toLocaleString("zh-TW")} 至{" "}
                    {new Date(selected.endsAt).toLocaleString("zh-TW")}
                  </dd>
                </div>
                <div>
                  <dt>行動見證</dt>
                  <dd>
                    {selected.verificationMode === "TIMER"
                      ? `停留 ${selected.minimumSeconds} 秒`
                      : "現場自我確認"}
                  </dd>
                </div>
                <div>
                  <dt>場域半徑</dt>
                  <dd>{selected.radiusMeters} 公尺</dd>
                </div>
                <div>
                  <dt>年輪進度</dt>
                  <dd>完成後增加 {selected.growthPoints} 點</dd>
                </div>
                <div>
                  <dt>季節收藏</dt>
                  <dd>{selected.badgeName ?? "未設定"}</dd>
                </div>
                <div>
                  <dt>無障礙資訊</dt>
                  <dd>{selected.accessibilityNotes}</dd>
                </div>
                <div>
                  <dt>安全說明</dt>
                  <dd>{selected.safetyNotes}</dd>
                </div>
                <div>
                  <dt>自願優惠</dt>
                  <dd>{selected.optionalOffer ?? "未提供"}</dd>
                </div>
                <div>
                  <dt>消費條件</dt>
                  <dd>不需要消費即可完成</dd>
                </div>
              </dl>
              <label className="partner-review-note-input">
                審查說明
                <textarea
                  value={reviewNote}
                  maxLength={500}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="說明核准依據，或具體指出需要修正的地方"
                />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="partner-review-actions">
                <button
                  className="reject-button"
                  disabled={busy}
                  onClick={() => void review("reject")}
                >
                  退回修正
                </button>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void review("approve")}
                >
                  <ShieldCheck size={16} /> 核准並發布到 App
                </button>
              </div>
            </article>
          ) : null}
        </div>
      )}
    </section>
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
      <PhotoAiValidationRunbook fullyEnabled={fullyEnabled} />
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
                    {fullyEnabled
                      ? "家人覆核決策由 App 處理"
                      : "等待照片 AI 環境完成"}
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

const photoAiValidationCases = [
  {
    label: "植物 PASS",
    title: "拍花、葉片、草地或樹",
    expectation: "高信心時完成任務，生命樹只增加一次。",
  },
  {
    label: "補水 PASS",
    title: "拍水瓶、水杯或飲料杯",
    expectation: "主體清楚時通過；不需要拍人臉或身分。",
  },
  {
    label: "REVIEW",
    title: "拍得太暗、太遠或 AI 信心不足",
    expectation: "進入同家庭其他帳號覆核；提交者不能覆核自己。",
  },
  {
    label: "FAIL / 重拍",
    title: "拍到不符合任務的物品",
    expectation: "不加成長值，App 顯示可重新拍攝。",
  },
  {
    label: "冪等",
    title: "同一 evidence complete 重送",
    expectation: "不重複呼叫 verifier，不重複增加成長值。",
  },
];

function PhotoAiValidationRunbook({ fullyEnabled }: { fullyEnabled: boolean }) {
  return (
    <div className="photo-ai-runbook" aria-label="照片 AI 實機驗收劇本">
      <div className="photo-ai-runbook-heading">
        <div>
          <span>VALIDATION SCRIPT</span>
          <h3>照片 AI 實機驗收劇本</h3>
          <p>
            拿手機測時照這五步走：一般任務拍照、Storage 上傳、Gemini 判斷、
            家人覆核、最後確認生命樹沒有重複加分。
          </p>
        </div>
        <strong className={fullyEnabled ? "ready" : "blocked"}>
          {fullyEnabled ? "Ready to test" : "Check env first"}
        </strong>
      </div>
      <div className="photo-ai-runbook-grid">
        {photoAiValidationCases.map((item, index) => (
          <article key={item.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.label}</strong>
            <h4>{item.title}</h4>
            <p>{item.expectation}</p>
          </article>
        ))}
      </div>
      <div className="photo-ai-runbook-note">
        <ShieldCheck size={17} />
        <span>
          雷達任務仍維持 SELF_CHECK / TIMER；照片 AI
          只驗收一般任務，避免定位任務和照片證據模型混用。
        </span>
      </div>
    </div>
  );
}

function LineOps({
  bindings,
  status,
  busyId,
  lastResult,
  onTestPush,
}: {
  bindings: AdminLineBindingSummary[];
  status: LineOperationalStatus | null;
  busyId: string | null;
  lastResult: LineNotificationStatus | null;
  onTestPush: (bindingId: string) => Promise<void>;
}) {
  const activeBindings = bindings.filter(
    (binding) => binding.status === "ACTIVE",
  );
  const revokedBindings = bindings.filter(
    (binding) => binding.status === "REVOKED",
  );

  return (
    <section className="workspace line-ops" data-view-root>
      <div className="workspace-heading">
        <div>
          <h2>LINE 陪伴入口</h2>
          <p>
            LINE 是提醒、求助與覆核通知入口；地圖探索、照片驗證與生命樹成長仍以
            App 為準。
          </p>
        </div>
        <span className="queue-count">{activeBindings.length} 個啟用綁定</span>
      </div>

      <div className="line-ops-grid">
        <article className="line-command-panel">
          <span>LINE BOT MVP</span>
          <h3>讓提醒靠近，但不繞過 App 規則。</h3>
          <p>
            快速回覆可以說「我完成了」「晚點提醒我」「我需要幫忙」；
            但完成任務仍需要回 App，避免重複加分或跳過照片 AI。
          </p>
          <div className="line-command-metrics">
            <div>
              <strong>{activeBindings.length}</strong>
              <small>啟用綁定</small>
            </div>
            <div>
              <strong>
                {bindings.reduce(
                  (sum, item) => sum + item.notificationCount,
                  0,
                )}
              </strong>
              <small>通知紀錄</small>
            </div>
            <div>
              <strong>{revokedBindings.length}</strong>
              <small>已解除</small>
            </div>
          </div>
          <div className="line-command-metrics line-config-metrics">
            <div>
              <strong>
                {status?.channelSecretConfigured ? "configured" : "missing"}
              </strong>
              <small>Channel secret</small>
            </div>
            <div>
              <strong>
                {status?.channelAccessTokenConfigured
                  ? "configured"
                  : "missing"}
              </strong>
              <small>Access token</small>
            </div>
            <div>
              <strong>{status?.lastNotificationStatus ?? "none"}</strong>
              <small>最近推播</small>
            </div>
          </div>
          {lastResult ? (
            <p className={`line-result ${lastResult.status.toLowerCase()}`}>
              最近測試推播：{lastResult.status}
              {lastResult.error ? ` · ${lastResult.error}` : ""}
            </p>
          ) : null}
        </article>

        <div className="line-binding-list">
          {bindings.length ? (
            bindings.map((binding) => (
              <article className="line-binding-card" key={binding.id}>
                <div>
                  <span
                    className={
                      binding.status === "ACTIVE"
                        ? "online-pill"
                        : "offline-pill"
                    }
                  >
                    {binding.status === "ACTIVE" ? "啟用" : "已解除"}
                  </span>
                  <h3>{binding.userDisplayName}</h3>
                  <p>{binding.householdName}</p>
                </div>
                <dl>
                  <div>
                    <dt>通知紀錄</dt>
                    <dd>{binding.notificationCount}</dd>
                  </div>
                  <div>
                    <dt>最近狀態</dt>
                    <dd>{binding.lastNotificationStatus ?? "尚未推播"}</dd>
                  </div>
                  <div>
                    <dt>建立日期</dt>
                    <dd>{formatDate(binding.createdAt)}</dd>
                  </div>
                </dl>
                <button
                  className="primary-button"
                  disabled={
                    binding.status !== "ACTIVE" || busyId === binding.id
                  }
                  onClick={() => void onTestPush(binding.id)}
                >
                  {busyId === binding.id ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Bell size={16} />
                  )}
                  測試推播
                </button>
              </article>
            ))
          ) : (
            <EmptyState text="目前沒有 LINE 綁定。請先在 App 家人頁產生綁定碼。" />
          )}
        </div>
      </div>
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
          <span>
            第一版只允許建立 simulated=true 的批次，公開頁會持續顯示模擬標記。
          </span>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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
              <span
                className={
                  device.reportedState.online ? "pulse online" : "pulse"
                }
              />
            </div>
            <div className="device-name">
              <div>
                <span>{device.serialNumber}</span>
                <h3>{device.name}</h3>
              </div>
              <span
                className={
                  device.reportedState.online ? "online-pill" : "offline-pill"
                }
              >
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
        .fromTo(backdropRef.current, { autoAlpha: 0 }, { autoAlpha: 1 })
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
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            title="關閉"
          >
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
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Plus size={18} />
            )}
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
          element.textContent = Math.round(counter.value).toLocaleString(
            "zh-TW",
          );
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
