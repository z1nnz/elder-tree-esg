# 管理員登入與授權操作手冊

這份手冊用來處理「Firebase 已登入，但後台仍無法進入」的情況。綠伴後台採兩層判斷：Firebase 負責確認身分，Neon 的 `User.role` 負責判斷是否為平台管理員。

## 操作流程

1. 先用 App 登入一次同一組 Email/Password，讓 API 在 Neon 建立對應的 `User`。
2. 到 Firebase Console 的 Authentication Users 頁面，複製該帳號的 Firebase UID。
3. 在專案根目錄設定 Neon 連線：

   ```bash
   cd /Users/whzi_111/elder-tree-esg

   export DATABASE_URL="$(
     npx --yes neonctl@2.30.1 connection-string \
       --database-name elder_tree \
       --role-name elder_tree_owner \
       --pooled \
       --ssl require
   )"
   ```

4. 授予平台管理員：

   ```bash
   npm run admin:grant -- 你的_FIREBASE_UID
   ```

5. 啟動 API 與後台：

   ```bash
   LOCATION_SIMULATION_ENABLED=true npm run dev:api:neon
   npm run dev:web
   ```

6. 打開 `http://localhost:3000`，用同一個 Firebase 帳號登入。

## 常見錯誤

| 現象 | 優先檢查 |
| --- | --- |
| 401 | Firebase Token、前端 Firebase 設定、登入狀態 |
| 403 | Neon `User.role` 是否為 `PLATFORM_ADMIN` |
| Failed to fetch | API 是否在 `http://localhost:4100` 執行 |
| No record was found for an update | 尚未先用 App 登入，因此 Neon 還沒有該使用者 |

## 安全提醒

- Firebase UID 可以用於授權指令，但不要公開密碼、Firebase Admin private key、`DATABASE_URL` 或登入 token。
- 後台正式權限只看 Neon `User.role === PLATFORM_ADMIN`，正式環境不得依賴 `x-demo-role`。
