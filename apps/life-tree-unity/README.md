# 生命樹庭園

這是樹伴 App 的全螢幕即時 3D 生命樹工程。Flutter 仍負責登入、任務、地圖、樹伴圈、文字與無障礙操作；本工程只負責生命樹場景、成長動態、紀念掛載與鏡頭互動。

## 不變的資料界線

- 只接收後端已確認的樹階段與紀念物，不在 Unity 本地增加成長值。
- 每個紀念物以穩定識別碼去重，並固定放入十二個掛點之一。
- 降低動態時停止微風與成長過場，仍顯示同一棵樹及全部已確認紀念物。
- 既有 2D 生命樹永遠保留為預設可讀畫面；無法載入 Unity、裝置效能不足或尚未支援的平台不會失去內容。降低動態時仍可由使用者選擇進入完全靜止的三維庭園。

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

這會從 FBX 建立 `Assets/Scenes/生命樹庭園.unity`，並輸出 Unity 真實場景檢查圖至 `docs/leadership-evidence/screenshots/life-tree-unity-garden.png`。首次套件解析需要網路。

編輯器測試：

```sh
/Applications/Unity/Hub/Editor/6000.0.82f1/Unity.app/Contents/MacOS/Unity \
  -batchmode \
  -projectPath apps/life-tree-unity \
  -runTests -testPlatform EditMode \
  -testResults /tmp/tree-companion-unity-tests.xml \
  -logFile -
```

執行 Unity 測試時不可加 `-quit`；測試執行器會在完成後自行結束，提前要求離開可能得到成功結束碼卻沒有測試結果。

## iOS 程式庫與 App 串接

安裝 Unity iOS Build Support 後，在專案根目錄執行：

```sh
tools/unity/prepare_life_tree_ios.sh
```

腳本會使用已版控並經過審查的場景匯出 iOS 工程、編譯 ARM64 `UnityFramework`、把可嵌入成品保存在忽略版控的 `Builds/Frameworks/iphoneos`，並寫入本機 `LifeTreeUnity.local.xcconfig`。多 GB 的編譯中間物會在成品轉存後清除；美術階層改變時才另外執行「重建生命樹庭園」，避免單純匯出造成無意義場景差異。

Flutter 的「走進生命樹庭園」會透過 iOS 原生通道傳入後端成長階段、固定紀念掛點與降低動態偏好。未準備 Unity 程式庫、原生載入失敗或其他尚未支援的平台會留在既有二維生命樹，不會假裝已開啟三維畫面。

目前已驗證 ARM64 iPhone 程式庫與 Swift 橋接可編譯；完整 App 實機安裝、返回操作、幀率與記憶體仍須用已安裝 iOS Device Platform 的 Xcode 與實體 iPhone 驗收。Android Unity 程式庫尚未接入。
