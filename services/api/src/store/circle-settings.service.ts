import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AppContext } from "@elder-tree/contracts";
import { PrismaService } from "../database/prisma.service";
import type { CreateCircleDto, UpdateCircleProfileDto } from "../dto/api.dto";
import { ClockService } from "../time/clock.service";
import { PersistentStoreService } from "./persistent-store.service";

@Injectable()
export class CircleSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: PersistentStoreService,
    private readonly clock: ClockService,
  ) {}

  async create(
    firebaseUid: string,
    input: CreateCircleDto,
  ): Promise<AppContext> {
    await this.store.getContext(firebaseUid);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { firebaseUid },
    });
    const name = input.name.trim();
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ name, kind: input.kind }))
      .digest("hex");
    await this.prisma.$transaction(async (transaction) => {
      // Serialize creation retries for this account, not unrelated circles.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`circle-create:${user.id}`}))`;
      const receipt = await transaction.circleCreation.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: user.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      let householdId: string;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new ConflictException(
            "Circle creation key was used for different settings",
          );
        const member = await transaction.householdMember.findUnique({
          where: {
            householdId_userId: {
              householdId: receipt.householdId,
              userId: user.id,
            },
          },
        });
        if (!member)
          throw new ForbiddenException(
            "Circle membership is no longer available",
          );
        householdId = receipt.householdId;
      } else {
        const household = await transaction.household.create({
          data: {
            name,
            circleKind: input.kind,
            configuredAt: this.clock.now(),
            members: {
              create: {
                userId: user.id,
                relationship: "建立者",
                canManageCircle: true,
              },
            },
            trees: { create: { name: "我們的生命樹" } },
            creationReceipts: {
              create: {
                userId: user.id,
                idempotencyKey: input.idempotencyKey,
                fingerprint,
              },
            },
          },
        });
        householdId = household.id;
      }
      // The command means create-and-open. A retry can reopen the same circle,
      // but never creates a second circle or resets its tree or settings.
      await transaction.user.update({
        where: { id: user.id },
        data: { activeHouseholdId: householdId },
      });
    });
    // Also ensures task assignments for the new membership after a lost response.
    return this.store.getContext(firebaseUid);
  }

  async update(
    firebaseUid: string,
    householdId: string,
    input: UpdateCircleProfileDto,
  ): Promise<AppContext> {
    const member = await this.prisma.householdMember.findFirst({
      where: { householdId, user: { firebaseUid } },
      include: { household: true },
    });
    if (!member) throw new NotFoundException("Circle membership not found");
    if (!member.canManageCircle)
      throw new ForbiddenException(
        "Circle settings require manager permission",
      );
    const name = input.name.trim();
    const sameProfile =
      member.household.name === name &&
      member.household.circleKind === input.kind;
    if (member.household.settingsRevision !== input.expectedRevision) {
      // Recover an exact retry after a response was lost, but don't overwrite
      // another editor's different settings with a stale form.
      if (sameProfile && member.household.configuredAt !== null)
        return this.store.getContext(firebaseUid);
      throw new ConflictException(
        "Circle settings changed; reload before saving",
      );
    }
    const saved = await this.prisma.household.updateMany({
      where: {
        id: householdId,
        settingsRevision: input.expectedRevision,
        members: { some: { userId: member.userId, canManageCircle: true } },
      },
      data: {
        name,
        circleKind: input.kind,
        configuredAt: member.household.configuredAt ?? this.clock.now(),
        settingsRevision: { increment: 1 },
      },
    });
    if (saved.count !== 1)
      throw new ConflictException(
        "Circle settings changed; reload before saving",
      );
    return this.store.getContext(firebaseUid);
  }
}
