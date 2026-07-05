"use client";

import { useGSAP } from "@gsap/react";
import type {
  DashboardSnapshot,
  ImpactBatchSummary,
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

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

type View = "overview" | "reviews" | "impact" | "devices";

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
  participantCount: 48,
  completedTaskCount: 326,
  pendingReviewCount: 1,
  connectedDeviceCount: 1,
  impactPoolPoints: 24750,
  simulatedTreeCount: 24,
};

const fallbackReviews: ReviewItem[] = [
  {
    id: "offline-review",
    taskTitle: "記錄今天看到的植物",
    participantName: "王奶奶",
    imageUrl:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80",
    confidence: 0.72,
    labels: ["plant", "flower", "outdoor"],
    explanation: "可辨識植物與戶外環境，但主體部分被遮擋，需要人工確認。",
    createdAt: new Date().toISOString(),
  },
];

const fallbackBatches: ImpactBatchSummary[] = [
  {
    id: "offline-batch",
    title: "七月社區綠化示範批次",
    status: "SIMULATED",
    simulated: true,
    allocatedPoints: 12800,
    equivalentTrees: 12.8,
    publishedAt: null,
  },
];

const fallbackDevices: DeviceView[] = [
  {
    id: "offline-device",
    serialNumber: "TREE-DEMO-001",
    name: "客廳陪伴樹",
    claimed: true,
    desiredState: {
      treeStage: "SPROUT",
      ledScene: "TASK_DUE",
      growthPoints: 180,
    },
    reportedState: {
      online: true,
      firmwareVersion: "0.1.0",
      temperatureC: 25.6,
      humidityPercent: 61,
      ambientLux: 168,
      presence: true,
      updatedAt: new Date().toISOString(),
    },
  },
];

const navItems = [
  { id: "overview" as const, label: "營運總覽", icon: Gauge },
  { id: "reviews" as const, label: "任務覆核", icon: ClipboardCheck },
  { id: "impact" as const, label: "公益批次", icon: Trees },
  { id: "devices" as const, label: "互動樹裝置", icon: Cpu },
];

export function OperationsDashboard() {
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [reviews, setReviews] = useState(fallbackReviews);
  const [batches, setBatches] = useState(fallbackBatches);
  const [devices, setDevices] = useState(fallbackDevices);
  const [loading, setLoading] = useState(true);
  const [offlineDemo, setOfflineDemo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchDialog, setBatchDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSnapshot, nextReviews, nextBatches, nextDevices] =
        await Promise.all([
          api.dashboard(),
          api.reviews(),
          api.impactBatches(),
          api.devices(),
        ]);
      setSnapshot(nextSnapshot);
      setReviews(nextReviews);
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

  async function decide(id: string, decision: "PASS" | "FAIL") {
    setBusyId(id);
    try {
      if (!offlineDemo) await api.decideReview(id, decision);
      setReviews((items) => items.filter((item) => item.id !== id));
      setSnapshot((value) => ({
        ...value,
        pendingReviewCount: Math.max(0, value.pendingReviewCount - 1),
        completedTaskCount:
          decision === "PASS"
            ? value.completedTaskCount + 1
            : value.completedTaskCount,
      }));
    } finally {
      setBusyId(null);
    }
  }

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
              {offlineDemo ? "離線示範資料" : "API 已連線"}
            </div>
            <button className="text-button" onClick={() => void load()}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              重新整理
            </button>
          </div>

          {view === "overview" ? (
            <Overview
              snapshot={snapshot}
              reviews={reviews}
              devices={devices}
              onNavigate={setView}
            />
          ) : null}
          {view === "reviews" ? (
            <Reviews reviews={reviews} busyId={busyId} onDecide={decide} />
          ) : null}
          {view === "impact" ? (
            <Impact
              batches={batches}
              onCreate={() => setBatchDialog(true)}
              onPublish={async (id) => {
                setBusyId(id);
                try {
                  const updated = offlineDemo
                    ? {
                        ...batches.find((batch) => batch.id === id)!,
                        status: "PUBLISHED" as const,
                        publishedAt: new Date().toISOString(),
                      }
                    : await api.publishBatch(id);
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
            const batch = offlineDemo
              ? {
                  id: crypto.randomUUID(),
                  title,
                  status: "DRAFT" as const,
                  simulated: true as const,
                  allocatedPoints: points,
                  equivalentTrees: Math.round((points / 1000) * 10) / 10,
                  publishedAt: null,
                }
              : await api.createBatch(title, points);
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
  reviews,
  devices,
  onNavigate,
}: {
  snapshot: DashboardSnapshot;
  reviews: ReviewItem[];
  devices: DeviceView[];
  onNavigate: (view: View) => void;
}) {
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
      label: "在線裝置",
      value: snapshot.connectedDeviceCount,
      hint: "互動樹",
      icon: Cpu,
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

  return (
    <div className="overview-motion-root" data-view-root ref={overviewRef}>
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
  busyId,
  onDecide,
}: {
  reviews: ReviewItem[];
  busyId: string | null;
  onDecide: (id: string, decision: "PASS" | "FAIL") => Promise<void>;
}) {
  return (
    <section className="workspace" data-view-root>
      <div className="workspace-heading">
        <div>
          <h2>AI 人工覆核佇列</h2>
          <p>低信心與模糊照片必須由人員確認，所有改判都會寫入稽核紀錄。</p>
        </div>
        <span className="queue-count">{reviews.length} 件待處理</span>
      </div>
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
                  <button
                    className="reject-button"
                    disabled={busyId === item.id}
                    onClick={() => void onDecide(item.id, "FAIL")}
                  >
                    <X size={18} /> 不通過
                  </button>
                  <button
                    className="approve-button"
                    disabled={busyId === item.id}
                    onClick={() => void onDecide(item.id, "PASS")}
                  >
                    {busyId === item.id ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : (
                      <Check size={18} />
                    )}
                    通過並成長
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
