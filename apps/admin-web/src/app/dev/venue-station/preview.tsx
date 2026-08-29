"use client";

import type { PartnerCampaignSummary } from "@elder-tree/contracts";
import { useMemo, useState } from "react";
import {
  VenueStation,
  type VenueStationClient,
} from "../../../components/venue-station";
import { ApiRequestError } from "../../../lib/api";

const campaign: PartnerCampaignSummary = {
  id: "local-preview",
  organizationId: "local-preview",
  organizationName: "本機驗收資料",
  title: "沿著河畔，留下我們一起走過的足跡",
  description: "本機視覺驗收，不代表已成立的合作活動。",
  venueName: "河畔友善據點（測試）",
  latitude: 25.033,
  longitude: 121.5654,
  radiusMeters: 60,
  startsAt: "2026-08-28T00:00:00Z",
  endsAt: "2026-09-28T00:00:00Z",
  verificationMode: "TIMER",
  minimumSeconds: 180,
  growthPoints: 12,
  accessibilityNotes: "測試資訊",
  safetyNotes: "測試資訊",
  optionalOffer: "一杯飲水，不需要消費。",
  purchaseRequired: false,
  requiresVenueWitness: true,
  status: "APPROVED",
  submittedAt: null,
  reviewedAt: null,
  reviewNote: null,
  radarMissionId: "local-preview",
  metrics: {
    deliveredToAppCount: 0,
    arrivedCount: 0,
    completedCount: 0,
    completionRate: 0,
  },
  createdAt: "2026-08-28T00:00:00Z",
  updatedAt: "2026-08-28T00:00:00Z",
};

export function VenueStationPreview() {
  const [scenario, setScenario] = useState("success");
  const [width, setWidth] = useState(1440);
  const [textScale, setTextScale] = useState(100);
  const [open, setOpen] = useState(true);
  const client = useMemo<VenueStationClient>(
    () => ({
      venueMetrics: async () => {
        if (scenario === "offline") throw new Error("preview offline");
        return { witnessedCount: 3, redeemedCount: 1 };
      },
      venueCode: async () => {
        if (scenario === "offline") throw new Error("preview offline");
        const now = Date.now();
        return {
          code: `TCA1_${"a".repeat(43)}`,
          serverTime: new Date(now).toISOString(),
          expiresAt: new Date(
            now + (scenario === "expiry" ? 10_000 : 60_000),
          ).toISOString(),
        };
      },
      redeemVenueOffer: async () => {
        if (scenario === "offline") throw new Error("preview offline");
        if (scenario === "expiry")
          throw new ApiRequestError(
            409,
            "Redemption code has expired or is unavailable",
          );
        return {
          id: "local-preview",
          campaignId: campaign.id,
          offer: campaign.optionalOffer!,
          witnessedAt: new Date().toISOString(),
          redeemedAt: new Date().toISOString(),
          alreadyRedeemed: scenario === "repeated",
        };
      },
    }),
    [scenario],
  );
  return (
    <main style={{ padding: "24px 16px" }}>
      <style>{`html { font-size: ${textScale}%; }`}</style>
      <section
        aria-label="本機驗收控制"
        style={{ maxWidth: 1380, margin: "0 auto 24px", lineHeight: 1.8 }}
      >
        <h1 style={{ fontSize: "1.4rem" }}>現場工作台 · 本機介面驗收</h1>
        <p>
          所有名稱、碼與數字都是測試資料，不連線正式後端。此頁僅在明確啟用的本機開發模式開放。
        </p>
        <p>
          寬度選單只調整工作台容器；文字比例只調整根字級，不能取代真實手機、瀏覽器縮放或螢幕閱讀器驗收。
        </p>
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label>
            模擬回覆{" "}
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="success">本次成功</option>
              <option value="repeated">先前已領取</option>
              <option value="expiry">過期（到場碼十秒換新）</option>
              <option value="offline">離線</option>
            </select>
          </label>
          <label>
            版面寬度{" "}
            <select
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            >
              <option value={360}>360</option>
              <option value={768}>768</option>
              <option value={1440}>1440</option>
            </select>
          </label>
          <label>
            文字比例{" "}
            <select
              value={textScale}
              onChange={(e) => setTextScale(Number(e.target.value))}
            >
              <option value={100}>100%</option>
              <option value={200}>200%</option>
            </select>
          </label>
          {!open ? (
            <button className="secondary-button" onClick={() => setOpen(true)}>
              重新開啟工作台
            </button>
          ) : null}
        </div>
        <label style={{ display: "block", marginTop: 12 }}>
          測試用領取碼（可複製）
          <input
            style={{
              display: "block",
              width: "min(100%, 560px)",
              minHeight: 44,
              fontSize: 16,
            }}
            readOnly
            value={`TCR1_${"b".repeat(43)}`}
          />
        </label>
      </section>
      <div style={{ width: "100%", maxWidth: width, margin: "0 auto" }}>
        {open ? (
          <VenueStation
            key={scenario}
            organizationId={campaign.organizationId}
            campaign={campaign}
            client={client}
            onClose={() => setOpen(false)}
          />
        ) : (
          <p>工作台已收起。</p>
        )}
      </div>
    </main>
  );
}
