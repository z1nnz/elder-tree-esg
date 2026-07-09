# Public Web Content Refresh Plan

Last updated: 2026-07-09

## 方向

公開前台要從「漂亮的展示頁」升級成「讓人願意留下、理解產品、知道下一步怎麼參與」的網站。核心不是把所有資訊塞回首頁，而是讓首頁只負責吸睛與引導，其他頁面各自承擔不同使用者意圖。

本計畫會善用 [React Bits](https://github.com/DavidHDev/react-bits) 的動畫方向，但不把它當整包依賴販售或重新包裝。React Bits 授權是 MIT + Commons Clause：可以作為網站/產品的一部分使用，但不能把元件本身作為元件庫轉售、再授權或重新發行。因此我們採取「按需參考、少量改寫、保留來源 notice」策略。

## 全站資訊架構

### `/` 首頁：天空島世界樹入口

目標：第一眼吸睛，讓使用者感覺這是一個完整世界。

- 使用世界樹影片作為第一屏主視覺。
- 保留五個島嶼互動熱區：
  - 城市探索
  - 任務雷達
  - 生命樹成長
  - 陪伴網絡
  - 永續公益
- 島嶼 hover/focus/tap 顯示一句短說明與導頁。
- 不在第一屏放長篇文字。
- 下一版可加入 React Bits 風格：
  - hover glow / magnetic hover
  - tooltip reveal
  - soft spotlight
  - aurora / particles 但只做輔助，不蓋過影片。

### `/product` 產品頁：讓使用者知道這到底怎麼用

目標：把抽象理念變成清楚功能。

建議內容順序：

1. 一句話定位：城市探索、陪伴與生命樹成長平台。
2. 使用者流程：
   - 登入
   - 開始探索
   - 接任務
   - 完成任務
   - 生命樹成長
   - 家人/陪伴者看見成果
3. 功能模組：
   - 任務雷達
   - 固定路線
   - 家庭樹
   - 實體樹
   - 照片 AI 驗證未開放狀態
4. 「不是現在就全部開放」區塊：清楚標示 MVP / 下一階段 / 未開放。

React Bits 可用方向：

- Stepper / timeline reveal
- Card tilt 但幅度要小
- Count up / animated stats，僅限真實或明確標示模擬資料

### `/explore` 城市探索頁：展示遊戲感與安全模型

目標：讓使用者看到「像 Pokémon GO，但更溫柔、更安全」。

建議內容順序：

1. 台北任務雷達展示。
2. 大安森林公園固定路線展示。
3. 安全規則：
   - 前景定位
   - 伺服器判斷距離
   - 不保存完整 GPS 軌跡
   - 不鼓勵速度競賽
4. 任務狀態：
   - 鎖定
   - 可接取
   - 進行中
   - 已完成
   - 已過期

React Bits 可用方向：

- Animated grid / beams 作為任務雷達背景
- Pulse cards 表現限時任務
- Blur text / split text 用於段落標題，但避免整頁都閃動

### `/partners` 合作頁：社福、長照、志工與社區組織入口

目標：讓合作方知道自己可以怎麼加入。

建議內容順序：

1. 為什麼需要陪伴網絡。
2. 合作角色：
   - 社福/長照單位
   - 志工團體
   - 社區組織
   - 企業 ESG 合作
3. 合作流程：
   - 聯絡
   - 審核
   - 設定任務/活動
   - 陪伴與覆核
   - 成果摘要
4. 安全承諾：
   - 權限最小化
   - 申訴/撤回
   - 不公開私人位置

React Bits 可用方向：

- Bento grid 展示合作角色。
- Accordion 展示合作 FAQ。
- Subtle border beams 用於合作 CTA。

### `/impact` 理念與影響力頁

目標：說清楚社會倡議，不要像空泛公益口號。

建議內容順序：

1. 核心理念：
   - 不以家庭作門票
   - 不以焦慮作誘因
   - 不把永續當口號
2. 影響力模型：
   - 個人照顧
   - 家庭/陪伴
   - 社區行動
   - 永續批次
3. 指標設計：
   - 任務完成
   - 生命樹成長
   - 陪伴互動
   - 公益批次
4. 資料倫理：
   - 私人資料不公開
   - 精確位置不做展示
   - 模擬與真實成果分開

React Bits 可用方向：

- Number ticker，但只用在真實資料或清楚標示 demo。
- Scroll reveal timeline。
- Soft gradient background。

## 後台與管理入口

公開前台不應混入管理功能。建議做清楚分工：

- 前台：吸引用戶、說明產品、導合作。
- 後台：任務、路線、雷達、合作資料、公益批次管理。
- 未來可在 footer 或合作頁放「管理員登入」小入口，但不要在首頁主視覺干擾一般使用者。

## 視覺與互動原則

1. 首頁是世界觀，不是簡報。
2. 動畫要服務理解，不要裝飾過量。
3. 老年友善：
   - 字體足夠大
   - 對比清楚
   - 動畫可停用
   - CTA 文案直接
4. 所有 AIGC 圖像/影片要保留來源與替換紀錄。
5. 每個頁面只保留一個主要 CTA：
   - 使用者：開始使用 / 查看產品
   - 合作方：合作洽詢

## 分階段實作

### Phase 1：穩住第一眼

- 使用目前提供的世界樹影片。
- 移除故障感線條 overlay。
- 保留島嶼 hover 說明。
- 檢查手機/平板/桌機裁切。

### Phase 2：全站內容重寫

- 重寫 `/product`、`/explore`、`/partners`、`/impact` 的段落與 CTA。
- 把「AI 願景」移到未來功能，不在每頁大量重複。
- 所有 demo 數字標示清楚。

### Phase 3：React Bits 風格導入

- 按頁面需要導入少量動畫：
  - 首頁：spotlight / hover glow
  - 產品頁：timeline / bento cards
  - 探索頁：radar pulse / grid beams
  - 合作頁：accordion / reveal cards
  - 理念頁：scroll timeline / number ticker
- 每個元件導入後都要支援 `prefers-reduced-motion`。
- 若直接改作 React Bits 可辨識程式碼，新增第三方 notice。

### Phase 4：互動島嶼升級

- 為影片中的五座島建立 cutout/mask layer。
- hover 時該島嶼真正浮上來，背景影片仍繼續播放。
- 說明文字從 hover card 升級為島嶼導覽 panel。

### Phase 5：前台與 App 串接

- 公開前台讀取公開路線與公開雷達摘要。
- 首頁島嶼可顯示真實狀態，例如「本週開放 3 條路線」。
- 不顯示私人定位、家庭資料或完成紀錄。

## 驗收標準

- 首頁第一屏播放世界樹影片，沒有故障線條感。
- 五個島嶼 hover/focus/tap 都能顯示說明。
- reduced motion 下首頁仍可閱讀。
- 所有頁面都有清楚單一目的與 CTA。
- public web build/typecheck 通過。
- 若導入 React Bits 可辨識程式碼，文件中有授權與來源說明。

## 參考

- React Bits GitHub: https://github.com/DavidHDev/react-bits
- React Bits 官方展示站: https://reactbits.dev/
