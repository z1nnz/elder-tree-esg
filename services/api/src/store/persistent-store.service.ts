import type {
  AppContext,
  CompanionDeviceSummary,
  DeviceDesiredState,
  DeviceReportedState,
  EvidenceDecision,
  EvidenceUpload,
  ExplorationEventResult,
  ExplorationState,
  FamilyMessage,
  FamilyReviewItem,
  HouseholdInviteSummary,
  ImpactSummary,
  TaskSummary,
  TreeSummary,
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
    verificationRule: { subject: "plant", minimumConfidence: 0.85 },
    growthPoints: 80,
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

function toTaskSummary(assignment: AssignmentWithTask): TaskSummary {
  const rule =
    assignment.task.verificationRule &&
    typeof assignment.task.verificationRule === "object" &&
    !Array.isArray(assignment.task.verificationRule)
      ? (assignment.task.verificationRule as Record<string, unknown>)
      : {};
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
  };
}

function inviteHash(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
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
    return {
      displayName: user.displayName,
      activeHouseholdId: user.activeHouseholdId,
      households: user.householdLinks.map((membership) => ({
        id: membership.householdId,
        name: membership.household.name,
        relationship: membership.relationship,
      })),
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
        throw new ConflictException("Household invite is expired or already used");
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

  async startTask(firebaseUid: string, assignmentId: string): Promise<TaskSummary> {
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
        const rule = assignment.task.verificationRule as Record<string, unknown>;
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
      return toTaskSummary(updatedAssignment);
    });
  }

  async initializeEvidence(
    firebaseUid: string,
    assignmentId: string,
    fileName: string,
    contentType: string,
  ): Promise<EvidenceUpload> {
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
        evidence.verification.decision !==
        PrismaVerificationDecision.REVIEW
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
      throw new BadRequestException("Submitters cannot review their own evidence");
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
    if (
      device.householdId &&
      device.householdId !== active.activeHouseholdId
    ) {
      throw new ConflictException("Companion device is already claimed");
    }
    const claimed = await this.prisma.device.update({
      where: { id: device.id },
      data: { householdId: active.activeHouseholdId },
    });
    return this.toDeviceSummary(claimed);
  }

  async getExplorationState(firebaseUid: string): Promise<ExplorationState> {
    const active = await this.getActiveUser(firebaseUid);
    const [progress, latestReceipt, quests] = await Promise.all([
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
      this.prisma.mapQuest.findMany({
        where: { active: true },
        include: {
          task: true,
          unlocks: {
            where: {
              userId: active.id,
              householdId: active.activeHouseholdId,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return {
      totalDistanceMeters: progress?.totalDistanceMeters ?? 0,
      coarseCell: latestReceipt?.coarseCell ?? null,
      quests: quests.map((quest) => ({
        id: quest.id,
        taskId: quest.taskId,
        title: quest.task.title,
        description: quest.task.description,
        triggerType: quest.triggerType,
        latitude: quest.latitude,
        longitude: quest.longitude,
        radiusMeters: quest.radiusMeters,
        unlockDistanceMeters: quest.unlockDistanceMeters,
        unlocked: quest.unlocks.length > 0,
      })),
    };
  }

  async recordExplorationEvent(
    firebaseUid: string,
    event: {
      eventKey: string;
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      distanceMeters: number;
      occurredAt: string;
    },
  ): Promise<ExplorationEventResult> {
    if (event.accuracyMeters > 100) {
      throw new BadRequestException(
        "Location accuracy must be within 100 meters",
      );
    }
    const active = await this.getActiveUser(firebaseUid);
    const previousReceipt = await this.prisma.locationEventReceipt.findUnique({
      where: { eventKey: event.eventKey },
    });
    if (previousReceipt) {
      return {
        ...(await this.getExplorationState(firebaseUid)),
        duplicate: true,
        newlyUnlockedTaskIds: [],
      };
    }

    const distanceMeters = Math.min(
      2000,
      Math.max(0, Math.round(event.distanceMeters)),
    );
    const coarseCell = latLngToCell(event.latitude, event.longitude, 8);
    const occurredAt = new Date(event.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException("Invalid exploration event time");
    }

    const newlyUnlockedTaskIds = await this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`exploration:${event.eventKey}`}))
        `;
        const duplicate = await transaction.locationEventReceipt.findUnique({
          where: { eventKey: event.eventKey },
        });
        if (duplicate) return [] as string[];

        const progress = await transaction.explorationProgress.upsert({
          where: {
            userId_householdId: {
              userId: active.id,
              householdId: active.activeHouseholdId,
            },
          },
          update: {
            totalDistanceMeters: { increment: distanceMeters },
            lastEventAt: occurredAt,
          },
          create: {
            userId: active.id,
            householdId: active.activeHouseholdId,
            totalDistanceMeters: distanceMeters,
            lastEventAt: occurredAt,
          },
        });
        await transaction.locationEventReceipt.create({
          data: {
            eventKey: event.eventKey,
            userId: active.id,
            householdId: active.activeHouseholdId,
            coarseCell,
            distanceMeters,
            occurredAt,
          },
        });

        const distanceQuests = await transaction.mapQuest.findMany({
          where: {
            active: true,
            triggerType: QuestTriggerType.DISTANCE,
            unlockDistanceMeters: {
              not: null,
              lte: progress.totalDistanceMeters,
            },
          },
          select: { id: true, taskId: true },
        });
        const geofenceQuests = await transaction.$queryRaw<
          Array<{ id: string; taskId: string }>
        >`
          SELECT "id", "taskId"
          FROM "MapQuest"
          WHERE "active" = true
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
        return unlockedTaskIds;
      },
    );
    return {
      ...(await this.getExplorationState(firebaseUid)),
      duplicate: false,
      newlyUnlockedTaskIds,
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
    const reported = (device.reportedState ?? {}) as Partial<DeviceReportedState>;
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
        firmwareVersion:
          reported.firmwareVersion ?? device.firmwareVersion,
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

      for (const task of TASK_SEEDS) {
        await transaction.task.upsert({
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
        });
      }

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
}
