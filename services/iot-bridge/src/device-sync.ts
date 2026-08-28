import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import {
  deviceSyncEventSchema,
  deviceSyncReplySchema,
} from "@elder-tree/contracts";
import type { Handler } from "aws-lambda";

type Publish = (topic: string, body: string) => Promise<void>;
const thingPattern = /^[A-Za-z0-9:_-]{1,128}$/;

// The IoT rule selects both names from connection/topic metadata, NOT from JSON.
// The Lambda invocation policy must restrict callers to that exact IoT rule.
export function createDeviceSyncHandler(options: {
  apiUrl: string;
  secret: string;
  fetch: typeof fetch;
  publish: Publish;
}) {
  const base = new URL(options.apiUrl);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(base.hostname) &&
        process.env.NODE_ENV !== "production"
      ))
  ) {
    throw new Error(
      "Device bridge requires HTTPS (local tests may use loopback HTTP)",
    );
  }
  if (options.secret.length < 32)
    throw new Error("Device bridge secret must contain at least 32 characters");
  return async (input: unknown) => {
    if (!input || typeof input !== "object")
      throw new Error("Invalid device gateway input");
    const message = input as Record<string, unknown>;
    const thingName = message.authenticatedThingName;
    if (
      typeof thingName !== "string" ||
      !thingPattern.test(thingName) ||
      thingName !== message.topicThingName
    ) {
      throw new Error("Device topic does not match authenticated connection");
    }
    const event = deviceSyncEventSchema.parse(message.event);
    const url = new URL(base);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/device-sync/${encodeURIComponent(thingName)}/events`;
    const response = await options.fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "content-type": "application/json",
        "x-iot-bridge-secret": options.secret,
      },
      body: JSON.stringify(event),
    });
    if (!response.ok)
      throw new Error(`Device API rejected event (${response.status})`);
    const envelope = (await response.json()) as { data?: unknown };
    const reply = deviceSyncReplySchema.parse(envelope.data);
    if (reply.eventKey !== event.eventKey)
      throw new Error("Device API replied to a different event");
    // Never acknowledge MQTT delivery before the API has committed the event.
    // A publish failure must retry the same event; the API deduplicates it.
    await options.publish(
      `tree/${thingName}/sync/reply`,
      JSON.stringify(reply),
    );
    return { accepted: true, duplicate: reply.duplicate };
  };
}

export const syncHandler: Handler<unknown> = async (input) => {
  const { API_URL, IOT_BRIDGE_SECRET, AWS_IOT_ENDPOINT, AWS_REGION } =
    process.env;
  if (!API_URL || !IOT_BRIDGE_SECRET || !AWS_IOT_ENDPOINT)
    throw new Error("Device bridge environment is incomplete");
  const client = new IoTDataPlaneClient({
    endpoint: AWS_IOT_ENDPOINT.startsWith("https://")
      ? AWS_IOT_ENDPOINT
      : `https://${AWS_IOT_ENDPOINT}`,
    region: AWS_REGION ?? "ap-northeast-1",
  });
  try {
    return await createDeviceSyncHandler({
      apiUrl: API_URL,
      secret: IOT_BRIDGE_SECRET,
      fetch,
      publish: async (topic, body) => {
        await client.send(
          new PublishCommand({
            topic,
            qos: 1,
            retain: false,
            payload: Buffer.from(body),
          }),
        );
      },
    })(input);
  } finally {
    client.destroy();
  }
};
