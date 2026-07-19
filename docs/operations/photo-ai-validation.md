# 照片 AI 驗證實機驗收手冊

這份手冊用來驗收一般任務的 `PHOTO_AI` 流程。雷達任務目前仍維持 `SELF_CHECK` / `TIMER`，不接照片證據。

## 啟動順序

1. 確認 Firebase Storage rules 已部署：

   ```bash
   firebase deploy --only storage --project elder-tree-esg-z1nnz
   ```

2. 啟動 AI verifier，並在同一個 process 設定 Gemini key：

   ```bash
   cd /Users/whzi_111/elder-tree-esg
   export GEMINI_API_KEY="你的本機 Gemini key"
   npm run dev:ai
   ```

3. 啟動 API：

   ```bash
   PHOTO_EVIDENCE_ENABLED=true \
   PHOTO_VERIFICATION_ENABLED=true \
   FIREBASE_STORAGE_BUCKET=elder-tree-esg-z1nnz.firebasestorage.app \
   AI_VERIFIER_URL=http://127.0.0.1:4400 \
   LOCATION_SIMULATION_ENABLED=true \
   npm run dev:api:neon
   ```

4. 啟動 App，使用實機連到同一個 Wi-Fi。若手機要連 Mac 上的 API，`API_URL` 需使用 Mac 的區網 IP，而不是手機自己的 `127.0.0.1`。

   ```bash
   API_URL=http://你的-Mac-區網-IP:4100/api/v1 flutter run
   ```

5. 跑照片 AI readiness check。

   最不容易出錯的方式是直接用專案裡的 doctor 腳本。它會自動切到正確的專案資料夾，並補上本機預設值：

   ```bash
   /Users/whzi_111/elder-tree-esg/scripts/photo-ai-doctor.sh
   ```

   如果你想手動跑，也可以先切到專案根目錄：

   ```bash
   cd /Users/whzi_111/elder-tree-esg
   PHOTO_EVIDENCE_ENABLED=true \
   PHOTO_VERIFICATION_ENABLED=true \
   FIREBASE_STORAGE_BUCKET=elder-tree-esg-z1nnz.firebasestorage.app \
   AI_VERIFIER_URL=http://127.0.0.1:4400 \
   GEMINI_API_KEY="$GEMINI_API_KEY" \
   npm run photo-ai:check
   ```

   這個指令只檢查設定與服務狀態，不會印出完整 Gemini key。若 AI verifier 不是 `gemini` mode，仍可測 API 與 Storage 流程，但不能算真正的 Gemini 圖片驗收。

   若看到 `Could not read package.json`，代表你在錯的資料夾執行 `npm run ...`。請改用上面的 `scripts/photo-ai-doctor.sh`。

6. 開後台檢查「照片覆核佇列」：

   - `Photo Evidence` 應為 Ready。
   - `Gemini Verifier` 應為 Ready。
   - `Radar PHOTO_AI` 應維持 Locked。
   - 「照片 AI 實機驗收劇本」會列出本輪要測的五個案例。

## 驗收案例

| 案例 | 拍攝方式 | 預期結果 |
| --- | --- | --- |
| 植物 PASS | 拍花、葉片、草地或樹，主體清楚、光線穩定 | 高信心時 PASS，任務完成，生命樹增加一次 |
| 補水 PASS | 拍水杯、水瓶、杯子或飲料杯，不拍人臉 | 高信心時 PASS，任務完成，生命樹增加一次 |
| REVIEW | 拍得太暗、太遠、主體不夠明確 | REVIEW，進入同家庭其他帳號的覆核列表 |
| FAIL / 重拍 | 拍到不符合任務的物品 | FAIL 或 REVIEW，不加成長值；FAIL 可重新拍攝 |
| 冪等重送 | 對同一筆 evidence 重送 complete | 不重複呼叫 verifier，不重複增加成長值 |

## App 驗收路徑

1. 用 A 帳號登入 App。
2. 確認任務頁或今日首頁有一般 `PHOTO_AI` 任務。
3. 點「拍照驗證任務」。
4. 拍符合任務的照片。
5. App 應顯示下列其中一種結果：

   - `PASS`：顯示「生命樹長出新葉 +N」，任務變成已完成。
   - `REVIEW`：顯示需要家人再確認，任務維持待覆核。
   - `FAIL`：顯示可重新拍攝，不增加成長值。

6. 關閉 App 後重啟，確認任務狀態與生命樹成長值仍存在。

## 覆核驗收

1. A 帳號提交需要 REVIEW 的照片。
2. B 帳號與 A 在同一家庭。
3. B 在家人覆核頁看到待覆核照片。
4. A 不能覆核自己的照片。
5. B 通過後生命樹只增加一次；B 退回後 A 可以重新拍攝。

## 不該發生的事

- App 不應顯示 `FirebaseError`、`Storage bucket`、`Gemini key`、`DATABASE_URL` 或 stack trace。
- 雷達任務不應出現 `PHOTO_AI` 發布選項。
- LINE 快速回覆不應直接完成照片任務。
- 同一張照片或同一 evidence 重送不應再次加分。

## 環境檢查

- `npm run photo-ai:check` 應該至少顯示 API health、AI verifier health 與 Firebase Storage rules files 可用。
- App 的 `me/context` 必須顯示 `photoEvidence.enabled=true` 與 `geminiPhotoVerification.enabled=true`。
- 後台「照片覆核佇列」會顯示 Photo Evidence、Gemini Verifier、Storage Rules 與 Radar PHOTO_AI 狀態。
- 後台不會顯示 Gemini key、Firebase Admin private key 或 `DATABASE_URL`。
