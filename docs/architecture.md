# 系統架構

## 架構目標

系統以長者與家庭的日常互動為第一場景，同時提供企業與社區管理端。
手機、硬體、AI 與 ESG 資料各自有清楚邊界，不讓任何一端直接修改成長
帳本或公益批次。

```mermaid
flowchart LR
    Elder["長者／一般使用者"] --> App["Flutter App"]
    Family["家庭成員"] --> App
    Operator["企業／社區人員"] --> Web["Next.js 營運後台"]

    App -->|"Firebase ID Token + REST"| API["NestJS API"]
    Web -->|"Firebase ID Token + REST"| API
    App -->|"Signed upload"| Storage["Firebase Storage"]
    API --> DB["Neon PostgreSQL"]
    API --> Queue["Cloud Tasks"]
    Queue --> AI["FastAPI AI Verifier"]
    AI --> Storage

    Tree["ESP32-S3 陪伴樹"] <-->|"MQTT/TLS"| IoT["AWS IoT Core + Shadow"]
    IoT --> Lambda["IoT Bridge Lambda"]
    Lambda --> API
    API -->|"AWS SDK desired state"| IoT
    API --> FCM["Firebase Cloud Messaging"]
    FCM --> App
```

## 端到端任務流程

```mermaid
sequenceDiagram
    participant U as 使用者
    participant A as Flutter App
    participant S as NestJS API
    participant V as AI Verifier
    participant R as 人工覆核
    participant D as Device Shadow
    participant T as 陪伴互動樹

    U->>A: 拍攝任務照片
    A->>S: POST /evidence
    S-->>A: 上傳位置與 evidenceId
    A->>S: POST /evidence/:id/complete
    S->>V: 非同步驗證
    V-->>S: PASS / REVIEW / FAIL
    alt PASS
        S->>S: 寫入冪等成長帳本
    else REVIEW
        R->>S: 人工通過或駁回
    end
    S->>D: 更新 treeStage、growthPoints、LED scene
    D-->>T: MQTT delta
    T-->>D: reported + command acknowledgement
```

## 信任邊界

- App 與 Web 不直接連 PostgreSQL，也不能直接增加成長值。
- 成長值只能由完成任務或人工覆核的冪等帳本事件產生。
- ESP32 只可存取自己的 MQTT client、Shadow 與事件 topic。
- 照片上傳後移除 EXIF；AI 不做人臉辨識或敏感屬性推論。
- 公益批次第一版必須 `simulated=true`，公開頁永久顯示模擬標記。
- 裝置沒有相機與麥克風，只回傳按鍵、連線與環境感測資訊。

## 離線策略

- Flutter App 在 API 無法連線時進入清楚標示的示範模式。
- ESP32 以 LittleFS 保存最多 100 筆事件；重連後依序重播。
- 每筆事件包含穩定 `eventKey`，API 重複收到時只確認、不重複計分。
- Device Shadow 保存 desired/reported state，版本較舊的 delta 會被忽略。
