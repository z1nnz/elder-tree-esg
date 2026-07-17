# 綠伴下一階段執行清單

更新日期：2026-07-17

## 目前完成

- App 已進入 Adventure Map V3 主線：登入後預設進入地圖、地圖頁隱藏傳統 bottom nav、附近任務欄與小樹主選單已成為主要操作入口。
- NestJS / Neon 已完成多家庭、任務冪等、雷達任務、探索狀態、Companion Response、LINE 綁定基礎與照片 AI Evidence 流程。
- Firebase Blaze / Storage 已可用，一般 PHOTO_AI 任務可進入拍照驗收；雷達任務 PHOTO_AI 仍暫不開放。
- 後台已有雷達任務管理、照片 AI 狀態、LINE 狀態與 Companion Response 檢視能力。
- 公開前台已有世界樹影片、台北 3D 行政區展示與多頁內容架構；前台大改版暫時排在 App 主體驗後。

## 現在主線

先把產品核心做穩：

地圖首頁 → 附近任務 → 進入半徑接取 → 完成 SELF_CHECK / TIMER → 生命樹成長 → 生活片段可被家人或陪伴者看見 → 再進照片 AI 驗收。

## PR 目標順序

### PR 1 — App Adventure Map V3 穩定化

完成條件：

- App 地圖 overlay 不堆疊、不 overflow。
- 附近任務欄、小樹主選單與任務 beacon 可以同時存在。
- `flutter analyze`、`flutter test` 與 GitHub CI 通過。

狀態：已完成並合併。

### PR 2 — 安全任務池與接取範圍

完成條件：

- 後台提供「台北驗收任務包」與「安全台灣任務池」。
- 任務只從安全白名單位置產生，不做任意經緯度亂數生成。
- 每個任務都有接取半徑、安全提醒、任務模式、成長值與陪伴回應模板。
- 接取規則固定：進入半徑才 unlock；完成任務才讓生命樹成長。
- 文件定義安全地點、接取半徑、照片辨識任務與未來全台任務生成方式。

目前正在執行。

### PR 3 — Blaze PHOTO_AI 實機驗收

完成條件：

- 一般 PHOTO_AI 任務可拍照、壓縮、上傳 Storage。
- AI verifier / Gemini 回傳 PASS、REVIEW、FAIL。
- PASS 讓生命樹成長；REVIEW 進入家人覆核；FAIL 可重拍。
- 同一 Evidence 重送不重複加分。
- 原圖在 PASS / FAIL / 覆核完成後刪除。

不做：

- 雷達 PHOTO_AI。
- 背景定位。
- 排行榜或競賽。

### PR 4 — Companion Response / LINE 收斂

完成條件：

- 任務完成後產生自然生活片段。
- 家人頁顯示最近生活片段。
- LINE 推播帶出自然回覆建議。
- 不做尷尬問句，不問照片或任務裡已經看得到的資訊。

### PR 5 — Web / Admin 收斂

完成條件：

- 前台文字對比統一，移除重複區塊與白底白字問題。
- 台北 3D 行政區裝飾元素不得吃滑鼠事件。
- 後台顯示 App 驗收、LINE、PHOTO_AI、待覆核與任務池狀態。

## 本階段不要做

- 不先上架網站。
- 不先做完整志工媒合。
- 不做排行榜。
- 不做背景定位。
- 不把 PHOTO_AI 接入雷達任務。
- 不重做世界樹影片。
- 不把 LINE Bot 做成 App 替代品。
- 不做大型 3D 角色。

## 相關文件

- 任務池、安全地點、半徑與照片辨識任務：`docs/product/mission-safety-photo-roadmap.md`
- App 實機驗收：`docs/operations/app-v2-validation.md`
- 照片 AI 驗收：`docs/operations/photo-ai-validation.md`
