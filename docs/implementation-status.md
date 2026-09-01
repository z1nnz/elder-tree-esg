# 實作狀態

## 2026-09-01：生命樹浮島世界風格化材質樣本（未送正式版）

- Blender／Unity 已驗證三維中央生命島、兩道近景瀑布與二維遠景旅程島／雲海可與生命樹資料掛點共存，並修正匯入比例與自動取景問題。
- 第一輪白模曾因紙片葉、純色地台、僵硬光影與環境深度不足被判定為低成本低模；第二輪已用原創風格化葉簇、樹皮、草地與岩層材質重製主畫面，但仍只保存為可核驗樣本，不合併成對外正式品質。
- 後續改以[原創浮島世界設計稿](art/concepts/生命樹浮島世界_正式設計稿_v1.png)與[主樹建模參考](art/concepts/生命樹_主樹建模參考_v1.png)為重製標準，採三維主樹、三維中央島與二維遠景混合管線。
- 重製中的主樹保留次枝、末梢枝與十六組資料葉冠，每組改用三張交叉透明葉簇面片，共 48 張；資產降至 97 個網格物件、10,119 個頂點及 16,786 個三角面。中央島與五塊岩石使用草地／岩層三向投影材質，Unity 9／9 測試通過。畫面仍未完成主枝剪影、石塊構圖、雲霧／瀑布動態、後製、六階段成長與真機效能，因此不得建立合併請求，詳見[證據紀錄](leadership-evidence/life-tree-floating-world-evidence.md)。

## 2026-09-01：Android 生命樹庭園原生串接

- Unity 6000.0.82f1 可匯出 ARM64 `unityLibrary`，Flutter Android 只在本機匯出物完整時嵌入；乾淨複製或中斷匯出仍能使用二維生命樹。
- App 與 iOS 共用生命樹通道及狀態契約；Android 啟動全螢幕 `UnityPlayerGameActivity`，活動不對外匯出且不建立第二個啟動圖示。
- 約 145 MB 通用 APK 已確認 ARM64 包含 Unity／IL2CPP，ARM64、ARMv7、x86-64 皆包含 Flutter；低記憶體、OpenGL ES 版本不足與非 ARM64 裝置留在二維生命樹。
- Flutter 靜態檢查零問題、180 項通過且 3 項隔離略過；Unity 編輯器 5／5 通過；故意殘缺 Unity 匯出時的二維建置亦成功。
- Android／iOS 實體裝置目前未出現在系統部署清單，載入時間、返回、記憶體與幀率仍待實機驗收；詳見[證據紀錄](leadership-evidence/life-tree-android-integration-evidence.md)。

## 2026-08-29：接力旅程第二級完整計時見證（合併請求 #46 驗收中）

- 「讓春天回到生命樹」第二篇章的一般舒展與無障礙慢呼吸改為伺服器 180 秒完整計時。
- 認領成功即保存開始時間；重新讀取後可恢復倒數，轉棒重新開始，逾時釋出不沿用舊時間。
- 未達時間由 App 禁止完成，API 仍會再次拒絕；通過後保存開始時間、最低秒數、實際秒數與完整計時層級，沿用篇章與請求冪等規則。
- App 清楚標示自我確認與完整計時的差異，通過 360／390／768 寬與二倍文字版面測試。
- 本功能只證明流程時間，不宣稱姿勢、位置、同場或健康效果；資料庫整合與跨平台建置以議題 #45／合併請求 #46 的本次遠端 CI 為準。

## 2026-08-27：共創夥伴台提案與審核發布縱向切片

- 新增組織隔離的夥伴工作區；旅程共創夥伴只能存取自己加入的組織及其提案。
- 夥伴可建立、修改草稿並送交審核，但不能直接發布；平台營運人員可留下審查說明後核准或退回。
- 核准會在單一資料庫交易內建立唯一一筆已發布雷達任務，重複核准不會重複建立任務，App 既有任務雷達可直接接收。
- 第一版旅程強制「不消費也能完成」；優惠只能是自願回饋，不能成為完成條件。
- 夥伴端只顯示任務送達 App、進入旅程場域、完成旅程三項彙總人次，不提供姓名或精確移動軌跡。
- 同一提案按使用者去重統計；切換樹伴圈不重複累計。送達代表 API 回傳到 App，不等同實際觀看，更不等同購買。
- 修改、送審與審核共用提案交易鎖；送審和核准會重新驗證既有資料，避免舊資料或並行更新繞過規則。
- App 顯示合作據點、無障礙資訊、安全說明與自願回饋；登入頁、夥伴台與平台後台改採清楚的淺色工作介面，移除假姓名、無作用的工具按鈕、示範趨勢與固定進度值。
- 短效動態碼與一次性優惠核銷尚未納入本切片，下一版再接上合作據點驗證台。

## 2026-07-10：Blaze 照片 AI 驗證 MVP

- Firebase Blaze／Storage 驗證線改為可啟用狀態；`dev-api-neon` 預設開啟
  `PHOTO_EVIDENCE_ENABLED=true` 與 `PHOTO_VERIFICATION_ENABLED=true`。
- 一般 PHOTO_AI 任務改走正式 Evidence 流程：App 壓縮 JPEG、寫入私人
  Storage、API 產生短效簽名 URL，再交由 AI verifier / Gemini 判斷。
- PASS 會自動完成任務並以既有 `GrowthEntry` 冪等加分；REVIEW 進同家庭其他
  帳號覆核；FAIL 不加分且可重新拍攝。
- Storage Rules 維持本人可寫、App 不可讀；PASS／FAIL 或人工覆核完成後刪除
  原圖。
- 雷達任務 PHOTO_AI 仍維持鎖定，避免在定位任務模型尚未設計 evidence 關聯前
  混用一般任務證據流程。

## 2026-07-07：任務雷達＋公開前台雙 CTA MVP

- 新增獨立的 `RadarMission` 與 `RadarMissionProgress`，和固定路線任務分開。
- 台北市中心已種入多個雷達任務點；任務包含座標、半徑、時間窗、模式、成長值與徽章名稱。
- App 新增任務雷達地圖光點與任務卡；前景定位會先以手機端粗略判斷候選點，再交由後端驗證半徑。
- 雷達任務只允許 `SELF_CHECK` 與 `TIMER`；完成後用 `GrowthEntry` 冪等帳本加分，重送不重複成長。
- 後台新增雷達任務管理，可建立草稿、設定座標／半徑／時間窗、發布與封存。
- 公開前台新增雙 CTA：「開始使用」與「合作／陪伴」，並讀取公開雷達任務 API 作城市任務展示。
- 照片 AI 驗證預設鎖到 Firebase Blaze／Storage 完整版；App/API 不呼叫 Storage 或 Gemini。

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
- Gemini API key、Firebase Admin service account 與已部署 Storage Rules。
- 150 張取得同意、完成標註的 golden set。
- 5 組長者／家庭志願者測試與研究同意流程。
- 24 小時真機壓力測試與 Android/iOS 實機 BLE 驗收。

## 已知依賴風險

`npm audit` 仍會列出 Nest/Next/Firebase Admin 上游鎖定的 Multer、
PostCSS 與 UUID 傳遞依賴。專案不使用 Multer 接收照片，照片改採 signed
upload；升級前需等待上游套件釋出相容版本，不使用破壞性
`npm audit fix --force`。
