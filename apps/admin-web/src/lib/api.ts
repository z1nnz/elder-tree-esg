import type {
  ApiEnvelope,
  DashboardSnapshot,
  ExplorationQuestInput,
  ExplorationRouteInput,
  ExplorationRouteSummary,
  ImpactBatchSummary,
  ReviewItem,
} from "@elder-tree/contracts";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api/v1";

let accessToken: string | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return ((await response.json()) as ApiEnvelope<T>).data;
}

export const api = {
  setAccessToken: (token: string | null) => {
    accessToken = token;
  },
  dashboard: () => request<DashboardSnapshot>("/admin/dashboard"),
  reviews: () => request<ReviewItem[]>("/admin/reviews"),
  explorationRoutes: () =>
    request<ExplorationRouteSummary[]>("/admin/exploration/routes"),
  createExplorationRoute: (input: ExplorationRouteInput) =>
    request<ExplorationRouteSummary>("/admin/exploration/routes", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateExplorationRoute: (
    id: string,
    input: Partial<ExplorationRouteInput>,
  ) =>
    request<ExplorationRouteSummary>(`/admin/exploration/routes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  createExplorationQuest: (input: ExplorationQuestInput) =>
    request<ExplorationRouteSummary[]>("/admin/exploration/quests", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateExplorationQuest: (id: string, input: ExplorationQuestInput) =>
    request<ExplorationRouteSummary[]>(`/admin/exploration/quests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  reorderExplorationQuests: (routeId: string, questIds: string[]) =>
    request<ExplorationRouteSummary[]>(
      `/admin/exploration/routes/${routeId}/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ questIds }),
      },
    ),
  publishExplorationRoute: (id: string) =>
    request<ExplorationRouteSummary>(
      `/admin/exploration/routes/${id}/publish`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  duplicateExplorationRoute: (id: string) =>
    request<ExplorationRouteSummary>(
      `/admin/exploration/routes/${id}/duplicate`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  archiveExplorationRoute: (id: string) =>
    request<ExplorationRouteSummary>(
      `/admin/exploration/routes/${id}/archive`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  simulateExplorationStep: (routeId: string, step: number) =>
    request(`/admin/exploration/simulations/${routeId}/steps/${step}`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
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
