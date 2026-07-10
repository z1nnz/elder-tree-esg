import type {
  AppContext,
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
  RadarMissionInput,
  RadarMissionSummary,
  RadarMissionStatus,
  RadarState,
  ReviewItem,
  TaskSummary,
  TreeSummary,
  VerificationResult,
} from "@elder-tree/contracts";
import {
  BadRequestException,
  ConflictException,
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

type AssignmentWithTask = Prisma.TaskAssignmentGetPayload<{
  include: { task: true };
}>;

type RouteWithTasks = Prisma.ExplorationRouteGetPayload<{
  include: { quests: { include: { task: true } } };
}>;

type RadarMissionWithProgress = Prisma.RadarMissionGetPayload<{
  include: { progress: true };
}>;

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
      description: "附近有一個城市任務，走近後就能接取。",
      ctaLabel: "開始探索",
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
    private readonly evidenceStorage: EvidenceStorageService =
      new EvidenceStorageService(),
    private readonly photoVerifier: PhotoVerifierService =
      new PhotoVerifierService(),
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
    return {
      id: message.id,
      authorName: message.author.displayName,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      deliveredToDeviceAt: null,
    };
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
    await this.prisma.$transaction(async (transaction) => {
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
      if (progress.completedAt) return;
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
    });
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
      publicationStatus: mission.status,
      status,
      unlockedAt: progress?.unlockedAt.toISOString() ?? null,
      completedAt: progress?.completedAt?.toISOString() ?? null,
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
          displayName: "綠伴使用者",
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
}
