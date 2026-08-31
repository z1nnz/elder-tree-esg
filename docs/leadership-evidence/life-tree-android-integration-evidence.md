# 生命樹庭園 Android 原生串接證據

日期：2026-09-01。主要負責人：`@z1nnz`。工作分支：`codex/life-tree-android-integration`。起始主線：`07c961f32a1323b678a207770bd832b055597de8`。追蹤議題：[生命樹庭園 #49](https://github.com/z1nnz/elder-tree-esg/issues/49)。

## 問題與採用方式

iOS 已能載入生命樹庭園，但 Android 仍只顯示二維生命樹。本輪採用 Unity 6 官方的「Unity 作為程式庫」結構：Flutter 保持唯一 App 主入口，只有使用者主動走進生命樹庭園時才啟動全螢幕 Unity 活動。官方文件說明 Android 匯出工程的 `unityLibrary` 可嵌入其他 Gradle 專案，並限制為全螢幕、單一 Unity 執行時期；本實作依此保留二維退化，不在 Flutter 小卡內硬嵌三維畫面。

- [Unity 6：把 Unity 整合到 Android 應用程式](https://docs.unity3d.com/6000.0/Documentation/Manual/UnityasaLibrary-Android.html)
- [Unity 6：Android Gradle 工程結構](https://docs.unity3d.com/6000.0/Documentation/Manual/android-gradle-project-structure.html)
- [Unity 6：Gradle 與 Android Gradle 外掛相容版本](https://docs.unity3d.com/6000.0/Documentation/Manual/android-gradle-version-compatibility.html)

## 主要負責人決策與整合範圍

1. Unity 匯出固定為 ARM64、最低 Android 8、SDK 36，與樹伴 App 現有 Android 條件一致。
2. Flutter 與 Android 使用和 iOS 相同的 `tree-companion/life-tree-garden` 通道；只傳入後端已確認的六階段狀態、十二個固定紀念掛點與降低動態偏好。
3. Android 依 Unity 6000.0.82f1 實際生成結果啟動 `UnityPlayerGameActivity`，不沿用舊教學的活動類別。
4. Unity 活動不可由其他 App 啟動，且移除生成模組自帶的第二個啟動入口；合併後只留下樹伴主頁一個啟動圖示。
5. 本機存在匯出程式庫時才加入 Gradle；乾淨複製、持續整合或未安裝 Unity 的開發者仍可編譯二維生命樹版本。
6. Unity 從 Android 啟動資料讀取同一份狀態；重回既有活動時會讀取新資料，重複內容不再次套用。

## 可重現工具

```sh
tools/unity/prepare_life_tree_android.sh
tools/unity/verify_life_tree_android_bridge.sh
```

第一個腳本核對 Unity Android 建置支援並匯出 `Builds/Android/unityLibrary`。第二個腳本建置完整 ARM64 APK，再直接檢查 APK 必須含有 `libunity.so` 與 `libil2cpp.so`；缺少任一檔案即失敗。

## 真實建置結果

| 成品 | 大小 | SHA-256 | 驗證結果 |
| --- | ---: | --- | --- |
| `樹伴-android-arm64-unity-debug.apk` | 227 MB | `6add608957069cbf4872f7dd09ff45fa566f66ae0dca6900dbede8b90965281b` | 含 Flutter、Unity、IL2CPP、`libmain.so` 與 `libgame.so` 的 ARM64 完整 APK |
| `樹伴-android-arm64-fallback-debug.apk` | 約 149 MB | `f4df68bb61548ccd000cfd728d13a635ad3b79e129dc9e82741086b2c3a2ccb8` | 暫時移開 Unity 匯出物後仍可建置，且不含 `libunity.so` |

合併後 Android Manifest 的核對結果：

- `com.eldertree.elder_tree_mobile.MainActivity` 是唯一具有 `MAIN`／`LAUNCHER` 的活動；
- `com.unity3d.player.UnityPlayerGameActivity` 為 `android:exported="false"`；
- 最低版本 26、目標版本 36；
- 完整 APK 只包含 `arm64-v8a` 原生程式庫。

## 測試與檢查

- `flutter analyze`：零問題。
- `flutter test`：180 項通過，3 項需本機字型或畫面產物的隔離案例略過。
- Unity 編輯器資料契約測試：4／4 通過，涵蓋有效狀態、拒絕客戶端自創階段、拒絕重複掛點與降低動態。
- 完整 Unity APK：建置成功，驗證腳本再次執行成功。
- 無 Unity 退化 APK：建置成功，確認未誤包 Unity 執行時期。

## 實際失敗與修正

1. Unity Hub 圖形介面與命令列同時執行造成資料庫鎖；先正常結束圖形介面，再以無介面模式安裝 Android、JDK、NDK、CMake 與 SDK 平台。
2. 首輪 Gradle 讀到損壞的 Kotlin DSL `metadata.bin`；停止舊 Gradle 程序，只刪除該可重建快取後重跑。
3. 首輪 IL2CPP 在 557 個節點接近完成時耗盡磁碟；保留已完成的增量編譯，清除舊版應用程式安裝包與開發工具快取後續跑成功。沒有刪除 `elder-tree-esg`、`self_discipline_app` 的原始碼或專題資料。
4. 最初 APK 檢查使用 `pipefail` 與提早結束的 `grep -q`，把實際存在的 Unity 程式庫判成缺少；改為先完整讀取 APK 清單再逐項比對，並以直接列檔交叉確認。

## 尚未宣稱完成

- `adb devices -l` 與 `xcrun devicectl list devices` 目前都沒有可部署裝置；使用者表示已連結，但作業系統尚未提供 Android 或 iOS 裝置識別，因此沒有宣稱實機安裝成功。
- 尚未量測 Android 首次載入時間、記憶體、穩定 30 幀、系統返回鍵、第二次進入與低階裝置退化。
- Unity 模型仍是可運作的第一輪骨架；正式樹皮、樹冠輪廓、六套成長差異、紀念物模型與人工美術修整仍屬議題 #49 後續範圍。
- APK 是本機除錯交付物，未完成 Play 商店簽章、上架、外部測試或發布；可重建產物不提交到 Git。

本紀錄能證明主要負責人的技術選擇、跨端整合、失敗判讀、完整建置與限制管理，不以編譯結果冒充真人試用、實機效能、合作承諾或最終美術完成。
