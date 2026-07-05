# Infrastructure

## Local development

`docker-compose.yml` provides PostgreSQL for schema and migration work. The API
defaults to an in-memory seeded mode so it can be demonstrated without Docker.

```sh
docker compose -f infra/docker-compose.yml up -d
npm run prisma:generate -w @elder-tree/api
npm run prisma:migrate -w @elder-tree/api
```

## Cloud demo topology

1. Create a Firebase project for Authentication, Storage, FCM, and Crashlytics.
2. Create a Neon PostgreSQL project and set `DATABASE_URL`.
3. Deploy `services/api/Dockerfile` and `services/ai-verifier/Dockerfile` to
   Cloud Run in `asia-east1`.
4. Deploy `apps/admin-web/Dockerfile` to Cloud Run or Firebase App Hosting.
5. Create an AWS IoT Thing per physical tree, attach one X.509 certificate, and
   apply a device-specific copy of `aws-iot-policy.json`.
6. Add an AWS IoT Rule for `tree/+/events` that invokes the built
   `services/iot-bridge` Lambda.
7. Configure Lambda with `API_URL` and `IOT_BRIDGE_SECRET`; configure the API
   with the same secret.
8. Add billing alerts at 50%, 80%, and 100% of the monthly budget.

Never put Firebase service accounts, AWS private keys, or device certificates
inside the repository. Cloud Run should use Secret Manager; each physical
device should receive its own certificate during flashing.

## Current baseline boundary

The checked-in API runs the complete product flow through `DemoStoreService`.
The Prisma schema is production-shaped, but replacing the demo repository with
a Neon-backed repository and Cloud Tasks enqueueing requires live project
credentials and is intentionally left as the first cloud integration task.
