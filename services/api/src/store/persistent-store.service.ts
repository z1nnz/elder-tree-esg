import type {
  AppContext,
  AdminLineBindingSummary,
  CircleOverview,
  CompanionPromptSummary,
  CompanionDeviceSummary,
  DashboardSnapshot,
  DeviceDesiredState,
  DeviceReportedState,
  EvidenceDecision,
  EvidenceUpload,
  ExplorationEventResult,
  ExplorationQuestInput,
  ExplorationRouteInput,
  ExplorationRouteSummary,
  ExplorationState,
  FamilyMessage,
  FamilyReviewItem,
  HomeAlert,
  HomeNextAction,
  HomeSummary,
  HomeTaskCard,
  HouseholdInviteSummary,
  ImpactSummary,
  LineBindingCodeResult,
  LineBindingSummary,
  LineNotificationStatus,
  LineOperationalStatus,
  PartnerCampaignInput,
  PartnerCampaignSummary,
  PartnerOrganizationSummary,
  PartnerWorkspaceSummary,
  RadarMissionInput,
  RadarMissionSummary,
  RadarMissionStatus,
  RadarState,
  ReviewItem,
  TaskSummary,
  TreeSummary,
  VerificationResult,
  WorkspaceAccessSummary,
} from "@elder-tree/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssignmentStatus,
  EvidenceStatus,
  Prisma,
  QuestTriggerType,
  TreeStage as PrismaTreeStage,
  UserRole,
  VerificationDecision as PrismaVerificationDecision,
  VerificationMode,
} from "@prisma/client";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { latLngToCell } from "h3-js";
import { PrismaService } from "../database/prisma.service";
import { EvidenceStorageService } from "../evidence/evidence-storage.service";
import { PhotoVerifierService } from "../evidence/photo-verifier.service";
import { LineMessagingService } from "../line/line-messaging.service";
import { ClockService } from "../time/clock.service";
import { nextStageAt, stageForPoints } from "./tree-growth";

const TASK_SEEDS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "拍下今天的一抹綠",
    description: "找一株植物，拍下讓你停下來多看一眼的地方。",
    verificationMode: VerificationMode.PHOTO_AI,
    verificationRule: {
      subject: "plant",
      requiredLabels: ["plant", "flower", "tree", "grass", "leaf"],
      matchAnyRequired: true,
      minimumConfidence: 0.75,
    },
    growthPoints: 80,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    title: "拍下今天的水杯",
    description: "讓水杯或水瓶清楚入鏡，提醒自己慢慢補水。",
    verificationMode: VerificationMode.PHOTO_AI,
    verificationRule: {
      subject: "hydration",
      requiredLabels: ["water bottle", "bottle", "cup", "glass", "drink"],
      matchAnyRequired: true,
      minimumConfidence: 0.7,
    },
    growthPoints: 35,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "慢慢喝一杯水",
    description: "為自己倒杯水，坐下來慢慢喝完。",
    verificationMode: VerificationMode.SELF_CHECK,
    verificationRule: { confirmationRequired: true },
    growthPoints: 30,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "十分鐘散步",
    description: "在住家附近走一小段，累了隨時可以休息。",
    verificationMode: VerificationMode.TIMER,
    verificationRule: { minimumSeconds: 600 },
    growthPoints: 60,
  },
] as const;

const COOPERATIVE_ACTION_SEED = {
  id: "66666666-6666-4666-8666-666666666666",
  slug: "spring-returns-to-life-tree",
  title: "讓春天回到生命樹",
  description: "三位樹伴輪流找回陽光、水與新芽，完成後一起留下春日紀念枝。",
  minimumContributors: 3,
  maxChaptersPerMember: 1,
  growthPoints: 120,
  keepsakeName: "春日紀念枝",
  chapters: [
    {
      taskId: "66666666-6666-4666-8666-000000000001",
      alternativeTaskId: "66666666-6666-4666-8666-000000001001",
      sequence: 1,
      title: "找回陽光",
      description: "到附近安全的戶外空間走一小段，感受今天的光。",
      alternativeTitle: "在窗邊找一束光",
      alternativeDescription:
        "不方便外出時，在安全的窗邊坐一會兒，感受今天的光。",
      elementName: "陽光",
    },
    {
      taskId: "66666666-6666-4666-8666-000000000002",
      alternativeTaskId: "66666666-6666-4666-8666-000000001002",
      sequence: 2,
      title: "喚醒水流",
      description: "跟著畫面完成三分鐘舒緩伸展或慢呼吸。",
      alternativeTitle: "坐著完成慢呼吸",
      alternativeDescription: "不方便伸展時，坐穩後跟著畫面完成三分鐘慢呼吸。",
      elementName: "水",
    },
    {
      taskId: "66666666-6666-4666-8666-000000000003",
      alternativeTaskId: "66666666-6666-4666-8666-000000001003",
      sequence: 3,
      title: "迎接新芽",
      description: "到戶外找到一株讓你喜歡的植物，停下來看看它。",
      alternativeTitle: "在室內找一片綠",
      alternativeDescription:
        "不方便外出時，在室內找一株植物或從窗邊觀察一片綠。",
      elementName: "新芽",
    },
  ],
} as const;

const COOPERATIVE_CLAIM_DURATION_MS = 30 * 60 * 1000;

type AssignmentWithTask = Prisma.TaskAssignmentGetPayload<{
  include: { task: true };
}>;

type RouteWithTasks = Prisma.ExplorationRouteGetPayload<{
  include: { quests: { include: { task: true } } };
}>;

type RadarMissionWithProgress = Prisma.RadarMissionGetPayload<{
  include: { progress: true };
}>;

type PartnerCampaignRecord = Prisma.CampaignGetPayload<{
  include: {
    organization: true;
    reaches: { select: { userId: true } };
    radarMission: {
      include: { progress: { select: { userId: true; completedAt: true } } };
    };
  };
}>;

type PartnerCampaignValidationInput = Omit<
  PartnerCampaignInput,
  "purchaseRequired"
> & {
  purchaseRequired: boolean;
};

interface RadarMissionPromptSource {
  title: string;
  category: string;
  tag: string;
  growthPoints: number;
  companionElderMessageTemplate: string | null;
  companionReplyTemplate: string | null;
  companionVolunteerNoteTemplate: string | null;
  companionShareSummaryTemplate: string | null;
}

const DEFAULT_COMPANION_PROMPT_TEMPLATES = {
  elderMessage:
    "你完成了「{title}」，生命樹長出新葉 +{growthPoints}。今天有把自己帶回生活裡，這件事很好。",
  companionReply:
    "可以回覆：『看到你完成「{title}」了，今天有做一件照顧自己的事，很棒。』",
  volunteerNote:
    "先肯定已完成的具體行動；若要延伸，只邀請下一次一起走安全路線，不做情緒判斷。",
  shareSummary: "完成「{title}」，生命樹長出新葉 +{growthPoints}。",
} as const;

interface GeminiPhotoTaskInput {
  imageBase64: string;
  contentType: string;
  idempotencyKey?: string;
}

function photoCapabilityStatus() {
  const evidenceRequested = process.env.PHOTO_EVIDENCE_ENABLED === "true";
  const storageConfigured = Boolean(process.env.FIREBASE_STORAGE_BUCKET);
  const verifierRequested = process.env.PHOTO_VERIFICATION_ENABLED === "true";
  const photoEvidenceEnabled = evidenceRequested && storageConfigured;
  const geminiPhotoVerificationEnabled =
    photoEvidenceEnabled && verifierRequested;
  return {
    photoEvidence: {
      enabled: photoEvidenceEnabled,
      reason: photoEvidenceEnabled
        ? null
        : evidenceRequested
          ? "STORAGE_NOT_CONFIGURED"
          : "BLAZE_REQUIRED",
    },
    geminiPhotoVerification: {
      enabled: geminiPhotoVerificationEnabled,
      reason: geminiPhotoVerificationEnabled
        ? null
        : evidenceRequested
          ? "VERIFIER_DISABLED"
          : "BLAZE_REQUIRED",
    },
    taskCapability: {
      enabled: geminiPhotoVerificationEnabled,
      reason: geminiPhotoVerificationEnabled
        ? null
        : !evidenceRequested
          ? "BLAZE_REQUIRED"
          : !storageConfigured
            ? "PHOTO_STORAGE_UNAVAILABLE"
            : "PHOTO_VERIFIER_UNAVAILABLE",
    },
  } as const;
}

function fillPromptTemplate(
  template: string | null | undefined,
  fallback: string,
  replacements: Record<string, string>,
): string {
  const source = template?.trim() || fallback;
  return source.replace(/\{(title|tag|category|growthPoints)\}/g, (_, key) => {
    return replacements[key] ?? "";
  });
}

function photoAiOperationalStatus() {
  const capability = photoCapabilityStatus();
  const aiVerifierUrl = process.env.AI_VERIFIER_URL ?? "http://127.0.0.1:4400";
  return {
    photoEvidence: capability.photoEvidence,
    geminiPhotoVerification: capability.geminiPhotoVerification,
    storageBucketConfigured: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
    storageBucketName: process.env.FIREBASE_STORAGE_BUCKET ?? null,
    aiVerifierUrlConfigured: Boolean(process.env.AI_VERIFIER_URL),
    aiVerifierUrl,
    storageRulesManagedSeparately: true,
    generalPhotoAiTasksEnabled: capability.taskCapability.enabled,
    radarPhotoAiTasksEnabled: false,
    updatedAt: new Date().toISOString(),
  };
}

function taskStateLabel(task: TaskSummary) {
  if (task.status === "COMPLETED") return "已完成";
  if (task.status === "VERIFYING") return "等待覆核";
  if (task.status === "REJECTED") return "可重新拍攝";
  if (task.status === "IN_PROGRESS") return "進行中";
  if (!task.capability.enabled) return "暫時不可用";
  return "可開始";
}

function taskActionLabel(task: TaskSummary) {
  if (task.status === "COMPLETED") return "已完成";
  if (task.status === "VERIFYING") return "等待確認";
  if (task.status === "REJECTED") return "重新拍攝";
  if (!task.capability.enabled) return "暫不可用";
  if (task.verificationMode === "PHOTO_AI") return "拍照驗證";
  if (task.verificationMode === "TIMER") {
    return task.status === "IN_PROGRESS" ? "查看計時" : "開始計時";
  }
  if (task.verificationMode === "SELF_CHECK") return "我完成了";
  return "尚未開放";
}

function taskPriority(task: TaskSummary) {
  if (task.status === "IN_PROGRESS") return 0;
  if (task.status === "REJECTED") return 1;
  if (task.status === "AVAILABLE" && task.capability.enabled) return 2;
  if (task.status === "VERIFYING") return 3;
  if (task.status === "AVAILABLE") return 4;
  if (task.status === "COMPLETED") return 9;
  return 8;
}

function toHomeTaskCard(task: TaskSummary): HomeTaskCard {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    verificationMode: task.verificationMode,
    growthPoints: task.growthPoints,
    status: task.status,
    stateLabel: taskStateLabel(task),
    actionLabel: taskActionLabel(task),
    capability: task.capability,
  };
}

function selectFeaturedRadarMission(
  missions: RadarMissionSummary[],
): RadarMissionSummary | null {
  const priority = (mission: RadarMissionSummary) => {
    if (mission.status === "UNLOCKED") return 0;
    if (mission.status === "LOCKED") return 1;
    if (mission.status === "UPCOMING") return 2;
    if (mission.status === "EXPIRED") return 8;
    return 9;
  };
  return (
    missions
      .filter((mission) => mission.status !== "COMPLETED")
      .sort((a, b) => {
        const byPriority = priority(a) - priority(b);
        if (byPriority !== 0) return byPriority;
        return a.remainingSeconds - b.remainingSeconds;
      })[0] ?? null
  );
}

function selectHomeNextAction(input: {
  tasks: TaskSummary[];
  pendingReviewCount: number;
  featuredRadarMission: RadarMissionSummary | null;
  latestMessage: FamilyMessage | null;
}): HomeNextAction {
  if (input.pendingReviewCount > 0) {
    return {
      kind: "REVIEW_PHOTO",
      title: "有照片需要你確認",
      description: "幫家人看一眼，通過後生命樹才會長出新葉。",
      ctaLabel: "前往覆核",
      taskId: null,
      radarMissionId: null,
    };
  }
  const task = [...input.tasks]
    .filter((item) => item.status !== "COMPLETED" && item.capability.enabled)
    .sort((a, b) => taskPriority(a) - taskPriority(b))[0];
  if (task) {
    const kind =
      task.verificationMode === "PHOTO_AI"
        ? "TAKE_PHOTO"
        : task.verificationMode === "TIMER"
          ? "START_TIMER"
          : "COMPLETE_TASK";
    return {
      kind,
      title: task.title,
      description: task.description,
      ctaLabel: taskActionLabel(task),
      taskId: task.id,
      radarMissionId: null,
    };
  }
  if (input.featuredRadarMission) {
    return {
      kind: "START_EXPLORATION",
      title: input.featuredRadarMission.title,
      description: "附近有一個城市任務，打開地圖就會看到自己的位置。",
      ctaLabel: "前往地圖",
      taskId: null,
      radarMissionId: input.featuredRadarMission.id,
    };
  }
  if (input.latestMessage) {
    return {
      kind: "READ_MESSAGE",
      title: "看看家人的留言",
      description: input.latestMessage.body,
      ctaLabel: "查看訊息",
      taskId: null,
      radarMissionId: null,
    };
  }
  return {
    kind: "REST",
    title: "今天先慢慢來",
    description: "沒有急著完成的任務，休息也是照顧自己的一部分。",
    ctaLabel: "看看生命樹",
    taskId: null,
    radarMissionId: null,
  };
}

function companionSpriteFor(
  tree: TreeSummary,
  nextAction: HomeNextAction,
): HomeSummary["companionSprite"] {
  const mood = (() => {
    if (nextAction.kind === "START_EXPLORATION") return "WALKING";
    if (nextAction.kind === "REVIEW_PHOTO") return "WAITING";
    if (nextAction.kind === "REST") return "RESTING";
    return "READY";
  })();
  return {
    mood,
    label:
      mood === "WALKING"
        ? "小葉靈準備陪你出門"
        : mood === "WAITING"
          ? "小葉靈正在等你確認"
          : mood === "RESTING"
            ? "小葉靈今天陪你慢慢休息"
            : "小葉靈帶著今天的任務來了",
    energyPoints: tree.growthPoints,
  };
}

function toTaskSummary(assignment: AssignmentWithTask): TaskSummary {
  const rule =
    assignment.task.verificationRule &&
    typeof assignment.task.verificationRule === "object" &&
    !Array.isArray(assignment.task.verificationRule)
      ? (assignment.task.verificationRule as Record<string, unknown>)
      : {};
  const capability = photoCapabilityStatus();
  return {
    id: assignment.id,
    title: assignment.task.title,
    description: assignment.task.description,
    verificationMode: assignment.task.verificationMode,
    growthPoints: assignment.task.growthPoints,
    status: assignment.status,
    startedAt: assignment.startedAt?.toISOString() ?? null,
    minimumSeconds:
      typeof rule.minimumSeconds === "number" ? rule.minimumSeconds : null,
    dueAt: assignment.dueAt?.toISOString() ?? null,
    capability: {
      enabled:
        assignment.task.verificationMode !== VerificationMode.PHOTO_AI ||
        capability.taskCapability.enabled,
      reason:
        assignment.task.verificationMode === VerificationMode.PHOTO_AI &&
        !capability.taskCapability.enabled
          ? capability.taskCapability.reason
          : null,
    },
  };
}

function inviteHash(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function lineBindingCodeHash(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function distanceBetweenMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

@Injectable()
export class PersistentStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService = new ClockService(),
    private readonly evidenceStorage: EvidenceStorageService = new EvidenceStorageService(),
    private readonly photoVerifier: PhotoVerifierService = new PhotoVerifierService(),
    private readonly lineMessaging: LineMessagingService = new LineMessagingService(),
  ) {}

  async getContext(firebaseUid: string): Promise<AppContext> {
    await this.ensureUserContext(firebaseUid);
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        householdLinks: {
          include: { household: true },
          orderBy: { householdId: "asc" },
        },
      },
    });
    if (!user?.activeHouseholdId) {
      throw new NotFoundException("Active household not found");
    }
    const capability = photoCapabilityStatus();
    return {
      displayName: user.displayName,
      activeHouseholdId: user.activeHouseholdId,
      households: user.householdLinks.map((membership) => ({
        id: membership.householdId,
        name: membership.household.name,
        relationship: membership.relationship,
      })),
      capabilities: {
        photoEvidence: capability.photoEvidence,
        geminiPhotoVerification: capability.geminiPhotoVerification,
      },
    };
  }

  async getHomeSummary(firebaseUid: string): Promise<HomeSummary> {
    const [context, tree, tasks, messages, pendingReviewCount, radar] =
      await Promise.all([
        this.getContext(firebaseUid),
        this.getTree(firebaseUid),
        this.listTasks(firebaseUid),
        this.listMessages(firebaseUid),
        this.countPendingFamilyReviews(firebaseUid),
        this.getRadarState(firebaseUid),
      ]);
    const taskCards = [...tasks]
      .sort((a, b) => taskPriority(a) - taskPriority(b))
      .slice(0, 4)
      .map(toHomeTaskCard);
    const latestMessage = messages[0] ?? null;
    const featuredRadarMission = selectFeaturedRadarMission(radar.missions);
    const nextAction = selectHomeNextAction({
      tasks,
      pendingReviewCount,
      featuredRadarMission,
      latestMessage,
    });
    const alerts: HomeAlert[] = [];
    if (pendingReviewCount > 0) {
      alerts.push({
        id: "reviews",
        kind: "REVIEW",
        title: "等待覆核",
        description: "有家人的照片需要你確認。",
        count: pendingReviewCount,
      });
    }
    if (latestMessage) {
      alerts.push({
        id: "latest-message",
        kind: "MESSAGE",
        title: "家庭訊息",
        description: `${latestMessage.authorName}傳來一段話。`,
        count: messages.length,
      });
    }
    if (
      tasks.some(
        (task) =>
          task.verificationMode === "PHOTO_AI" && !task.capability.enabled,
      )
    ) {
      alerts.push({
        id: "photo-ai",
        kind: "PHOTO_AI",
        title: "照片驗證狀態",
        description: "照片任務會依目前 Storage 與 AI verifier 狀態顯示。",
        count: tasks.filter((task) => task.verificationMode === "PHOTO_AI")
          .length,
      });
    }
    if (featuredRadarMission) {
      alerts.push({
        id: "radar",
        kind: "RADAR",
        title: "附近任務",
        description: featuredRadarMission.title,
        count: radar.missions.filter(
          (mission) => mission.status !== "COMPLETED",
        ).length,
      });
    }
    return {
      generatedAt: this.clock.now().toISOString(),
      displayName: context.displayName,
      activeHouseholdName:
        context.households.find(
          (household) => household.id === context.activeHouseholdId,
        )?.name ?? tree.householdName,
      tree,
      nextAction,
      taskCards,
      featuredRadarMission,
      pendingReviewCount,
      messageCount: messages.length,
      latestMessage,
      capabilities: context.capabilities,
      companionSprite: companionSpriteFor(tree, nextAction),
      alerts,
    };
  }

  async updateDisplayName(
    firebaseUid: string,
    displayName: string,
  ): Promise<AppContext> {
    await this.ensureUserContext(firebaseUid);
    await this.prisma.user.update({
      where: { firebaseUid },
      data: { displayName: displayName.trim() },
    });
    return this.getContext(firebaseUid);
  }

  async createHouseholdInvite(
    firebaseUid: string,
  ): Promise<HouseholdInviteSummary> {
    const active = await this.getActiveUser(firebaseUid);
    const code = randomBytes(6)
      .toString("base64url")
      .replace(/[-_]/g, "")
      .slice(0, 8)
      .toUpperCase()
      .padEnd(8, "X");
    const expiresAt = new Date(
      this.clock.now().getTime() + 24 * 60 * 60 * 1000,
    );
    await this.prisma.householdInvite.create({
      data: {
        householdId: active.activeHouseholdId,
        createdById: active.id,
        codeHash: inviteHash(code),
        expiresAt,
      },
    });
    return {
      code,
      householdId: active.activeHouseholdId,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async joinHousehold(
    firebaseUid: string,
    code: string,
    relationship: string,
  ): Promise<AppContext> {
    await this.ensureUserContext(firebaseUid);
    const codeHash = inviteHash(code);
    await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { firebaseUid },
      });
      const invite = await transaction.householdInvite.findUnique({
        where: { codeHash },
      });
      if (!user || !invite) {
        throw new NotFoundException("Household invite not found");
      }
      if (
        invite.usedAt ||
        invite.expiresAt.getTime() <= this.clock.now().getTime()
      ) {
        throw new ConflictException(
          "Household invite is expired or already used",
        );
      }
      const existingMembership = await transaction.householdMember.findUnique({
        where: {
          householdId_userId: {
            householdId: invite.householdId,
            userId: user.id,
          },
        },
      });
      if (existingMembership) {
        throw new ConflictException("Already a household member");
      }
      const consumed = await transaction.householdInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: this.clock.now(), usedById: user.id },
      });
      if (consumed.count !== 1) {
        throw new ConflictException("Household invite is already used");
      }
      await transaction.householdMember.create({
        data: {
          householdId: invite.householdId,
          userId: user.id,
          relationship: relationship.trim(),
        },
      });
      await transaction.taskAssignment.createMany({
        data: TASK_SEEDS.map((task) => ({
          taskId: task.id,
          userId: user.id,
          householdId: invite.householdId,
          status: AssignmentStatus.AVAILABLE,
        })),
        skipDuplicates: true,
      });
      await transaction.user.update({
        where: { id: user.id },
        data: { activeHouseholdId: invite.householdId },
      });
    });
    return this.getContext(firebaseUid);
  }

  async setActiveHousehold(
    firebaseUid: string,
    householdId: string,
  ): Promise<AppContext> {
    await this.ensureUserContext(firebaseUid);
    const membership = await this.prisma.householdMember.findFirst({
      where: { householdId, user: { firebaseUid } },
    });
    if (!membership) {
      throw new NotFoundException("Household membership not found");
    }
    await this.prisma.user.update({
      where: { firebaseUid },
      data: { activeHouseholdId: householdId },
    });
    return this.getContext(firebaseUid);
  }

  async createLineBindingCode(
    firebaseUid: string,
  ): Promise<LineBindingCodeResult> {
    const active = await this.getActiveUser(firebaseUid);
    const code = randomBytes(5)
      .toString("base64url")
      .replace(/[-_]/g, "")
      .slice(0, 8)
      .toUpperCase()
      .padEnd(8, "L");
    const expiresAt = new Date(this.clock.now().getTime() + 10 * 60 * 1000);
    await this.prisma.lineBindingCode.create({
      data: {
        codeHash: lineBindingCodeHash(code),
        userId: active.id,
        householdId: active.activeHouseholdId,
        expiresAt,
      },
    });
    return {
      code,
      expiresAt: expiresAt.toISOString(),
      qrPayload: `eldertree://line-bind?code=${code}`,
      instructions:
        "請在同行成林 LINE 官方帳號輸入此 8 碼綁定碼；10 分鐘內有效且只能使用一次。",
    };
  }

  async listLineBindings(firebaseUid: string): Promise<LineBindingSummary[]> {
    const active = await this.getActiveUser(firebaseUid);
    const bindings = await this.prisma.lineBinding.findMany({
      where: { userId: active.id, householdId: active.activeHouseholdId },
      include: { household: true },
      orderBy: { createdAt: "desc" },
    });
    return bindings.map((binding) => ({
      id: binding.id,
      householdId: binding.householdId,
      householdName: binding.household.name,
      status: binding.status === "ACTIVE" ? "ACTIVE" : "REVOKED",
      createdAt: binding.createdAt.toISOString(),
      revokedAt: binding.revokedAt?.toISOString() ?? null,
    }));
  }

  async revokeLineBinding(
    firebaseUid: string,
    bindingId: string,
  ): Promise<LineBindingSummary[]> {
    const active = await this.getActiveUser(firebaseUid);
    await this.prisma.lineBinding.updateMany({
      where: {
        id: bindingId,
        userId: active.id,
        householdId: active.activeHouseholdId,
        status: "ACTIVE",
      },
      data: { status: "REVOKED", revokedAt: this.clock.now() },
    });
    return this.listLineBindings(firebaseUid);
  }

  async bindLineUserWithCode(
    code: string,
    lineUserId: string,
  ): Promise<LineBindingSummary> {
    const normalizedCode = code.trim().toUpperCase();
    const codeHash = lineBindingCodeHash(normalizedCode);
    const now = this.clock.now();
    const binding = await this.prisma.$transaction(async (transaction) => {
      const bindingCode = await transaction.lineBindingCode.findUnique({
        where: { codeHash },
        include: { household: true },
      });
      if (!bindingCode)
        throw new NotFoundException("LINE binding code not found");
      if (
        bindingCode.usedAt ||
        bindingCode.expiresAt.getTime() <= now.getTime()
      ) {
        throw new ConflictException(
          "LINE binding code is expired or already used",
        );
      }
      const consumed = await transaction.lineBindingCode.updateMany({
        where: {
          id: bindingCode.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now, lineUserId },
      });
      if (consumed.count !== 1) {
        throw new ConflictException(
          "LINE binding code is expired or already used",
        );
      }
      return transaction.lineBinding.upsert({
        where: {
          lineUserId_householdId: {
            lineUserId,
            householdId: bindingCode.householdId,
          },
        },
        update: {
          userId: bindingCode.userId,
          status: "ACTIVE",
          revokedAt: null,
        },
        create: {
          lineUserId,
          userId: bindingCode.userId,
          householdId: bindingCode.householdId,
          status: "ACTIVE",
        },
        include: { household: true },
      });
    });
    return {
      id: binding.id,
      householdId: binding.householdId,
      householdName: binding.household.name,
      status: binding.status === "ACTIVE" ? "ACTIVE" : "REVOKED",
      createdAt: binding.createdAt.toISOString(),
      revokedAt: binding.revokedAt?.toISOString() ?? null,
    };
  }

  async getAdminLineBinding(bindingId: string) {
    const binding = await this.prisma.lineBinding.findUnique({
      where: { id: bindingId },
      include: { household: true, user: true },
    });
    if (!binding || binding.status !== "ACTIVE") {
      throw new NotFoundException("Active LINE binding not found");
    }
    return binding;
  }

  async listAdminLineBindings(): Promise<AdminLineBindingSummary[]> {
    const bindings = await this.prisma.lineBinding.findMany({
      include: {
        household: true,
        user: true,
        notifications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { notifications: true },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return bindings.map((binding) => {
      const lastNotification = binding.notifications[0];
      return {
        id: binding.id,
        householdId: binding.householdId,
        householdName: binding.household.name,
        userDisplayName: binding.user.displayName,
        status: binding.status === "ACTIVE" ? "ACTIVE" : "REVOKED",
        createdAt: binding.createdAt.toISOString(),
        revokedAt: binding.revokedAt?.toISOString() ?? null,
        notificationCount: binding._count.notifications,
        lastNotificationStatus: lastNotification
          ? (lastNotification.status as "SENT" | "FAILED" | "SKIPPED")
          : null,
        lastNotificationAt: lastNotification?.createdAt.toISOString() ?? null,
      };
    });
  }

  async logLineNotification(input: {
    lineBindingId?: string;
    target: string;
    type: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    error?: string | null;
  }): Promise<LineNotificationStatus> {
    const log = await this.prisma.lineNotificationLog.create({
      data: {
        lineBindingId: input.lineBindingId,
        target: input.target,
        type: input.type,
        status: input.status,
        error: input.error ?? null,
      },
    });
    return {
      id: log.id,
      target: log.target,
      type: log.type,
      status: log.status as "SENT" | "FAILED" | "SKIPPED",
      error: log.error,
      createdAt: log.createdAt.toISOString(),
    };
  }

  private async pushLineNotificationToHousehold(input: {
    householdId: string;
    excludeUserId?: string;
    type: string;
    message: string;
    quickReplies?: string[];
  }): Promise<void> {
    const bindings = await this.prisma.lineBinding.findMany({
      where: {
        householdId: input.householdId,
        status: "ACTIVE",
        ...(input.excludeUserId
          ? { userId: { not: input.excludeUserId } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    for (const binding of bindings) {
      try {
        const result = await this.lineMessaging.push(
          binding.lineUserId,
          input.message,
          input.quickReplies,
        );
        await this.logLineNotification({
          lineBindingId: binding.id,
          target: binding.lineUserId,
          type: input.type,
          status: result.status,
          error: result.error,
        });
      } catch (error) {
        await this.logLineNotification({
          lineBindingId: binding.id,
          target: binding.lineUserId,
          type: input.type,
          status: "FAILED",
          error: error instanceof Error ? error.message : "LINE push failed",
        }).catch(() => undefined);
      }
    }
  }

  async listTasks(firebaseUid: string): Promise<TaskSummary[]> {
    const active = await this.getActiveUser(firebaseUid);
    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        userId: active.id,
        householdId: active.activeHouseholdId,
      },
      include: { task: true },
      orderBy: { createdAt: "asc" },
    });
    return assignments.map(toTaskSummary);
  }

  async getTree(firebaseUid: string): Promise<TreeSummary> {
    const active = await this.getActiveUser(firebaseUid);
    const household = await this.prisma.household.findUnique({
      where: { id: active.activeHouseholdId },
      include: { trees: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    const tree = household?.trees[0];
    if (!household || !tree) {
      throw new NotFoundException("Companion tree not found");
    }
    return {
      id: tree.id,
      name: tree.name,
      householdName: household.name,
      stage: tree.stage,
      growthPoints: tree.growthPoints,
      nextStageAt: nextStageAt(tree.growthPoints),
    };
  }

  async getCircleOverview(firebaseUid: string): Promise<CircleOverview> {
    const active = await this.getActiveUser(firebaseUid);
    await this.ensureCooperativeActionSeed();
    const household = await this.prisma.household.findUnique({
      where: { id: active.activeHouseholdId },
      include: {
        members: {
          include: { user: true },
          orderBy: { userId: "asc" },
        },
      },
    });
    if (!household) throw new NotFoundException("Circle not found");

    const now = this.clock.now();
    const action = await this.prisma.cooperativeAction.findFirst({
      where: {
        status: "PUBLISHED",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: { publishedAt: "asc" },
    });
    if (!action) {
      return {
        id: household.id,
        name: household.name,
        kind: household.circleKind,
        currentMemberId: active.id,
        memberCount: household.members.length,
        members: household.members.map((membership) => ({
          id: membership.userId,
          displayName: membership.user.displayName,
          relationship: membership.relationship,
        })),
        activeAction: null,
      };
    }

    const run = await this.prisma.cooperativeActionRun.upsert({
      where: {
        actionId_householdId: {
          actionId: action.id,
          householdId: household.id,
        },
      },
      update: {},
      create: { actionId: action.id, householdId: household.id },
      include: {
        action: {
          include: {
            chapters: {
              include: { task: true, alternativeTask: true },
              orderBy: { sequence: "asc" },
            },
          },
        },
        claimedBy: true,
        contributions: { include: { user: true, task: true } },
      },
    });
    const contributionsByChapter = new Map(
      run.contributions.map((contribution) => [
        contribution.chapterId,
        contribution,
      ]),
    );
    const contributorCount = new Set(
      run.contributions.map((contribution) => contribution.userId),
    ).size;
    return {
      id: household.id,
      name: household.name,
      kind: household.circleKind,
      currentMemberId: active.id,
      memberCount: household.members.length,
      members: household.members.map((membership) => ({
        id: membership.userId,
        displayName: membership.user.displayName,
        relationship: membership.relationship,
      })),
      activeAction: {
        id: run.action.id,
        runId: run.id,
        title: run.action.title,
        description: run.action.description,
        kind: run.action.kind,
        status: run.status,
        minimumContributors: run.action.minimumContributors,
        maxChaptersPerMember: run.action.maxChaptersPerMember,
        contributorCount,
        completedChapterCount: run.contributions.length,
        totalChapterCount: run.action.chapters.length,
        growthPoints: run.action.growthPoints,
        keepsakeName: run.action.keepsakeName,
        chapters: run.action.chapters.map((chapter) => {
          const contribution = contributionsByChapter.get(chapter.id);
          return {
            id: chapter.id,
            sequence: chapter.sequence,
            title: chapter.task.title,
            description: chapter.task.description,
            elementName: chapter.elementName,
            verificationMode: chapter.task.verificationMode,
            alternative: chapter.alternativeTask
              ? {
                  title: chapter.alternativeTask.title,
                  description: chapter.alternativeTask.description,
                  verificationMode: chapter.alternativeTask.verificationMode,
                }
              : null,
            claim:
              run.claimedChapterId === chapter.id &&
              run.claimedBy &&
              run.claimedAt &&
              run.claimExpiresAt
                ? {
                    memberId: run.claimedBy.id,
                    displayName: run.claimedBy.displayName,
                    claimedAt: run.claimedAt.toISOString(),
                    expiresAt: run.claimExpiresAt.toISOString(),
                    usingAlternative:
                      run.claimedTaskId === chapter.alternativeTaskId,
                  }
                : null,
            contributor: contribution
              ? {
                  memberId: contribution.userId,
                  displayName: contribution.user.displayName,
                  actionTitle: contribution.task.title,
                  usedAlternative:
                    contribution.taskId === chapter.alternativeTaskId,
                  witnessedAt: contribution.witnessedAt.toISOString(),
                  witnessTier: contribution.witnessTier,
                }
              : null,
          };
        }),
      },
    };
  }

  async claimCooperativeActionChapter(
    firebaseUid: string,
    runId: string,
    chapterId: string,
    useAlternative = false,
  ): Promise<CircleOverview> {
    const active = await this.getActiveUser(firebaseUid);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${runId}))
      `;
      const run = await transaction.cooperativeActionRun.findFirst({
        where: { id: runId, householdId: active.activeHouseholdId },
        include: {
          action: { include: { chapters: { orderBy: { sequence: "asc" } } } },
        },
      });
      if (!run) throw new NotFoundException("Cooperative action run not found");
      if (
        run.status !== "ACTIVE" ||
        run.action.status !== "PUBLISHED" ||
        run.action.kind !== "RELAY"
      ) {
        throw new ConflictException("Cooperative action is not active");
      }
      const now = this.clock.now();
      if (
        (run.action.startsAt &&
          run.action.startsAt.getTime() > now.getTime()) ||
        (run.action.endsAt && run.action.endsAt.getTime() <= now.getTime())
      ) {
        throw new ConflictException(
          "Cooperative action is outside its active period",
        );
      }
      const chapter = run.action.chapters.find((item) => item.id === chapterId);
      if (!chapter)
        throw new NotFoundException("Cooperative action chapter not found");

      const contributions =
        await transaction.cooperativeActionContribution.findMany({
          where: { runId },
          select: { chapterId: true, userId: true },
        });
      if (contributions.some((item) => item.chapterId === chapterId)) {
        throw new ConflictException(
          "Cooperative action chapter is already complete",
        );
      }
      const completedChapterIds = new Set(
        contributions.map((item) => item.chapterId),
      );
      const missingPrevious = run.action.chapters.some(
        (item) =>
          item.sequence < chapter.sequence && !completedChapterIds.has(item.id),
      );
      if (missingPrevious) {
        throw new ConflictException("Previous relay chapter is not complete");
      }
      if (
        contributions.filter((item) => item.userId === active.id).length >=
        run.action.maxChaptersPerMember
      ) {
        throw new ConflictException(
          "Each member can complete only one chapter",
        );
      }
      const taskId = useAlternative
        ? chapter.alternativeTaskId
        : chapter.taskId;
      if (!taskId) {
        throw new ConflictException("Alternative action is not available");
      }
      if (run.claimedChapterId) {
        const claimIsActive =
          run.claimExpiresAt && run.claimExpiresAt.getTime() > now.getTime();
        if (
          claimIsActive &&
          run.claimedChapterId === chapterId &&
          run.claimedById === active.id &&
          run.claimedTaskId === taskId
        ) {
          return;
        }
        throw new ConflictException(
          claimIsActive
            ? "Relay chapter is already claimed"
            : "Expired relay claim must be released",
        );
      }
      await transaction.cooperativeActionRun.update({
        where: { id: run.id },
        data: {
          claimedChapterId: chapter.id,
          claimedById: active.id,
          claimedTaskId: taskId,
          claimedAt: now,
          claimExpiresAt: new Date(
            now.getTime() + COOPERATIVE_CLAIM_DURATION_MS,
          ),
        },
      });
    });
    return this.getCircleOverview(firebaseUid);
  }

  async handoffCooperativeActionChapter(
    firebaseUid: string,
    runId: string,
    chapterId: string,
    targetMemberId: string,
  ): Promise<CircleOverview> {
    const active = await this.getActiveUser(firebaseUid);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${runId}))
      `;
      const run = await transaction.cooperativeActionRun.findFirst({
        where: { id: runId, householdId: active.activeHouseholdId },
        include: { action: true },
      });
      if (!run) throw new NotFoundException("Cooperative action run not found");
      const now = this.clock.now();
      if (
        run.status !== "ACTIVE" ||
        run.action.status !== "PUBLISHED" ||
        run.action.kind !== "RELAY" ||
        run.claimedChapterId !== chapterId ||
        run.claimedById !== active.id ||
        !run.claimExpiresAt ||
        run.claimExpiresAt.getTime() <= now.getTime()
      ) {
        throw new ConflictException(
          "Only the current claimant can hand off this chapter",
        );
      }
      if (
        (run.action.startsAt &&
          run.action.startsAt.getTime() > now.getTime()) ||
        (run.action.endsAt && run.action.endsAt.getTime() <= now.getTime())
      ) {
        throw new ConflictException(
          "Cooperative action is outside its active period",
        );
      }
      if (targetMemberId === active.id) {
        throw new ConflictException("Choose another circle member for handoff");
      }
      const targetMembership = await transaction.householdMember.findUnique({
        where: {
          householdId_userId: {
            householdId: active.activeHouseholdId,
            userId: targetMemberId,
          },
        },
      });
      if (!targetMembership)
        throw new NotFoundException("Circle member not found");
      const targetContributionCount =
        await transaction.cooperativeActionContribution.count({
          where: { runId, userId: targetMemberId },
        });
      if (targetContributionCount >= run.action.maxChaptersPerMember) {
        throw new ConflictException(
          "Target member already completed their chapter",
        );
      }
      await transaction.cooperativeActionRun.update({
        where: { id: run.id },
        data: {
          claimedById: targetMemberId,
          claimedAt: now,
          claimExpiresAt: new Date(
            now.getTime() + COOPERATIVE_CLAIM_DURATION_MS,
          ),
        },
      });
    });
    return this.getCircleOverview(firebaseUid);
  }

  async releaseExpiredCooperativeActionClaim(
    firebaseUid: string,
    runId: string,
    chapterId: string,
  ): Promise<CircleOverview> {
    const active = await this.getActiveUser(firebaseUid);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${runId}))
      `;
      const run = await transaction.cooperativeActionRun.findFirst({
        where: { id: runId, householdId: active.activeHouseholdId },
      });
      if (!run) throw new NotFoundException("Cooperative action run not found");
      if (run.claimedChapterId !== chapterId || !run.claimExpiresAt) {
        throw new ConflictException("No relay claim to release");
      }
      if (run.claimExpiresAt.getTime() > this.clock.now().getTime()) {
        throw new ConflictException("Relay claim has not expired");
      }
      await transaction.cooperativeActionRun.update({
        where: { id: run.id },
        data: {
          claimedChapterId: null,
          claimedById: null,
          claimedTaskId: null,
          claimedAt: null,
          claimExpiresAt: null,
        },
      });
    });
    return this.getCircleOverview(firebaseUid);
  }

  async completeCooperativeActionChapter(
    firebaseUid: string,
    runId: string,
    chapterId: string,
    requestIdempotencyKey?: string,
  ): Promise<CircleOverview> {
    const active = await this.getActiveUser(firebaseUid);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${runId}))
      `;
      const run = await transaction.cooperativeActionRun.findFirst({
        where: { id: runId, householdId: active.activeHouseholdId },
        include: {
          action: { include: { chapters: { orderBy: { sequence: "asc" } } } },
        },
      });
      if (!run) throw new NotFoundException("Cooperative action run not found");
      if (run.status === "COMPLETED") return;
      if (run.status !== "ACTIVE" || run.action.status !== "PUBLISHED") {
        throw new ConflictException("Cooperative action is not active");
      }
      const now = this.clock.now();
      if (
        (run.action.startsAt &&
          run.action.startsAt.getTime() > now.getTime()) ||
        (run.action.endsAt && run.action.endsAt.getTime() <= now.getTime())
      ) {
        throw new ConflictException(
          "Cooperative action is outside its active period",
        );
      }
      const chapter = run.action.chapters.find((item) => item.id === chapterId);
      if (!chapter)
        throw new NotFoundException("Cooperative action chapter not found");

      const existing =
        await transaction.cooperativeActionContribution.findUnique({
          where: { runId_chapterId: { runId, chapterId } },
        });
      if (existing) return;
      if (
        run.claimedChapterId !== chapterId ||
        run.claimedById !== active.id ||
        !run.claimedTaskId ||
        !run.claimExpiresAt ||
        run.claimExpiresAt.getTime() <= now.getTime()
      ) {
        throw new ConflictException(
          "Claim the relay chapter before completing it",
        );
      }
      if (
        run.claimedTaskId !== chapter.taskId &&
        run.claimedTaskId !== chapter.alternativeTaskId
      ) {
        throw new ConflictException(
          "Claimed action does not belong to this chapter",
        );
      }
      const claimedTask = await transaction.task.findUnique({
        where: { id: run.claimedTaskId },
      });
      if (!claimedTask) throw new NotFoundException("Claimed action not found");
      if (claimedTask.verificationMode !== "SELF_CHECK") {
        throw new ConflictException("Selected action requires witness data");
      }
      const completedChapterIds = new Set(
        (
          await transaction.cooperativeActionContribution.findMany({
            where: { runId },
            select: { chapterId: true },
          })
        ).map((item) => item.chapterId),
      );
      const missingPrevious = run.action.chapters.some(
        (item) =>
          item.sequence < chapter.sequence && !completedChapterIds.has(item.id),
      );
      if (missingPrevious) {
        throw new ConflictException("Previous relay chapter is not complete");
      }
      const memberContributionCount =
        await transaction.cooperativeActionContribution.count({
          where: { runId, userId: active.id },
        });
      if (memberContributionCount >= run.action.maxChaptersPerMember) {
        throw new ConflictException(
          "Each member can complete only one chapter",
        );
      }

      const idempotencyKey =
        requestIdempotencyKey ??
        `cooperative:${runId}:${chapterId}:${active.id}`;
      const duplicateReceipt =
        await transaction.cooperativeActionContribution.findUnique({
          where: { idempotencyKey },
        });
      if (duplicateReceipt) {
        if (
          duplicateReceipt.runId === runId &&
          duplicateReceipt.chapterId === chapterId &&
          duplicateReceipt.userId === active.id
        ) {
          return;
        }
        throw new ConflictException("Idempotency key is already in use");
      }
      await transaction.cooperativeActionContribution.create({
        data: {
          runId,
          chapterId,
          userId: active.id,
          taskId: claimedTask.id,
          idempotencyKey,
          witnessTier: "SELF_CHECK",
          witnessedAt: now,
        },
      });

      const contributions =
        await transaction.cooperativeActionContribution.findMany({
          where: { runId },
          select: { userId: true },
        });
      const enoughChapters =
        contributions.length === run.action.chapters.length;
      const enoughMembers =
        new Set(contributions.map((item) => item.userId)).size >=
        run.action.minimumContributors;
      if (enoughChapters && enoughMembers) {
        await this.awardCooperativeActionGrowth(
          transaction,
          run.id,
          run.action.growthPoints,
          active.activeHouseholdId,
        );
        await transaction.cooperativeActionRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            claimedChapterId: null,
            claimedById: null,
            claimedTaskId: null,
            claimedAt: null,
            claimExpiresAt: null,
          },
        });
      } else {
        await transaction.cooperativeActionRun.update({
          where: { id: run.id },
          data: {
            claimedChapterId: null,
            claimedById: null,
            claimedTaskId: null,
            claimedAt: null,
            claimExpiresAt: null,
          },
        });
      }
    });
    return this.getCircleOverview(firebaseUid);
  }

  async startTask(
    firebaseUid: string,
    assignmentId: string,
  ): Promise<TaskSummary> {
    const assignment = await this.findAssignment(firebaseUid, assignmentId);
    if (assignment.status === AssignmentStatus.COMPLETED) {
      throw new ConflictException("Task is already complete");
    }
    return toTaskSummary(
      await this.prisma.taskAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.IN_PROGRESS,
          startedAt: assignment.startedAt ?? this.clock.now(),
        },
        include: { task: true },
      }),
    );
  }

  async completeTask(
    firebaseUid: string,
    assignmentId: string,
    _requestIdempotencyKey?: string,
  ): Promise<TaskSummary> {
    const active = await this.getActiveUser(firebaseUid);
    return this.prisma.$transaction(async (transaction) => {
      const assignment = await transaction.taskAssignment.findFirst({
        where: {
          id: assignmentId,
          userId: active.id,
          householdId: active.activeHouseholdId,
        },
        include: {
          task: true,
        },
      });
      if (!assignment) throw new NotFoundException("Task assignment not found");
      if (assignment.task.verificationMode === VerificationMode.PHOTO_AI) {
        throw new BadRequestException("PHOTO_AI tasks require evidence");
      }
      if (assignment.task.verificationMode === VerificationMode.TIMER) {
        const rule = assignment.task.verificationRule as Record<
          string,
          unknown
        >;
        const minimumSeconds =
          typeof rule.minimumSeconds === "number" ? rule.minimumSeconds : 0;
        if (!assignment.startedAt) {
          throw new BadRequestException("Timer task has not been started");
        }
        const elapsedSeconds = Math.floor(
          (this.clock.now().getTime() - assignment.startedAt.getTime()) / 1000,
        );
        if (elapsedSeconds < minimumSeconds) {
          throw new BadRequestException(
            `Timer task requires ${minimumSeconds - elapsedSeconds} more seconds`,
          );
        }
      }

      await this.awardTaskGrowth(
        transaction,
        assignment,
        active.activeHouseholdId,
      );

      const updatedAssignment = await transaction.taskAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.COMPLETED,
          completedAt: assignment.completedAt ?? this.clock.now(),
        },
        include: { task: true },
      });
      await this.awardCompletedRouteBadge(
        transaction,
        active.id,
        active.activeHouseholdId,
        assignment.taskId,
      );
      return toTaskSummary(updatedAssignment);
    });
  }

  async completeGeminiPhotoTask(
    firebaseUid: string,
    assignmentId: string,
    input: GeminiPhotoTaskInput,
  ): Promise<TaskSummary> {
    if (
      process.env.PHOTO_EVIDENCE_ENABLED !== "true" ||
      process.env.PHOTO_VERIFICATION_ENABLED !== "true"
    ) {
      throw new BadRequestException(
        "Photo verification requires private storage and the verifier to be enabled",
      );
    }
    const active = await this.getActiveUser(firebaseUid);
    const assignment = await this.prisma.taskAssignment.findFirst({
      where: {
        id: assignmentId,
        userId: active.id,
        householdId: active.activeHouseholdId,
      },
      include: { task: true },
    });
    if (!assignment) throw new NotFoundException("Task assignment not found");
    if (assignment.task.verificationMode !== VerificationMode.PHOTO_AI) {
      throw new BadRequestException(
        "This task does not accept photo verification",
      );
    }
    if (assignment.status === AssignmentStatus.COMPLETED) {
      return toTaskSummary(assignment);
    }
    const idempotencyKey =
      input.idempotencyKey ??
      `gemini-photo:${assignment.id}:${input.imageBase64.slice(0, 48)}`;
    const existingAttempt =
      await this.prisma.photoVerificationAttempt.findUnique({
        where: {
          assignmentId_idempotencyKey: {
            assignmentId: assignment.id,
            idempotencyKey,
          },
        },
        include: { assignment: { include: { task: true } } },
      });
    if (existingAttempt) {
      if (existingAttempt.decision === PrismaVerificationDecision.PASS) {
        return toTaskSummary(existingAttempt.assignment);
      }
      throw new BadRequestException("Photo verification did not pass");
    }

    const estimatedBytes = Math.floor((input.imageBase64.length * 3) / 4);
    if (estimatedBytes <= 0 || estimatedBytes > 10 * 1024 * 1024) {
      throw new BadRequestException(
        "Photo image must be between 1 byte and 10 MB",
      );
    }

    const rule = assignment.task.verificationRule as Record<string, unknown>;
    const requiredLabels = Array.isArray(rule.requiredLabels)
      ? rule.requiredLabels.filter(
          (label): label is string => typeof label === "string",
        )
      : typeof rule.subject === "string"
        ? [rule.subject]
        : [];
    const forbiddenLabels = Array.isArray(rule.forbiddenLabels)
      ? rule.forbiddenLabels.filter(
          (label): label is string => typeof label === "string",
        )
      : [];
    const verification = await this.photoVerifier.verifyInline({
      evidenceId: `assignment:${assignment.id}`,
      taskTitle: assignment.task.title,
      imageBase64: input.imageBase64,
      contentType: input.contentType,
      requiredLabels,
      forbiddenLabels,
      matchAnyRequired: rule.matchAnyRequired === true,
    });

    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`photo:${assignment.id}:${idempotencyKey}`}))
      `;
      const existing = await transaction.photoVerificationAttempt.findUnique({
        where: {
          assignmentId_idempotencyKey: {
            assignmentId: assignment.id,
            idempotencyKey,
          },
        },
        include: { assignment: { include: { task: true } } },
      });
      if (existing) {
        return {
          decision: existing.decision,
          summary: toTaskSummary(existing.assignment),
        };
      }

      const decision = verification.decision as PrismaVerificationDecision;
      await transaction.photoVerificationAttempt.create({
        data: {
          assignmentId: assignment.id,
          idempotencyKey,
          decision,
          labels: verification.labels,
          matchedLabels: verification.labels.filter((label) =>
            requiredLabels
              .map((required) => required.toLowerCase())
              .includes(label.toLowerCase()),
          ),
          confidence: verification.confidence,
          reasonCodes: verification.reasonCodes,
          model: verification.model,
          ruleVersion: verification.ruleVersion,
        },
      });

      if (decision !== PrismaVerificationDecision.PASS) {
        const rejected = await transaction.taskAssignment.update({
          where: { id: assignment.id },
          data: { status: AssignmentStatus.REJECTED },
          include: { task: true },
        });
        return { decision, summary: toTaskSummary(rejected) };
      }

      await this.awardTaskGrowth(
        transaction,
        assignment,
        active.activeHouseholdId,
      );
      const completed = await transaction.taskAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.COMPLETED,
          completedAt: assignment.completedAt ?? this.clock.now(),
        },
        include: { task: true },
      });
      await this.awardCompletedRouteBadge(
        transaction,
        active.id,
        active.activeHouseholdId,
        assignment.taskId,
      );
      return { decision, summary: toTaskSummary(completed) };
    });

    if (result.decision !== PrismaVerificationDecision.PASS) {
      throw new BadRequestException("Photo verification did not pass");
    }
    return result.summary;
  }

  async initializeEvidence(
    firebaseUid: string,
    assignmentId: string,
    fileName: string,
    contentType: string,
  ): Promise<EvidenceUpload> {
    if (process.env.PHOTO_EVIDENCE_ENABLED !== "true") {
      throw new BadRequestException(
        "Photo verification is unavailable until private storage is configured",
      );
    }
    const active = await this.getActiveUser(firebaseUid);
    const assignment = await this.prisma.taskAssignment.findFirst({
      where: {
        id: assignmentId,
        userId: active.id,
        householdId: active.activeHouseholdId,
      },
      include: { task: true },
    });
    if (!assignment) throw new NotFoundException("Task assignment not found");
    if (assignment.task.verificationMode !== VerificationMode.PHOTO_AI) {
      throw new BadRequestException("This task does not accept photo evidence");
    }
    if (assignment.status === AssignmentStatus.COMPLETED) {
      throw new ConflictException("Task is already complete");
    }
    const extension = contentType === "image/png" ? "png" : "jpg";
    const id = randomUUID();
    const storagePath = `evidence/${firebaseUid}/${id}/original.${extension}`;
    await this.prisma.$transaction([
      this.prisma.evidence.create({
        data: {
          id,
          assignmentId,
          storagePath,
          contentType,
        },
      }),
      this.prisma.taskAssignment.update({
        where: { id: assignmentId },
        data: { status: AssignmentStatus.VERIFYING },
      }),
    ]);
    void fileName;
    return { id, storagePath, contentType };
  }

  async completeEvidence(
    firebaseUid: string,
    evidenceId: string,
    sha256: string,
  ): Promise<EvidenceDecision> {
    if (process.env.PHOTO_VERIFICATION_ENABLED !== "true") {
      throw new BadRequestException("Photo verification is disabled");
    }
    const active = await this.getActiveUser(firebaseUid);
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        assignment: {
          userId: active.id,
          householdId: active.activeHouseholdId,
        },
      },
      include: {
        assignment: { include: { task: true } },
        verification: true,
      },
    });
    if (!evidence) throw new NotFoundException("Evidence not found");
    if (evidence.verification) {
      if (
        evidence.verification.decision !== PrismaVerificationDecision.REVIEW
      ) {
        await this.evidenceStorage.deleteObject(evidence.storagePath);
      }
      return {
        evidenceId,
        decision: evidence.verification.decision,
        status: evidence.assignment.status,
      };
    }

    await this.evidenceStorage.assertUploaded(
      evidence.storagePath,
      evidence.contentType,
    );
    const imageUrl = await this.evidenceStorage.createSignedReadUrl(
      evidence.storagePath,
    );
    const rule = evidence.assignment.task.verificationRule as Record<
      string,
      unknown
    >;
    const requiredLabels = Array.isArray(rule.requiredLabels)
      ? rule.requiredLabels.filter(
          (label): label is string => typeof label === "string",
        )
      : typeof rule.subject === "string"
        ? [rule.subject]
        : [];
    const forbiddenLabels = Array.isArray(rule.forbiddenLabels)
      ? rule.forbiddenLabels.filter(
          (label): label is string => typeof label === "string",
        )
      : [];

    let verification;
    try {
      verification = await this.photoVerifier.verify({
        evidenceId,
        taskTitle: evidence.assignment.task.title,
        imageUrl,
        requiredLabels,
        forbiddenLabels,
        matchAnyRequired: rule.matchAnyRequired === true,
      });
    } catch (error) {
      await this.prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          status: EvidenceStatus.ERROR,
          errorCode: error instanceof Error ? error.name : "VERIFIER_ERROR",
          sha256,
          uploadedAt: this.clock.now(),
        },
      });
      throw error;
    }

    const transactionResult = await this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`evidence:${evidenceId}`}))
        `;
        const existing = await transaction.verificationRun.findUnique({
          where: { evidenceId },
          include: { evidence: { include: { assignment: true } } },
        });
        if (existing) {
          return {
            created: false,
            terminal: existing.decision !== PrismaVerificationDecision.REVIEW,
            result: {
              evidenceId,
              decision: existing.decision,
              status: existing.evidence.assignment.status,
            } satisfies EvidenceDecision,
          };
        }

        const decision = verification.decision as PrismaVerificationDecision;
        await transaction.verificationRun.create({
          data: {
            evidenceId,
            decision,
            confidence: verification.confidence,
            labels: verification.labels,
            reasonCodes: verification.reasonCodes,
            explanation: verification.explanation,
            model: verification.model,
            ruleVersion: verification.ruleVersion,
          },
        });
        const assignmentStatus =
          decision === PrismaVerificationDecision.PASS
            ? AssignmentStatus.COMPLETED
            : decision === PrismaVerificationDecision.FAIL
              ? AssignmentStatus.REJECTED
              : AssignmentStatus.VERIFYING;
        if (decision === PrismaVerificationDecision.PASS) {
          await this.awardTaskGrowth(
            transaction,
            evidence.assignment,
            active.activeHouseholdId,
          );
        }
        await transaction.taskAssignment.update({
          where: { id: evidence.assignmentId },
          data: {
            status: assignmentStatus,
            completedAt:
              decision === PrismaVerificationDecision.PASS
                ? this.clock.now()
                : null,
          },
        });
        await transaction.evidence.update({
          where: { id: evidenceId },
          data: {
            sha256,
            uploadedAt: this.clock.now(),
            status:
              decision === PrismaVerificationDecision.REVIEW
                ? EvidenceStatus.AWAITING_REVIEW
                : EvidenceStatus.RESOLVED,
            errorCode: null,
          },
        });
        return {
          created: true,
          terminal: decision !== PrismaVerificationDecision.REVIEW,
          result: {
            evidenceId,
            decision,
            status: assignmentStatus,
          } satisfies EvidenceDecision,
        };
      },
    );
    if (transactionResult.terminal) {
      await this.evidenceStorage.deleteObject(evidence.storagePath);
    } else if (
      transactionResult.created &&
      transactionResult.result.decision === PrismaVerificationDecision.REVIEW
    ) {
      await this.pushLineNotificationToHousehold({
        householdId: active.activeHouseholdId,
        excludeUserId: active.id,
        type: "PHOTO_REVIEW_REQUEST",
        message: `同行成林提醒：「${evidence.assignment.task.title}」照片需要家人覆核。請回 App 查看。`,
        quickReplies: ["打開 App", "晚點提醒我"],
      });
    }
    return transactionResult.result;
  }

  async listFamilyReviews(firebaseUid: string): Promise<FamilyReviewItem[]> {
    const active = await this.getActiveUser(firebaseUid);
    const reviews = await this.prisma.verificationRun.findMany({
      where: {
        decision: PrismaVerificationDecision.REVIEW,
        reviewedAt: null,
        evidence: {
          assignment: {
            householdId: active.activeHouseholdId,
            userId: { not: active.id },
          },
        },
      },
      include: {
        evidence: {
          include: {
            assignment: {
              include: { task: true, user: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return Promise.all(
      reviews.map(async (review) => ({
        id: review.id,
        evidenceId: review.evidenceId,
        taskTitle: review.evidence.assignment.task.title,
        participantName: review.evidence.assignment.user.displayName,
        imageUrl: await this.evidenceStorage.createSignedReadUrl(
          review.evidence.storagePath,
        ),
        confidence: review.confidence,
        labels: review.labels,
        explanation: review.explanation,
        createdAt: review.createdAt.toISOString(),
      })),
    );
  }

  async countPendingFamilyReviews(firebaseUid: string): Promise<number> {
    const active = await this.getActiveUser(firebaseUid);
    return this.prisma.verificationRun.count({
      where: {
        decision: PrismaVerificationDecision.REVIEW,
        reviewedAt: null,
        evidence: {
          assignment: {
            householdId: active.activeHouseholdId,
            userId: { not: active.id },
          },
        },
      },
    });
  }

  async decideFamilyReview(
    firebaseUid: string,
    reviewId: string,
    decision: "PASS" | "FAIL",
  ): Promise<EvidenceDecision> {
    const active = await this.getActiveUser(firebaseUid);
    const review = await this.prisma.verificationRun.findFirst({
      where: {
        id: reviewId,
        evidence: {
          assignment: { householdId: active.activeHouseholdId },
        },
      },
      include: {
        evidence: {
          include: {
            assignment: { include: { task: true } },
          },
        },
      },
    });
    if (!review) throw new NotFoundException("Family review not found");
    if (review.evidence.assignment.userId === active.id) {
      throw new BadRequestException(
        "Submitters cannot review their own evidence",
      );
    }
    if (review.reviewedAt) {
      await this.evidenceStorage.deleteObject(review.evidence.storagePath);
      return {
        evidenceId: review.evidenceId,
        decision: review.decision,
        status: review.evidence.assignment.status,
      };
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`review:${reviewId}`}))
      `;
      const current = await transaction.verificationRun.findUnique({
        where: { id: reviewId },
        include: {
          evidence: {
            include: { assignment: { include: { task: true } } },
          },
        },
      });
      if (!current) throw new NotFoundException("Family review not found");
      if (current.reviewedAt) {
        return {
          created: false,
          result: {
            evidenceId: current.evidenceId,
            decision: current.decision,
            status: current.evidence.assignment.status,
          } satisfies EvidenceDecision,
        };
      }
      const prismaDecision =
        decision === "PASS"
          ? PrismaVerificationDecision.PASS
          : PrismaVerificationDecision.FAIL;
      const status =
        decision === "PASS"
          ? AssignmentStatus.COMPLETED
          : AssignmentStatus.REJECTED;
      if (decision === "PASS") {
        await this.awardTaskGrowth(
          transaction,
          current.evidence.assignment,
          active.activeHouseholdId,
        );
      }
      await transaction.verificationRun.update({
        where: { id: reviewId },
        data: {
          decision: prismaDecision,
          reviewedAt: this.clock.now(),
          reviewedById: active.id,
        },
      });
      await transaction.evidence.update({
        where: { id: current.evidenceId },
        data: { status: EvidenceStatus.RESOLVED, errorCode: null },
      });
      await transaction.taskAssignment.update({
        where: { id: current.evidence.assignmentId },
        data: {
          status,
          completedAt: decision === "PASS" ? this.clock.now() : null,
        },
      });
      return {
        created: true,
        result: {
          evidenceId: current.evidenceId,
          decision: prismaDecision,
          status,
        } satisfies EvidenceDecision,
      };
    });
    await this.evidenceStorage.deleteObject(review.evidence.storagePath);
    return result.result;
  }

  async listMessages(firebaseUid: string): Promise<FamilyMessage[]> {
    const active = await this.getActiveUser(firebaseUid);
    const messages = await this.prisma.familyMessage.findMany({
      where: { householdId: active.activeHouseholdId },
      include: { author: true },
      orderBy: { createdAt: "desc" },
    });
    return messages.map((message) => ({
      id: message.id,
      authorName: message.author.displayName,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      deliveredToDeviceAt: message.deliveredToDeviceAt?.toISOString() ?? null,
    }));
  }

  async createMessage(
    firebaseUid: string,
    body: string,
  ): Promise<FamilyMessage> {
    const active = await this.getActiveUser(firebaseUid);
    const message = await this.prisma.familyMessage.create({
      data: {
        householdId: active.activeHouseholdId,
        authorId: active.id,
        body: body.trim(),
      },
      include: { author: true },
    });
    const result = {
      id: message.id,
      authorName: message.author.displayName,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      deliveredToDeviceAt: null,
    };
    await this.pushLineNotificationToHousehold({
      householdId: active.activeHouseholdId,
      excludeUserId: active.id,
      type: "FAMILY_MESSAGE",
      message: `同行成林家庭訊息：${message.author.displayName} 留了一段話：「${message.body.slice(
        0,
        48,
      )}${message.body.length > 48 ? "…" : ""}」`,
      quickReplies: ["打開 App", "晚點提醒我", "我需要幫忙"],
    });
    return result;
  }

  async getImpactSummary(firebaseUid: string): Promise<ImpactSummary> {
    const tree = await this.getTree(firebaseUid);
    const contributedPoints = await this.prisma.impactPoolEntry.aggregate({
      where: { sourceType: "HOUSEHOLD_TREE", sourceId: tree.id },
      _sum: { points: true },
    });
    return {
      householdName: tree.householdName,
      treeStage: tree.stage,
      growthPoints: tree.growthPoints,
      nextStageAt: tree.nextStageAt,
      contributedPoints: contributedPoints._sum.points ?? 0,
    };
  }

  async listDevices(firebaseUid: string): Promise<CompanionDeviceSummary[]> {
    const active = await this.getActiveUser(firebaseUid);
    const devices = await this.prisma.device.findMany({
      where: { householdId: active.activeHouseholdId },
      orderBy: { createdAt: "asc" },
    });
    return devices.map((device) => this.toDeviceSummary(device));
  }

  async claimDevice(
    firebaseUid: string,
    serialNumber: string,
    claimCode: string,
  ): Promise<CompanionDeviceSummary> {
    const active = await this.getActiveUser(firebaseUid);
    const device = await this.prisma.device.findUnique({
      where: { serialNumber: serialNumber.trim() },
    });
    if (!device) throw new NotFoundException("Companion device not found");
    const pepper = process.env.DEVICE_CLAIM_PEPPER;
    if (!pepper) {
      throw new BadRequestException("Device claiming is not configured");
    }
    const received = createHash("sha256")
      .update(`${pepper}\u0000${device.serialNumber}\u0000${claimCode.trim()}`)
      .digest();
    const expected = Buffer.from(device.claimCodeHash, "hex");
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new BadRequestException("Invalid serial number or claim code");
    }
    if (device.householdId && device.householdId !== active.activeHouseholdId) {
      throw new ConflictException("Companion device is already claimed");
    }
    const claimed = await this.prisma.device.update({
      where: { id: device.id },
      data: { householdId: active.activeHouseholdId },
    });
    return this.toDeviceSummary(claimed);
  }

  async getAdminDashboard(): Promise<DashboardSnapshot> {
    const [
      participantCount,
      completedTaskCount,
      pendingReviewCount,
      connectedDeviceCount,
      impactPool,
      publishedRouteCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.taskAssignment.count({ where: { status: "COMPLETED" } }),
      this.prisma.verificationRun.count({
        where: { decision: "REVIEW", reviewedAt: null },
      }),
      this.prisma.device.count({ where: { householdId: { not: null } } }),
      this.prisma.impactPoolEntry.aggregate({
        where: { allocatedAt: null },
        _sum: { points: true },
      }),
      this.prisma.explorationRoute.count({ where: { status: "PUBLISHED" } }),
    ]);
    return {
      participantCount,
      completedTaskCount,
      pendingReviewCount,
      connectedDeviceCount,
      impactPoolPoints: impactPool._sum.points ?? 0,
      simulatedTreeCount: publishedRouteCount,
    };
  }

  getPhotoAiOperationalStatus() {
    return photoAiOperationalStatus();
  }

  async getLineOperationalStatus(): Promise<LineOperationalStatus> {
    const [activeBindingCount, revokedBindingCount, notificationCount, latest] =
      await Promise.all([
        this.prisma.lineBinding.count({ where: { status: "ACTIVE" } }),
        this.prisma.lineBinding.count({ where: { status: "REVOKED" } }),
        this.prisma.lineNotificationLog.count(),
        this.prisma.lineNotificationLog.findFirst({
          orderBy: { createdAt: "desc" },
        }),
      ]);
    return {
      channelSecretConfigured: Boolean(process.env.LINE_CHANNEL_SECRET),
      channelAccessTokenConfigured: Boolean(
        process.env.LINE_CHANNEL_ACCESS_TOKEN,
      ),
      activeBindingCount,
      revokedBindingCount,
      notificationCount,
      lastNotificationStatus: latest
        ? (latest.status as "SENT" | "FAILED" | "SKIPPED")
        : null,
      lastNotificationAt: latest?.createdAt.toISOString() ?? null,
      updatedAt: this.clock.now().toISOString(),
    };
  }

  async listAdminReviews(): Promise<ReviewItem[]> {
    if (process.env.PHOTO_EVIDENCE_ENABLED !== "true") return [];
    const reviews = await this.prisma.verificationRun.findMany({
      where: { decision: "REVIEW", reviewedAt: null },
      include: {
        evidence: {
          include: {
            assignment: {
              include: { task: true, user: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return Promise.all(
      reviews.map(async (review) => ({
        id: review.id,
        taskTitle: review.evidence.assignment.task.title,
        participantName: review.evidence.assignment.user.displayName,
        imageUrl: await this.evidenceStorage.createSignedReadUrl(
          review.evidence.storagePath,
        ),
        confidence: review.confidence,
        labels: review.labels,
        explanation: review.explanation,
        createdAt: review.createdAt.toISOString(),
      })),
    );
  }

  async listAdminExplorationRoutes(): Promise<ExplorationRouteSummary[]> {
    const routes = await this.prisma.explorationRoute.findMany({
      include: {
        quests: {
          include: { task: true },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    });
    return routes.map((route) => this.toRouteSummary(route));
  }

  async getPublicExplorationRoute(
    slug: string,
  ): Promise<ExplorationRouteSummary> {
    const route = await this.prisma.explorationRoute.findFirst({
      where: {
        status: "PUBLISHED",
        OR: [{ slug }, { slug: { startsWith: `${slug}-v` } }],
      },
      include: {
        quests: {
          where: { active: true },
          include: { task: true },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { version: "desc" },
    });
    if (!route) throw new NotFoundException("Published route not found");
    return this.toRouteSummary(route);
  }

  async createAdminExplorationRoute(input: ExplorationRouteInput) {
    const route = await this.prisma.explorationRoute.create({
      data: {
        slug: input.slug.trim().toLowerCase(),
        name: input.name.trim(),
        description: input.description.trim(),
        badgeName: input.badgeName.trim(),
        badgeAssetKey: input.badgeAssetKey.trim(),
      },
      include: { quests: { include: { task: true } } },
    });
    return this.toRouteSummary(route);
  }

  async updateAdminExplorationRoute(
    routeId: string,
    input: Partial<ExplorationRouteInput>,
  ) {
    await this.assertDraftRoute(routeId);
    const route = await this.prisma.explorationRoute.update({
      where: { id: routeId },
      data: {
        name: input.name?.trim(),
        description: input.description?.trim(),
        badgeName: input.badgeName?.trim(),
        badgeAssetKey: input.badgeAssetKey?.trim(),
      },
      include: {
        quests: {
          include: { task: true },
          orderBy: { sequence: "asc" },
        },
      },
    });
    return this.toRouteSummary(route);
  }

  async createAdminExplorationQuest(input: ExplorationQuestInput) {
    await this.assertDraftRoute(input.routeId);
    this.assertValidQuestInput(input);
    await this.prisma.mapQuest.create({
      data: {
        route: { connect: { id: input.routeId } },
        sequence: input.sequence,
        locationName: input.locationName.trim(),
        category: input.category.trim().toUpperCase(),
        safetyNote: input.safetyNote?.trim() || null,
        accessibilityTags: input.accessibilityTags.map((tag) => tag.trim()),
        sourceUrl: input.sourceUrl?.trim() || null,
        triggerType: input.triggerType,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        radiusMeters: input.radiusMeters ?? null,
        unlockDistanceMeters: input.unlockDistanceMeters ?? null,
        task: {
          create: {
            title: input.title.trim(),
            description: input.description.trim(),
            verificationMode: input.verificationMode,
            verificationRule:
              input.verificationMode === "TIMER"
                ? {
                    source: "exploration",
                    minimumSeconds: input.minimumSeconds,
                  }
                : { source: "exploration", confirmationRequired: true },
            growthPoints: input.growthPoints,
          },
        },
      },
    });
    return this.listAdminExplorationRoutes();
  }

  async updateAdminExplorationQuest(
    questId: string,
    input: ExplorationQuestInput,
  ) {
    const existing = await this.prisma.mapQuest.findUnique({
      where: { id: questId },
    });
    if (!existing) throw new NotFoundException("Exploration quest not found");
    await this.assertDraftRoute(existing.routeId);
    if (existing.routeId !== input.routeId) {
      throw new BadRequestException(
        "A quest cannot move between route versions",
      );
    }
    this.assertValidQuestInput(input);
    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: existing.taskId },
        data: {
          title: input.title.trim(),
          description: input.description.trim(),
          verificationMode: input.verificationMode,
          verificationRule:
            input.verificationMode === "TIMER"
              ? {
                  source: "exploration",
                  minimumSeconds: input.minimumSeconds,
                }
              : { source: "exploration", confirmationRequired: true },
          growthPoints: input.growthPoints,
        },
      }),
      this.prisma.mapQuest.update({
        where: { id: questId },
        data: {
          sequence: input.sequence,
          locationName: input.locationName.trim(),
          category: input.category.trim().toUpperCase(),
          safetyNote: input.safetyNote?.trim() || null,
          accessibilityTags: input.accessibilityTags.map((tag) => tag.trim()),
          sourceUrl: input.sourceUrl?.trim() || null,
          triggerType: input.triggerType,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          radiusMeters: input.radiusMeters ?? null,
          unlockDistanceMeters: input.unlockDistanceMeters ?? null,
        },
      }),
    ]);
    return this.listAdminExplorationRoutes();
  }

  async reorderAdminExplorationQuests(routeId: string, questIds: string[]) {
    await this.assertDraftRoute(routeId);
    const existing = await this.prisma.mapQuest.findMany({
      where: { routeId },
      select: { id: true },
    });
    const expected = new Set(existing.map((quest) => quest.id));
    if (
      questIds.length !== expected.size ||
      new Set(questIds).size !== questIds.length ||
      questIds.some((id) => !expected.has(id))
    ) {
      throw new BadRequestException(
        "Reorder must include every route quest exactly once",
      );
    }
    await this.prisma.$transaction(async (transaction) => {
      for (let index = 0; index < questIds.length; index += 1) {
        await transaction.mapQuest.update({
          where: { id: questIds[index] },
          data: { sequence: 10_000 + index },
        });
      }
      for (let index = 0; index < questIds.length; index += 1) {
        await transaction.mapQuest.update({
          where: { id: questIds[index] },
          data: { sequence: index + 1 },
        });
      }
    });
    return this.listAdminExplorationRoutes();
  }

  async publishAdminExplorationRoute(routeId: string) {
    await this.assertDraftRoute(routeId);
    const route = await this.prisma.explorationRoute.findUnique({
      where: { id: routeId },
      include: { quests: { include: { task: true } } },
    });
    if (!route || route.quests.length === 0) {
      throw new BadRequestException("A route needs at least one quest");
    }
    for (const quest of route.quests) {
      this.assertValidQuestInput({
        routeId,
        sequence: quest.sequence,
        locationName: quest.locationName,
        category: quest.category,
        safetyNote: quest.safetyNote,
        accessibilityTags: quest.accessibilityTags,
        sourceUrl: quest.sourceUrl,
        title: quest.task.title,
        description: quest.task.description,
        verificationMode: quest.task.verificationMode as "SELF_CHECK" | "TIMER",
        minimumSeconds: (quest.task.verificationRule as Record<string, unknown>)
          .minimumSeconds as number | undefined,
        growthPoints: quest.task.growthPoints,
        triggerType: quest.triggerType,
        latitude: quest.latitude,
        longitude: quest.longitude,
        radiusMeters: quest.radiusMeters,
        unlockDistanceMeters: quest.unlockDistanceMeters,
      });
    }
    const baseSlug = route.slug.replace(/-v\d+$/, "");
    const published = await this.prisma.$transaction(async (transaction) => {
      await transaction.explorationRoute.updateMany({
        where: {
          id: { not: routeId },
          status: "PUBLISHED",
          OR: [{ slug: baseSlug }, { slug: { startsWith: `${baseSlug}-v` } }],
        },
        data: { status: "ARCHIVED", archivedAt: this.clock.now() },
      });
      return transaction.explorationRoute.update({
        where: { id: routeId },
        data: {
          status: "PUBLISHED",
          publishedAt: this.clock.now(),
          archivedAt: null,
        },
        include: {
          quests: {
            include: { task: true },
            orderBy: { sequence: "asc" },
          },
        },
      });
    });
    return this.toRouteSummary(published);
  }

  async duplicateAdminExplorationRoute(routeId: string) {
    const source = await this.prisma.explorationRoute.findUnique({
      where: { id: routeId },
      include: {
        quests: {
          include: { task: true },
          orderBy: { sequence: "asc" },
        },
      },
    });
    if (!source || source.status === "DRAFT") {
      throw new BadRequestException(
        "Only a published or archived route can create a new version",
      );
    }
    const version = source.version + 1;
    const route = await this.prisma.explorationRoute.create({
      data: {
        slug: `${source.slug.replace(/-v\d+$/, "")}-v${version}`,
        name: source.name,
        description: source.description,
        badgeName: source.badgeName,
        badgeAssetKey: source.badgeAssetKey,
        version,
        quests: {
          create: source.quests.map((quest) => ({
            sequence: quest.sequence,
            locationName: quest.locationName,
            category: quest.category,
            safetyNote: quest.safetyNote,
            accessibilityTags: quest.accessibilityTags,
            sourceUrl: quest.sourceUrl,
            triggerType: quest.triggerType,
            latitude: quest.latitude,
            longitude: quest.longitude,
            radiusMeters: quest.radiusMeters,
            unlockDistanceMeters: quest.unlockDistanceMeters,
            active: quest.active,
            task: {
              create: {
                title: quest.task.title,
                description: quest.task.description,
                verificationMode: quest.task.verificationMode,
                verificationRule:
                  quest.task.verificationRule ?? Prisma.JsonNull,
                growthPoints: quest.task.growthPoints,
              },
            },
          })),
        },
      },
      include: {
        quests: {
          include: { task: true },
          orderBy: { sequence: "asc" },
        },
      },
    });
    return this.toRouteSummary(route);
  }

  async archiveAdminExplorationRoute(routeId: string) {
    const route = await this.prisma.explorationRoute.findUnique({
      where: { id: routeId },
    });
    if (!route) throw new NotFoundException("Exploration route not found");
    if (route.status === "DRAFT") {
      throw new BadRequestException("Draft routes cannot be archived");
    }
    const archived = await this.prisma.explorationRoute.update({
      where: { id: routeId },
      data: { status: "ARCHIVED", archivedAt: this.clock.now() },
      include: {
        quests: {
          include: { task: true },
          orderBy: { sequence: "asc" },
        },
      },
    });
    return this.toRouteSummary(archived);
  }

  async getRadarState(firebaseUid: string): Promise<RadarState> {
    const active = await this.getActiveUser(firebaseUid);
    const now = this.clock.now();
    const missions = await this.prisma.radarMission.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { endsAt: { gte: now } },
          {
            progress: {
              some: {
                userId: active.id,
                householdId: active.activeHouseholdId,
              },
            },
          },
        ],
      },
      include: {
        progress: {
          where: {
            userId: active.id,
            householdId: active.activeHouseholdId,
          },
        },
      },
      orderBy: [{ endsAt: "asc" }, { createdAt: "asc" }],
    });
    const campaignIds = [
      ...new Set(
        missions
          .map((mission) => mission.campaignId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (campaignIds.length > 0) {
      await this.prisma.campaignReach.createMany({
        data: campaignIds.map((campaignId) => ({
          campaignId,
          userId: active.id,
        })),
        skipDuplicates: true,
      });
    }
    return {
      generatedAt: now.toISOString(),
      missions: missions.map((mission) =>
        this.toRadarMissionSummary(mission, now),
      ),
    };
  }

  async getPublicRadarState(): Promise<RadarState> {
    const now = this.clock.now();
    const missions = await this.prisma.radarMission.findMany({
      where: {
        status: "PUBLISHED",
        endsAt: { gte: now },
      },
      include: { progress: { take: 0 } },
      orderBy: [{ endsAt: "asc" }, { createdAt: "asc" }],
      take: 12,
    });
    return {
      generatedAt: now.toISOString(),
      missions: missions.map((mission) =>
        this.toRadarMissionSummary({ ...mission, progress: [] }, now),
      ),
    };
  }

  async listAdminRadarMissions(): Promise<RadarMissionSummary[]> {
    const missions = await this.prisma.radarMission.findMany({
      include: { progress: { take: 0 } },
      orderBy: [{ createdAt: "desc" }],
    });
    const now = this.clock.now();
    return missions.map((mission) =>
      this.toRadarMissionSummary({ ...mission, progress: [] }, now),
    );
  }

  async listPartnerOrganizations(
    firebaseUid: string,
  ): Promise<PartnerOrganizationSummary[]> {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        organizationMemberships: {
          where: { role: UserRole.ORG_ADMIN },
          include: { organization: true },
          orderBy: { organization: { name: "asc" } },
        },
      },
    });
    if (!user || user.organizationMemberships.length === 0) {
      throw new ForbiddenException("Journey partner access required");
    }
    return user.organizationMemberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      role: "ORG_ADMIN",
    }));
  }

  async getWorkspaceAccess(
    firebaseUid: string,
  ): Promise<WorkspaceAccessSummary> {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        role: true,
        organizationMemberships: {
          where: { role: UserRole.ORG_ADMIN },
          include: { organization: true },
          orderBy: { organization: { name: "asc" } },
        },
      },
    });
    if (!user) throw new ForbiddenException("Workspace access required");
    return {
      role: user.role,
      organizations: user.organizationMemberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        role: "ORG_ADMIN",
      })),
    };
  }

  async getPartnerWorkspace(
    firebaseUid: string,
    organizationId: string,
  ): Promise<PartnerWorkspaceSummary> {
    const membership = await this.getPartnerMembership(
      firebaseUid,
      organizationId,
    );
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizationId },
      include: {
        organization: true,
        reaches: { select: { userId: true } },
        radarMission: {
          include: {
            progress: { select: { userId: true, completedAt: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        role: "ORG_ADMIN",
      },
      campaigns: campaigns.map((campaign) =>
        this.toPartnerCampaignSummary(campaign),
      ),
    };
  }

  async createPartnerCampaign(
    firebaseUid: string,
    organizationId: string,
    input: PartnerCampaignInput,
  ): Promise<PartnerCampaignSummary> {
    const membership = await this.getPartnerMembership(
      firebaseUid,
      organizationId,
    );
    this.assertValidPartnerCampaignInput(input);
    const campaign = await this.prisma.campaign.create({
      data: {
        organizationId,
        createdByUserId: membership.user.id,
        ...this.toPartnerCampaignData(input),
      },
      include: {
        organization: true,
        reaches: { select: { userId: true } },
        radarMission: {
          include: {
            progress: { select: { userId: true, completedAt: true } },
          },
        },
      },
    });
    return this.toPartnerCampaignSummary(campaign);
  }

  async updatePartnerCampaign(
    firebaseUid: string,
    organizationId: string,
    campaignId: string,
    input: PartnerCampaignInput,
  ): Promise<PartnerCampaignSummary> {
    this.assertValidPartnerCampaignInput(input);
    const campaign = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`partner-campaign:${campaignId}`}))
      `;
      const membership = await transaction.organizationMember.findFirst({
        where: {
          organizationId,
          role: UserRole.ORG_ADMIN,
          user: { firebaseUid },
        },
      });
      if (!membership) {
        throw new ForbiddenException("Journey partner access required");
      }
      const existing = await transaction.campaign.findFirst({
        where: { id: campaignId, organizationId },
      });
      if (!existing) throw new NotFoundException("Partner campaign not found");
      if (!["DRAFT", "REJECTED"].includes(existing.status)) {
        throw new ConflictException("Submitted campaigns are read-only");
      }
      return transaction.campaign.update({
        where: { id: campaignId },
        data: {
          ...this.toPartnerCampaignData(input),
          status: "DRAFT",
          submittedAt: null,
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNote: null,
        },
        include: {
          organization: true,
          reaches: { select: { userId: true } },
          radarMission: {
            include: {
              progress: { select: { userId: true, completedAt: true } },
            },
          },
        },
      });
    });
    return this.toPartnerCampaignSummary(campaign);
  }

  async submitPartnerCampaign(
    firebaseUid: string,
    organizationId: string,
    campaignId: string,
  ): Promise<PartnerCampaignSummary> {
    const campaign = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`partner-campaign:${campaignId}`}))
      `;
      const membership = await transaction.organizationMember.findFirst({
        where: {
          organizationId,
          role: UserRole.ORG_ADMIN,
          user: { firebaseUid },
        },
      });
      if (!membership) {
        throw new ForbiddenException("Journey partner access required");
      }
      const existing = await transaction.campaign.findFirst({
        where: { id: campaignId, organizationId },
      });
      if (!existing) throw new NotFoundException("Partner campaign not found");
      if (existing.status !== "DRAFT") {
        throw new ConflictException("Only draft campaigns can be submitted");
      }
      this.assertValidStoredPartnerCampaign(existing);
      return transaction.campaign.update({
        where: { id: campaignId },
        data: { status: "SUBMITTED", submittedAt: this.clock.now() },
        include: {
          organization: true,
          reaches: { select: { userId: true } },
          radarMission: {
            include: {
              progress: { select: { userId: true, completedAt: true } },
            },
          },
        },
      });
    });
    return this.toPartnerCampaignSummary(campaign);
  }

  async listAdminPartnerCampaigns(): Promise<PartnerCampaignSummary[]> {
    const campaigns = await this.prisma.campaign.findMany({
      include: {
        organization: true,
        reaches: { select: { userId: true } },
        radarMission: {
          include: {
            progress: { select: { userId: true, completedAt: true } },
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    });
    return campaigns.map((campaign) => this.toPartnerCampaignSummary(campaign));
  }

  async approvePartnerCampaign(
    firebaseUid: string,
    campaignId: string,
    reviewNote: string,
  ): Promise<PartnerCampaignSummary> {
    this.assertValidPartnerReviewNote(reviewNote);
    const now = this.clock.now();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`partner-campaign:${campaignId}`}))
      `;
      const reviewer = await transaction.user.findUnique({
        where: { firebaseUid },
      });
      if (!reviewer || reviewer.role !== UserRole.PLATFORM_ADMIN) {
        throw new ForbiddenException("Platform administrator required");
      }
      const campaign = await transaction.campaign.findUnique({
        where: { id: campaignId },
        include: { radarMission: true },
      });
      if (!campaign) throw new NotFoundException("Partner campaign not found");
      if (campaign.status === "APPROVED" && campaign.radarMission) return;
      if (campaign.status !== "SUBMITTED") {
        throw new ConflictException("Campaign is not awaiting review");
      }
      this.assertValidStoredPartnerCampaign(campaign);
      if (campaign.endsAt <= now) {
        throw new ConflictException("Campaign end time has already passed");
      }
      const mission = await transaction.radarMission.create({
        data: {
          campaignId: campaign.id,
          title: campaign.title,
          description: campaign.description,
          category: "PARTNER",
          tag: "旅程共創",
          latitude: campaign.latitude,
          longitude: campaign.longitude,
          radiusMeters: campaign.radiusMeters,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
          verificationMode: campaign.verificationMode,
          minimumSeconds: campaign.minimumSeconds,
          growthPoints: campaign.growthPoints,
          badgeName: campaign.badgeName,
          venueName: campaign.venueName,
          accessibilityNotes: campaign.accessibilityNotes,
          safetyNotes: campaign.safetyNotes,
          optionalOffer: campaign.optionalOffer,
          status: "PUBLISHED",
          publishedAt: now,
        },
      });
      await transaction.campaign.update({
        where: { id: campaign.id },
        data: {
          status: "APPROVED",
          reviewedAt: now,
          reviewedByUserId: reviewer.id,
          reviewNote: reviewNote.trim(),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: reviewer.id,
          action: "PARTNER_CAMPAIGN_APPROVED",
          entityType: "Campaign",
          entityId: campaign.id,
          after: { radarMissionId: mission.id, reviewNote: reviewNote.trim() },
        },
      });
    });
    return this.getAdminPartnerCampaign(campaignId);
  }

  async rejectPartnerCampaign(
    firebaseUid: string,
    campaignId: string,
    reviewNote: string,
  ): Promise<PartnerCampaignSummary> {
    this.assertValidPartnerReviewNote(reviewNote);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`partner-campaign:${campaignId}`}))
      `;
      const reviewer = await transaction.user.findUnique({
        where: { firebaseUid },
      });
      if (!reviewer || reviewer.role !== UserRole.PLATFORM_ADMIN) {
        throw new ForbiddenException("Platform administrator required");
      }
      const existing = await transaction.campaign.findUnique({
        where: { id: campaignId },
      });
      if (!existing) throw new NotFoundException("Partner campaign not found");
      if (existing.status !== "SUBMITTED") {
        throw new ConflictException("Campaign is not awaiting review");
      }
      const reviewedAt = this.clock.now();
      await transaction.campaign.update({
        where: { id: campaignId },
        data: {
          status: "REJECTED",
          reviewedAt,
          reviewedByUserId: reviewer.id,
          reviewNote: reviewNote.trim(),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: reviewer.id,
          action: "PARTNER_CAMPAIGN_REJECTED",
          entityType: "Campaign",
          entityId: campaignId,
          after: { reviewNote: reviewNote.trim() },
        },
      });
    });
    return this.getAdminPartnerCampaign(campaignId);
  }

  async getRecentCompanionPrompts(
    firebaseUid: string,
  ): Promise<CompanionPromptSummary[]> {
    const active = await this.getActiveUser(firebaseUid);
    const prompts = await this.prisma.companionPrompt.findMany({
      where: {
        householdId: active.activeHouseholdId,
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    return prompts.map((prompt) => this.toCompanionPromptSummary(prompt));
  }

  async listAdminCompanionPrompts(): Promise<CompanionPromptSummary[]> {
    const prompts = await this.prisma.companionPrompt.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return prompts.map((prompt) => this.toCompanionPromptSummary(prompt));
  }

  async createAdminRadarMission(
    input: RadarMissionInput,
  ): Promise<RadarMissionSummary> {
    this.assertValidRadarMissionInput(input);
    const mission = await this.prisma.radarMission.create({
      data: this.toRadarMissionData(input),
      include: { progress: { take: 0 } },
    });
    return this.toRadarMissionSummary(
      { ...mission, progress: [] },
      this.clock.now(),
    );
  }

  async updateAdminRadarMission(
    missionId: string,
    input: RadarMissionInput,
  ): Promise<RadarMissionSummary> {
    this.assertValidRadarMissionInput(input);
    const existing = await this.prisma.radarMission.findUnique({
      where: { id: missionId },
    });
    if (!existing) throw new NotFoundException("Radar mission not found");
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Published radar missions are immutable");
    }
    const mission = await this.prisma.radarMission.update({
      where: { id: missionId },
      data: this.toRadarMissionData(input),
      include: { progress: { take: 0 } },
    });
    return this.toRadarMissionSummary(
      { ...mission, progress: [] },
      this.clock.now(),
    );
  }

  async publishAdminRadarMission(
    missionId: string,
  ): Promise<RadarMissionSummary> {
    const existing = await this.prisma.radarMission.findUnique({
      where: { id: missionId },
    });
    if (!existing) throw new NotFoundException("Radar mission not found");
    if (existing.verificationMode === VerificationMode.PHOTO_AI) {
      throw new BadRequestException(
        "PHOTO_AI radar missions are not supported in this MVP",
      );
    }
    const mission = await this.prisma.radarMission.update({
      where: { id: missionId },
      data: {
        status: "PUBLISHED",
        publishedAt: this.clock.now(),
        archivedAt: null,
      },
      include: { progress: { take: 0 } },
    });
    return this.toRadarMissionSummary(
      { ...mission, progress: [] },
      this.clock.now(),
    );
  }

  async archiveAdminRadarMission(
    missionId: string,
  ): Promise<RadarMissionSummary> {
    const existing = await this.prisma.radarMission.findUnique({
      where: { id: missionId },
    });
    if (!existing) throw new NotFoundException("Radar mission not found");
    const mission = await this.prisma.radarMission.update({
      where: { id: missionId },
      data: {
        status: "ARCHIVED",
        archivedAt: this.clock.now(),
      },
      include: { progress: { take: 0 } },
    });
    return this.toRadarMissionSummary(
      { ...mission, progress: [] },
      this.clock.now(),
    );
  }

  async unlockRadarMission(
    firebaseUid: string,
    missionId: string,
    event: {
      eventKey: string;
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      occurredAt: string;
    },
  ): Promise<RadarState> {
    if (event.accuracyMeters > 50) {
      throw new BadRequestException(
        "Location accuracy must be within 50 meters",
      );
    }
    const occurredAt = new Date(event.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException("Invalid radar event time");
    }
    const eventAge = this.clock.now().getTime() - occurredAt.getTime();
    if (eventAge > 5 * 60 * 1000 || eventAge < -60 * 1000) {
      throw new BadRequestException(
        "Radar event time is outside the accepted window",
      );
    }
    const active = await this.getActiveUser(firebaseUid);
    const mission = await this.prisma.radarMission.findFirst({
      where: { id: missionId, status: "PUBLISHED" },
    });
    if (!mission)
      throw new NotFoundException("Published radar mission not found");
    const now = this.clock.now();
    if (now < mission.startsAt || now > mission.endsAt) {
      throw new BadRequestException("Radar mission is not currently available");
    }
    const distanceMeters = distanceBetweenMeters(
      { latitude: mission.latitude, longitude: mission.longitude },
      { latitude: event.latitude, longitude: event.longitude },
    );
    if (distanceMeters > mission.radiusMeters) {
      throw new BadRequestException("You must be inside the mission radius");
    }

    await this.prisma.radarMissionProgress.upsert({
      where: {
        missionId_userId_householdId: {
          missionId,
          userId: active.id,
          householdId: active.activeHouseholdId,
        },
      },
      update: { lastEventKey: event.eventKey },
      create: {
        missionId,
        userId: active.id,
        householdId: active.activeHouseholdId,
        unlockedAt: now,
        lastEventKey: event.eventKey,
      },
    });
    return this.getRadarState(firebaseUid);
  }

  async completeRadarMission(
    firebaseUid: string,
    missionId: string,
    _idempotencyKey?: string,
  ): Promise<RadarState> {
    const active = await this.getActiveUser(firebaseUid);
    const now = this.clock.now();
    const companionNotification = await this.prisma.$transaction(
      async (
        transaction,
      ): Promise<{
        sourceTitle: string;
        growthPoints: number;
        companionReply: string;
      } | null> => {
        const progress = await transaction.radarMissionProgress.findUnique({
          where: {
            missionId_userId_householdId: {
              missionId,
              userId: active.id,
              householdId: active.activeHouseholdId,
            },
          },
          include: { mission: true },
        });
        if (!progress)
          throw new NotFoundException("Radar mission is not unlocked");
        if (progress.completedAt) {
          await this.ensureRadarCompanionPrompt(
            transaction,
            progress,
            active.id,
            active.activeHouseholdId,
            progress.completedAt,
          );
          return null;
        }
        if (progress.mission.status !== "PUBLISHED") {
          throw new BadRequestException("Radar mission is not published");
        }
        if (now > progress.mission.endsAt) {
          throw new BadRequestException("Radar mission has expired");
        }
        if (progress.mission.verificationMode === VerificationMode.PHOTO_AI) {
          throw new BadRequestException(
            "PHOTO_AI radar missions are not supported in this MVP",
          );
        }
        if (progress.mission.verificationMode === VerificationMode.TIMER) {
          const minimumSeconds = progress.mission.minimumSeconds ?? 0;
          const elapsedSeconds = Math.floor(
            (now.getTime() - progress.unlockedAt.getTime()) / 1000,
          );
          if (elapsedSeconds < minimumSeconds) {
            throw new BadRequestException(
              `Radar timer requires ${minimumSeconds - elapsedSeconds} more seconds`,
            );
          }
        }
        await this.awardRadarMissionGrowth(
          transaction,
          progress.id,
          progress.missionId,
          progress.mission.growthPoints,
          active.activeHouseholdId,
        );
        await transaction.radarMissionProgress.update({
          where: { id: progress.id },
          data: { completedAt: now },
        });
        const prompt = await this.ensureRadarCompanionPrompt(
          transaction,
          progress,
          active.id,
          active.activeHouseholdId,
          now,
        );
        return {
          sourceTitle: prompt.sourceTitle,
          growthPoints: prompt.growthPoints,
          companionReply: prompt.companionReply,
        };
      },
    );
    if (companionNotification) {
      await this.pushLineNotificationToHousehold({
        householdId: active.activeHouseholdId,
        excludeUserId: active.id,
        type: "COMPANION_RESPONSE_READY",
        message: `同行成林生活片段：「${companionNotification.sourceTitle}」已完成，生命樹長出新葉 +${companionNotification.growthPoints}。可以自然回應：${companionNotification.companionReply}`,
        quickReplies: ["打開 App", "晚點提醒我", "我需要幫忙"],
      });
    }
    return this.getRadarState(firebaseUid);
  }

  async getExplorationState(firebaseUid: string): Promise<ExplorationState> {
    const active = await this.getActiveUser(firebaseUid);
    const expirationCutoff = new Date(
      this.clock.now().getTime() - 4 * 60 * 60 * 1000,
    );
    await this.prisma.explorationSession.updateMany({
      where: {
        userId: active.id,
        householdId: active.activeHouseholdId,
        status: "ACTIVE",
        startedAt: { lt: expirationCutoff },
      },
      data: {
        status: "EXPIRED",
        endedAt: this.clock.now(),
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
      },
    });
    const [progress, latestReceipt, routes, activeSession] = await Promise.all([
      this.prisma.explorationProgress.findUnique({
        where: {
          userId_householdId: {
            userId: active.id,
            householdId: active.activeHouseholdId,
          },
        },
      }),
      this.prisma.locationEventReceipt.findFirst({
        where: {
          userId: active.id,
          householdId: active.activeHouseholdId,
        },
        orderBy: { occurredAt: "desc" },
      }),
      this.prisma.explorationRoute.findMany({
        where: { status: "PUBLISHED" },
        include: {
          awards: {
            where: {
              userId: active.id,
              householdId: active.activeHouseholdId,
            },
            take: 1,
          },
          quests: {
            where: { active: true },
            include: {
              task: {
                include: {
                  assignments: {
                    where: {
                      userId: active.id,
                      householdId: active.activeHouseholdId,
                    },
                    take: 1,
                  },
                },
              },
              unlocks: {
                where: {
                  userId: active.id,
                  householdId: active.activeHouseholdId,
                },
                take: 1,
              },
            },
            orderBy: { sequence: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.explorationSession.findFirst({
        where: {
          userId: active.id,
          householdId: active.activeHouseholdId,
          status: "ACTIVE",
        },
        orderBy: { startedAt: "desc" },
      }),
    ]);
    return {
      totalDistanceMeters: progress?.totalDistanceMeters ?? 0,
      coarseCell: latestReceipt?.coarseCell ?? null,
      activeSession: activeSession
        ? {
            id: activeSession.id,
            routeId: activeSession.routeId,
            status: activeSession.status,
            distanceMeters: activeSession.distanceMeters,
            startedAt: activeSession.startedAt.toISOString(),
            lastEventAt: activeSession.lastEventAt?.toISOString() ?? null,
          }
        : null,
      routes: routes.map((route) => {
        const completedQuestCount = route.quests.filter(
          (quest) => quest.task.assignments[0]?.status === "COMPLETED",
        ).length;
        return {
          id: route.id,
          slug: route.slug,
          name: route.name,
          description: route.description,
          badgeName: route.badgeName,
          badgeAssetKey: route.badgeAssetKey,
          version: route.version,
          status: route.status,
          publishedAt: route.publishedAt?.toISOString() ?? null,
          completedQuestCount,
          totalQuestCount: route.quests.length,
          badgeAwarded: route.awards.length > 0,
          quests: route.quests.map((quest) => ({
            id: quest.id,
            taskId: quest.taskId,
            sequence: quest.sequence,
            locationName: quest.locationName,
            category: quest.category,
            safetyNote: quest.safetyNote,
            accessibilityTags: quest.accessibilityTags,
            sourceUrl: quest.sourceUrl,
            title: quest.task.title,
            description: quest.task.description,
            verificationMode: quest.task.verificationMode as
              "SELF_CHECK" | "TIMER",
            minimumSeconds:
              typeof (quest.task.verificationRule as Record<string, unknown>)
                .minimumSeconds === "number"
                ? (quest.task.verificationRule as Record<string, number>)
                    .minimumSeconds
                : null,
            growthPoints: quest.task.growthPoints,
            triggerType: quest.triggerType,
            latitude: quest.latitude,
            longitude: quest.longitude,
            radiusMeters: quest.radiusMeters,
            unlockDistanceMeters: quest.unlockDistanceMeters,
            unlocked: quest.unlocks.length > 0,
            completed: quest.task.assignments[0]?.status === "COMPLETED",
          })),
        };
      }),
    };
  }

  async startExplorationSession(firebaseUid: string, routeId: string) {
    const active = await this.getActiveUser(firebaseUid);
    const route = await this.prisma.explorationRoute.findFirst({
      where: { id: routeId, status: "PUBLISHED" },
    });
    if (!route)
      throw new NotFoundException("Published exploration route not found");
    const now = this.clock.now();
    const expirationCutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    await this.prisma.explorationSession.updateMany({
      where: {
        userId: active.id,
        householdId: active.activeHouseholdId,
        status: "ACTIVE",
        startedAt: { lt: expirationCutoff },
      },
      data: {
        status: "EXPIRED",
        endedAt: now,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
      },
    });
    const current = await this.prisma.explorationSession.findFirst({
      where: {
        userId: active.id,
        householdId: active.activeHouseholdId,
        status: "ACTIVE",
      },
      orderBy: { startedAt: "desc" },
    });
    if (current?.routeId === routeId) {
      return {
        id: current.id,
        routeId: current.routeId,
        status: current.status,
        distanceMeters: current.distanceMeters,
        startedAt: current.startedAt.toISOString(),
        lastEventAt: current.lastEventAt?.toISOString() ?? null,
      };
    }
    if (current) {
      await this.prisma.explorationSession.update({
        where: { id: current.id },
        data: {
          status: "ENDED",
          endedAt: now,
          lastLatitude: null,
          lastLongitude: null,
          lastAccuracy: null,
        },
      });
    }
    const session = await this.prisma.explorationSession.create({
      data: {
        routeId,
        userId: active.id,
        householdId: active.activeHouseholdId,
        startedAt: now,
      },
    });
    return {
      id: session.id,
      routeId: session.routeId,
      status: session.status,
      distanceMeters: session.distanceMeters,
      startedAt: session.startedAt.toISOString(),
      lastEventAt: null,
    };
  }

  async recordExplorationSessionEvent(
    firebaseUid: string,
    sessionId: string,
    event: {
      eventKey: string;
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      occurredAt: string;
    },
    options: { simulation?: boolean } = {},
  ): Promise<ExplorationEventResult> {
    if (event.accuracyMeters > 50) {
      throw new BadRequestException(
        "Location accuracy must be within 50 meters",
      );
    }
    const active = await this.getActiveUser(firebaseUid);
    const expirationCutoff = new Date(
      this.clock.now().getTime() - 4 * 60 * 60 * 1000,
    );
    await this.prisma.explorationSession.updateMany({
      where: {
        id: sessionId,
        userId: active.id,
        householdId: active.activeHouseholdId,
        status: "ACTIVE",
        startedAt: { lt: expirationCutoff },
      },
      data: {
        status: "EXPIRED",
        endedAt: this.clock.now(),
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
      },
    });
    const occurredAt = new Date(event.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException("Invalid exploration event time");
    }
    const eventAge = this.clock.now().getTime() - occurredAt.getTime();
    if (
      !options.simulation &&
      (eventAge > 5 * 60 * 1000 || eventAge < -60 * 1000)
    ) {
      throw new BadRequestException(
        "Exploration event time is outside the accepted window",
      );
    }
    const previousReceipt = await this.prisma.locationEventReceipt.findUnique({
      where: { eventKey: event.eventKey },
    });
    if (previousReceipt) {
      return {
        ...(await this.getExplorationState(firebaseUid)),
        duplicate: true,
        acceptedDistanceMeters: previousReceipt.distanceMeters,
        newlyUnlockedTaskIds: [],
      };
    }
    const coarseCell = latLngToCell(event.latitude, event.longitude, 8);

    const transactionResult = await this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`exploration-session:${sessionId}`}))
        `;
        const duplicate = await transaction.locationEventReceipt.findUnique({
          where: { eventKey: event.eventKey },
        });
        if (duplicate) {
          return {
            duplicate: true,
            acceptedDistanceMeters: duplicate.distanceMeters,
            newlyUnlockedTaskIds: [] as string[],
          };
        }
        const session = await transaction.explorationSession.findFirst({
          where: {
            id: sessionId,
            userId: active.id,
            householdId: active.activeHouseholdId,
            status: "ACTIVE",
          },
        });
        if (!session)
          throw new NotFoundException("Active exploration session not found");
        if (
          session.lastEventAt &&
          occurredAt.getTime() <= session.lastEventAt.getTime()
        ) {
          throw new BadRequestException(
            "Exploration events must be chronological",
          );
        }
        let acceptedDistanceMeters = 0;
        if (
          session.lastLatitude !== null &&
          session.lastLongitude !== null &&
          session.lastEventAt
        ) {
          const preciseDistance = distanceBetweenMeters(
            {
              latitude: session.lastLatitude,
              longitude: session.lastLongitude,
            },
            { latitude: event.latitude, longitude: event.longitude },
          );
          const elapsedSeconds =
            (occurredAt.getTime() - session.lastEventAt.getTime()) / 1000;
          const speedMetersPerSecond = preciseDistance / elapsedSeconds;
          if (
            !options.simulation &&
            (preciseDistance > 2_000 || speedMetersPerSecond > 15 / 3.6)
          ) {
            throw new BadRequestException(
              "Location jump is too fast for a walking exploration",
            );
          }
          acceptedDistanceMeters = Math.max(0, Math.round(preciseDistance));
        }
        const nextSessionDistance =
          session.distanceMeters + acceptedDistanceMeters;

        await transaction.explorationProgress.upsert({
          where: {
            userId_householdId: {
              userId: active.id,
              householdId: active.activeHouseholdId,
            },
          },
          update: {
            totalDistanceMeters: { increment: acceptedDistanceMeters },
            lastEventAt: occurredAt,
          },
          create: {
            userId: active.id,
            householdId: active.activeHouseholdId,
            totalDistanceMeters: acceptedDistanceMeters,
            lastEventAt: occurredAt,
          },
        });
        await transaction.explorationSession.update({
          where: { id: session.id },
          data: {
            distanceMeters: nextSessionDistance,
            lastLatitude: event.latitude,
            lastLongitude: event.longitude,
            lastAccuracy: event.accuracyMeters,
            lastEventAt: occurredAt,
          },
        });
        await transaction.locationEventReceipt.create({
          data: {
            eventKey: event.eventKey,
            sessionId: session.id,
            userId: active.id,
            householdId: active.activeHouseholdId,
            coarseCell,
            distanceMeters: acceptedDistanceMeters,
            occurredAt,
          },
        });

        const distanceQuests = await transaction.mapQuest.findMany({
          where: {
            routeId: session.routeId,
            active: true,
            triggerType: QuestTriggerType.DISTANCE,
            unlockDistanceMeters: {
              not: null,
              lte: nextSessionDistance,
            },
          },
          select: { id: true, taskId: true },
        });
        const geofenceQuests = await transaction.$queryRaw<
          Array<{ id: string; taskId: string }>
        >`
          SELECT "id", "taskId"
          FROM "MapQuest"
          WHERE "routeId" = ${session.routeId}
            AND "active" = true
            AND "triggerType" = 'GEOFENCE'::"QuestTriggerType"
            AND "latitude" IS NOT NULL
            AND "longitude" IS NOT NULL
            AND "radiusMeters" IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography,
              ST_SetSRID(ST_MakePoint(${event.longitude}, ${event.latitude}), 4326)::geography,
              "radiusMeters"
            )
        `;
        const candidates = new Map(
          [...distanceQuests, ...geofenceQuests].map((quest) => [
            quest.id,
            quest,
          ]),
        );
        const unlockedTaskIds: string[] = [];
        for (const quest of candidates.values()) {
          const unlock = await transaction.questUnlock.createMany({
            data: [
              {
                questId: quest.id,
                userId: active.id,
                householdId: active.activeHouseholdId,
              },
            ],
            skipDuplicates: true,
          });
          if (unlock.count !== 1) continue;
          unlockedTaskIds.push(quest.taskId);
          await transaction.taskAssignment.createMany({
            data: [
              {
                taskId: quest.taskId,
                userId: active.id,
                householdId: active.activeHouseholdId,
                status: AssignmentStatus.AVAILABLE,
              },
            ],
            skipDuplicates: true,
          });
        }
        return {
          duplicate: false,
          acceptedDistanceMeters,
          newlyUnlockedTaskIds: unlockedTaskIds,
        };
      },
    );
    return {
      ...(await this.getExplorationState(firebaseUid)),
      ...transactionResult,
    };
  }

  async endExplorationSession(firebaseUid: string, sessionId: string) {
    const active = await this.getActiveUser(firebaseUid);
    const session = await this.prisma.explorationSession.findFirst({
      where: {
        id: sessionId,
        userId: active.id,
        householdId: active.activeHouseholdId,
      },
    });
    if (!session) throw new NotFoundException("Exploration session not found");
    if (session.status === "ACTIVE") {
      await this.prisma.explorationSession.update({
        where: { id: session.id },
        data: {
          status: "ENDED",
          endedAt: this.clock.now(),
          lastLatitude: null,
          lastLongitude: null,
          lastAccuracy: null,
        },
      });
    }
    return this.getExplorationState(firebaseUid);
  }

  async simulateExplorationStep(
    firebaseUid: string,
    routeId: string,
    step: number,
  ): Promise<ExplorationEventResult> {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.LOCATION_SIMULATION_ENABLED !== "true"
    ) {
      throw new BadRequestException("Location simulation is disabled");
    }
    const route = await this.prisma.explorationRoute.findFirst({
      where: { id: routeId, status: "PUBLISHED" },
      include: {
        quests: { where: { active: true }, orderBy: { sequence: "asc" } },
      },
    });
    const quest = route?.quests[step - 1];
    if (!route || !quest)
      throw new NotFoundException("Simulation step not found");
    const session = await this.startExplorationSession(firebaseUid, routeId);
    if (
      quest.triggerType === "GEOFENCE" &&
      quest.latitude !== null &&
      quest.longitude !== null
    ) {
      return this.recordExplorationSessionEvent(
        firebaseUid,
        session.id,
        {
          eventKey: `simulation:${session.id}:${step}`,
          latitude: quest.latitude,
          longitude: quest.longitude,
          accuracyMeters: 5,
          occurredAt: new Date(this.clock.now().getTime() + step).toISOString(),
        },
        { simulation: true },
      );
    }
    const active = await this.getActiveUser(firebaseUid);
    const targetDistance = quest.unlockDistanceMeters ?? session.distanceMeters;
    const acceptedDistanceMeters = Math.max(
      0,
      targetDistance - session.distanceMeters,
    );
    const fallbackPoint = route.quests.find(
      (item) => item.latitude !== null && item.longitude !== null,
    );
    const latitude = fallbackPoint?.latitude ?? 25.03367;
    const longitude = fallbackPoint?.longitude ?? 121.53566;
    const eventKey = `simulation:${session.id}:${step}`;
    const duplicate = await this.prisma.locationEventReceipt.findUnique({
      where: { eventKey },
    });
    if (!duplicate) {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.explorationSession.update({
          where: { id: session.id },
          data: {
            distanceMeters: targetDistance,
            lastLatitude: latitude,
            lastLongitude: longitude,
            lastAccuracy: 5,
            lastEventAt: this.clock.now(),
          },
        });
        await transaction.explorationProgress.upsert({
          where: {
            userId_householdId: {
              userId: active.id,
              householdId: active.activeHouseholdId,
            },
          },
          update: {
            totalDistanceMeters: { increment: acceptedDistanceMeters },
            lastEventAt: this.clock.now(),
          },
          create: {
            userId: active.id,
            householdId: active.activeHouseholdId,
            totalDistanceMeters: acceptedDistanceMeters,
            lastEventAt: this.clock.now(),
          },
        });
        await transaction.locationEventReceipt.create({
          data: {
            eventKey,
            sessionId: session.id,
            userId: active.id,
            householdId: active.activeHouseholdId,
            coarseCell: latLngToCell(latitude, longitude, 8),
            distanceMeters: acceptedDistanceMeters,
            occurredAt: this.clock.now(),
          },
        });
        await transaction.questUnlock.createMany({
          data: [
            {
              questId: quest.id,
              userId: active.id,
              householdId: active.activeHouseholdId,
            },
          ],
          skipDuplicates: true,
        });
        await transaction.taskAssignment.createMany({
          data: [
            {
              taskId: quest.taskId,
              userId: active.id,
              householdId: active.activeHouseholdId,
              status: AssignmentStatus.AVAILABLE,
            },
          ],
          skipDuplicates: true,
        });
      });
    }
    return {
      ...(await this.getExplorationState(firebaseUid)),
      duplicate: Boolean(duplicate),
      acceptedDistanceMeters:
        duplicate?.distanceMeters ?? acceptedDistanceMeters,
      newlyUnlockedTaskIds: duplicate ? [] : [quest.taskId],
    };
  }

  private toRouteSummary(route: RouteWithTasks): ExplorationRouteSummary {
    return {
      id: route.id,
      slug: route.slug,
      name: route.name,
      description: route.description,
      badgeName: route.badgeName,
      badgeAssetKey: route.badgeAssetKey,
      version: route.version,
      status: route.status,
      publishedAt: route.publishedAt?.toISOString() ?? null,
      completedQuestCount: 0,
      totalQuestCount: route.quests.length,
      badgeAwarded: false,
      quests: route.quests.map((quest) => ({
        id: quest.id,
        taskId: quest.taskId,
        sequence: quest.sequence,
        locationName: quest.locationName,
        category: quest.category,
        safetyNote: quest.safetyNote,
        accessibilityTags: quest.accessibilityTags,
        sourceUrl: quest.sourceUrl,
        title: quest.task.title,
        description: quest.task.description,
        verificationMode: quest.task.verificationMode as "SELF_CHECK" | "TIMER",
        minimumSeconds:
          typeof (quest.task.verificationRule as Record<string, unknown>)
            .minimumSeconds === "number"
            ? (quest.task.verificationRule as Record<string, number>)
                .minimumSeconds
            : null,
        growthPoints: quest.task.growthPoints,
        triggerType: quest.triggerType,
        latitude: quest.latitude,
        longitude: quest.longitude,
        radiusMeters: quest.radiusMeters,
        unlockDistanceMeters: quest.unlockDistanceMeters,
        unlocked: false,
        completed: false,
      })),
    };
  }

  private async assertDraftRoute(routeId: string): Promise<void> {
    const route = await this.prisma.explorationRoute.findUnique({
      where: { id: routeId },
      select: { status: true },
    });
    if (!route) throw new NotFoundException("Exploration route not found");
    if (route.status !== "DRAFT") {
      throw new ConflictException(
        "Published routes are immutable; create a new draft version",
      );
    }
  }

  private assertValidQuestInput(input: ExplorationQuestInput): void {
    if (!["SELF_CHECK", "TIMER"].includes(input.verificationMode)) {
      throw new BadRequestException(
        "Exploration quests only support SELF_CHECK or TIMER",
      );
    }
    if (
      input.verificationMode === "TIMER" &&
      (!input.minimumSeconds ||
        input.minimumSeconds < 30 ||
        input.minimumSeconds > 3600)
    ) {
      throw new BadRequestException(
        "Timer exploration quests require 30-3600 seconds",
      );
    }
    if (
      input.triggerType === "GEOFENCE" &&
      (input.latitude === null ||
        input.latitude === undefined ||
        input.longitude === null ||
        input.longitude === undefined ||
        input.radiusMeters === null ||
        input.radiusMeters === undefined ||
        input.radiusMeters < 25 ||
        input.radiusMeters > 150)
    ) {
      throw new BadRequestException(
        "Geofence quests require a coordinate and a 25-150 meter radius",
      );
    }
    if (
      input.triggerType === "DISTANCE" &&
      (!input.unlockDistanceMeters || input.unlockDistanceMeters < 50)
    ) {
      throw new BadRequestException(
        "Distance quests require an unlock distance of at least 50 meters",
      );
    }
  }

  private async getPartnerMembership(
    firebaseUid: string,
    organizationId: string,
  ) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        role: UserRole.ORG_ADMIN,
        user: { firebaseUid },
      },
      include: { organization: true, user: true },
    });
    if (!membership) {
      throw new ForbiddenException("Journey partner access required");
    }
    return membership;
  }

  private async getAdminPartnerCampaign(
    campaignId: string,
  ): Promise<PartnerCampaignSummary> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        organization: true,
        reaches: { select: { userId: true } },
        radarMission: {
          include: {
            progress: { select: { userId: true, completedAt: true } },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException("Partner campaign not found");
    return this.toPartnerCampaignSummary(campaign);
  }

  private assertValidPartnerCampaignInput(
    input: PartnerCampaignValidationInput,
  ): void {
    if (input.purchaseRequired !== false) {
      throw new BadRequestException(
        "Partner journeys must be completable without a purchase",
      );
    }
    if (
      input.title.trim().length < 2 ||
      input.title.trim().length > 100 ||
      input.description.trim().length < 8 ||
      input.description.trim().length > 500 ||
      input.venueName.trim().length < 2 ||
      input.venueName.trim().length > 120 ||
      input.accessibilityNotes.trim().length < 4 ||
      input.accessibilityNotes.trim().length > 500 ||
      input.safetyNotes.trim().length < 4 ||
      input.safetyNotes.trim().length > 500 ||
      (input.badgeName != null &&
        (input.badgeName.trim().length < 2 || input.badgeName.trim().length > 80)) ||
      (input.optionalOffer?.trim().length ?? 0) > 240
    ) {
      throw new BadRequestException(
        "Partner journey requires complete venue and safety information",
      );
    }
    if (
      !Number.isFinite(input.latitude) ||
      input.latitude < -90 ||
      input.latitude > 90 ||
      !Number.isFinite(input.longitude) ||
      input.longitude < -180 ||
      input.longitude > 180 ||
      !Number.isInteger(input.growthPoints) ||
      input.growthPoints < 1 ||
      input.growthPoints > 50 ||
      !Number.isInteger(input.radiusMeters) ||
      (input.verificationMode === "TIMER" && !Number.isInteger(input.minimumSeconds))
    ) {
      throw new BadRequestException(
        "Partner journey requires valid coordinates and growth points",
      );
    }
    this.assertValidRadarMissionInput({
      title: input.title,
      description: input.description,
      category: "PARTNER",
      tag: "旅程共創",
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      verificationMode: input.verificationMode,
      minimumSeconds: input.minimumSeconds,
      growthPoints: input.growthPoints,
      badgeName: input.badgeName,
    });
  }

  private assertValidStoredPartnerCampaign(
    campaign: Prisma.CampaignGetPayload<Record<string, never>>,
  ): void {
    this.assertValidPartnerCampaignInput({
      title: campaign.title,
      description: campaign.description,
      venueName: campaign.venueName,
      latitude: campaign.latitude,
      longitude: campaign.longitude,
      radiusMeters: campaign.radiusMeters,
      startsAt: campaign.startsAt.toISOString(),
      endsAt: campaign.endsAt.toISOString(),
      verificationMode: campaign.verificationMode as "SELF_CHECK" | "TIMER",
      minimumSeconds: campaign.minimumSeconds,
      growthPoints: campaign.growthPoints,
      badgeName: campaign.badgeName,
      accessibilityNotes: campaign.accessibilityNotes,
      safetyNotes: campaign.safetyNotes,
      optionalOffer: campaign.optionalOffer,
      purchaseRequired: campaign.purchaseRequired,
    });
  }

  private assertValidPartnerReviewNote(reviewNote: string): void {
    const length = reviewNote.trim().length;
    if (length < 4 || length > 500) {
      throw new BadRequestException(
        "Review note must contain 4-500 characters",
      );
    }
  }

  private toPartnerCampaignData(input: PartnerCampaignInput) {
    return {
      title: input.title.trim(),
      description: input.description.trim(),
      venueName: input.venueName.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      verificationMode: input.verificationMode,
      minimumSeconds:
        input.verificationMode === "TIMER" ? input.minimumSeconds : null,
      growthPoints: input.growthPoints,
      badgeName: input.badgeName?.trim() || null,
      accessibilityNotes: input.accessibilityNotes.trim(),
      safetyNotes: input.safetyNotes.trim(),
      optionalOffer: input.optionalOffer?.trim() || null,
      purchaseRequired: false,
    };
  }

  private toPartnerCampaignSummary(
    campaign: PartnerCampaignRecord,
  ): PartnerCampaignSummary {
    const progress = campaign.radarMission?.progress ?? [];
    const deliveredToAppCount = campaign.reaches.length;
    const arrivedCount = new Set(progress.map((entry) => entry.userId)).size;
    const completedCount = new Set(
      progress
        .filter((entry) => entry.completedAt !== null)
        .map((entry) => entry.userId),
    ).size;
    return {
      id: campaign.id,
      organizationId: campaign.organizationId,
      organizationName: campaign.organization.name,
      title: campaign.title,
      description: campaign.description,
      venueName: campaign.venueName,
      latitude: campaign.latitude,
      longitude: campaign.longitude,
      radiusMeters: campaign.radiusMeters,
      startsAt: campaign.startsAt.toISOString(),
      endsAt: campaign.endsAt.toISOString(),
      verificationMode: campaign.verificationMode as "SELF_CHECK" | "TIMER",
      minimumSeconds: campaign.minimumSeconds,
      growthPoints: campaign.growthPoints,
      badgeName: campaign.badgeName,
      accessibilityNotes: campaign.accessibilityNotes,
      safetyNotes: campaign.safetyNotes,
      optionalOffer: campaign.optionalOffer,
      purchaseRequired: false,
      status: campaign.status,
      submittedAt: campaign.submittedAt?.toISOString() ?? null,
      reviewedAt: campaign.reviewedAt?.toISOString() ?? null,
      reviewNote: campaign.reviewNote,
      radarMissionId: campaign.radarMission?.id ?? null,
      metrics: {
        deliveredToAppCount,
        arrivedCount,
        completedCount,
        completionRate:
          deliveredToAppCount === 0 ? 0 : completedCount / deliveredToAppCount,
      },
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }

  private assertValidRadarMissionInput(input: RadarMissionInput): void {
    if (!["SELF_CHECK", "TIMER"].includes(input.verificationMode)) {
      throw new BadRequestException(
        "Radar missions only support SELF_CHECK or TIMER in this MVP",
      );
    }
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException(
        "Radar mission requires a valid time window",
      );
    }
    if (input.radiusMeters < 25 || input.radiusMeters > 150) {
      throw new BadRequestException(
        "Radar mission radius must be 25-150 meters",
      );
    }
    if (
      input.verificationMode === "TIMER" &&
      (!input.minimumSeconds ||
        input.minimumSeconds < 30 ||
        input.minimumSeconds > 3600)
    ) {
      throw new BadRequestException(
        "Timer radar missions require 30-3600 seconds",
      );
    }
  }

  private toRadarMissionData(input: RadarMissionInput) {
    return {
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category.trim().toUpperCase(),
      tag: input.tag.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      verificationMode: input.verificationMode,
      minimumSeconds:
        input.verificationMode === "TIMER" ? input.minimumSeconds : null,
      growthPoints: input.growthPoints,
      badgeName: input.badgeName?.trim() || null,
      companionElderMessageTemplate:
        input.companionPromptTemplates?.elderMessage?.trim() || null,
      companionReplyTemplate:
        input.companionPromptTemplates?.companionReply?.trim() || null,
      companionVolunteerNoteTemplate:
        input.companionPromptTemplates?.volunteerNote?.trim() || null,
      companionShareSummaryTemplate:
        input.companionPromptTemplates?.shareSummary?.trim() || null,
    };
  }

  private toRadarMissionSummary(
    mission: RadarMissionWithProgress,
    now: Date,
  ): RadarMissionSummary {
    const progress = mission.progress[0];
    let status: RadarMissionStatus = "LOCKED";
    if (progress?.completedAt) {
      status = "COMPLETED";
    } else if (now < mission.startsAt) {
      status = "UPCOMING";
    } else if (now > mission.endsAt) {
      status = "EXPIRED";
    } else if (progress) {
      status = "UNLOCKED";
    }
    return {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      category: mission.category,
      tag: mission.tag,
      latitude: mission.latitude,
      longitude: mission.longitude,
      radiusMeters: mission.radiusMeters,
      startsAt: mission.startsAt.toISOString(),
      endsAt: mission.endsAt.toISOString(),
      remainingSeconds: Math.max(
        0,
        Math.floor((mission.endsAt.getTime() - now.getTime()) / 1000),
      ),
      verificationMode: mission.verificationMode as "SELF_CHECK" | "TIMER",
      minimumSeconds: mission.minimumSeconds,
      growthPoints: mission.growthPoints,
      badgeName: mission.badgeName,
      venueName: mission.venueName,
      accessibilityNotes: mission.accessibilityNotes,
      safetyNotes: mission.safetyNotes,
      optionalOffer: mission.optionalOffer,
      publicationStatus: mission.status,
      status,
      unlockedAt: progress?.unlockedAt.toISOString() ?? null,
      completedAt: progress?.completedAt?.toISOString() ?? null,
      companionPromptTemplates: {
        elderMessage: mission.companionElderMessageTemplate,
        companionReply: mission.companionReplyTemplate,
        volunteerNote: mission.companionVolunteerNoteTemplate,
        shareSummary: mission.companionShareSummaryTemplate,
      },
    };
  }

  private async ensureRadarCompanionPrompt(
    transaction: Prisma.TransactionClient,
    progress: Prisma.RadarMissionProgressGetPayload<{
      include: { mission: true };
    }>,
    userId: string,
    householdId: string,
    createdAt: Date,
  ) {
    const prompt = this.buildRadarCompanionPrompt(progress.mission);
    return transaction.companionPrompt.upsert({
      where: { radarMissionProgressId: progress.id },
      update: { sourceTitle: progress.mission.title },
      create: {
        radarMissionProgressId: progress.id,
        userId,
        householdId,
        sourceTitle: progress.mission.title,
        category: progress.mission.category,
        tag: progress.mission.tag,
        growthPoints: progress.mission.growthPoints,
        elderMessage: prompt.elderMessage,
        companionReply: prompt.companionReply,
        volunteerNote: prompt.volunteerNote,
        shareSummary: prompt.shareSummary,
        createdAt,
      },
    });
  }

  private buildRadarCompanionPrompt(mission: RadarMissionPromptSource) {
    const replacements = {
      title: mission.title,
      tag: mission.tag,
      category: mission.category,
      growthPoints: String(mission.growthPoints),
    };
    return {
      elderMessage: fillPromptTemplate(
        mission.companionElderMessageTemplate,
        DEFAULT_COMPANION_PROMPT_TEMPLATES.elderMessage,
        replacements,
      ),
      companionReply: fillPromptTemplate(
        mission.companionReplyTemplate,
        DEFAULT_COMPANION_PROMPT_TEMPLATES.companionReply,
        replacements,
      ),
      volunteerNote: fillPromptTemplate(
        mission.companionVolunteerNoteTemplate,
        DEFAULT_COMPANION_PROMPT_TEMPLATES.volunteerNote,
        replacements,
      ),
      shareSummary: fillPromptTemplate(
        mission.companionShareSummaryTemplate,
        DEFAULT_COMPANION_PROMPT_TEMPLATES.shareSummary,
        replacements,
      ),
    };
  }

  private toCompanionPromptSummary(prompt: {
    id: string;
    sourceType: "RADAR_MISSION";
    householdId: string;
    user?: { displayName: string } | null;
    sourceTitle: string;
    category: string;
    tag: string;
    growthPoints: number;
    elderMessage: string;
    companionReply: string;
    volunteerNote: string;
    shareSummary: string;
    createdAt: Date;
  }): CompanionPromptSummary {
    return {
      id: prompt.id,
      sourceType: prompt.sourceType,
      householdId: prompt.householdId,
      participantName: prompt.user?.displayName ?? "家庭成員",
      sourceTitle: prompt.sourceTitle,
      category: prompt.category,
      tag: prompt.tag,
      growthPoints: prompt.growthPoints,
      elderMessage: prompt.elderMessage,
      companionReply: prompt.companionReply,
      volunteerNote: prompt.volunteerNote,
      shareSummary: prompt.shareSummary,
      createdAt: prompt.createdAt.toISOString(),
    };
  }

  private async findAssignment(
    firebaseUid: string,
    assignmentId: string,
  ): Promise<AssignmentWithTask> {
    const active = await this.getActiveUser(firebaseUid);
    const assignment = await this.prisma.taskAssignment.findFirst({
      where: {
        id: assignmentId,
        userId: active.id,
        householdId: active.activeHouseholdId,
      },
      include: { task: true },
    });
    if (!assignment) throw new NotFoundException("Task assignment not found");
    return assignment;
  }

  private async getActiveUser(firebaseUid: string) {
    await this.ensureUserContext(firebaseUid);
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user?.activeHouseholdId) {
      throw new NotFoundException("Active household not found");
    }
    return {
      id: user.id,
      activeHouseholdId: user.activeHouseholdId,
    };
  }

  private async awardTaskGrowth(
    transaction: Prisma.TransactionClient,
    assignment: {
      id: string;
      task: { growthPoints: number };
    },
    householdId: string,
  ): Promise<void> {
    const tree = await transaction.tree.findFirst({
      where: { householdId },
      orderBy: { createdAt: "asc" },
    });
    if (!tree) throw new NotFoundException("Companion tree not found");
    const canonicalIdempotencyKey = `assignment:${assignment.id}`;
    const inserted = await transaction.$executeRaw`
      INSERT INTO "GrowthEntry"
        ("id", "treeId", "idempotencyKey", "points", "reason", "sourceId", "createdAt")
      VALUES
        (${randomUUID()}, ${tree.id}, ${canonicalIdempotencyKey},
         ${assignment.task.growthPoints}, 'TASK_COMPLETED', ${assignment.id}, NOW())
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `;
    if (inserted !== 1) return;
    const updatedTree = await transaction.tree.update({
      where: { id: tree.id },
      data: { growthPoints: { increment: assignment.task.growthPoints } },
    });
    await transaction.tree.update({
      where: { id: tree.id },
      data: {
        stage: stageForPoints(updatedTree.growthPoints) as PrismaTreeStage,
      },
    });
  }

  private async awardRadarMissionGrowth(
    transaction: Prisma.TransactionClient,
    progressId: string,
    missionId: string,
    growthPoints: number,
    householdId: string,
  ): Promise<void> {
    const tree = await transaction.tree.findFirst({
      where: { householdId },
      orderBy: { createdAt: "asc" },
    });
    if (!tree) throw new NotFoundException("Companion tree not found");
    const canonicalIdempotencyKey = `radar:${progressId}`;
    const inserted = await transaction.$executeRaw`
      INSERT INTO "GrowthEntry"
        ("id", "treeId", "idempotencyKey", "points", "reason", "sourceId", "createdAt")
      VALUES
        (${randomUUID()}, ${tree.id}, ${canonicalIdempotencyKey},
         ${growthPoints}, 'RADAR_MISSION_COMPLETED', ${missionId}, NOW())
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `;
    if (inserted !== 1) return;
    const updatedTree = await transaction.tree.update({
      where: { id: tree.id },
      data: { growthPoints: { increment: growthPoints } },
    });
    await transaction.tree.update({
      where: { id: tree.id },
      data: {
        stage: stageForPoints(updatedTree.growthPoints) as PrismaTreeStage,
      },
    });
  }

  private async awardCooperativeActionGrowth(
    transaction: Prisma.TransactionClient,
    runId: string,
    growthPoints: number,
    householdId: string,
  ): Promise<void> {
    const tree = await transaction.tree.findFirst({
      where: { householdId },
      orderBy: { createdAt: "asc" },
    });
    if (!tree) throw new NotFoundException("Companion tree not found");
    const idempotencyKey = `cooperative-action:${runId}`;
    const inserted = await transaction.$executeRaw`
      INSERT INTO "GrowthEntry"
        ("id", "treeId", "idempotencyKey", "points", "reason", "sourceId", "createdAt")
      VALUES
        (${randomUUID()}, ${tree.id}, ${idempotencyKey},
         ${growthPoints}, 'COOPERATIVE_ACTION_COMPLETED', ${runId}, NOW())
      ON CONFLICT ("idempotencyKey") DO NOTHING
    `;
    if (inserted !== 1) return;
    const updatedTree = await transaction.tree.update({
      where: { id: tree.id },
      data: { growthPoints: { increment: growthPoints } },
    });
    await transaction.tree.update({
      where: { id: tree.id },
      data: {
        stage: stageForPoints(updatedTree.growthPoints) as PrismaTreeStage,
      },
    });
  }

  private async awardCompletedRouteBadge(
    transaction: Prisma.TransactionClient,
    userId: string,
    householdId: string,
    taskId: string,
  ): Promise<void> {
    const quest = await transaction.mapQuest.findUnique({
      where: { taskId },
      include: {
        route: {
          include: {
            quests: {
              where: { active: true },
              select: { taskId: true },
            },
          },
        },
      },
    });
    if (!quest || quest.route.status !== "PUBLISHED") return;
    const taskIds = quest.route.quests.map((item) => item.taskId);
    if (taskIds.length === 0) return;
    const completedCount = await transaction.taskAssignment.count({
      where: {
        userId,
        householdId,
        taskId: { in: taskIds },
        status: AssignmentStatus.COMPLETED,
      },
    });
    if (completedCount !== taskIds.length) return;
    await transaction.explorationRouteAward.createMany({
      data: [
        {
          routeId: quest.routeId,
          userId,
          householdId,
        },
      ],
      skipDuplicates: true,
    });
  }

  private toDeviceSummary(device: {
    id: string;
    serialNumber: string;
    thingName: string;
    householdId: string | null;
    firmwareVersion: string;
    desiredState: Prisma.JsonValue | null;
    reportedState: Prisma.JsonValue | null;
    updatedAt: Date;
  }): CompanionDeviceSummary {
    const desired = (device.desiredState ?? {}) as Partial<DeviceDesiredState>;
    const reported = (device.reportedState ??
      {}) as Partial<DeviceReportedState>;
    const now = device.updatedAt.toISOString();
    return {
      id: device.id,
      serialNumber: device.serialNumber,
      name: device.thingName,
      claimed: device.householdId !== null,
      desiredState: {
        activeTaskId: desired.activeTaskId ?? null,
        activeTaskTitle: desired.activeTaskTitle ?? null,
        messagePreview: desired.messagePreview ?? null,
        treeStage: desired.treeStage ?? "SEED",
        growthPoints: desired.growthPoints ?? 0,
        ledScene: desired.ledScene ?? "OFFLINE",
        brightness: desired.brightness ?? 65,
        firmwareTarget: desired.firmwareTarget ?? null,
        commandId: desired.commandId ?? null,
        updatedAt: desired.updatedAt ?? now,
      },
      reportedState: {
        online: reported.online ?? false,
        firmwareVersion: reported.firmwareVersion ?? device.firmwareVersion,
        ambientLux: reported.ambientLux ?? null,
        temperatureC: reported.temperatureC ?? null,
        humidityPercent: reported.humidityPercent ?? null,
        presence: reported.presence ?? null,
        lastInteractionAt: reported.lastInteractionAt ?? null,
        acknowledgedCommandId: reported.acknowledgedCommandId ?? null,
        queueDepth: reported.queueDepth ?? 0,
        updatedAt: reported.updatedAt ?? now,
      },
    };
  }

  private async ensureUserContext(firebaseUid: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        activeHouseholdId: true,
        householdLinks: { select: { householdId: true } },
      },
    });
    if (
      existing?.activeHouseholdId &&
      existing.householdLinks.some(
        (membership) => membership.householdId === existing.activeHouseholdId,
      )
    ) {
      await this.ensureTaskSeeds();
      for (const membership of existing.householdLinks) {
        await this.prisma.taskAssignment.createMany({
          data: TASK_SEEDS.map((task) => ({
            taskId: task.id,
            userId: existing.id,
            householdId: membership.householdId,
            status: AssignmentStatus.AVAILABLE,
          })),
          skipDuplicates: true,
        });
      }
      return;
    }
    await this.ensureTaskSeeds();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${firebaseUid}))
      `;

      const user = await transaction.user.upsert({
        where: { firebaseUid },
        update: {},
        create: {
          firebaseUid,
          displayName: "同行成林使用者",
          role: UserRole.PARTICIPANT,
        },
      });

      let memberships = await transaction.householdMember.findMany({
        where: { userId: user.id },
        orderBy: { householdId: "asc" },
      });
      if (memberships.length === 0) {
        const household = await transaction.household.create({
          data: {
            name: "我的家庭",
            members: {
              create: {
                userId: user.id,
                relationship: "本人",
              },
            },
            trees: {
              create: {
                name: "我們家的陪伴樹",
              },
            },
          },
        });
        memberships = [
          {
            householdId: household.id,
            userId: user.id,
            relationship: "本人",
          },
        ];
      }

      const membershipIds = new Set(
        memberships.map((membership) => membership.householdId),
      );
      const activeHouseholdId =
        user.activeHouseholdId && membershipIds.has(user.activeHouseholdId)
          ? user.activeHouseholdId
          : memberships[0]!.householdId;
      if (user.activeHouseholdId !== activeHouseholdId) {
        await transaction.user.update({
          where: { id: user.id },
          data: { activeHouseholdId },
        });
      }

      for (const membership of memberships) {
        const treeCount = await transaction.tree.count({
          where: { householdId: membership.householdId },
        });
        if (treeCount === 0) {
          await transaction.tree.create({
            data: {
              householdId: membership.householdId,
              name: "我們家的陪伴樹",
            },
          });
        }
        await transaction.taskAssignment.createMany({
          data: TASK_SEEDS.map((task) => ({
            taskId: task.id,
            userId: user.id,
            householdId: membership.householdId,
            status: AssignmentStatus.AVAILABLE,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  private async ensureTaskSeeds(): Promise<void> {
    await this.prisma.$transaction(
      TASK_SEEDS.map((task) =>
        this.prisma.task.upsert({
          where: { id: task.id },
          update: {
            title: task.title,
            description: task.description,
            verificationMode: task.verificationMode,
            verificationRule: task.verificationRule,
            growthPoints: task.growthPoints,
          },
          create: {
            ...task,
            verificationRule: task.verificationRule,
          },
        }),
      ),
    );
  }

  private async ensureCooperativeActionSeed(): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const action = await transaction.cooperativeAction.upsert({
        where: { id: COOPERATIVE_ACTION_SEED.id },
        update: {
          slug: COOPERATIVE_ACTION_SEED.slug,
          title: COOPERATIVE_ACTION_SEED.title,
          description: COOPERATIVE_ACTION_SEED.description,
          kind: "RELAY",
          minimumContributors: COOPERATIVE_ACTION_SEED.minimumContributors,
          maxChaptersPerMember: COOPERATIVE_ACTION_SEED.maxChaptersPerMember,
          growthPoints: COOPERATIVE_ACTION_SEED.growthPoints,
          keepsakeName: COOPERATIVE_ACTION_SEED.keepsakeName,
        },
        create: {
          id: COOPERATIVE_ACTION_SEED.id,
          slug: COOPERATIVE_ACTION_SEED.slug,
          title: COOPERATIVE_ACTION_SEED.title,
          description: COOPERATIVE_ACTION_SEED.description,
          kind: "RELAY",
          status: "PUBLISHED",
          minimumContributors: COOPERATIVE_ACTION_SEED.minimumContributors,
          maxChaptersPerMember: COOPERATIVE_ACTION_SEED.maxChaptersPerMember,
          growthPoints: COOPERATIVE_ACTION_SEED.growthPoints,
          keepsakeName: COOPERATIVE_ACTION_SEED.keepsakeName,
          publishedAt: this.clock.now(),
        },
      });
      for (const chapter of COOPERATIVE_ACTION_SEED.chapters) {
        await transaction.task.upsert({
          where: { id: chapter.taskId },
          update: {
            title: chapter.title,
            description: chapter.description,
            verificationMode: "SELF_CHECK",
            verificationRule: { confirmationRequired: true },
            growthPoints: 0,
          },
          create: {
            id: chapter.taskId,
            title: chapter.title,
            description: chapter.description,
            verificationMode: "SELF_CHECK",
            verificationRule: { confirmationRequired: true },
            growthPoints: 0,
          },
        });
        await transaction.task.upsert({
          where: { id: chapter.alternativeTaskId },
          update: {
            title: chapter.alternativeTitle,
            description: chapter.alternativeDescription,
            verificationMode: "SELF_CHECK",
            verificationRule: { confirmationRequired: true },
            growthPoints: 0,
          },
          create: {
            id: chapter.alternativeTaskId,
            title: chapter.alternativeTitle,
            description: chapter.alternativeDescription,
            verificationMode: "SELF_CHECK",
            verificationRule: { confirmationRequired: true },
            growthPoints: 0,
          },
        });
        await transaction.cooperativeActionChapter.upsert({
          where: {
            actionId_sequence: {
              actionId: action.id,
              sequence: chapter.sequence,
            },
          },
          update: {
            taskId: chapter.taskId,
            alternativeTaskId: chapter.alternativeTaskId,
            elementName: chapter.elementName,
          },
          create: {
            actionId: action.id,
            taskId: chapter.taskId,
            alternativeTaskId: chapter.alternativeTaskId,
            sequence: chapter.sequence,
            elementName: chapter.elementName,
          },
        });
      }
    });
  }
}
