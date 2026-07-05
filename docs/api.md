# API 契約

Base URL：`/api/v1`。除 `/health` 外皆需 Firebase Bearer Token；本地
`DEMO_MODE=true` 時可使用 `x-demo-user` 與 `x-demo-role`。

| Method | Path | 行為 |
|---|---|---|
| GET | `/health` | 健康檢查與目前模式 |
| GET | `/tasks` | 取得每日任務 |
| POST | `/tasks/:id/start` | 開始任務 |
| POST | `/tasks/:id/complete` | 完成非照片任務，支援冪等鍵 |
| POST | `/evidence` | 建立照片證據與上傳位置 |
| POST | `/evidence/:id/complete` | 完成上傳並排入驗證 |
| GET | `/tree` | 取得家庭樹階段與成長值 |
| GET/POST | `/family/messages` | 讀取／傳送家庭訊息 |
| GET | `/devices` | 取得已認領裝置 |
| POST | `/devices/claim` | 以序號與認領碼綁定裝置 |
| GET | `/devices/:id/state` | 取得 desired/reported state |
| POST | `/devices/:id/commands` | 更新訊息、亮度等 desired state |
| POST | `/devices/:id/events` | IoT bridge 寫入可去重裝置事件 |
| GET | `/admin/dashboard` | 營運摘要 |
| GET | `/admin/reviews` | 待人工覆核項目 |
| POST | `/admin/reviews/:id/decision` | 人工通過／駁回並寫稽核 |
| GET | `/impact-batches` | 公益批次 |
| POST | `/impact-batches` | 建立強制模擬批次 |
| POST | `/impact-batches/:id/publish` | 公開模擬成果 |

Swagger UI 位於 `/api/docs`。共享 enum、Device Shadow schema 與回應型別
位於 `packages/contracts`，App、Web、API 與 IoT bridge 不得重複定義。
