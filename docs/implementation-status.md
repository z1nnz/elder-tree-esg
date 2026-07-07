# 實作狀態

## 2026-07-06：城市探索 MVP（不升級 Blaze）

- Neon 還原點：`backup-before-city-exploration-mvp-20260706`。
- MapLibre 改用 OpenFreeMap，可透過 `MAP_STYLE_URL` 切換底圖。
- 已發布「都市綠肺初探」：5 個大安森林公園地標、400/1,000 公尺任務與徽章。
- 探索改為 4 小時 Session；App 只在探索頁前景定位，距離由伺服器計算。
- 精確座標只保留 Session 最新一點，結束後清除；歷史事件只存 H3 粗略格網。
- 定位事件會檢查 50 公尺精度、時間順序、5 分鐘時效與每小時 15 公里速度。
- 到點只解鎖任務；完成任務、樹成長與路線徽章均有唯一鍵防止重複。
- 後台使用 Firebase Email/Password，管理權以 Neon `PLATFORM_ADMIN` 判斷。
- 後台可視覺化新增／編輯地標、拖曳排序、發布、封存及複製新版草稿。
- 公開前台透過匿名 API 顯示真實首發路線，GSAP 動畫支援 reduced motion。
- `PHOTO_EVIDENCE_ENABLED=false`；照片任務顯示鎖定，API 不會呼叫 Storage 或 Gemini。
- Neon 整合測試共 8 案例，包含照片鎖定、路線發布、伺服器計距、異常跳點、
  解鎖、冪等成長與徽章。
- GitHub CI 會啟動臨時 PostGIS 執行遷移與完整 Neon 相同路徑的持久化測試。

## 2026-07-05：登入與持久化任務流程

- Firebase 專案 `elder-tree-esg-z1nnz` 已開啟 Email/Password。
- Flutter 已加入登入／註冊頁、Firebase session 保存與 ID Token API 驗證。
- 首次登入會在 Neon PostgreSQL 建立使用者、家庭、任務指派與陪伴樹。
- 任務完成會寫入 `GrowthEntry`，並以 `assignment:<id>` 作為唯一冪等鍵。
- API 重啟後任務狀態與家庭樹成長值仍會保留。
- Neon 整合測試會重建 Prisma instance，驗證重試不會再次加分。

## 已完成基線

- npm monorepo、共享契約與 CI。
- PostgreSQL/Prisma 核心資料模型與可重播遷移。
- NestJS REST API、Swagger、Firebase Token Guard、Neon 角色 guard 與本地 Demo Store。
- 任務冪等成長、照片送審、人工覆核、家庭訊息、裝置事件去重。
- 強制 `simulated=true` 的 ESG 公益批次。
- FastAPI 規則＋Gemini 結構化驗證、EXIF 清除與人工覆核閾值。
- AWS IoT Lambda bridge、Device Shadow 更新器與本地裝置模擬器。
- Next.js 營運後台、Firebase 登入與城市任務地圖編輯器。
- Flutter Android/iOS App、大字模式、任務、家庭、公益、裝置認領與 BLE 掃描。
- ESP32-S3 韌體、感測器、TFT、LED、三鍵、BLE 配網、MQTT 與離線佇列。

## 需要外部資源才能完成

- Google Cloud、AWS 帳號與正式憑證。
- 實體 ESP32-S3、螢幕、感測器、LED、按鍵及外殼製作。
- APNs/FCM 憑證、正式網域與 App Store／Play Store 簽章。
- Firebase Blaze 與 Storage；目前刻意延後，不阻塞城市探索 MVP。
- 150 張取得同意、完成標註的 golden set。
- 5 組長者／家庭志願者測試與研究同意流程。
- 24 小時真機壓力測試與 Android/iOS 實機 BLE 驗收。

## 已知依賴風險

`npm audit` 仍會列出 Nest/Next/Firebase Admin 上游鎖定的 Multer、
PostCSS 與 UUID 傳遞依賴。專案不使用 Multer 接收照片，照片改採 signed
upload；升級前需等待上游套件釋出相容版本，不使用破壞性
`npm audit fix --force`。
