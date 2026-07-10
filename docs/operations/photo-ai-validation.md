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

## 驗收案例

| 案例 | 預期結果 |
| --- | --- |
| 拍植物、花、樹、草或葉 | 高信心時 PASS，任務完成，生命樹增加一次 |
| 拍水杯、水瓶、杯子或飲料 | 高信心時 PASS，任務完成，生命樹增加一次 |
| 照片不清楚或低信心 | REVIEW，進入同家庭其他帳號的覆核列表 |
| 明顯不符合任務 | FAIL 或 REVIEW，不加成長值，可重新拍攝 |
| 重送同一 evidence complete | 不重複增加成長值 |

## 覆核驗收

1. A 帳號提交需要 REVIEW 的照片。
2. B 帳號與 A 在同一家庭。
3. B 在家人覆核頁看到待覆核照片。
4. A 不能覆核自己的照片。
5. B 通過後生命樹只增加一次；B 退回後 A 可以重新拍攝。

## 環境檢查

- App 的 `me/context` 必須顯示 `photoEvidence.enabled=true` 與 `geminiPhotoVerification.enabled=true`。
- 後台「照片覆核佇列」會顯示 Photo Evidence、Gemini Verifier、Storage Rules 與 Radar PHOTO_AI 狀態。
- 後台不會顯示 Gemini key、Firebase Admin private key 或 `DATABASE_URL`。
