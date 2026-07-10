"use client";

import type { PhotoAiOperationalStatus } from "@elder-tree/contracts";
import { BadgeCheck, CircleAlert, ShieldCheck } from "lucide-react";

export function PhotoAiStatusPanel({
  status,
  reviewCount,
}: {
  status: PhotoAiOperationalStatus | null;
  reviewCount: number;
}) {
  const items = status
    ? [
        {
          label: "Photo Evidence",
          enabled: status.photoEvidence.enabled,
          detail: status.photoEvidence.enabled
            ? `Storage bucket：${status.storageBucketName ?? "已設定"}`
            : status.photoEvidence.reason === "STORAGE_NOT_CONFIGURED"
              ? "尚未設定 FIREBASE_STORAGE_BUCKET"
              : "尚未啟用 PHOTO_EVIDENCE_ENABLED",
        },
        {
          label: "Gemini Verifier",
          enabled: status.geminiPhotoVerification.enabled,
          detail: status.geminiPhotoVerification.enabled
            ? `Verifier：${status.aiVerifierUrl}`
            : "尚未啟用 PHOTO_VERIFICATION_ENABLED 或 verifier",
        },
        {
          label: "Storage Rules",
          enabled: status.storageRulesManagedSeparately,
          detail: "已由 Firebase CLI 管理；修改 storage.rules 後需重新 deploy",
        },
        {
          label: "Radar PHOTO_AI",
          enabled: status.radarPhotoAiTasksEnabled,
          detail: "雷達任務暫不接照片證據，避免定位任務模型混用",
        },
      ]
    : [
        {
          label: "Photo Evidence",
          enabled: false,
          detail: "正在讀取 API 狀態",
        },
        {
          label: "Gemini Verifier",
          enabled: false,
          detail: "正在讀取 verifier 設定",
        },
        {
          label: "Storage Rules",
          enabled: false,
          detail: "正在確認操作提示",
        },
        {
          label: "Radar PHOTO_AI",
          enabled: false,
          detail: "雷達任務暫不接照片證據",
        },
      ];

  return (
    <div className="photo-ai-status-panel">
      <div className="photo-ai-status-hero">
        <div className="photo-ai-icon">
          <ShieldCheck size={24} />
        </div>
        <div>
          <span>PHOTO AI OPERATIONS</span>
          <strong>{reviewCount} 件待覆核照片</strong>
          <small>只顯示環境狀態，不顯示 Gemini key 或 Firebase 私鑰。</small>
        </div>
      </div>
      <div className="photo-ai-status-grid">
        {items.map((item) => (
          <div className="photo-ai-status-card" key={item.label}>
            {item.enabled ? (
              <BadgeCheck size={18} className="status-ok" />
            ) : (
              <CircleAlert size={18} className="status-warn" />
            )}
            <strong>{item.label}</strong>
            <span>{item.enabled ? "Ready" : "Locked"}</span>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
