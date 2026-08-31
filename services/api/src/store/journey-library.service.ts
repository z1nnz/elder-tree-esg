import type { JourneyResult, JourneyShelf } from "@elder-tree/contracts";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ClockService } from "../time/clock.service";
import { buildJourneyResult } from "./journey-result";
import { PersistentStoreService } from "./persistent-store.service";

const REVISIT_DELAY = 7 * 24 * 60 * 60 * 1000;
const JOURNEYS = [
  {
    id: "77777777-1111-4111-8111-777777777777",
    slug: "everyday-conversation",
    title: "聽見彼此的日常",
    description:
      "兩位樹伴輪流分享一個生活片刻，再把回應交還給對方。面對面、電話或訊息都可以。",
    keepsakeName: "相知葉",
    growthPoints: 80,
    chapters: [
      [
        "留一段日常",
        "找一位樹伴，分享今天一件印象深刻的小事。",
        "分享",
        "用訊息留一句話",
        "不方便說話時，用訊息分享今天的一個片刻。",
      ],
      [
        "接住你的故事",
        "聽完上一位樹伴的分享，回應一件你在意或好奇的事。",
        "回應",
        "用文字接住故事",
        "讀完分享後，用訊息留下自己的回應。",
      ],
    ],
  },
  {
    id: "77777777-2222-4222-8222-777777777777",
    slug: "kindness-around-us",
    title: "把好意傳下去",
    description:
      "三位樹伴各留下一件小小的好意，最後一起說說這段旅程。每一棒都不需要消費。",
    keepsakeName: "暖心枝",
    growthPoints: 100,
    chapters: [
      [
        "向一個人問好",
        "向熟悉的人問候，聽聽對方今天過得如何。",
        "問候",
        "傳一則關心",
        "不方便見面時，傳一則訊息關心熟悉的人。",
      ],
      [
        "照顧共同角落",
        "在安全範圍整理一個大家共用的小角落，不搬重物、不接觸危險物。",
        "照顧",
        "分享一個友善提醒",
        "和樹伴分享一個讓共同空間更好使用的小提醒。",
      ],
      [
        "留下感謝",
        "向前兩棒的樹伴說聲謝謝，分享這段旅程最喜歡的片刻。",
        "感謝",
        "寫下謝謝",
        "用訊息向前兩棒的樹伴留下感謝。",
      ],
    ],
  },
] as const;

@Injectable()
export class JourneyLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: PersistentStoreService,
    private readonly clock: ClockService,
  ) {}

  private async ensureCatalog() {
    for (const item of JOURNEYS) {
      await this.prisma.$transaction(async (tx) => {
        await tx.cooperativeAction.upsert({
          where: { id: item.id },
          update: {},
          create: {
            id: item.id,
            slug: item.slug,
            title: item.title,
            description: item.description,
            keepsakeName: item.keepsakeName,
            growthPoints: item.growthPoints,
            kind: "RELAY",
            status: "PUBLISHED",
            minimumContributors: item.chapters.length,
            maxChaptersPerMember: 1,
            publishedAt: this.clock.now(),
          },
        });
        for (const [index, chapter] of item.chapters.entries()) {
          const taskId = `${item.id.slice(0, 24)}${String(index + 1).padStart(12, "0")}`;
          const alternativeTaskId = `${item.id.slice(0, 24)}${String(index + 1001).padStart(12, "0")}`;
          for (const [id, title, description] of [
            [taskId, chapter[0], chapter[1]],
            [alternativeTaskId, chapter[3], chapter[4]],
          ]) {
            await tx.task.upsert({
              where: { id },
              update: {},
              create: {
                id,
                title: title!,
                description: description!,
                verificationMode: "SELF_CHECK",
                verificationRule: { confirmationRequired: true },
                growthPoints: 0,
              },
            });
          }
          await tx.cooperativeActionChapter.upsert({
            where: {
              actionId_sequence: { actionId: item.id, sequence: index + 1 },
            },
            update: {},
            create: {
              actionId: item.id,
              sequence: index + 1,
              elementName: chapter[2],
              taskId,
              alternativeTaskId,
            },
          });
        }
      });
    }
  }

  async shelf(uid: string, before?: string): Promise<JourneyShelf> {
    const circle = await this.store.getCircleOverview(uid);
    await this.ensureCatalog();
    const now = this.clock.now();
    const current = await this.prisma.cooperativeActionRun.findFirst({
      where: { householdId: circle.id, isCurrent: true },
      include: { action: true, _count: { select: { contributions: true } } },
    });
    if (
      before &&
      !(await this.prisma.cooperativeActionRun.findFirst({
        where: {
          id: before,
          householdId: circle.id,
          status: "COMPLETED",
          completedAt: { not: null },
        },
      }))
    )
      throw new NotFoundException("Journey record not found");
    const rows = await this.prisma.cooperativeActionRun.findMany({
      where: {
        householdId: circle.id,
        status: "COMPLETED",
        completedAt: { not: null },
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: 13,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });
    const completedRuns = await this.prisma.cooperativeActionRun.findMany({
      where: {
        householdId: circle.id,
        status: "COMPLETED",
        completedAt: { not: null },
      },
      select: { id: true },
      orderBy: [{ completedAt: "asc" }, { id: "asc" }],
    });
    const keepsakeSlotByRun = new Map(
      completedRuns.map((run, index) => [run.id, index % 12]),
    );
    const results: JourneyResult[] = [];
    for (const run of rows.slice(0, 12)) {
      let snapshot: JourneyResult;
      if (run.resultSnapshot === null) {
        // Legacy results cannot recover past display names. Freeze the records
        // available now, mark the import, and never pretend it was captured then.
        const builtSnapshot = await buildJourneyResult(
          this.prisma,
          run.id,
          run.completedAt!,
          true,
        );
        await this.prisma.cooperativeActionRun.updateMany({
          where: { id: run.id, resultSnapshot: { equals: Prisma.DbNull } },
          data: {
            resultSnapshot: builtSnapshot as unknown as Prisma.InputJsonValue,
          },
        });
        const saved = await this.prisma.cooperativeActionRun.findUniqueOrThrow({
          where: { id: run.id },
        });
        snapshot = saved.resultSnapshot as unknown as JourneyResult;
      } else snapshot = run.resultSnapshot as unknown as JourneyResult;
      const keepsakeSlot = keepsakeSlotByRun.get(run.id);
      if (keepsakeSlot === undefined)
        throw new Error("Completed journey is missing from history");
      if (
        !Number.isInteger(snapshot.keepsakeSlot) ||
        snapshot.keepsakeSlot < 0 ||
        snapshot.keepsakeSlot >= 12
      ) {
        // Earlier immutable snapshots predate the 3D canopy. Add only the
        // deterministic socket; names, witnesses and receipts stay untouched.
        snapshot = { ...snapshot, keepsakeSlot };
        await this.prisma.cooperativeActionRun.update({
          where: { id: run.id },
          data: {
            resultSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
      }
      results.push(snapshot);
    }
    const actions = await this.prisma.cooperativeAction.findMany({
      where: {
        status: "PUBLISHED",
        kind: "RELAY",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      include: { _count: { select: { chapters: true } } },
      orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    });
    const inProgress =
      current &&
      current.status === "ACTIVE" &&
      current.action.status === "PUBLISHED" &&
      (!current.action.startsAt || current.action.startsAt <= now) &&
      (!current.action.endsAt || current.action.endsAt > now) &&
      (current._count.contributions > 0 || current.claimedById !== null);
    const choices = await Promise.all(
      actions.map(async (action) => {
        const last = await this.prisma.cooperativeActionRun.findFirst({
          where: {
            householdId: circle.id,
            actionId: action.id,
            OR: [{ status: "COMPLETED" }, { contributions: { some: {} } }],
          },
          orderBy: { startedAt: "desc" },
        });
        const availableAt = last
          ? new Date(last.startedAt.getTime() + REVISIT_DELAY)
          : null;
        return {
          actionId: action.id,
          title: action.title,
          description: action.description,
          keepsakeName: action.keepsakeName,
          minimumContributors: action.minimumContributors,
          chapterCount: action._count.chapters,
          growthPoints: action.growthPoints,
          availableAt:
            availableAt && availableAt > now ? availableAt.toISOString() : null,
          unavailableReason: inProgress
            ? ("IN_PROGRESS" as const)
            : availableAt && availableAt > now
              ? ("COOLDOWN" as const)
              : circle.memberCount < action.minimumContributors
                ? ("NOT_ENOUGH_MEMBERS" as const)
                : null,
        };
      }),
    );
    return {
      circleId: circle.id,
      currentRunId: current?.id ?? null,
      completedCount: completedRuns.length,
      results,
      choices,
      nextCursor: rows.length > 12 ? rows[11]!.id : null,
    };
  }

  async start(
    uid: string,
    input: { circleId: string; actionId: string; previousRunId: string },
  ) {
    const context = await this.store.getContext(uid);
    if (context.activeHouseholdId !== input.circleId)
      throw new ConflictException("Circle changed; reload journeys");
    await this.ensureCatalog();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`journey-circle:${input.circleId}`}))`;
      const previous = await tx.cooperativeActionRun.findFirst({
        where: { id: input.previousRunId, householdId: input.circleId },
      });
      if (!previous) throw new NotFoundException("Journey record not found");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${previous.id}))`;
      const receipt = await tx.cooperativeActionRun.findUnique({
        where: { previousRunId: previous.id },
      });
      if (receipt) {
        if (receipt.actionId !== input.actionId || !receipt.isCurrent)
          throw new ConflictException("Journey changed; reload journeys");
        return;
      }
      const current = await tx.cooperativeActionRun.findFirst({
        where: {
          id: previous.id,
          householdId: input.circleId,
          isCurrent: true,
        },
        include: { action: true, _count: { select: { contributions: true } } },
      });
      if (!current)
        throw new ConflictException("Journey changed; reload journeys");
      const now = this.clock.now();
      const expired =
        current.action.status !== "PUBLISHED" ||
        (current.action.startsAt !== null && current.action.startsAt > now) ||
        (current.action.endsAt !== null && current.action.endsAt <= now);
      if (
        current.status === "ACTIVE" &&
        !expired &&
        (current._count.contributions > 0 || current.claimedById !== null)
      )
        throw new ConflictException(
          "Finish the current journey before starting another",
        );
      const memberCount = await tx.householdMember.count({
        where: { householdId: input.circleId },
      });
      if (
        current.actionId === input.actionId &&
        current.status === "ACTIVE" &&
        !expired
      ) {
        if (memberCount < current.action.minimumContributors)
          throw new ConflictException(
            "Invite more circle members before starting this journey",
          );
        return;
      }
      const action = await tx.cooperativeAction.findFirst({
        where: {
          id: input.actionId,
          kind: "RELAY",
          status: "PUBLISHED",
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
        include: { chapters: true },
      });
      if (!action || action.chapters.length === 0)
        throw new ConflictException("Journey is unavailable");
      if (memberCount < action.minimumContributors)
        throw new ConflictException(
          "Invite more circle members before starting this journey",
        );
      const last = await tx.cooperativeActionRun.findFirst({
        where: {
          householdId: input.circleId,
          actionId: action.id,
          OR: [{ status: "COMPLETED" }, { contributions: { some: {} } }],
        },
        orderBy: { startedAt: "desc" },
      });
      if (last && last.startedAt.getTime() + REVISIT_DELAY > now.getTime())
        throw new ConflictException("Journey revisit is not available yet");
      await tx.cooperativeActionRun.update({
        where: { id: current.id },
        data: {
          isCurrent: false,
          ...(current.status === "ACTIVE" ? { status: "EXPIRED" } : {}),
        },
      });
      await tx.cooperativeActionRun.create({
        data: {
          householdId: input.circleId,
          actionId: action.id,
          previousRunId: current.id,
          startedAt: now,
        },
      });
    });
    return this.store.getCircleOverview(uid);
  }
}
