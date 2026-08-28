# 桌上生命樹：樹伴圈狀態與裝置回報

日期：2026-08-28。狀態：軟體開發中，尚未完成韌體接線、原生畫面或雲端部署驗收。

## 這一段要交付什麼

桌上生命樹不是另一個可以自行加分的任務終端。它顯示伺服器持久化的樹伴圈、生命樹、目前接力篇章與共同收藏；三個大按鍵用於查看旅程、查看留言及確認讀過。照片、位置、合作據點見證仍由對應正式流程處理。

本輪完成的軟體部分：

- 第二版完整狀態與事件契約；不再將部分更新當成完整畫面資料。
- 裝置所屬樹伴圈的存取權限、設定更新版本檢查、持久化狀態及伺服器回報。
- 同一裝置事件去重、重用編號但改內容拒絕、精確版本與確認碼核對。
- 接力已完成數、目前篇章、認領中／待接棒／認領逾時，以及完成收藏；讀取裝置不建立旅程或代替成員認領。
- 認領設備採條件式更新，避免同一設備被兩個樹伴圈同時搶走。
- 新閘道依 IoT 連線及主題中繼資料辨認設備，服務成功保存事件後才回傳 MQTT 確認。

仍未完成：實體韌體第二版解析與畫面、斷電／斷網事件保存、中文螢幕實際顯示、雲端部署與憑證配置、電氣與長時間運轉驗收。這些不能由服務端測試或模擬器推定通過。

## 狀態與事件鏈路

```text
手機完成正式共行旅程
    → 資料庫保存旅程進度與生命樹
    → 裝置定期請求完整狀態
    → 閘道核對憑證連線名稱與主題名稱
    → 服務保存事件、產生或讀取同一版本快照
    → 閘道回覆事件編號與完整快照
    → 裝置套用、保存並顯示後，回報精確版本與確認碼
```

每個完整快照包含 `protocolVersion=2`、設備編號、樹伴圈、生命樹、旅程摘要、亮度、可清除留言、版本、確認碼及生成時間。同內容再次讀取沿用同版本；內容、設定或認領時效真正改變才遞增版本。讀取使用可序列化交易，避免把不同時間的旅程與成長拼成一張畫面。

伺服器回覆建議每 30 秒同步，90 秒未確認即視為離線／過期。裝置端尚須實作依本機單調時間處理這項規則，不能只看 MQTT 是否連線。服務端已依實際收到事件的時間計算在線，不採用裝置自稱的 `online=true`。

`accepted=true` 只代表事件已保存；`applied=true` 只在裝置回報的版本與確認碼**兩者都等於目前快照**時成立。舊回報仍可獲得收件確認，但不能讓新版顯示「已同步」。重送原事件不重複保存，編號相同但內容不同則拒絕；按鍵事件不寫入成長帳本。

## 介面與權限

| 介面 | 誰可以呼叫 | 規則 |
| --- | --- | --- |
| `GET /api/v1/devices/:id/state` | 已登入且仍在目前樹伴圈的成員 | 只能取得該圈已認領裝置，回覆不得快取。 |
| `POST /api/v1/devices/:id/commands` | 同上 | 必填 `expectedRevision`，只可修改亮度或留言；舊版本要求先更新。 |
| `POST /api/v1/device-sync/:thingName/events` | 可信閘道 | 不以 Firebase 成員身分登入，但必須通過獨立閘道守衛與共用密鑰。 |
| 舊 `POST /api/v1/devices/:id/events` | 僅保留本機示範模式 | 正式／持久化模式停止使用，不能繞過第二版裝置規則。 |

閘道密鑰至少 32 字元，只配置於後端與閘道，**不寫入微控制器、App、網址或版本庫**。裝置以各自的 X.509 憑證連線；伺服器仍以已認領的裝置資料對應樹伴圈。成員憑證不能代替閘道密鑰，閘道密鑰也不能登入成員介面。

共享硬體預設不顯示成員姓名或自動轉送私人訊息，只呈現篇章與認領狀態。成員明確設定的留言可清除；設備重新配置至其他樹伴圈時，前圈留言不沿用。

## 雲端設定模板與尚未部署的界線

- [`infra/aws-iot-sync-policy.json`](../../infra/aws-iot-sync-policy.json)：裝置只能發布自己的同步請求、接收自己的回覆，不得發送回覆或接收其他設備的資料。
- [`infra/aws-iot-sync-rule.json`](../../infra/aws-iot-sync-rule.json)：只選取 `clientid()`、`topic(2)` 及 `event`，不從負載讀取權威裝置身分。模板預設停用，`REGION`／`ACCOUNT_ID`／函式名稱仍須正式配置。
- Lambda 入口為 `services/iot-bridge` 的 `index.syncHandler`；環境為 `API_URL`、`IOT_BRIDGE_SECRET`、`AWS_IOT_ENDPOINT`、`AWS_REGION`。正式 API 必須使用 HTTPS；拒絕重新導向，避免密鑰被轉送。
- Lambda 只允許指定帳號／指定 IoT Rule 呼叫；使用唯一憑證綁定設備，移除較寬的舊政策。裝置連線名稱必須等於已綁定的 Thing 名稱。這些目前是部署要求，不是已驗證的雲端結果。
- 不在確認碼遺失時改成「傳送成功就刪事件」。閘道回覆失敗會讓相同事件重試，後端以裝置與事件編號去重。

身分與政策設計依據 [AWS Thing 政策變數](https://docs.aws.amazon.com/iot/latest/developerguide/thing-policy-variables.html)及 [IoT SQL 函式](https://docs.aws.amazon.com/iot/latest/developerguide/iot-sql-functions.html)。正式部署仍須測試跨設備發布／訂閱拒絕、未綁定憑證、函式呼叫來源及撤銷憑證，不僅檢查 JSON 格式。

## 重現與驗收

先建立專用本機測試資料庫並套用遷移，再執行：

```sh
npm run prisma:generate --workspace @elder-tree/api
npm run build:contracts
npm run build --workspace @elder-tree/api
npm run test --workspace @elder-tree/contracts
npm run test --workspace @elder-tree/iot-bridge
DATABASE_URL=postgresql://venue_test@127.0.0.1:55441/device_sync_20260828 \
  RUN_PERSISTENCE_TESTS=true \
  npm exec --workspace @elder-tree/api -- vitest run src/devices/device-sync.integration.test.ts
```

HTTP 測試使用真正編譯後的 Nest 模組、驗證管線及閘道守衛，啟動本機隨機連接埠；沒有將閘道守衛換成直接通過。測試使用獨立、明確標示的身分／設備／過去季節資料，結束只刪除該次建立的資料。沒有連接真實裝置或雲端 MQTT。

本機 PostgreSQL 缺少 PostGIS，這一輪專用資料庫以 schema 建立驗證裝置邏輯；完整遷移與城市探索仍交由含 PostGIS 的持續整合確認。不能把本機裝置專項的通過寫成全系統或實體設備驗收。

本輪已執行：全倉型別檢查通過；一般 Node 測試 30 項通過、36 項需資料庫的測試明確略過；其中新增的裝置資料庫／HTTP 10 項另行執行通過。新增測試合計 17 項，另包括 2 項契約及 5 項閘道測試。遠端完整遷移及各平台結果以本分支最新持續整合為準。
