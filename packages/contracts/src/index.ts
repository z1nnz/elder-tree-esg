import { z } from "zod";

export const taskVerificationModes = [
  "PHOTO_AI",
  "SELF_CHECK",
  "TIMER",
  "STEP_COUNT",
  "LOCATION_CHECK_IN",
  "DEVICE_CONFIRM",
] as const;
export type TaskVerificationMode = (typeof taskVerificationModes)[number];

export const verificationDecisions = ["PASS", "REVIEW", "FAIL"] as const;
export type VerificationDecision = (typeof verificationDecisions)[number];

export const treeStages = [
  "SEED",
  "SPROUT",
  "SEEDLING",
  "YOUNG_TREE",
  "MATURE",
] as const;
export type TreeStage = (typeof treeStages)[number];

export const impactBatchStatuses = [
  "DRAFT",
  "SIMULATED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type ImpactBatchStatus = (typeof impactBatchStatuses)[number];

export const assignmentStatuses = [
  "AVAILABLE",
  "IN_PROGRESS",
  "VERIFYING",
  "COMPLETED",
  "REJECTED",
] as const;
export type AssignmentStatus = (typeof assignmentStatuses)[number];

export const ledScenes = [
  "IDLE",
  "TASK_DUE",
  "MESSAGE",
  "GROWTH",
  "MATURE",
  "OFFLINE",
  "ERROR",
] as const;
export type LedScene = (typeof ledScenes)[number];

export const deviceDesiredStateSchema = z.object({
  activeTaskId: z.string().uuid().nullable(),
  activeTaskTitle: z.string().max(80).nullable(),
  messagePreview: z.string().max(120).nullable(),
  treeStage: z.enum(treeStages),
  growthPoints: z.number().int().min(0),
  ledScene: z.enum(ledScenes),
  brightness: z.number().int().min(5).max(100),
  firmwareTarget: z.string().max(32).nullable(),
  commandId: z.string().uuid().nullable(),
  updatedAt: z.string().datetime(),
});
export type DeviceDesiredState = z.infer<typeof deviceDesiredStateSchema>;

export const deviceReportedStateSchema = z.object({
  online: z.boolean(),
  firmwareVersion: z.string().max(32),
  ambientLux: z.number().min(0).nullable(),
  temperatureC: z.number().min(-40).max(100).nullable(),
  humidityPercent: z.number().min(0).max(100).nullable(),
  presence: z.boolean().nullable(),
  lastInteractionAt: z.string().datetime().nullable(),
  acknowledgedCommandId: z.string().uuid().nullable(),
  queueDepth: z.number().int().min(0).max(100),
  updatedAt: z.string().datetime(),
});
export type DeviceReportedState = z.infer<typeof deviceReportedStateSchema>;

export const verificationResultSchema = z.object({
  decision: z.enum(verificationDecisions),
  confidence: z.number().min(0).max(1),
  labels: z.array(z.string().max(48)).max(20),
  reasonCodes: z.array(z.string().max(48)).max(10),
  explanation: z.string().max(500),
  model: z.string().max(80),
  ruleVersion: z.string().max(32),
});
export type VerificationResult = z.infer<typeof verificationResultSchema>;

export interface TaskSummary {
  id: string;
  title: string;
  description: string;
  verificationMode: TaskVerificationMode;
  growthPoints: number;
  status: AssignmentStatus;
  startedAt: string | null;
  minimumSeconds: number | null;
  dueAt: string | null;
  capability: {
    enabled: boolean;
    reason:
      | "PHOTO_STORAGE_UNAVAILABLE"
      | "PHOTO_VERIFIER_UNAVAILABLE"
      | "BLAZE_REQUIRED"
      | null;
  };
}

export interface TreeSummary {
  id: string;
  name: string;
  stage: TreeStage;
  growthPoints: number;
  nextStageAt: number | null;
  householdName: string;
}

export interface FamilyMessage {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  deliveredToDeviceAt: string | null;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  relationship: string;
}

export interface AppContext {
  displayName: string;
  activeHouseholdId: string;
  households: HouseholdSummary[];
  capabilities: {
    photoEvidence: {
      enabled: boolean;
      reason: "STORAGE_NOT_CONFIGURED" | "BLAZE_REQUIRED" | null;
    };
    geminiPhotoVerification: {
      enabled: boolean;
      reason: "VERIFIER_DISABLED" | "BLAZE_REQUIRED" | null;
    };
  };
}

export type HomeNextActionKind =
  | "COMPLETE_TASK"
  | "START_TIMER"
  | "TAKE_PHOTO"
  | "REVIEW_PHOTO"
  | "START_EXPLORATION"
  | "READ_MESSAGE"
  | "REST";

export interface HomeNextAction {
  kind: HomeNextActionKind;
  title: string;
  description: string;
  ctaLabel: string;
  taskId: string | null;
  radarMissionId: string | null;
}

export interface HomeTaskCard {
  id: string;
  title: string;
  description: string;
  verificationMode: TaskVerificationMode;
  growthPoints: number;
  status: AssignmentStatus;
  stateLabel: string;
  actionLabel: string;
  capability: TaskSummary["capability"];
}

export interface HomeAlert {
  id: string;
  kind: "REVIEW" | "MESSAGE" | "PHOTO_AI" | "RADAR" | "DEVICE";
  title: string;
  description: string;
  count: number;
}

export interface CompanionSpriteState {
  mood: "READY" | "WALKING" | "GROWING" | "WAITING" | "RESTING";
  label: string;
  energyPoints: number;
}

export interface HomeSummary {
  generatedAt: string;
  displayName: string;
  activeHouseholdName: string;
  tree: TreeSummary;
  nextAction: HomeNextAction;
  taskCards: HomeTaskCard[];
  featuredRadarMission: RadarMissionSummary | null;
  pendingReviewCount: number;
  messageCount: number;
  latestMessage: FamilyMessage | null;
  capabilities: AppContext["capabilities"];
  companionSprite: CompanionSpriteState;
  alerts: HomeAlert[];
}

export interface LineBindingSummary {
  id: string;
  householdId: string;
  householdName: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  revokedAt: string | null;
}

export interface AdminLineBindingSummary extends LineBindingSummary {
  userDisplayName: string;
  notificationCount: number;
  lastNotificationStatus: "SENT" | "FAILED" | "SKIPPED" | null;
  lastNotificationAt: string | null;
}

export interface LineBindingCodeResult {
  code: string;
  expiresAt: string;
  qrPayload: string;
  instructions: string;
}

export interface LineNotificationStatus {
  id: string;
  target: string;
  type: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  createdAt: string;
}

export interface PhotoAiOperationalStatus {
  photoEvidence: {
    enabled: boolean;
    reason: "STORAGE_NOT_CONFIGURED" | "BLAZE_REQUIRED" | null;
  };
  geminiPhotoVerification: {
    enabled: boolean;
    reason: "VERIFIER_DISABLED" | "BLAZE_REQUIRED" | null;
  };
  storageBucketConfigured: boolean;
  storageBucketName: string | null;
  aiVerifierUrlConfigured: boolean;
  aiVerifierUrl: string;
  storageRulesManagedSeparately: true;
  generalPhotoAiTasksEnabled: boolean;
  radarPhotoAiTasksEnabled: false;
  updatedAt: string;
}

export interface HouseholdInviteSummary {
  code: string;
  householdId: string;
  expiresAt: string;
}

export interface EvidenceUpload {
  id: string;
  storagePath: string;
  contentType: string;
}

export interface EvidenceDecision {
  evidenceId: string;
  decision: VerificationDecision;
  status: AssignmentStatus;
}

export interface FamilyReviewItem {
  id: string;
  evidenceId: string;
  taskTitle: string;
  participantName: string;
  imageUrl: string;
  confidence: number;
  labels: string[];
  explanation: string;
  createdAt: string;
}

export interface ImpactSummary {
  householdName: string;
  treeStage: TreeStage;
  growthPoints: number;
  nextStageAt: number | null;
  contributedPoints: number;
}

export interface CompanionDeviceSummary {
  id: string;
  serialNumber: string;
  name: string;
  claimed: boolean;
  desiredState: DeviceDesiredState;
  reportedState: DeviceReportedState;
}

export interface ExplorationQuest {
  id: string;
  taskId: string;
  sequence: number;
  locationName: string;
  category: string;
  safetyNote: string | null;
  accessibilityTags: string[];
  sourceUrl: string | null;
  title: string;
  description: string;
  verificationMode: "SELF_CHECK" | "TIMER";
  minimumSeconds: number | null;
  growthPoints: number;
  triggerType: "DISTANCE" | "GEOFENCE";
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  unlockDistanceMeters: number | null;
  unlocked: boolean;
  completed: boolean;
}

export interface ExplorationSessionSummary {
  id: string;
  routeId: string;
  status: "ACTIVE" | "ENDED" | "EXPIRED";
  distanceMeters: number;
  startedAt: string;
  lastEventAt: string | null;
}

export interface ExplorationRouteSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  badgeName: string;
  badgeAssetKey: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  completedQuestCount: number;
  totalQuestCount: number;
  badgeAwarded: boolean;
  quests: ExplorationQuest[];
}

export interface ExplorationState {
  totalDistanceMeters: number;
  coarseCell: string | null;
  activeSession: ExplorationSessionSummary | null;
  routes: ExplorationRouteSummary[];
}

export interface ExplorationEventResult extends ExplorationState {
  duplicate: boolean;
  acceptedDistanceMeters: number;
  newlyUnlockedTaskIds: string[];
}

export type RadarMissionStatus =
  | "UPCOMING"
  | "LOCKED"
  | "UNLOCKED"
  | "COMPLETED"
  | "EXPIRED";

export interface RadarMissionSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  tag: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  remainingSeconds: number;
  verificationMode: "SELF_CHECK" | "TIMER";
  minimumSeconds: number | null;
  growthPoints: number;
  badgeName: string | null;
  publicationStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  status: RadarMissionStatus;
  unlockedAt: string | null;
  completedAt: string | null;
}

export interface RadarState {
  generatedAt: string;
  missions: RadarMissionSummary[];
}

export interface RadarMissionInput {
  title: string;
  description: string;
  category: string;
  tag: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  verificationMode: "SELF_CHECK" | "TIMER";
  minimumSeconds?: number | null;
  growthPoints: number;
  badgeName?: string | null;
}

export interface RadarMissionUnlockInput {
  eventKey: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  occurredAt: string;
}

export interface ExplorationRouteInput {
  slug: string;
  name: string;
  description: string;
  badgeName: string;
  badgeAssetKey: string;
}

export interface ExplorationQuestInput {
  routeId: string;
  sequence: number;
  locationName: string;
  category: string;
  safetyNote?: string | null;
  accessibilityTags: string[];
  sourceUrl?: string | null;
  title: string;
  description: string;
  verificationMode: "SELF_CHECK" | "TIMER";
  minimumSeconds?: number | null;
  growthPoints: number;
  triggerType: "DISTANCE" | "GEOFENCE";
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  unlockDistanceMeters?: number | null;
}

export interface DashboardSnapshot {
  participantCount: number;
  completedTaskCount: number;
  pendingReviewCount: number;
  connectedDeviceCount: number;
  impactPoolPoints: number;
  simulatedTreeCount: number;
}

export interface ReviewItem {
  id: string;
  taskTitle: string;
  participantName: string;
  imageUrl: string;
  confidence: number;
  labels: string[];
  explanation: string;
  createdAt: string;
}

export interface ImpactBatchSummary {
  id: string;
  title: string;
  status: ImpactBatchStatus;
  simulated: true;
  allocatedPoints: number;
  equivalentTrees: number;
  publishedAt: string | null;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: {
    requestId?: string;
    generatedAt?: string;
  };
}
