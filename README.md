# 樹伴

樹伴是一個以「樹伴圈」為群體單位的真實世界共行旅程平台，也是「同行成林計畫」的主要 App。樹伴成員透過分級行動見證留下真實足跡，共同培養樹伴生命樹；在資金、種植名額與合作責任都確認後，再連結真實生命樹與世界共生林。

> 讓每一次真實行動，長成我們共同留下的森林。

家庭與高齡陪伴仍是第一個重要場景，但產品核心不限制為家庭，也不把一般任務點數直接宣稱為真實植樹成果。中文共同語言見 [`CONTEXT.md`](CONTEXT.md)，多人玩法範圍見 [`docs/product/circle-cooperative-action-mvp.md`](docs/product/circle-cooperative-action-mvp.md)，共同開發方式見 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

產品定位與品牌使用見 [`docs/brand-guidelines.md`](docs/brand-guidelines.md)，加速交付計畫見 [`docs/roadmap/tongxing-chenglin-delivery-plan.md`](docs/roadmap/tongxing-chenglin-delivery-plan.md)，專案責任與可核驗貢獻方式見 [`PROJECT_LEADERSHIP.md`](PROJECT_LEADERSHIP.md)。

手機與網頁設計使用共用的[介面工藝庫](docs/design/skill-library.md)：包含已審查的開源技能、固定版本與授權，以及樹伴的大字、互動和真實畫面驗收方式。

## Repository layout

- `apps/mobile`: Flutter app for participants, elders, and family members.
- `apps/public-web`: GSAP-powered public storytelling and participation site.
- `apps/admin-web`: Next.js operations dashboard.
- `services/api`: NestJS REST API and Prisma data model.
- `services/ai-verifier`: FastAPI image verification service.
- `services/iot-bridge`: AWS IoT event bridge.
- `services/device-simulator`: local companion-tree simulator.
- `firmware/companion-tree`: ESP32-S3 PlatformIO firmware.
- `packages/contracts`: shared API and device-state contracts.
- `infra`: local infrastructure and deployment examples.
- `docs`: product, architecture, hardware, and project-book documents.

## Local quick start

```sh
cp .env.example .env
npm install
npm run dev:api
```

In another terminal:

```sh
npm run dev:web
```

Firebase Authentication on macOS stores session state in Keychain. Build the
local macOS App with an Apple Development certificate so the checked-in
Keychain Sharing entitlement is preserved:

```sh
npm run build:macos:auth
```

The public site is a separate application:

```sh
npm run dev:public
```

The checked-in example uses `DEMO_MODE=false`, so App and dashboard data are
persisted in PostgreSQL. The legacy seeded mode is available only when
`DEMO_MODE=true` is set explicitly in a non-production environment.

### Firebase login and Neon persistence

The production-like development path uses Firebase Authentication and the
PostgreSQL database linked in `.neon`.

```sh
firebase deploy --only auth
npm run dev:api:neon
```

For photo verification, run the private verifier on its own port:

```sh
cd services/ai-verifier
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ../..
npm run dev:ai
```

Photo evidence is available for local Blaze validation. Start the AI verifier,
set `GEMINI_API_KEY` in that verifier process, and keep
`PHOTO_EVIDENCE_ENABLED=true` plus `PHOTO_VERIFICATION_ENABLED=true` when
running `npm run dev:api:neon`. The app uploads sanitized private evidence to
Firebase Storage; the API creates a short-lived signed URL for the verifier.
Deploy the private rules before testing on a real account. The project currently
uses `elder-tree-esg-z1nnz.firebasestorage.app` as the Storage bucket:

```sh
firebase deploy --only storage --project elder-tree-esg-z1nnz
```

If the deploy command says Storage has not been set up, open the Firebase
Console Storage page for `elder-tree-esg-z1nnz`, click **Get Started**, choose
the intended region, and then run the deploy command again.

Never commit the Admin private key or Gemini API key. If `GEMINI_API_KEY` is not
set, the verifier stays in rules-only mode and photo tasks will not auto-pass.
See the operational runbooks for step-by-step validation:

- [Admin login and role grant](docs/operations/admin-login.md)
- [App V2 validation](docs/operations/app-v2-validation.md)
- [Photo AI validation](docs/operations/photo-ai-validation.md)
- [Device and demo testing checklist](docs/operations/device-testing-checklist.md)

Run the Flutter app in another terminal:

```sh
cd apps/mobile
flutter run -d macos \
  --dart-define=API_URL=http://127.0.0.1:4100/api/v1 \
  --dart-define=MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
```

The first account created in the app is provisioned with a household, three
starter task assignments, and a companion tree. Task completion is recorded in
`GrowthEntry` with a canonical assignment idempotency key, so retries and API
restarts cannot award the same growth twice.

To verify the persistence contract against Neon:

```sh
npm run test:persistence
```

Grant an existing Firebase user access to the operations dashboard:

```sh
export DATABASE_URL="postgresql://..."
npm run admin:grant -- FIREBASE_UID
```

The city exploration seed contains the published `都市綠肺初探` route plus
Taipei city-center radar missions for the MVP mission radar. Location
simulation is accepted only outside production when
`LOCATION_SIMULATION_ENABLED=true`; production ignores demo-role headers and
rejects simulation endpoints.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

See `docs/product-strategy.md`, `docs/architecture.md`, and `docs/hardware.md`
for the product principles, production topology, and physical prototype
specification.
