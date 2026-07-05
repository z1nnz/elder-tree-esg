import {
  deviceDesiredStateSchema,
  deviceReportedStateSchema,
} from "@elder-tree/contracts";

const apiUrl = process.env.API_URL ?? "http://localhost:4100/api/v1";
const deviceId =
  process.env.DEVICE_ID ?? "44444444-4444-4444-8444-444444444444";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-demo-user": "device-simulator",
      "x-demo-role": "PLATFORM_ADMIN",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function run() {
  const state = await request<{
    data: { desired: unknown; reported: unknown };
  }>(`/devices/${deviceId}/state`);
  const desired = deviceDesiredStateSchema.parse(state.data.desired);
  const reported = deviceReportedStateSchema.parse(state.data.reported);

  console.log("Companion tree simulator");
  console.log(`Tree: ${desired.treeStage} (${desired.growthPoints} points)`);
  console.log(`LED scene: ${desired.ledScene}, brightness ${desired.brightness}%`);
  console.log(`Message: ${desired.messagePreview ?? "No new family message"}`);
  console.log(`Sensors: ${reported.temperatureC}°C, ${reported.humidityPercent}% RH`);

  const eventKey = `simulator:${Date.now()}`;
  const event = await request<{ data: { accepted: boolean; duplicate: boolean } }>(
    `/devices/${deviceId}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        eventKey,
        eventType: "BUTTON_CONFIRM",
        occurredAt: new Date().toISOString(),
        payload: { queueDepth: 0, source: "local-simulator" },
      }),
    },
  );
  console.log(`Button event accepted: ${event.data.accepted}`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
