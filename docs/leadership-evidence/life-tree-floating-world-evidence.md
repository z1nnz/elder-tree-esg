# 生命樹浮島世界重製基礎與正式美術門檻紀錄

## 目標與範圍

- 工作議題：[生命樹浮島世界：重製主角樹、環境層次與手機級動畫 #53](https://github.com/z1nnz/elder-tree-esg/issues/53)
- 實作分支：`codex/life-tree-floating-world`
- 主要負責範圍：構圖採用、資料掛點邊界、Blender 可重建資產、Unity 場景組裝、手機取景、測試判讀與正式版本驗收。
- 外部參考圖只作氣氛討論，沒有收進專案，也沒有描摹其島形、樹形、建築或地貌。正式資產由本專案的 Blender 產生腳本與母稿建立。

2026-09-01 人工檢視結論：這批模型只通過場景結構、資料契約與混合管線驗證，沒有通過正式美術驗收。新版已拿掉球狀樹冠與三維遠景雲塊，但葉片仍像硬質紙片、中央島接近測試地台、瀑布沒有流動，三維前景與精緻二維背景的材質和光影不在同一個世界。整體不能作為研究所作品集或公開產品畫面，也不得建立合併請求。它只保留為可重現的重製基礎證據，不進正式貢獻表。

## 可核驗資產

| 項目 | 結果 |
| --- | --- |
| 資產版本 | 2 |
| 匯出網格物件 | 98 |
| 頂點 | 25,849 |
| 三角面 | 43,938 |
| 橢圓葉片元素 | 1,152 |
| 合併葉群網格 | 16 |
| 主枝／可動葉冠／掛點 | 8／16／12 |
| 三維中央島／近景瀑布／三維雲塊 | 1／2／0 |
| FBX SHA-256 | `ac259a686d8c1ec02748ec99b9ac77fdebe179fc0496406b7417c83300f090a4` |
| GLB SHA-256 | `331fe14650cf949edeb6f429cb62c549fabd324bc60aa388762b35edbd8bdb2f` |

Blender 產生腳本會在匯出時檢查上述固定數量與 14,000～60,000 三角面預算；任一契約不符就中止。1,152 片葉子在可編輯母稿中保留，匯出前依十六個葉冠群組合併，網格物件由 1,277 降至 98；遠方島嶼與雲海改由二維背景板承擔，不再載入被遮住的三維幾何。98 個網格物件只是繪製成本的代理指標，不等同實機繪製呼叫次數；正式數字仍須由 Unity 分析器與實機擷取證明。

## 同尺寸前後對照

重製前基線，768 × 1024 Unity 主相機畫面：

![重製前 Unity 生命樹基線](screenshots/life-tree-unity-garden-before-floating-world.png)

目前重製基礎，768 × 1024 Unity 主相機畫面：

![目前 Unity 浮島世界重製基礎](screenshots/life-tree-unity-garden.png)

- 重製前畫面 SHA-256：`690bb07459ee90db71e17864886d88096f33ac6f5dfb1e4dc1ab3bafe64cf08a`
- 目前畫面 SHA-256：`dd38c65161c64a77f67b0dc6f05968d0ba1335633b0ca062132bc3a904c9389a`
- 比較結果：已改善取景、背景規模、主幹輪廓、三級枝梢與葉冠資料群組，但目前畫面仍因葉片、地台、石塊、瀑布、接觸陰影和光色整合不足而未過正式美術門檻。

## 產製檢查畫面

Blender 品質預覽（用於檢查造型、燈光與材質）：

![Blender 浮島世界品質預覽](../../apps/life-tree-unity/Assets/Art/Generated/生命樹庭園_品質預覽.png)

上方目前畫面不是 Blender 預覽冒充 App 畫面。它由 Unity 主相機直接渲染，前景為可受資料控制的三維樹與中央島，遠方天空、雲海與兩座旅程島是本專案原創二維背景板。已修正 FBX 被重複放大 100 倍、相機退到 4,291 單位外而被霧色吞沒的問題；混合場景取景邊界為 6.80 × 3.13 × 4.55，相機距離 20.00。

## 正式重製標準

![樹伴原創生命樹浮島世界設計稿](../art/concepts/生命樹浮島世界_正式設計稿_v1.png)

![樹伴原創主樹建模參考](../art/concepts/生命樹_主樹建模參考_v1.png)

兩張圖由內建圖像生成工具依樹伴需求產生，作為原創視覺方向與 Blender 拆解參考，不是 Unity 畫面，也不能直接證明可執行品質。正式重製採三維主樹與中央島、二維遠景群島與天空、Unity 即時雲霧／瀑布／枝葉動態的混合方式。

- 浮島世界設計稿 SHA-256：`2c20de348d408d746e01e387c419eba884644db81e834432517c7a94431b0823`
- 主樹建模參考 SHA-256：`cdf49056f05b3ea66a291639b5e94ad9a93cdfcde09a1820f6e123d6842c41c8`
- 遠景背景板 SHA-256：`355b5b997d92d9565a7d50427660a5edc032e3a8822bc91de799cfe9d61bad33`
- 原創生成式樹皮色彩貼圖 SHA-256：`c45fe3ad7ac94464de2ecb8f615ac14c5a92133824458d13b40be56ea5caf3ee`
- Unity 共用樹皮材質 SHA-256：`39b145b75f32dbf659ceab4674a370e589caa118607bdf0a476537e9e20df63c`
- Unity 場景 SHA-256：`dacedec4d6371ae0a746a71472ca0783a8f456aa14c1d24779008ad52b23d19e`
- Blender 品質預覽 SHA-256：`7c38107a0eee9b6cd6f6235b5be0363bfc2764655f4d2bdf9854c17e06c249ff`
- 兩張原圖均無使用者照片、人物、品牌標誌或第三方遊戲素材；提示詞與限制保存於同資料夾的來源紀錄。

## 重現與測試

```sh
blender --background --python tools/blender/build_life_tree.py -- \
  --output apps/life-tree-unity/Assets/Art/Generated \
  --source art-source/blender

/Applications/Unity/Hub/Editor/6000.0.82f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -quit \
  -projectPath apps/life-tree-unity \
  -executeMethod TreeCompanion.Editor.LifeTreeSceneBuilder.BuildAndCapture

/Applications/Unity/Hub/Editor/6000.0.82f1/Unity.app/Contents/MacOS/Unity \
  -batchmode \
  -projectPath apps/life-tree-unity \
  -runTests -testPlatform EditMode \
  -testResults /tmp/tree-companion-final-tree-tests.xml \
  -logFile /tmp/tree-companion-final-tree-tests.log
```

- Blender 腳本 Python 編譯檢查通過。
- Blender 場景、母稿、FBX、GLB、統計與預覽重新產生成功。
- Unity 場景自動重建及主相機截圖成功。
- Unity 編輯器測試 7／7 通過（2026-09-01 重新執行，0 失敗、0 略過）；新增案例會載入正式遠景資產並驗證匯入後仍維持 3:4，也會核對共用樹皮材質確實引用經審查的貼圖。測試報告位於本機暫存路徑 `/tmp/tree-companion-final-tree-tests.xml`，不把暫存報告冒充版本庫永久證據。

## 尚未證明

- 目前是可運作的原創重製基礎，不等同參考圖、兩張重製設計稿或大型商業遊戲的最終美術品質，也不得提交合併主分支。
- 尚未完成雕刻高模、法線烘焙、正式葉群材質、雲霧／瀑布著色器、後製與完整成長動畫。
- 編輯器截圖不等同 Android／iOS 實機幀率、溫度、記憶體、載入時間或觸控驗收。
- Unity 三維庭園本身不承載文字，因此二倍文字不適用於這張背景板；返回、讀屏、大字與操作控制仍由 Flutter／原生層驗收，目前沒有以此白模取代既有 360／390 寬 App 介面證據。
- 三維畫面不證明真實植樹、合作夥伴、社會影響或使用者留存成果。
