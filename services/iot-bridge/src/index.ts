import type { Handler } from "aws-lambda";

export interface IoTDeviceEvent {
  deviceId: string;
  eventKey: string;
  eventType: "BUTTON_TASK" | "BUTTON_FAMILY" | "BUTTON_CONFIRM" | "STATE";
  occurredAt: string;
  payload?: Record<string, unknown>;
}

export interface BridgeResponse {
  statusCode: number;
  duplicate?: boolean;
}

export function parseDeviceEvent(input: unknown): IoTDeviceEvent {
  if (!input || typeof input !== "object") {
    throw new Error("IoT event must be an object");
  }
  const event = input as Record<string, unknown>;
  const allowedTypes = new Set([
    "BUTTON_TASK",
    "BUTTON_FAMILY",
    "BUTTON_CONFIRM",
    "STATE",
  ]);
  if (
    typeof event.deviceId !== "string" ||
    typeof event.eventKey !== "string" ||
    typeof event.eventType !== "string" ||
    !allowedTypes.has(event.eventType) ||
    typeof event.occurredAt !== "string"
  ) {
    throw new Error("IoT event is missing required fields");
  }
  return {
    deviceId: event.deviceId,
    eventKey: event.eventKey,
    eventType: event.eventType as IoTDeviceEvent["eventType"],
    occurredAt: event.occurredAt,
    payload:
      event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : undefined,
  };
}

export const handler: Handler<IoTDeviceEvent, BridgeResponse> = async (input) => {
  const event = parseDeviceEvent(input);
  const apiUrl = process.env.API_URL;
  const secret = process.env.IOT_BRIDGE_SECRET;
  if (!apiUrl || !secret) {
    throw new Error("API_URL and IOT_BRIDGE_SECRET must be configured");
  }

  const response = await fetch(
    `${apiUrl.replace(/\/$/, "")}/devices/${encodeURIComponent(event.deviceId)}/events`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-iot-bridge-secret": secret,
        "x-demo-role": "PLATFORM_ADMIN",
      },
      body: JSON.stringify({
        eventKey: event.eventKey,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        payload: event.payload ?? {},
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`API rejected IoT event with status ${response.status}`);
  }
  const body = (await response.json()) as {
    data?: { duplicate?: boolean };
  };
  return {
    statusCode: response.status,
    duplicate: body.data?.duplicate,
  };
};
