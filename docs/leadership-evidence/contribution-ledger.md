# 貢獻與決策紀錄

> 本表只記錄已有公開差異、審查或測試可以核對的成果。尚未完成的工作放在議題，不先列為貢獻。

| 日期 | 目標與成果 | 主要負責人角色 | 整合與驗收 | 可核驗資料 |
| --- | --- | --- | --- | --- |
| 2026-08-09 | 將產品從家庭單次任務調整為樹伴圈共行旅程，確立免費陪伴核心、商家自願旅程、行動見證與真實植樹分離原則 | 問題定義、產品決策、商業與倫理邊界 | 由 `@z1nnz` 負責規格整合、取捨與正式版本驗收 | [`CONTEXT.md`](../../CONTEXT.md)、[`docs/adr/0001-adopt-circle-cooperative-actions.md`](../adr/0001-adopt-circle-cooperative-actions.md) |
| 2026-08-21 | 完成第一段接力旅程縱向切片、多人完成一致性、冪等鍵核對與有效期間限制 | 核心玩法、驗收標準、正式版本責任 | 由 `@z1nnz` 負責程式整合、測試判讀與合併 | [合併請求 #31](https://github.com/z1nnz/elder-tree-esg/pull/31)、提交 `2cfc8af` |
| 2026-08-22 | 建立硬體方向與合作單位初步名單，明確區分篩選、諮詢、簽約與正式成果 | 範圍決策、風險界線、後續接洽責任 | 由 `@z1nnz` 負責研究範圍、採用決定與後續執行 | [`docs/hardware-device-research.md`](../hardware-device-research.md)、[合併請求 #32](https://github.com/z1nnz/elder-tree-esg/pull/32)、提交 `30759ba` |
| 2026-08-22 | 確立正式工作名稱「同行成林」、加速交付週期與主要負責人證據制度 | 品牌、時程、治理與研究所呈現方式 | 由 `@z1nnz` 負責名稱採用、版本整合與驗收 | [總目標議題 #33](https://github.com/z1nnz/elder-tree-esg/issues/33)、[`docs/brand-guidelines.md`](../brand-guidelines.md)、[`docs/roadmap/tongxing-chenglin-delivery-plan.md`](../roadmap/tongxing-chenglin-delivery-plan.md)、[`PROJECT_LEADERSHIP.md`](../../PROJECT_LEADERSHIP.md) |
| 2026-08-22 | 完成接力旅程認領、轉棒、逾時釋出、無障礙替代方案與離線唯讀邊界 | 核心玩法、資料一致性、應用程式互動與驗收 | 由 `@z1nnz` 負責規格取捨、跨端整合、兩軸審查與正式版本驗收 | [議題 #35](https://github.com/z1nnz/elder-tree-esg/issues/35)、[合併請求 #36](https://github.com/z1nnz/elder-tree-esg/pull/36)、提交 `ff87d14` |
| 2026-08-22 | 完成核心 App 視覺基礎與長者友善首頁，讓樹伴圈接力旅程、下一棒與共同收藏成為首頁主要入口 | 產品層級、視覺系統、核心介面實作、無障礙與跨平台驗收 | 由 `@z1nnz` 負責需求定義、視覺決策、程式整合、實際畫面驗收與 Android 安裝包驗收 | [議題 #37](https://github.com/z1nnz/elder-tree-esg/issues/37)、[合併請求 #38](https://github.com/z1nnz/elder-tree-esg/pull/38)、[390 × 844 畫面與驗證紀錄](issue-37-mobile-visual-evidence.md)、提交 `f87a6b7` |

## 待補的本人實作證據

### 2026-08-27：共創夥伴台與旅程審核發布

- 已交付：組織隔離提案、審核發布、並行操作保護、按帳號去重的合作成果彙總，以及手機安全／無障礙資訊；登入與營運介面精修。
- 主要負責人：`@z1nnz`，負責產品規則、免費核心、權限與發布邊界的採用及版本整合。
- 可核驗資料：[議題 #39](https://github.com/z1nnz/elder-tree-esg/issues/39)、[合併請求 #40](https://github.com/z1nnz/elder-tree-esg/pull/40)、實作提交 `a768253`、[畫面與測試紀錄](issue-39-partner-workspace-evidence.md)。最終合併與 CI 結果以該合併請求為準。
- 不推定已有現場合作、真實植樹成果或使用者成效。

主要負責人每次完成程式、設計、實機接線、測試或訪談後，應新增一筆紀錄，附原始分支、提交、照片或去識別化資料。未經核驗的內容不得推測或代填。

### 2026-08-28：桌上生命樹核心串接（開發中）

- 主要負責人 `@z1nnz` 的系統整合範圍：樹伴圈裝置完整快照、版本確認、持久化去重、認領競態、跨圈權限，以及依憑證連線辨認設備的閘道。
- 分支：`codex/desktop-tree-integration`，由正式主分支獨立開發，不把尚待實機驗收的到場功能合併進來。
- 證據：[狀態契約、部署界線與重現方式](../hardware/desktop-tree-sync.md)、新增 17 項測試；一般 Node 30 項通過，裝置資料庫／HTTP 10 項另行通過。完整遷移與遠端建置以最新持續整合為準。
- 韌體、中文硬體畫面、雲端實際部署及電氣測試仍未完成，不填寫本人已接線、已拿到廠商承諾或已完成實機展示。
