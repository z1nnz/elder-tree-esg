# 生命樹庭園

這是樹伴 App 的全螢幕即時 3D 生命樹工程。Flutter 仍負責登入、任務、地圖、樹伴圈、文字與無障礙操作；本工程只負責生命樹場景、成長動態、紀念掛載與鏡頭互動。

## 不變的資料界線

- 只接收後端已確認的樹階段與紀念物，不在 Unity 本地增加成長值。
- 每個紀念物以穩定識別碼去重，並固定放入十二個掛點之一。
- 降低動態時停止微風與成長過場，仍顯示同一棵樹及全部已確認紀念物。
- Flutter 無法載入 Unity、裝置效能不足或使用者開啟降低動態時，保留既有 2D 生命樹退化畫面。

## 建模與匯出

```sh
blender --background --python tools/blender/build_life_tree.py -- \
  --output apps/life-tree-unity/Assets/Art/Generated \
  --source art-source/blender
```

腳本會產生：

- `生命樹庭園.fbx`：Unity 原生匯入資產；
- `生命樹庭園.glb`：通用交換與檢查格式；
- `生命樹庭園_品質預覽.png`：固定相機的視覺審查圖；
- `生命樹庭園_資產統計.json`：可核對的物件、頂點、三角面與掛點統計；
- `生命樹庭園_母稿.blend`：可繼續人工雕整的母稿。

## 建立 Unity 場景

安裝 Unity 6000.0.82f1 後，以批次模式執行：

```sh
/Applications/Unity/Hub/Editor/6000.0.82f1/Unity.app/Contents/MacOS/Unity \
  -batchmode \
  -projectPath apps/life-tree-unity \
  -executeMethod TreeCompanion.Editor.LifeTreeSceneBuilder.BuildAndCapture \
  -logFile -
```

這會從 FBX 建立 `Assets/Scenes/生命樹庭園.unity`，並輸出 Unity 真實場景檢查圖至 `docs/leadership-evidence/screenshots/life-tree-unity-garden.png`。首次套件解析需要網路，正式手機整合與效能驗收仍須另外完成。

編輯器測試：

```sh
/Applications/Unity/Hub/Editor/6000.0.82f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -quit \
  -projectPath apps/life-tree-unity \
  -runTests -testPlatform EditMode \
  -testResults /tmp/tree-companion-unity-tests.xml \
  -logFile -
```
