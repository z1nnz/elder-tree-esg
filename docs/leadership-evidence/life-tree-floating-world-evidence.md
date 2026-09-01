# 生命樹浮島世界重製基礎與正式美術門檻紀錄

## 目標與範圍

- 工作議題：[生命樹浮島世界：重製主角樹、環境層次與手機級動畫 #53](https://github.com/z1nnz/elder-tree-esg/issues/53)
- 實作分支：`codex/life-tree-floating-world`
- 主要負責範圍：構圖採用、資料掛點邊界、Blender 可重建資產、Unity 場景組裝、手機取景、測試判讀與正式版本驗收。
- 外部參考圖只作氣氛討論，沒有收進專案，也沒有描摹其島形、樹形、建築或地貌。正式資產由本專案的 Blender 產生腳本與母稿建立。

2026-09-01 第二輪人工檢視結論：風格化葉簇、共用樹皮、草地與岩層材質已取代紙片葉與純色測試地台，三維前景和二維遠景開始具有一致光色，並大幅降低葉冠幾何成本。這一輪可以作為可重現的美術管線與方向樣本，但尚未通過正式美術驗收：主枝剪影仍偏對稱僵硬、地表石塊仍像臨時道具、瀑布尚未形成主畫面中的流動層次，也沒有完成霧氣、粒子、後製和六階段成長。因此仍不得建立合併請求或把它宣稱為大型商業遊戲的最終品質。

## 可核驗資產

| 項目 | 結果 |
| --- | --- |
| 資產版本 | 2 |
| 匯出網格物件 | 97 |
| 頂點 | 10,119 |
| 三角面 | 16,786 |
| 獨立葉片元素 | 0 |
| 合併葉群網格 | 16 |
| 透明葉簇面片 | 48 |
| 主枝／可動葉冠／掛點 | 8／16／12 |
| 三維中央島／近景瀑布／三維雲塊 | 1／2／0 |
| FBX SHA-256 | `eaf0be194f0aed8ebdf4b00697eb0cc56065a12a20d7c52444572b7730aa710a` |
| GLB SHA-256 | `47b178ca872461e82a089f0642d2137d3ed9ee208e3124a53d29265c7f74056c` |

Blender 產生腳本會在匯出時檢查上述固定數量與 14,000～60,000 三角面預算；任一契約不符就中止。十六個可動葉冠各由三張交叉透明葉簇面片建立可讀體積，不再保存或匯出 1,152 片獨立葉子；網格物件為 97，遠方島嶼與雲海仍由二維背景板承擔。這些數字只是繪製成本的代理指標，不等同實機繪製呼叫次數、透明排序成本或幀率；正式數字仍須由 Unity 分析器與實機擷取證明。

## 同尺寸前後對照

重製前基線，768 × 1024 Unity 主相機畫面：

![重製前 Unity 生命樹基線](screenshots/life-tree-unity-garden-before-floating-world.png)

目前重製基礎，768 × 1024 Unity 主相機畫面：

![目前 Unity 浮島世界重製基礎](screenshots/life-tree-unity-garden.png)

- 重製前畫面 SHA-256：`690bb07459ee90db71e17864886d88096f33ac6f5dfb1e4dc1ab3bafe64cf08a`
- 目前畫面 SHA-256：`3452e49108e1d8494f8119fdad60351f5cd51f15265f405b794446650ba25865`
- 比較結果：已改善取景、背景規模、主幹輪廓、三級枝梢、葉冠密度、樹皮與浮島材質；葉冠不再像均勻紙片，地台也不再是純色圓盤。未過門檻的主要原因已轉為主枝剪影、地表構圖、瀑布／霧氣動態、後製與六階段內容，而不是材質管線本身。

## 產製檢查畫面

Blender 品質預覽（用於檢查造型、燈光與材質）：

![Blender 浮島世界品質預覽](../../apps/life-tree-unity/Assets/Art/Generated/生命樹庭園_品質預覽.png)

上方目前畫面不是 Blender 預覽冒充 App 畫面。它由 Unity 主相機直接渲染，前景為可受資料控制的三維樹與中央島，遠方天空、雲海與兩座旅程島是本專案原創二維背景板。葉簇使用雙面透明裁切著色器，浮島使用草地／岩層三向投影著色器；混合場景取景邊界為 7.24 × 3.09 × 4.90，相機距離 20.00。

## 正式重製標準

![樹伴原創生命樹浮島世界設計稿](../art/concepts/生命樹浮島世界_正式設計稿_v1.png)

![樹伴原創主樹建模參考](../art/concepts/生命樹_主樹建模參考_v1.png)

兩張圖由內建圖像生成工具依樹伴需求產生，作為原創視覺方向與 Blender 拆解參考，不是 Unity 畫面，也不能直接證明可執行品質。正式重製採三維主樹與中央島、二維遠景群島與天空、Unity 即時雲霧／瀑布／枝葉動態的混合方式。

- 浮島世界設計稿 SHA-256：`2c20de348d408d746e01e387c419eba884644db81e834432517c7a94431b0823`
- 主樹建模參考 SHA-256：`cdf49056f05b3ea66a291639b5e94ad9a93cdfcde09a1820f6e123d6842c41c8`
- 遠景背景板 SHA-256：`355b5b997d92d9565a7d50427660a5edc032e3a8822bc91de799cfe9d61bad33`
- 原創生成式樹皮色彩貼圖 SHA-256：`c45fe3ad7ac94464de2ecb8f615ac14c5a92133824458d13b40be56ea5caf3ee`
- 原創風格化葉簇貼圖 SHA-256：`f1fa205a54e5bba64a2b7c01b798945b9355c852197fcb8e45982c4874a80416`
- 原創浮島草地貼圖 SHA-256：`f300dd0643153d5c1d2cc0d8da472cd5ae4b008384ae05178c68eae393251a66`
- 原創浮島岩層貼圖 SHA-256：`e2d3c7b13565a7ab8583ab594f76079e33e8c43210c41b6af88b2c60ae2eff86`
- Unity 共用樹皮／葉簇／浮島／島岩材質 SHA-256：`36769deac2eacabfd025e2514609e1acb7f9d16ec7db69e910492630d1ff1325`／`4a90a83933b34d8dc0f55eff0589489ce88a9bf067b3ad1b929b9d5c425b9aba`／`4a8813e672e968efecb54c539f3054d7c2960fc88921302893bb7311f249baea`／`0450355565be51370dff8b668bf7f2a740d47276c764fd6b45804c69757a078d`
- Unity 場景 SHA-256：`b7e47a10c07ab8db8e0bfd13e1ffd2aaa138fa4674e77a8631e4b76bdadf12a0`
- Blender 品質預覽 SHA-256：`090e13d20a73a7d14426f630533c7ae925d1b3b767e4ae30463146d50971f129`
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
- Unity 編輯器測試 9／9 通過（2026-09-01 重新執行，0 失敗、0 略過）；除遠景比例與樹皮材質外，新增案例會核對十六組葉冠共用透明葉簇材質，以及中央島與五塊岩石確實使用經審查的風格化貼圖。測試報告位於本機暫存路徑 `/tmp/tree-companion-stylized-final-tests.xml`，不把暫存報告冒充版本庫永久證據。

## 尚未證明

- 目前是可運作的原創重製基礎，不等同參考圖、兩張重製設計稿或大型商業遊戲的最終美術品質，也不得提交合併主分支。
- 尚未完成主幹與主枝剪影人工雕整、法線烘焙、葉冠層級再構圖、雲霧／瀑布動畫著色器、後製與完整成長動畫。
- 編輯器截圖不等同 Android／iOS 實機幀率、溫度、記憶體、載入時間或觸控驗收。
- Unity 三維庭園本身不承載文字，因此二倍文字不適用於這張背景板；返回、讀屏、大字與操作控制仍由 Flutter／原生層驗收，目前沒有以此白模取代既有 360／390 寬 App 介面證據。
- 三維畫面不證明真實植樹、合作夥伴、社會影響或使用者留存成果。
