"use client";

import type {
  PartnerCampaignSummary,
  VenueCodeSummary,
  VenueMetricsSummary,
  VenueRedemptionResult,
} from "@elder-tree/contracts";
import {
  Camera,
  CheckCircle2,
  Gift,
  Leaf,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  isRedemptionCode,
  venueCodeLifetimeMs,
  venueErrorMessage,
} from "../lib/venue-witness";
import styles from "./venue-station.module.css";

export type VenueStationClient = Pick<
  typeof api,
  "venueCode" | "venueMetrics" | "redeemVenueOffer"
>;

export function VenueStation({
  organizationId,
  campaign,
  onClose,
  client = api,
}: {
  organizationId: string;
  campaign: PartnerCampaignSummary;
  onClose: () => void;
  client?: VenueStationClient;
}) {
  const [view, setView] = useState<"arrival" | "redemption" | null>("arrival");
  const [metrics, setMetrics] = useState<VenueMetricsSummary | null>(null);
  const [metricsError, setMetricsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const sequence = useRef(0);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const refreshMetrics = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setMetricsError(false);
    try {
      const result = await client.venueMetrics(organizationId, campaign.id);
      if (sequence.current === current) setMetrics(result);
    } catch {
      if (sequence.current === current) {
        setMetrics(null);
        setMetricsError(true);
      }
    } finally {
      if (sequence.current === current) setLoading(false);
    }
  }, [client, organizationId, campaign.id]);
  useEffect(() => {
    void refreshMetrics();
    const hide = () => {
      if (document.hidden) setView(null);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      sequence.current += 1;
      document.removeEventListener("visibilitychange", hide);
    };
  }, [refreshMetrics]);

  return (
    <section
      className={styles.station}
      aria-label={`${campaign.title}現場工作台`}
    >
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>現場工作台</span>
          <h2 ref={heading} tabIndex={-1}>
            {campaign.venueName}
          </h2>
          <p>{campaign.title}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>
          <X size={17} aria-hidden="true" /> 收起工作台
        </button>
      </header>
      <div className={styles.switcher} role="group" aria-label="現場操作">
        <button
          type="button"
          aria-pressed={view === "arrival"}
          onClick={() => setView("arrival")}
        >
          <QrCode size={19} aria-hidden="true" /> 展示到場碼
        </button>
        <button
          type="button"
          aria-pressed={view === "redemption"}
          disabled={!campaign.optionalOffer?.trim()}
          onClick={() => setView("redemption")}
        >
          <Gift size={19} aria-hidden="true" /> 核銷回饋
        </button>
      </div>
      <div className={styles.workspace}>
        <div className={styles.actionArea}>
          {view === "arrival" ? (
            <ArrivalPanel
              organizationId={organizationId}
              campaignId={campaign.id}
              client={client}
            />
          ) : null}
          {view === "redemption" ? (
            <RedemptionPanel
              organizationId={organizationId}
              campaign={campaign}
              onRedeemed={refreshMetrics}
              client={client}
            />
          ) : null}
          {view === null ? (
            <div className={styles.empty} role="status">
              <ShieldCheck size={32} aria-hidden="true" />
              <h3>畫面已安全收起</h3>
              <p>
                離開分頁時會關閉鏡頭並收起碼。請選擇上方操作，繼續現場服務。
              </p>
            </div>
          ) : null}
        </div>
        <aside className={styles.guide}>
          <Leaf size={25} aria-hidden="true" />
          <h3>留下一次真實相聚</h3>
          <p>
            成員先完成旅程條件，再用手機掃描到場碼。系統會一併確認位置與有效時間。
          </p>
          <div className={styles.rule}>
            <ShieldCheck size={19} aria-hidden="true" />
            <p>掃碼是到場見證，不代表購買、共同在場或已完成植樹。</p>
          </div>
          <div className={styles.offer}>
            <span>自願回饋</span>
            <p>
              {campaign.optionalOffer?.trim() ||
                "這段旅程沒有額外回饋，完成後仍可累積年輪進度。"}
            </p>
          </div>
          <dl className={styles.metrics} aria-busy={loading}>
            <div>
              <dt>完成到場見證</dt>
              <dd>
                {metrics?.witnessedCount ?? "—"}
                <small>人</small>
              </dd>
            </div>
            <div>
              <dt>已登記領取</dt>
              <dd>
                {metrics?.redeemedCount ?? "—"}
                <small>人</small>
              </dd>
            </div>
          </dl>
          {metricsError ? (
            <p role="status">成效暫時讀取不到，請重試。</p>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={() => void refreshMetrics()}
          >
            <RefreshCw size={15} aria-hidden="true" />{" "}
            {loading ? "更新中…" : "更新成效"}
          </button>
          <small>僅彙總本旅程，不顯示姓名或移動軌跡。</small>
        </aside>
      </div>
    </section>
  );
}

function ArrivalPanel({
  organizationId,
  campaignId,
  client,
}: {
  organizationId: string;
  campaignId: string;
  client: VenueStationClient;
}) {
  const [value, setValue] = useState<VenueCodeSummary | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [renew, setRenew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const inFlight = useRef(false);
  const issue = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = ++sequence.current;
    const started = performance.now();
    setBusy(true);
    setValue(null);
    setError(null);
    try {
      const result = await client.venueCode(organizationId, campaignId);
      if (sequence.current !== current) return;
      const expires = started + venueCodeLifetimeMs(result);
      if (expires <= performance.now()) throw new Error("Code unavailable");
      setValue(result);
      setDeadline(expires);
      setNow(performance.now());
      setRenew(true);
    } catch (cause) {
      if (sequence.current === current) {
        setError(venueErrorMessage(cause));
        setRenew(false);
      }
    } finally {
      if (sequence.current === current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }, [client, organizationId, campaignId]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 250);
    return () => {
      window.clearInterval(timer);
      sequence.current += 1;
    };
  }, []);
  useEffect(() => {
    if (value && now >= deadline) {
      setValue(null);
      if (renew && !document.hidden) void issue();
    }
  }, [value, now, deadline, renew, issue]);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const showing = value && seconds > 0;
  return (
    <div className={styles.arrival}>
      <span className={styles.eyebrow}>到場見證</span>
      <h3>邀請成員，留下今天的足跡</h3>
      <p>請使用「同行成林」掃描下方到場碼。</p>
      <div className={styles.codeFrame} aria-busy={busy}>
        {showing ? (
          <QrSymbol code={value.code} />
        ) : (
          <div className={styles.codePlaceholder}>
            <QrCode size={48} strokeWidth={1.3} aria-hidden="true" />
            <span>{busy ? "正在取得新的到場碼…" : "開啟後才顯示到場碼"}</span>
          </div>
        )}
      </div>
      {showing ? (
        <>
          <p className={styles.countdown}>
            此碼還有 <strong>{seconds}</strong> 秒有效
          </p>
          <p className={styles.caption}>保持此頁開啟，到期後會自動換碼。</p>
        </>
      ) : (
        <p className={styles.caption}>
          碼會在本機繪製，不傳送到第三方產碼網站。
        </p>
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.controls}>
        {showing ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              sequence.current += 1;
              setValue(null);
              setRenew(false);
            }}
          >
            <X size={17} aria-hidden="true" /> 收起到場碼
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => void issue()}
          >
            <QrCode size={18} aria-hidden="true" />{" "}
            {busy ? "正在開啟…" : error ? "重新取得到場碼" : "開啟到場碼"}
          </button>
        )}
      </div>
    </div>
  );
}

function QrSymbol({ code }: { code: string }) {
  const symbol = useMemo(() => {
    const { modules } = QRCode.create(code, { errorCorrectionLevel: "M" });
    const paths: string[] = [];
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) paths.push(`M${col + 4} ${row + 4}h1v1h-1z`);
      }
    }
    return { size: modules.size + 8, path: paths.join("") };
  }, [code]);
  return (
    <svg
      role="img"
      aria-label="本旅程短效到場碼"
      viewBox={`0 0 ${symbol.size} ${symbol.size}`}
      shapeRendering="crispEdges"
      className={styles.qr}
    >
      <rect width={symbol.size} height={symbol.size} fill="#fff" />
      <path d={symbol.path} fill="#17201c" />
    </svg>
  );
}

function RedemptionPanel({
  organizationId,
  campaign,
  onRedeemed,
  client,
}: {
  organizationId: string;
  campaign: PartnerCampaignSummary;
  onRedeemed: () => Promise<void>;
  client: VenueStationClient;
}) {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VenueRedemptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const read = useCallback((value: string) => {
    setScanning(false);
    setResult(null);
    if (!isRedemptionCode(value)) {
      setCode("");
      setError("這不是領取碼。請成員開啟已完成旅程中的回饋領取畫面。");
      return;
    }
    setCode(value);
    setError(null);
  }, []);
  const cameraError = useCallback(() => {
    setScanning(false);
    setError(
      "無法開啟鏡頭。請允許相機權限，並使用安全連線；也可使用下方掃描器輸入欄。",
    );
  }, []);
  async function redeem() {
    if (!isRedemptionCode(code) || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setScanning(false);
    try {
      const redeemed = await client.redeemVenueOffer(
        organizationId,
        campaign.id,
        code,
      );
      if (!mounted.current) return;
      setResult(redeemed);
      setCode("");
      void onRedeemed();
    } catch (cause) {
      if (mounted.current) setError(venueErrorMessage(cause));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className={styles.redemption}>
      <span className={styles.eyebrow}>自願回饋</span>
      <h3>掃描成員的領取碼</h3>
      <p>先讀取，再確認核銷。請依伺服器回覆交付回饋。</p>
      {result ? (
        <div
          className={result.alreadyRedeemed ? styles.warning : styles.success}
          role="status"
        >
          <CheckCircle2 size={30} aria-hidden="true" />
          <h4>{result.alreadyRedeemed ? "先前已領取" : "本次已登記領取"}</h4>
          <p>
            {result.alreadyRedeemed
              ? "請勿再次交付。若上次連線中斷，請先核對現場交付情況。"
              : "已成功登記，請向這位成員交付本次回饋。"}
          </p>
          {result.redeemedAt ? (
            <time dateTime={result.redeemedAt}>
              {new Intl.DateTimeFormat("zh-TW", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Taipei",
              }).format(new Date(result.redeemedAt))}
            </time>
          ) : null}
        </div>
      ) : null}
      {scanning ? (
        <>
          <VenueScanner onRead={read} onError={cameraError} />
          <button
            type="button"
            className="secondary-button"
            onClick={() => setScanning(false)}
          >
            關閉鏡頭
          </button>
        </>
      ) : (
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setCode("");
            setResult(null);
            setError(null);
            setScanning(true);
          }}
        >
          <Camera size={18} aria-hidden="true" />{" "}
          {result ? "掃描下一位成員" : "開啟鏡頭掃描"}
        </button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label
          className={styles.inputLabel}
          htmlFor={`redemption-code-${campaign.id}`}
        >
          領取碼／掃描器輸入
        </label>
        <input
          id={`redemption-code-${campaign.id}`}
          name="redemptionCode"
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={48}
          value={code}
          disabled={busy || scanning}
          onChange={(event) => {
            setCode(event.target.value.trim());
            setResult(null);
            setError(null);
          }}
          aria-describedby={`redemption-help-${campaign.id}`}
        />
        <p className={styles.caption} id={`redemption-help-${campaign.id}`}>
          沒有鏡頭時，可接鍵盤式掃描器或貼上成員提供的領取碼。內容僅暫存於本次操作，不寫入網址或本機儲存。
        </p>
        {isRedemptionCode(code) ? (
          <p className={styles.ready} role="status">
            <ShieldCheck size={17} aria-hidden="true" />{" "}
            已讀取領取碼，等待你確認
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="primary-button"
          type="button"
          onClick={() => void redeem()}
          disabled={busy || scanning || !isRedemptionCode(code)}
        >
          <Gift size={18} aria-hidden="true" />{" "}
          {busy ? "正在確認核銷…" : "確認核銷"}
        </button>
      </form>
      <p className={styles.caption}>
        是否領取回饋，不影響成員已完成的旅程與年輪進度。
      </p>
    </div>
  );
}

function VenueScanner({
  onRead,
  onError,
}: {
  onRead: (code: string) => void;
  onError: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    let stream: MediaStream | undefined;
    const element = video.current!;
    async function start() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (disposed) return;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const controls = await new BrowserQRCodeReader().decodeFromStream(
          stream,
          element,
          (result, _error, controls) => {
            if (disposed) {
              controls.stop();
              return;
            }
            if (result) {
              controls.stop();
              onRead(result.getText());
            }
          },
        );
        stop = () => controls.stop();
        if (disposed) stop();
      } catch {
        if (!disposed) onError();
      }
    }
    void start();
    return () => {
      disposed = true;
      stop?.();
      stream?.getTracks().forEach((track) => track.stop());
      element.srcObject = null;
    };
  }, [onRead, onError]);
  return (
    <div className={styles.scanner}>
      <video ref={video} muted playsInline aria-label="領取碼相機預覽" />
      <p>將領取碼放進畫面，讀取後會自動關閉鏡頭。</p>
    </div>
  );
}
