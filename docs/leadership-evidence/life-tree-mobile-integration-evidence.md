# 生命樹庭園 App 串接證據

## 範圍與版本

- 工作分支：`codex/life-tree-mobile-integration`
- 起始主線：`38ff276386c82738aa4ace42b9826e8f17b50a0d`
- 追蹤議題：[生命樹庭園 #49](https://github.com/z1nnz/elder-tree-esg/issues/49)
- 主要負責人：`@z1nnz`

本階段把已合併的 Unity 生命樹垂直切片接到 Flutter App 的生命樹頁，並把紀念掛點所有權放回後端。這是 iOS 原生整合里程碑，不代表 Android Unity、實體手機效能或最終美術已完成。

## 已完成的系統邊界

1. App 新增「走進生命樹庭園」入口；Unity 是獨立全螢幕頁面，Flutter 保留任務、地圖、文字與二維替代畫面。
2. API 為每段已完成旅程保存 `0` 至 `11` 的固定紀念掛點。排序以圈子的完成時間與旅程識別碼決定，最近十二段旅程不互撞，下一輪循環使用同一組掛點。
3. 舊成果快照只補入可重算的掛點，不改寫當時的名稱、見證、參與者或成長回執。
4. Flutter 傳入資料契約版本、六階段索引、降低動態偏好與最多十二個已驗證紀念物；重複掛點會在進入原生層前拒絕。
5. iOS 使用 Flutter 隱式引擎註冊原生通道。只有 App 內確實嵌入 `UnityFramework` 時才回報可用；否則保持二維生命樹並給出可理解提示。
6. Unity 畫面上方保留 44 點可點擊關閉鈕，關閉時暫停 Unity 並把主視窗交回 Flutter。

## 真實建置證據

- Unity 6000.0.82f1 的 iOS Build Support 已把 C# 場景轉成 ARM64 iPhone 動態程式庫。
- Xcode 目標層建置結果：`** BUILD SUCCEEDED **`。
- 輸出格式：`Mach-O 64-bit dynamically linked shared library arm64`。
- 最低系統：iOS 15.0；支援平台：`iPhoneOS`；框架識別碼：`com.unity3d.framework`。
- `UnityFramework` 執行檔 SHA-256：`f9c8f9fe0aba0e0cf0ce3ce1764f00a13531c7905fbc93050a9792be5db3445a`。
- Swift 原生橋接分別在「含 Unity ARM64 模組」與「不含 Unity 的 iOS 模擬器替代路徑」完成型別檢查。
- Android ARM64 二維退化路徑已產生 149 MB debug APK；SHA-256：`2fb97169fbe4d2a90d3e59ee72f2ce4dd331843a44d6c2f889571b27159a9fdf`。這不代表 Android Unity 已接入。
- Unity 編輯器測試 4／4 通過；Flutter 180 項通過、3 項隔離案例略過，靜態檢查無問題；Node 型別檢查與非資料庫測試通過。
- 已套用正式 Prisma 遷移的 Neon PostgreSQL 開發資料庫上，旅程整合測試 13／13 通過，耗時 452 秒；涵蓋完成當下掛點、舊快照補建、17 筆分頁、並行選擇、人數不足、七日重訪與舊資料遷移。

## 實際發現並修正的問題

- Xcode 在 Apple Silicon 上把 Unity scheme 自動指向 Mac Catalyst；建置腳本改為直接鎖定 `UnityFramework`、`iphoneos` 與 ARM64 目標。
- Unity 的 `getInstance()` 在 Swift 介面是可空值；橋接改成安全解包。
- Swift 無法直接取得唯讀 `_mh_execute_header` 的可變址；改由 `dlopen`／`dlsym` 取得主執行檔真實 Mach-O 標頭位址。
- Unity 已啟動後再次進入庭園不可重跑初始化；橋接改為喚醒既有引擎並重新顯示 Unity 視窗。
- iPhone ARM64 程式庫不可污染模擬器；本機連結設定與嵌入階段限制為 `iphoneos`，模擬器維持無 Unity 編譯路徑。
- iOS 匯出不再每次重建已版控場景，避免相同畫面產生數百個 Unity 內部編號差異；只有美術階層變更時才獨立重建並審查。
- 資料庫整合測試原先依賴全域旅程發布順序，重跑時可能取得不同起始旅程；測試夾具改為明確指定三人起始旅程，可在非空開發資料庫重複驗證。
- 初次編譯產生約 3 GB 中間物；腳本先轉存 118 MB 可嵌入框架，再執行 Xcode clean，避免長期占用系統空間。

## 尚未宣稱完成

- 這台電腦的 Xcode 目前缺少已登錄的 iOS Device Platform；雖然 iPhoneOS SDK 可直接完成目標層編譯，Flutter 的整包 device build 仍會在目的地選擇階段被 Xcode 阻擋。
- Xcode 可列出 iPhone 14 Pro 與 iPad Air，但兩者目前皆為 `unavailable`，Flutter 沒有可安裝的 iOS 裝置；不可把裝置名稱出現當成已連線或已驗收。
- 尚未在實體 iPhone 點擊入口、確認全螢幕返回、量測首次載入、記憶體與穩定 30 幀。
- Android Unity Build Support 與 Android 原生程式庫尚未接入；Android 目前會使用 Flutter 二維生命樹。
- 六套獨立成長輪廓、正式紀念物模型與最終等級材質仍未完成。

上述缺口不以編輯器截圖、單元測試或 ARM64 框架編譯成功替代；完成後需追加實機型號、系統版本、操作錄影或截圖及量測紀錄。
