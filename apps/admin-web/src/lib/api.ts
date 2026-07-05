import type {
  ApiEnvelope,
  DashboardSnapshot,
  ImpactBatchSummary,
  ReviewItem,
} from "@elder-tree/contracts";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-demo-user": "demo-admin",
      "x-demo-role": "ORG_ADMIN",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return ((await response.json()) as ApiEnvelope<T>).data;
}

export const api = {
  dashboard: () => request<DashboardSnapshot>("/admin/dashboard"),
  reviews: () => request<ReviewItem[]>("/admin/reviews"),
  impactBatches: () => request<ImpactBatchSummary[]>("/impact-batches"),
  devices: () =>
    request<
      Array<{
        id: string;
        serialNumber: string;
        name: string;
        claimed: boolean;
        desiredState: {
          treeStage: string;
          ledScene: string;
          growthPoints: number;
        };
        reportedState: {
          online: boolean;
          firmwareVersion: string;
          temperatureC: number | null;
          humidityPercent: number | null;
          ambientLux: number | null;
          presence: boolean | null;
          updatedAt: string;
        };
      }>
    >("/devices"),
  decideReview: (id: string, decision: "PASS" | "FAIL") =>
    request<ReviewItem>(`/admin/reviews/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({
        decision,
        note: `Reviewed from operations dashboard: ${decision}`,
      }),
    }),
  createBatch: (title: string, allocatedPoints: number) =>
    request<ImpactBatchSummary>("/impact-batches", {
      method: "POST",
      body: JSON.stringify({ title, allocatedPoints, simulated: true }),
    }),
  publishBatch: (id: string) =>
    request<ImpactBatchSummary>(`/impact-batches/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
