# Elder Tree ESG

Elder Tree ESG is a connected companion-tree platform that turns verified daily
activities into visible tree growth, family interaction, and transparent
simulated ESG impact batches.

## Repository layout

- `apps/mobile`: Flutter app for participants, elders, and family members.
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

The API runs in seeded in-memory demo mode when `DEMO_MODE=true`, so PostgreSQL,
Firebase, AWS, and Gemini credentials are not required for the first launch.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

See `docs/architecture.md` and `docs/hardware.md` for the production topology
and physical prototype specification.
