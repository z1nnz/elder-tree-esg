# 綠伴下一階段執行清單

更新日期：2026-07-05

## 目前完成

- Next.js 營運後台已有營運總覽、人工覆核、公益批次與互動樹裝置頁。
- GSAP 已用於數字更新、任務趨勢、公益進度、工作區轉場與批次視窗。
- NestJS Demo API、共享契約、Prisma schema、IoT bridge、裝置模擬器與 Flutter 基線可建置。
- 端到端 Demo 已能證明任務成長不重複計分、家庭訊息送達裝置狀態、公益批次固定為模擬。

## 四週優先路線

### 第 1 週：把 Demo 資料換成可登入的真實雲端資料

- 建立 Firebase Demo 專案與 Web、Android、iOS App。
- 接上 Firebase Auth，後端驗證 ID Token。
- 建立 Neon PostgreSQL，將 DemoStoreRepository 替換為 Prisma repository。
- 完成使用者、家庭、裝置、任務與樹木的 seed 資料。
- 驗收：重新啟動 API 後資料不消失，不同角色只能看到自己組織或家庭的資料。

### 第 2 週：完成照片任務與 AI 人工覆核閉環

- 使用 Firebase Storage 上傳照片並移除 EXIF。
- API 建立 evidence、完成上傳並排入驗證工作。
- FastAPI 接入 Gemini 結構化輸出與規則版本。
- Web 覆核通過後寫入 GrowthEntry，更新家庭樹與後台數字。
- 驗收：手機上傳照片後，後台能通過或駁回；通過只增加一次成長值。

### 第 3 週：讓真實互動樹加入閉環

- 購買並接線 ESP32-S3、ST7796、WS2812B、三鍵與基本感測器。
- 先完成螢幕、LED、按鍵與 Wi-Fi，再加入 BLE 配網與感測器。
- 建立 AWS IoT Demo 環境、獨立裝置憑證與 Device Shadow。
- 驗收：任務通過後 15 秒內更新樹階段；家庭訊息 10 秒內顯示；斷網事件重連後不重複計分。

### 第 4 週：完成畢業專題展示故事

- Flutter 完成長者大字模式、家庭訊息、裝置認領與 BLE 配網。
- Web 增加公開成果證明頁，持續顯示 simulated=true。
- 準備一組固定 Demo：照片任務、人工覆核、家庭訊息、實體樹成長、公益批次。
- 找 2 組內部試用者先跑流程，再進行 5 組正式長者／家庭可用性測試。
- 驗收：評審能在 3 到 5 分鐘內看懂問題、完成任務、家庭陪伴、硬體回饋與 ESG 防漂綠。

## 動畫後續原則

- 下一個值得製作的動畫是「樹階段狀態視覺化」，由真實 growthPoints 與 treeStage 驅動。
- 任務通過時可短暫呈現成長值流入家庭樹，但必須同步真實帳本結果。
- 公益批次頁可用 Flip 呈現狀態從 DRAFT 到 PUBLISHED 的移動，不以動畫掩蓋 simulated 標記。
- 營運頁不使用大面積 ScrollTrigger、視差或粒子背景，避免降低掃描效率。
- 所有動畫必須支援 prefers-reduced-motion，並以 transform、opacity 為主。

## 現在最先做的一件事

建立 Firebase Demo 專案與 Neon 資料庫，完成第一個真實登入使用者及持久化家庭樹。這會把目前可展示的本地 Demo，提升成可以支撐 App、Web、AI 與硬體共同開發的正式基底。
