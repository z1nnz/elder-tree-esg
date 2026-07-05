import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../database/prisma.service";
import { PersistentStoreService } from "./persistent-store.service";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("PersistentStoreService", () => {
  const firebaseUid = `integration-${randomUUID()}`;
  let prisma: PrismaService;
  let store: PersistentStoreService;

  beforeAll(async () => {
    prisma = new PrismaService();
    store = new PersistentStoreService(prisma);
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      include: { householdLinks: true },
    });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
      for (const link of user.householdLinks) {
        await prisma.household.delete({ where: { id: link.householdId } });
      }
    }
    await prisma.$disconnect();
  });

  it(
    "persists task completion and awards growth only once across restarts",
    async () => {
      const tasks = await store.listTasks(firebaseUid);
      const task = tasks.find((item) => item.verificationMode === "SELF_CHECK");
      expect(task).toBeDefined();

      const before = await store.getTree(firebaseUid);
      await store.completeTask(firebaseUid, task!.id);
      const afterFirstCompletion = await store.getTree(firebaseUid);

      await prisma.$disconnect();
      prisma = new PrismaService();
      store = new PersistentStoreService(prisma);

      await store.completeTask(firebaseUid, task!.id);
      const afterRestartAndRetry = await store.getTree(firebaseUid);

      expect(afterFirstCompletion.growthPoints).toBe(
        before.growthPoints + task!.growthPoints,
      );
      expect(afterRestartAndRetry.growthPoints).toBe(
        afterFirstCompletion.growthPoints,
      );
      expect(
        (await store.listTasks(firebaseUid)).find((item) => item.id === task!.id)
          ?.status,
      ).toBe("COMPLETED");
    },
    30_000,
  );
});
