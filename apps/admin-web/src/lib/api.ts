import type {
  AdminLineBindingSummary,
  ApiEnvelope,
  CompanionPromptSummary,
  DashboardSnapshot,
  ExplorationQuestInput,
  RadarMissionInput,
  RadarMissionSummary,
  ExplorationRouteInput,
  ExplorationRouteSummary,
  ImpactBatchSummary,
  LineOperationalStatus,
  PhotoAiOperationalStatus,
  ReviewItem,
  LineNotificationStatus,
  PartnerCampaignInput,
  PartnerCampaignSummary,
  PartnerOrganizationSummary,
  PartnerWorkspaceSummary,
  WorkspaceAccessSummary,
  VenueCodeSummary,
  VenueMetricsSummary,
  VenueRedemptionResult,
} from "@elder-tree/contracts";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api/v1";

let accessToken: string | null = null;

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

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
    const body: unknown = await response.json().catch(() => null);
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "Request failed";
    throw new ApiRequestError(response.status, message);
  }
  return ((await response.json()) as ApiEnvelope<T>).data;
}

export const api = {
  setAccessToken: (token: string | null) => {
    accessToken = token;
  },
  dashboard: () => request<DashboardSnapshot>("/admin/dashboard"),
  workspaceAccess: () =>
    request<WorkspaceAccessSummary>("/me/workspace-access"),
  partnerOrganizations: () =>
    request<PartnerOrganizationSummary[]>("/partners/organizations"),
  partnerWorkspace: (organizationId: string) =>
    request<PartnerWorkspaceSummary>(
      `/partners/organizations/${organizationId}/workspace`,
    ),
  venueCode: (organizationId: string, campaignId: string) =>
    request<VenueCodeSummary>(
      `/partners/organizations/${organizationId}/campaigns/${campaignId}/venue-code`,
      { method: "POST", body: "{}", signal: AbortSignal.timeout(10_000) },
    ),
  venueMetrics: (organizationId: string, campaignId: string) =>
    request<VenueMetricsSummary>(
      `/partners/organizations/${organizationId}/campaigns/${campaignId}/venue-metrics`,
      { signal: AbortSignal.timeout(10_000) },
    ),
  redeemVenueOffer: (
    organizationId: string,
    campaignId: string,
    code: string,
  ) =>
    request<VenueRedemptionResult>(
      `/partners/organizations/${organizationId}/campaigns/${campaignId}/redeem`,
      {
        method: "POST",
        body: JSON.stringify({ code }),
        signal: AbortSignal.timeout(10_000),
      },
    ),
  createPartnerCampaign: (
    organizationId: string,
    input: PartnerCampaignInput,
  ) =>
    request<PartnerCampaignSummary>(
      `/partners/organizations/${organizationId}/campaigns`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  updatePartnerCampaign: (
    organizationId: string,
    campaignId: string,
    input: PartnerCampaignInput,
  ) =>
    request<PartnerCampaignSummary>(
      `/partners/organizations/${organizationId}/campaigns/${campaignId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  submitPartnerCampaign: (organizationId: string, campaignId: string) =>
    request<PartnerCampaignSummary>(
      `/partners/organizations/${organizationId}/campaigns/${campaignId}/submit`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  adminPartnerCampaigns: () =>
    request<PartnerCampaignSummary[]>("/admin/partner-campaigns"),
  approvePartnerCampaign: (campaignId: string, reviewNote: string) =>
    request<PartnerCampaignSummary>(
      `/admin/partner-campaigns/${campaignId}/approve`,
      { method: "POST", body: JSON.stringify({ reviewNote }) },
    ),
  rejectPartnerCampaign: (campaignId: string, reviewNote: string) =>
    request<PartnerCampaignSummary>(
      `/admin/partner-campaigns/${campaignId}/reject`,
      { method: "POST", body: JSON.stringify({ reviewNote }) },
    ),
  photoAiStatus: () =>
    request<PhotoAiOperationalStatus>("/admin/photo-ai/status"),
  lineBindings: () =>
    request<AdminLineBindingSummary[]>("/admin/line/bindings"),
  lineStatus: () => request<LineOperationalStatus>("/admin/line/status"),
  testLinePush: (lineBindingId: string, message?: string) =>
    request<LineNotificationStatus>("/admin/line/test-push", {
      method: "POST",
      body: JSON.stringify({ lineBindingId, message }),
    }),
  reviews: () => request<ReviewItem[]>("/admin/reviews"),
  radarMissions: () =>
    request<RadarMissionSummary[]>("/admin/exploration/radar-missions"),
  companionPrompts: () =>
    request<CompanionPromptSummary[]>("/admin/companion-prompts/recent"),
  createRadarMission: (input: RadarMissionInput) =>
    request<RadarMissionSummary>("/admin/exploration/radar-missions", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateRadarMission: (id: string, input: RadarMissionInput) =>
    request<RadarMissionSummary>(`/admin/exploration/radar-missions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  publishRadarMission: (id: string) =>
    request<RadarMissionSummary>(
      `/admin/exploration/radar-missions/${id}/publish`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  archiveRadarMission: (id: string) =>
    request<RadarMissionSummary>(
      `/admin/exploration/radar-missions/${id}/archive`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  explorationRoutes: () =>
    request<ExplorationRouteSummary[]>("/admin/exploration/routes"),
  createExplorationRoute: (input: ExplorationRouteInput) =>
    request<ExplorationRouteSummary>("/admin/exploration/routes", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateExplorationRoute: (id: string, input: Partial<ExplorationRouteInput>) =>
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
