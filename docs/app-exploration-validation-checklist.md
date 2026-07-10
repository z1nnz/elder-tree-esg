# App 城市探索實機驗收清單

本清單用來把城市探索 MVP 從「本機測試通過」推進到「真的可以拿手機玩一次」。照片 AI 已進入 Blaze / Storage / Gemini 驗收階段；照片任務請另外依照 `docs/operations/photo-ai-validation.md` 驗收。

## 1. 啟動前準備

- API 使用 Neon 資料庫啟動，並確認手機能連到開發 Mac 的區網位址。
- App 的 API base URL 指向開發 Mac，而不是 `localhost`。
- Firebase Email/Password 登入可用。
- 測試帳號已完成登入，Neon 內有對應 User 與 active household。
- 後台登入的平台管理員帳號已授權 `PLATFORM_ADMIN`。
- 後台「任務雷達」頁按下一鍵建立實機測試任務，確認已建立並發布：
  - 中正紀念堂廣場補水確認：SELF_CHECK。
  - 二二八公園三分鐘慢呼吸：TIMER。

## 2. iPhone / Android 實機流程

1. 開啟 App 並登入。
2. 確認首頁能載入目前家庭、生命樹成長值、任務雷達摘要。
3. 進入城市探索頁。
4. 按下開始探索。
5. 第一次測試時允許前景定位權限。
6. 確認畫面顯示最新位置、任務距離、最近任務卡。
7. 移動到任務半徑內，或使用受控 demo/simulation 模式。
8. 確認任務只會先解鎖，不會直接增加生命樹成長值。
9. 完成 SELF_CHECK 任務，確認顯示「生命樹長出新葉 +N」。
10. 完成 TIMER 任務，確認時間未到時不可完成，倒數歸零後才可完成。
11. 重複送出同一任務完成請求，確認生命樹成長值只增加一次。
12. 關閉 App 後重啟，確認登入狀態、任務狀態、生命樹成長值仍存在。

## 3. macOS App 驗收

- macOS 不要求真實 GPS。
- 只驗證登入、探索頁 UI、任務雷達列表、照片 AI 狀態文案與受控 demo。
- 若啟用 simulation，必須確認 production 或未設定 `LOCATION_SIMULATION_ENABLED` 時完全拒絕模擬 API。

## 4. 後台驗收

- 平台管理員可以建立、發布、封存雷達任務。
- 任務列表能看出草稿、已發布、已過期、已封存。
- 一般帳號呼叫 `/admin/*` 必須得到 403。
- 雷達任務仍不可發布 `PHOTO_AI`；一般任務的照片 AI 依照片驗證手冊測試。

## 5. 驗收通過標準

- 開始探索後才使用定位。
- 進入任務半徑才 unlock。
- unlock 不加分，complete 才加分。
- 同一任務、同一使用者、同一家庭只加一次。
- 關閉 App、API 重啟、App 重啟後狀態仍以後端資料恢復。
- 城市探索流程不依賴 Blaze / Storage / Gemini；照片任務的 Storage / Gemini 請用獨立驗收清單確認。
