import {
  IoTDataPlaneClient,
  UpdateThingShadowCommand,
} from "@aws-sdk/client-iot-data-plane";
import {
  deviceDesiredStateSchema,
  type DeviceDesiredState,
} from "@elder-tree/contracts";

export async function updateDesiredState(
  thingName: string,
  desiredState: DeviceDesiredState,
): Promise<void> {
  const endpoint = process.env.AWS_IOT_ENDPOINT;
  if (!endpoint) throw new Error("AWS_IOT_ENDPOINT is not configured");
  const state = deviceDesiredStateSchema.parse(desiredState);
  const client = new IoTDataPlaneClient({
    endpoint: endpoint.startsWith("https://") ? endpoint : `https://${endpoint}`,
    region: process.env.AWS_REGION ?? "ap-northeast-1",
  });
  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      shadowName: "companion",
      payload: Buffer.from(JSON.stringify({ state: { desired: state } })),
    }),
  );
}
