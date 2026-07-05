const baseUrl = process.env.API_URL ?? "http://localhost:4100/api/v1";

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-demo-user": "e2e-demo",
      "x-demo-role": "PLATFORM_ADMIN",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body.data;
}

const health = await request("/health");
const beforeTree = await request("/tree");
const task = await request(
  "/tasks/22222222-2222-4222-8222-222222222222/complete",
  {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: "e2e-water-task" }),
  },
);
await request(
  "/tasks/22222222-2222-4222-8222-222222222222/complete",
  {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: "e2e-water-task" }),
  },
);
const afterTree = await request("/tree");
const message = await request("/family/messages", {
  method: "POST",
  body: JSON.stringify({ body: "端到端測試：今晚一起看看天空。" }),
});
const device = await request(
  "/devices/44444444-4444-4444-8444-444444444444/state",
);
const batch = await request("/impact-batches", {
  method: "POST",
  body: JSON.stringify({
    title: "端到端驗證模擬批次",
    allocatedPoints: 1000,
    simulated: true,
  }),
});

if (health.status !== "ok") throw new Error("Health check failed");
if (task.status !== "COMPLETED") throw new Error("Task did not complete");
if (afterTree.growthPoints !== beforeTree.growthPoints + 30) {
  throw new Error("Idempotent growth award failed");
}
if (device.desired.messagePreview !== message.body) {
  throw new Error("Family message did not reach desired device state");
}
if (batch.simulated !== true) throw new Error("Impact batch was not simulated");

console.log(
  JSON.stringify(
    {
      health: health.status,
      growth: `${beforeTree.growthPoints} -> ${afterTree.growthPoints}`,
      messageDelivered: message.deliveredToDeviceAt !== null,
      deviceScene: device.desired.ledScene,
      batch: `${batch.status} / simulated=${batch.simulated}`,
    },
    null,
    2,
  ),
);
