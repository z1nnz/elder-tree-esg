# Elder Tree ESG

Elder Tree ESG is a connected companion-tree platform that turns verified daily
activities into visible tree growth, family interaction, and transparent
simulated ESG impact batches.

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

Photo evidence is intentionally locked while the project remains off Blaze.
Keep `PHOTO_EVIDENCE_ENABLED=false`; the app will show the task as unavailable
and the API will not call Storage or Gemini. When the plan changes, enable
Firebase Storage in `asia-east1`, configure a Firebase Admin service account,
and then deploy the private rules:

```sh
firebase deploy --only storage --project elder-tree-esg-z1nnz
```

Firebase currently requires the Blaze plan before a new default Storage bucket
can be created. Never commit the Admin private key or Gemini API key.

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

The city exploration seed contains the published `都市綠肺初探` route. Location
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
