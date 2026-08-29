import type { VenueCodeSummary } from "@elder-tree/contracts";
import { ApiRequestError } from "./api";

export const isRedemptionCode = (code: string) =>
  /^TCR1_[A-Za-z0-9_-]{43}$/.test(code);

// Use server-relative lifetime and a monotonic client clock, never the client's wall clock.
// Starting at request dispatch conservatively deducts the complete round-trip time.
export function venueCodeLifetimeMs(value: VenueCodeSummary): number {
  const lifetime = Date.parse(value.expiresAt) - Date.parse(value.serverTime);
  if (
    !/^TCA1_[A-Za-z0-9_-]{43}$/.test(value.code) ||
    !Number.isFinite(lifetime)
  )
    return 0;
  return Math.max(0, Math.min(60_000, lifetime));
}

export function venueErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403)
      return "工作區權限已失效，請重新登入或聯絡組織管理員。";
    if (error.message.includes("Please wait"))
      return "更新得太快，請稍候十秒再試。";
    if (error.message.includes("not currently available"))
      return "旅程尚未開始、已結束或已停止發布，請確認旅程狀態。";
    if (error.message.includes("expired"))
      return "領取碼已過期，請成員重新產生後再掃描。";
    if (error.message.includes("replaced"))
      return "這張領取碼已被替換，請掃描成員手機上最新的碼。";
    if (error.status === 400 || error.status === 404)
      return "這不是本旅程可用的領取碼，請確認旅程與成員手機上的碼。";
  }
  return "暫時無法確認伺服器結果。請檢查連線後重試；核銷前不要先交付回饋。";
}
