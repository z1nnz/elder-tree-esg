# 綠伴 Public Web V2 Design Spec

## Direction

綠伴前台 V2 是「電影感自然科技網站」，不是一般功能型 landing page。第一眼由世界樹影片承擔情緒，後續用 scroll storytelling、任務地圖與互動面板把產品講清楚。

## Reference Grammar

- Nature Beyond: 把樹木視為高性能自然系統，使用掃描、節點、系統面板語彙。
- Noomo Storytelling: 用 tap / scroll to explore 做探索節奏，不一次把所有文字攤開。
- Trionn: 強主句、強對比、少量但明確的品牌語氣。
- SOHub: 大畫面、短文案、章節式服務敘事。
- GSAP Showcase: 動畫要支援 reduced motion；關閉動態後內容仍完整。

## Page Rhythm

- `/`: 世界樹影片 → 探索點 → App 主流程 → 自然科技索引 → 城市任務 → 路線旅程 → CTA。
- `/product`: App V2 操作故事，展示今日陪伴、任務卡、照片 AI、生命樹回饋。
- `/explore`: 台北 3D 任務大屏是主角，文字集中在資料顯示台。
- `/partners`: 角色入口與合作流程，強調安全、可撤回、可信任。
- `/impact`: manifesto + 影響路徑，避免假數字與過度宣傳。

## Motion Rules

- 首頁 hero 使用 sticky scroll：先看主句，再進入探索點，再離開 hero。
- 內頁使用 reveal、panel shift、任務點 pulse；不使用大量同質卡片動畫。
- `prefers-reduced-motion: reduce` 時停用循環與 scroll scrub，保留靜態內容。

## Copy Rules

- 少用「AI 驅動、賦能、解決方案」。
- 每段最多一個主句、一個補充句。
- 使用可感知動作：走出去、靠近、停一下、完成、長出新葉。
