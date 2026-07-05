import type { TaskSummary, TreeSummary } from "@elder-tree/contracts";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssignmentStatus,
  Prisma,
  TreeStage as PrismaTreeStage,
  UserRole,
  VerificationMode,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
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
  return {
    id: assignment.id,
    title: assignment.task.title,
    description: assignment.task.description,
    verificationMode: assignment.task.verificationMode,
    growthPoints: assignment.task.growthPoints,
    status: assignment.status,
    dueAt: assignment.dueAt?.toISOString() ?? null,
  };
}

@Injectable()
export class PersistentStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async listTasks(firebaseUid: string): Promise<TaskSummary[]> {
    await this.ensureUserContext(firebaseUid);
    const assignments = await this.prisma.taskAssignment.findMany({
      where: { user: { firebaseUid } },
      include: { task: true },
      orderBy: { createdAt: "asc" },
    });
    return assignments.map(toTaskSummary);
  }

  async getTree(firebaseUid: string): Promise<TreeSummary> {
    await this.ensureUserContext(firebaseUid);
    const membership = await this.prisma.householdMember.findFirst({
      where: { user: { firebaseUid } },
      include: {
        household: {
          include: {
            trees: { orderBy: { createdAt: "asc" }, take: 1 },
          },
        },
      },
    });
    const tree = membership?.household.trees[0];
    if (!membership || !tree) {
      throw new NotFoundException("Companion tree not found");
    }
    return {
      id: tree.id,
      name: tree.name,
      householdName: membership.household.name,
      stage: tree.stage,
      growthPoints: tree.growthPoints,
      nextStageAt: nextStageAt(tree.growthPoints),
    };
  }

  async startTask(firebaseUid: string, assignmentId: string): Promise<TaskSummary> {
    await this.ensureUserContext(firebaseUid);
    const assignment = await this.findAssignment(firebaseUid, assignmentId);
    if (assignment.status === AssignmentStatus.COMPLETED) {
      throw new ConflictException("Task is already complete");
    }
    return toTaskSummary(
      await this.prisma.taskAssignment.update({
        where: { id: assignment.id },
        data: { status: AssignmentStatus.IN_PROGRESS },
        include: { task: true },
      }),
    );
  }

  async completeTask(
    firebaseUid: string,
    assignmentId: string,
    _requestIdempotencyKey?: string,
  ): Promise<TaskSummary> {
    await this.ensureUserContext(firebaseUid);
    return this.prisma.$transaction(async (transaction) => {
      const assignment = await transaction.taskAssignment.findFirst({
        where: { id: assignmentId, user: { firebaseUid } },
        include: {
          task: true,
          user: {
            include: {
              householdLinks: {
                include: {
                  household: {
                    include: {
                      trees: { orderBy: { createdAt: "asc" }, take: 1 },
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
      });
      if (!assignment) throw new NotFoundException("Task assignment not found");
      if (assignment.task.verificationMode === VerificationMode.PHOTO_AI) {
        throw new BadRequestException("PHOTO_AI tasks require evidence");
      }

      const tree = assignment.user.householdLinks[0]?.household.trees[0];
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

      if (inserted === 1) {
        const updatedTree = await transaction.tree.update({
          where: { id: tree.id },
          data: { growthPoints: { increment: assignment.task.growthPoints } },
        });
        await transaction.tree.update({
          where: { id: tree.id },
          data: { stage: stageForPoints(updatedTree.growthPoints) as PrismaTreeStage },
        });
      }

      const updatedAssignment = await transaction.taskAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.COMPLETED,
          completedAt: assignment.completedAt ?? new Date(),
        },
        include: { task: true },
      });
      return toTaskSummary(updatedAssignment);
    });
  }

  private async findAssignment(
    firebaseUid: string,
    assignmentId: string,
  ): Promise<AssignmentWithTask> {
    const assignment = await this.prisma.taskAssignment.findFirst({
      where: { id: assignmentId, user: { firebaseUid } },
      include: { task: true },
    });
    if (!assignment) throw new NotFoundException("Task assignment not found");
    return assignment;
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

      let membership = await transaction.householdMember.findFirst({
        where: { userId: user.id },
      });
      if (!membership) {
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
        membership = { householdId: household.id, userId: user.id, relationship: "本人" };
      }

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
          status: AssignmentStatus.AVAILABLE,
        })),
        skipDuplicates: true,
      });
    });
  }
}
