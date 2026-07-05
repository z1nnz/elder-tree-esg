# 實作狀態

## 2026-07-05：登入與持久化任務流程

- Firebase 專案 `elder-tree-esg-z1nnz` 已開啟 Email/Password。
- Flutter 已加入登入／註冊頁、Firebase session 保存與 ID Token API 驗證。
- 首次登入會在 Neon PostgreSQL 建立使用者、家庭、任務指派與陪伴樹。
- 任務完成會寫入 `GrowthEntry`，並以 `assignment:<id>` 作為唯一冪等鍵。
- API 重啟後任務狀態與家庭樹成長值仍會保留。
- Neon 整合測試會重建 Prisma instance，驗證重試不會再次加分。

## 已完成基線

- npm monorepo、共享契約與 CI。
- 18 個 PostgreSQL/Prisma 核心資料實體。
- NestJS REST API、Swagger、Firebase Token Guard 與本地 Demo Store。
- 任務冪等成長、照片送審、人工覆核、家庭訊息、裝置事件去重。
- 強制 `simulated=true` 的 ESG 公益批次。
- FastAPI 規則＋Gemini 結構化驗證、EXIF 清除與人工覆核閾值。
- AWS IoT Lambda bridge、Device Shadow 更新器與本地裝置模擬器。
- Next.js 多租戶營運後台的主要操作畫面。
- Flutter Android/iOS App、大字模式、任務、家庭、公益、裝置認領與 BLE 掃描。
- ESP32-S3 韌體、感測器、TFT、LED、三鍵、BLE 配網、MQTT 與離線佇列。

## 需要外部資源才能完成

- Google Cloud、AWS 帳號與正式憑證。
- 實體 ESP32-S3、螢幕、感測器、LED、按鍵及外殼製作。
- Firebase App 設定檔、APNs/FCM 憑證與簽章。
- 150 張取得同意、完成標註的 golden set。
- 5 組長者／家庭志願者測試與研究同意流程。
- 24 小時真機壓力測試與 Android/iOS 實機 BLE 驗收。

## 已知依賴風險

`npm audit` 仍會列出 Nest/Next/Firebase Admin 上游鎖定的 Multer、
PostCSS 與 UUID 傳遞依賴。專案不使用 Multer 接收照片，照片改採 signed
upload；升級前需等待上游套件釋出相容版本，不使用破壞性
`npm audit fix --force`。
