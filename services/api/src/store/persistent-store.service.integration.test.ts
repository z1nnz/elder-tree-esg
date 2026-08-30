import { createHash, randomUUID } from "node:crypto";
import { VerificationMode } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service";
import type { ClockService } from "../time/clock.service";
import { PersistentStoreService } from "./persistent-store.service";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;
if (databaseUrl) {
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
}

describeWithDatabase("PersistentStoreService", () => {
  const firebaseUid = `integration-${randomUUID()}`;
  const createdFirebaseUids = new Set([firebaseUid]);
  const createdTaskIds = new Set<string>();
  const createdRouteIds = new Set<string>();
  const createdRadarMissionIds = new Set<string>();
  const createdDeviceIds = new Set<string>();
  const createdLineTargets = new Set<string>();
  const createdOrganizationIds = new Set<string>();
  let prisma: PrismaService;
  let store: PersistentStoreService;

  beforeAll(async () => {
    prisma = new PrismaService();
    store = new PersistentStoreService(prisma);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: [...createdFirebaseUids] } },
      include: { householdLinks: true },
    });
    const householdIds = new Set(
      users.flatMap((user) => user.householdLinks.map((link) => link.householdId)),
    );
    await prisma.device.deleteMany({
      where: { id: { in: [...createdDeviceIds] } },
    });
    await prisma.lineNotificationLog.deleteMany({
      where: { target: { in: [...createdLineTargets] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [...createdOrganizationIds] } },
    });
    await prisma.user.deleteMany({
      where: { firebaseUid: { in: [...createdFirebaseUids] } },
    });
    for (const householdId of householdIds) {
      await prisma.household.deleteMany({ where: { id: householdId } });
    }
    await prisma.explorationRoute.deleteMany({
      where: { id: { in: [...createdRouteIds] } },
    });
    await prisma.radarMission.deleteMany({
      where: { id: { in: [...createdRadarMissionIds] } },
    });
    await prisma.task.deleteMany({ where: { id: { in: [...createdTaskIds] } } });
    await prisma.$disconnect();
  });

  it(
    "keeps partner proposals organization-scoped and publishes one mission after approval",
    async () => {
      const partnerUid = `integration-partner-${randomUUID()}`;
      const outsiderUid = `integration-partner-outsider-${randomUUID()}`;
      const adminUid = `integration-partner-admin-${randomUUID()}`;
      const noPartnerUid = `integration-non-partner-${randomUUID()}`;
      createdFirebaseUids.add(partnerUid);
      createdFirebaseUids.add(outsiderUid);
      createdFirebaseUids.add(adminUid);
      createdFirebaseUids.add(noPartnerUid);

      await store.getContext(partnerUid);
      await store.getContext(outsiderUid);
      await store.getContext(adminUid);
      await store.getContext(noPartnerUid);
      await expect(store.listPartnerOrganizations(noPartnerUid)).rejects.toThrow(
        "Journey partner access required",
      );
      const partner = await prisma.user.update({
        where: { firebaseUid: partnerUid },
        data: { role: "ORG_ADMIN" },
      });
      await prisma.user.update({
        where: { firebaseUid: adminUid },
        data: { role: "PLATFORM_ADMIN" },
      });
      const organization = await prisma.organization.create({
        data: {
          name: "整合測試共創夥伴",
          memberships: {
            create: { userId: partner.id, role: "ORG_ADMIN" },
          },
        },
      });
      createdOrganizationIds.add(organization.id);
      const outsider = await prisma.user.update({
        where: { firebaseUid: outsiderUid },
        data: { role: "ORG_ADMIN" },
      });
      const otherOrganization = await prisma.organization.create({
        data: {
          name: "另一個整合測試夥伴",
          memberships: {
            create: { userId: outsider.id, role: "ORG_ADMIN" },
          },
        },
      });
      createdOrganizationIds.add(otherOrganization.id);

      await expect(
        store.getPartnerWorkspace(outsiderUid, organization.id),
      ).rejects.toThrow("Journey partner access required");
      await expect(
        store.getPartnerWorkspace(partnerUid, otherOrganization.id),
      ).rejects.toThrow("Journey partner access required");
      expect(await store.listPartnerOrganizations(partnerUid)).toEqual([
        expect.objectContaining({ id: organization.id }),
      ]);

      const startsAt = new Date(Date.now() - 60_000);
      const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const legacyCampaign = await prisma.campaign.create({
        data: {
          organizationId: organization.id,
          title: "舊版未補齊資料的提案",
          startsAt,
          endsAt,
        },
      });
      await expect(
        store.submitPartnerCampaign(partnerUid, organization.id, legacyCampaign.id),
      ).rejects.toThrow("complete venue and safety information");
      await expect(
        store.createPartnerCampaign(partnerUid, organization.id, {
          title: "必須消費的錯誤旅程",
          description: "這個提案應該在伺服器驗證階段直接被拒絕。",
          venueName: "錯誤測試據點",
          latitude: 25.033,
          longitude: 121.5654,
          radiusMeters: 60,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          verificationMode: "SELF_CHECK",
          growthPoints: 12,
          accessibilityNotes: "設有平緩步道。",
          safetyNotes: "白天開放。",
          // @ts-expect-error Deliberately bypass the contract to exercise the runtime guard.
          purchaseRequired: true,
        }),
      ).rejects.toThrow("must be completable without a purchase");
      const draft = await store.createPartnerCampaign(
        partnerUid,
        organization.id,
        {
          title: "一起走進友善公園",
          description: "在安全步道停留三分鐘，一起看看公園裡的季節變化。",
          venueName: "整合測試公園",
          latitude: 25.033,
          longitude: 121.5654,
          radiusMeters: 60,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          verificationMode: "SELF_CHECK",
          growthPoints: 12,
          badgeName: "公園同行葉",
          accessibilityNotes: "設有平緩步道與無障礙洗手間。",
          safetyNotes: "白天開放，請避開施工區域。",
          optionalOffer: "完成後可自願領取一杯水，不需消費。",
          purchaseRequired: false,
        },
      );
      expect(draft.status).toBe("DRAFT");
      const race = await Promise.allSettled([
        store.submitPartnerCampaign(partnerUid, organization.id, draft.id),
        store.updatePartnerCampaign(partnerUid, organization.id, draft.id, draft),
      ]);
      expect(race[0].status).toBe("fulfilled");
      expect((await prisma.campaign.findUnique({ where: { id: draft.id } }))?.status)
        .toBe("SUBMITTED");
      await expect(
        store.updatePartnerCampaign(partnerUid, organization.id, draft.id, {
          ...draft,
          title: "提交後不應能修改",
          purchaseRequired: false,
        }),
      ).rejects.toThrow("Submitted campaigns are read-only");

      const [approved, approvedAgain] = await Promise.all([
        store.approvePartnerCampaign(adminUid, draft.id, "安全與無障礙資訊完整，核准試辦。"),
        store.approvePartnerCampaign(adminUid, draft.id, "重複送出不應建立第二筆任務。"),
      ]);
      expect(approved.status).toBe("APPROVED");
      expect(approved.radarMissionId).toBeTruthy();
      expect(approvedAgain.radarMissionId).toBe(approved.radarMissionId);
      createdRadarMissionIds.add(approved.radarMissionId!);
      expect(
        await prisma.radarMission.count({
          where: { campaignId: draft.id },
        }),
      ).toBe(1);

      const radar = await store.getRadarState(outsiderUid);
      expect(radar.missions.find((mission) => mission.id === approved.radarMissionId))
        .toMatchObject({
          venueName: draft.venueName,
          safetyNotes: draft.safetyNotes,
          accessibilityNotes: draft.accessibilityNotes,
          optionalOffer: draft.optionalOffer,
        });
      await store.unlockRadarMission(outsiderUid, approved.radarMissionId!, {
        eventKey: `partner-arrival-${randomUUID()}`,
        latitude: 25.033,
        longitude: 121.5654,
        accuracyMeters: 8,
        occurredAt: new Date().toISOString(),
      });
      await store.completeRadarMission(outsiderUid, approved.radarMissionId!);
      const secondHousehold = await prisma.household.create({
        data: {
          name: "同一使用者的第二個樹伴圈",
          members: {
            create: {
              userId: outsider.id,
              relationship: "測試成員",
            },
          },
          trees: { create: { name: "第二棵測試生命樹" } },
        },
      });
      await store.setActiveHousehold(outsiderUid, secondHousehold.id);
      await store.getRadarState(outsiderUid);
      await store.unlockRadarMission(outsiderUid, approved.radarMissionId!, {
        eventKey: `partner-second-circle-arrival-${randomUUID()}`,
        latitude: 25.033,
        longitude: 121.5654,
        accuracyMeters: 8,
        occurredAt: new Date().toISOString(),
      });
      await store.completeRadarMission(outsiderUid, approved.radarMissionId!);
      const workspace = await store.getPartnerWorkspace(
        partnerUid,
        organization.id,
      );
      expect(workspace.campaigns.find((campaign) => campaign.id === draft.id)?.metrics).toEqual({
        deliveredToAppCount: 1,
        arrivedCount: 1,
        completedCount: 1,
        completionRate: 1,
      });

      const rejectedDraft = await store.createPartnerCampaign(
        partnerUid,
        organization.id,
        {
          title: "需要補充安全資訊的旅程",
          description: "用第二個提案驗證平台退回與審查紀錄流程。",
          venueName: "整合測試廣場",
          latitude: 25.034,
          longitude: 121.566,
          radiusMeters: 50,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          verificationMode: "SELF_CHECK",
          growthPoints: 8,
          accessibilityNotes: "入口目前標示為平面。",
          safetyNotes: "仍需確認夜間照明。",
          purchaseRequired: false,
        },
      );
      await store.submitPartnerCampaign(
        partnerUid,
        organization.id,
        rejectedDraft.id,
      );
      const rejected = await store.rejectPartnerCampaign(
        adminUid,
        rejectedDraft.id,
        "請補上雨天替代路線與夜間照明資訊。",
      );
      expect(rejected.status).toBe("REJECTED");
      expect(rejected.reviewNote).toContain("雨天替代路線");
      expect(rejected.radarMissionId).toBeNull();
    },
    120_000,
  );

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
    120_000,
  );

  it(
    "completes a cooperative relay with three members and awards growth once",
    async () => {
      const ownerUid = `integration-circle-owner-${randomUUID()}`;
      const secondUid = `integration-circle-second-${randomUUID()}`;
      const thirdUid = `integration-circle-third-${randomUUID()}`;
      createdFirebaseUids.add(ownerUid);
      createdFirebaseUids.add(secondUid);
      createdFirebaseUids.add(thirdUid);
      let now = new Date("2026-08-29T07:00:00.000Z");
      const relayStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);

      await relayStore.getContext(ownerUid);
      const secondInvite = await relayStore.createHouseholdInvite(ownerUid);
      await relayStore.joinHousehold(secondUid, secondInvite.code, "朋友");
      const thirdInvite = await relayStore.createHouseholdInvite(ownerUid);
      await relayStore.joinHousehold(thirdUid, thirdInvite.code, "鄰居朋友");

      const before = await relayStore.getTree(ownerUid);
      const circle = await relayStore.getCircleOverview(ownerUid);
      const action = circle.activeAction;
      expect(circle.memberCount).toBe(3);
      expect(action?.runId).toBeTruthy();
      expect(action?.chapters).toHaveLength(3);

      await relayStore.claimCooperativeActionChapter(
        ownerUid,
        action!.runId!,
        action.chapters[0]!.id,
      );
      await relayStore.completeCooperativeActionChapter(
        ownerUid,
        action.runId!,
        action.chapters[0]!.id,
        "circle-owner-first",
      );
      await expect(
        relayStore.claimCooperativeActionChapter(
          ownerUid,
          action.runId!,
          action.chapters[1]!.id,
        ),
      ).rejects.toThrow("Each member can complete only one chapter");
      await relayStore.claimCooperativeActionChapter(
        secondUid,
        action.runId!,
        action.chapters[1]!.id,
      );
      now = new Date(now.getTime() + 180_000);
      await relayStore.completeCooperativeActionChapter(
        secondUid,
        action.runId!,
        action.chapters[1]!.id,
        "circle-second-member",
      );
      await relayStore.claimCooperativeActionChapter(
        thirdUid,
        action.runId!,
        action.chapters[2]!.id,
        true,
      );
      const completed = await relayStore.completeCooperativeActionChapter(
        thirdUid,
        action.runId!,
        action.chapters[2]!.id,
        "circle-third-member",
      );
      await relayStore.completeCooperativeActionChapter(
        thirdUid,
        action.runId!,
        action.chapters[2]!.id,
        "circle-third-member",
      );

      expect(completed.activeAction?.status).toBe("COMPLETED");
      expect(completed.activeAction?.contributorCount).toBe(3);
      expect(completed.activeAction?.chapters[2]?.contributor).toMatchObject({
        actionTitle: "在室內找一片綠",
        usedAlternative: true,
      });
      expect((await relayStore.getTree(ownerUid)).growthPoints).toBe(
        before.growthPoints + action.growthPoints,
      );
    },
    120_000,
  );

  it("requires the full relay timer before recording a process witness", async () => {
    const ownerUid = `integration-timer-relay-owner-${randomUUID()}`;
    const secondUid = `integration-timer-relay-second-${randomUUID()}`;
    const thirdUid = `integration-timer-relay-third-${randomUUID()}`;
    createdFirebaseUids.add(ownerUid);
    createdFirebaseUids.add(secondUid);
    createdFirebaseUids.add(thirdUid);
    let now = new Date("2026-08-29T08:00:00.000Z");
    const timerStore = new PersistentStoreService(prisma, {
      now: () => now,
    } as ClockService);

    await timerStore.getContext(ownerUid);
    for (const [uid, relationship] of [
      [secondUid, "朋友"],
      [thirdUid, "鄰居朋友"],
    ] as const) {
      const invite = await timerStore.createHouseholdInvite(ownerUid);
      await timerStore.joinHousehold(uid, invite.code, relationship);
    }

    const action = (await timerStore.getCircleOverview(ownerUid)).activeAction!;
    expect(action.chapters[1]).toMatchObject({
      verificationMode: "TIMER",
      minimumSeconds: 180,
      alternative: {
        verificationMode: "TIMER",
        minimumSeconds: 180,
      },
    });
    await timerStore.claimCooperativeActionChapter(
      ownerUid,
      action.runId!,
      action.chapters[0]!.id,
    );
    await timerStore.completeCooperativeActionChapter(
      ownerUid,
      action.runId!,
      action.chapters[0]!.id,
    );

    now = new Date("2026-08-29T08:01:00.000Z");
    const claimed = await timerStore.claimCooperativeActionChapter(
      secondUid,
      action.runId!,
      action.chapters[1]!.id,
      true,
    );
    expect(claimed.activeAction?.chapters[1]).toMatchObject({
      verificationMode: "TIMER",
      minimumSeconds: 180,
      claim: {
        claimedAt: "2026-08-29T08:01:00.000Z",
        usingAlternative: true,
      },
    });

    now = new Date("2026-08-29T08:03:59.000Z");
    await expect(
      timerStore.completeCooperativeActionChapter(
        secondUid,
        action.runId!,
        action.chapters[1]!.id,
      ),
    ).rejects.toThrow("1 more seconds");
    expect(
      (await timerStore.getCircleOverview(secondUid)).activeAction?.chapters[1]
        ?.contributor,
    ).toBeNull();

    const thirdMemberId = (await timerStore.getCircleOverview(thirdUid))
      .currentMemberId;
    const handedOff = await timerStore.handoffCooperativeActionChapter(
      secondUid,
      action.runId!,
      action.chapters[1]!.id,
      thirdMemberId,
    );
    expect(handedOff.activeAction?.chapters[1]?.claim).toMatchObject({
      memberId: thirdMemberId,
      claimedAt: "2026-08-29T08:03:59.000Z",
      usingAlternative: true,
    });

    now = new Date("2026-08-29T08:04:00.000Z");
    await expect(
      timerStore.completeCooperativeActionChapter(
        thirdUid,
        action.runId!,
        action.chapters[1]!.id,
      ),
    ).rejects.toThrow("179 more seconds");

    now = new Date("2026-08-29T08:06:59.000Z");
    const completed = await timerStore.completeCooperativeActionChapter(
      thirdUid,
      action.runId!,
      action.chapters[1]!.id,
      "timer-after-handoff",
    );
    expect(completed.activeAction?.chapters[1]?.contributor).toMatchObject({
      witnessTier: "PROCESS",
      usedAlternative: true,
      witnessStartedAt: "2026-08-29T08:03:59.000Z",
      witnessMinimumSeconds: 180,
      witnessElapsedSeconds: 180,
    });
    const retried = await timerStore.completeCooperativeActionChapter(
      thirdUid,
      action.runId!,
      action.chapters[1]!.id,
      "timer-after-handoff",
    );
    expect(retried.activeAction?.chapters[1]?.contributor).toEqual(
      completed.activeAction?.chapters[1]?.contributor,
    );
  }, 120_000);

  it(
    "hands an alternative relay action to another member and releases it only after expiry",
    async () => {
      const ownerUid = `integration-relay-handoff-owner-${randomUUID()}`;
      const friendUid = `integration-relay-handoff-friend-${randomUUID()}`;
      createdFirebaseUids.add(ownerUid);
      createdFirebaseUids.add(friendUid);
      let now = new Date("2026-08-22T01:00:00.000Z");
      const relayStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);

      await relayStore.getContext(ownerUid);
      const invite = await relayStore.createHouseholdInvite(ownerUid);
      await relayStore.joinHousehold(friendUid, invite.code, "朋友");

      const ownerCircle = await relayStore.getCircleOverview(ownerUid);
      const friendCircle = await relayStore.getCircleOverview(friendUid);
      const action = ownerCircle.activeAction!;
      const chapter = action.chapters[0]!;

      const claimed = await relayStore.claimCooperativeActionChapter(
        ownerUid,
        action.runId!,
        chapter.id,
        true,
      );
      expect(claimed.activeAction?.chapters[0]?.alternative).not.toBeNull();
      expect(claimed.activeAction?.chapters[0]?.claim).toMatchObject({
        memberId: ownerCircle.currentMemberId,
        usingAlternative: true,
      });

      const handedOff = await relayStore.handoffCooperativeActionChapter(
        ownerUid,
        action.runId!,
        chapter.id,
        friendCircle.currentMemberId,
      );
      expect(handedOff.activeAction?.chapters[0]?.claim).toMatchObject({
        memberId: friendCircle.currentMemberId,
        usingAlternative: true,
      });
      await expect(
        relayStore.releaseExpiredCooperativeActionClaim(
          ownerUid,
          action.runId!,
          chapter.id,
        ),
      ).rejects.toThrow("Relay claim has not expired");

      now = new Date("2026-08-22T01:31:00.000Z");
      const released = await relayStore.releaseExpiredCooperativeActionClaim(
        ownerUid,
        action.runId!,
        chapter.id,
      );
      expect(released.activeAction?.chapters[0]?.claim).toBeNull();
    },
    120_000,
  );

  it(
    "keeps tasks, messages, and tree growth isolated to the active household",
    async () => {
      const inviterUid = `integration-inviter-${randomUUID()}`;
      const joinerUid = `integration-joiner-${randomUUID()}`;
      createdFirebaseUids.add(inviterUid);
      createdFirebaseUids.add(joinerUid);

      const inviterContext = await store.getContext(inviterUid);
      const joinerPersonalContext = await store.getContext(joinerUid);
      const invite = await store.createHouseholdInvite(inviterUid);
      const joinedContext = await store.joinHousehold(
        joinerUid,
        invite.code,
        "家人",
      );

      expect(joinedContext.households).toHaveLength(2);
      expect(joinedContext.activeHouseholdId).toBe(
        inviterContext.activeHouseholdId,
      );

      await store.createMessage(joinerUid, "共享家庭的第一則訊息");
      expect((await store.listMessages(inviterUid))[0]?.body).toBe(
        "共享家庭的第一則訊息",
      );
      expect((await store.getHomeSummary(joinerUid)).messageCount).toBe(1);

      const sharedTask = (await store.listTasks(joinerUid)).find(
        (task) => task.verificationMode === "SELF_CHECK",
      );
      expect(sharedTask).toBeDefined();
      await store.completeTask(joinerUid, sharedTask!.id);
      const sharedHome = await store.getHomeSummary(inviterUid);
      expect(sharedHome.tree.growthPoints).toBe(30);
      expect(sharedHome.nextAction.taskId).not.toBe(sharedTask!.id);

      await store.setActiveHousehold(
        joinerUid,
        joinerPersonalContext.activeHouseholdId,
      );
      expect((await store.getTree(joinerUid)).growthPoints).toBe(0);
      expect(await store.listMessages(joinerUid)).toEqual([]);
      const personalHome = await store.getHomeSummary(joinerUid);
      expect(personalHome.tree.growthPoints).toBe(0);
      expect(personalHome.messageCount).toBe(0);

      await store.setActiveHousehold(
        joinerUid,
        inviterContext.activeHouseholdId,
      );
      expect((await store.getTree(joinerUid)).growthPoints).toBe(30);
    },
    120_000,
  );

  it("creates single-use LINE binding codes and revokes active bindings", async () => {
    const lineUid = `integration-line-${randomUUID()}`;
    const lineUserId = `U${randomUUID().replace(/-/g, "")}`;
    createdFirebaseUids.add(lineUid);
    createdLineTargets.add(lineUserId);

    const context = await store.getContext(lineUid);
    const code = await store.createLineBindingCode(lineUid);
    expect(code.code).toHaveLength(8);

    const binding = await store.bindLineUserWithCode(code.code, lineUserId);
    expect(binding.householdId).toBe(context.activeHouseholdId);
    expect(binding.status).toBe("ACTIVE");

    await expect(
      store.bindLineUserWithCode(code.code, `${lineUserId}-again`),
    ).rejects.toMatchObject({ status: 409 });

    const bindings = await store.listLineBindings(lineUid);
    expect(bindings).toHaveLength(1);
    expect(bindings[0].id).toBe(binding.id);

    const revoked = await store.revokeLineBinding(lineUid, binding.id);
    expect(revoked[0]?.status).toBe("REVOKED");

    const log = await store.logLineNotification({
      lineBindingId: binding.id,
      target: lineUserId,
      type: "ADMIN_TEST_PUSH",
      status: "SKIPPED",
      error: "LINE_CHANNEL_ACCESS_TOKEN is not configured",
    });
    expect(log.status).toBe("SKIPPED");

    const adminBindings = await store.listAdminLineBindings();
    const adminBinding = adminBindings.find((item) => item.id === binding.id);
    expect(adminBinding).toMatchObject({
      id: binding.id,
      householdId: context.activeHouseholdId,
      status: "REVOKED",
      notificationCount: 1,
      lastNotificationStatus: "SKIPPED",
    });
  });

  it("logs LINE notifications for family messages without notifying the author", async () => {
    const previousLineAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const authorUid = `integration-line-message-author-${randomUUID()}`;
    const receiverUid = `integration-line-message-receiver-${randomUUID()}`;
    const receiverLineUserId = `U${randomUUID().replace(/-/g, "")}`;
    const authorLineUserId = `U${randomUUID().replace(/-/g, "")}`;
    createdFirebaseUids.add(authorUid);
    createdFirebaseUids.add(receiverUid);
    createdLineTargets.add(receiverLineUserId);
    createdLineTargets.add(authorLineUserId);
    try {
      const authorContext = await store.getContext(authorUid);
      const invite = await store.createHouseholdInvite(authorUid);
      await store.joinHousehold(receiverUid, invite.code, "家人");

      const receiverCode = await store.createLineBindingCode(receiverUid);
      await store.bindLineUserWithCode(receiverCode.code, receiverLineUserId);
      const authorCode = await store.createLineBindingCode(authorUid);
      await store.bindLineUserWithCode(authorCode.code, authorLineUserId);

      await store.createMessage(authorUid, "今天晚點一起看看生命樹。");

      const receiverLogs = await prisma.lineNotificationLog.findMany({
        where: { target: receiverLineUserId, type: "FAMILY_MESSAGE" },
      });
      const authorLogs = await prisma.lineNotificationLog.findMany({
        where: { target: authorLineUserId, type: "FAMILY_MESSAGE" },
      });
      expect(receiverLogs).toHaveLength(1);
      expect(receiverLogs[0]?.status).toBe("SKIPPED");
      expect(authorLogs).toHaveLength(0);
      expect((await store.listMessages(receiverUid))[0]?.body).toBe(
        "今天晚點一起看看生命樹。",
      );
      expect(authorContext.activeHouseholdId).toBe(
        (await store.getContext(receiverUid)).activeHouseholdId,
      );
    } finally {
      if (previousLineAccessToken === undefined) {
        delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
      } else {
        process.env.LINE_CHANNEL_ACCESS_TOKEN = previousLineAccessToken;
      }
    }
  });

  it(
    "requires the configured timer duration before awarding growth",
    async () => {
      const timerUid = `integration-timer-${randomUUID()}`;
      createdFirebaseUids.add(timerUid);
      let now = new Date("2026-07-06T00:00:00.000Z");
      const timerStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);
      const timerTask = (await timerStore.listTasks(timerUid)).find(
        (task) => task.verificationMode === "TIMER",
      );
      expect(timerTask).toBeDefined();

      const started = await timerStore.startTask(timerUid, timerTask!.id);
      expect(started.startedAt).toBe("2026-07-06T00:00:00.000Z");

      now = new Date("2026-07-06T00:09:59.000Z");
      await expect(
        timerStore.completeTask(timerUid, timerTask!.id),
      ).rejects.toThrow("1 more seconds");

      now = new Date("2026-07-06T00:10:00.000Z");
      await timerStore.completeTask(timerUid, timerTask!.id);
      expect((await timerStore.getTree(timerUid)).growthPoints).toBe(60);
    },
    60_000,
  );

  it(
    "claims only a pre-provisioned device with the hashed claim code",
    async () => {
      const claimantUid = `integration-device-${randomUUID()}`;
      const otherUid = `integration-device-other-${randomUUID()}`;
      createdFirebaseUids.add(claimantUid);
      createdFirebaseUids.add(otherUid);
      await store.getContext(claimantUid);
      await store.getContext(otherUid);

      const serialNumber = `TREE-${randomUUID()}`;
      const claimCode = "482951";
      const pepper = `integration-pepper-${randomUUID()}`;
      const previousPepper = process.env.DEVICE_CLAIM_PEPPER;
      process.env.DEVICE_CLAIM_PEPPER = pepper;
      const claimCodeHash = createHash("sha256")
        .update(`${pepper}\u0000${serialNumber}\u0000${claimCode}`)
        .digest("hex");
      const device = await prisma.device.create({
        data: {
          serialNumber,
          thingName: `integration-${randomUUID()}`,
          claimCodeHash,
          firmwareVersion: "integration-test",
        },
      });
      createdDeviceIds.add(device.id);

      try {
        expect(await store.listDevices(claimantUid)).toEqual([]);
        await expect(
          store.claimDevice(claimantUid, serialNumber, "000000"),
        ).rejects.toThrow("Invalid serial number or claim code");

        const claimed = await store.claimDevice(
          claimantUid,
          serialNumber,
          claimCode,
        );
        expect(claimed.serialNumber).toBe(serialNumber);
        expect(claimed.claimed).toBe(true);
        expect(await store.listDevices(claimantUid)).toHaveLength(1);
        await expect(
          store.claimDevice(otherUid, serialNumber, claimCode),
        ).rejects.toThrow("already claimed");
      } finally {
        if (previousPepper === undefined) {
          delete process.env.DEVICE_CLAIM_PEPPER;
        } else {
          process.env.DEVICE_CLAIM_PEPPER = previousPepper;
        }
      }
    },
    60_000,
  );

  it(
    "keeps photo AI locked until storage and verification are enabled",
    async () => {
      delete process.env.PHOTO_EVIDENCE_ENABLED;
      delete process.env.PHOTO_VERIFICATION_ENABLED;
      const lockedUid = `integration-photo-locked-${randomUUID()}`;
      createdFirebaseUids.add(lockedUid);
      const context = await store.getContext(lockedUid);
      const photoTask = (await store.listTasks(lockedUid)).find(
        (task) => task.verificationMode === "PHOTO_AI",
      );

      expect(context.capabilities.photoEvidence).toEqual({
        enabled: false,
        reason: "BLAZE_REQUIRED",
      });
      expect(context.capabilities.geminiPhotoVerification).toEqual({
        enabled: false,
        reason: "BLAZE_REQUIRED",
      });
      expect(photoTask?.capability).toEqual({
        enabled: false,
        reason: "BLAZE_REQUIRED",
      });
      await expect(
        store.initializeEvidence(
          lockedUid,
          photoTask!.id,
          "locked.jpg",
          "image/jpeg",
        ),
      ).rejects.toThrow("private storage is configured");
      await expect(
        store.completeGeminiPhotoTask(lockedUid, photoTask!.id, {
          imageBase64: "ZmFrZS1qcGVn",
          contentType: "image/jpeg",
          idempotencyKey: "locked-gemini-photo",
        }),
      ).rejects.toThrow("requires private storage");
    },
    60_000,
  );

  it(
    "exposes photo capabilities when storage and verifier are enabled",
    async () => {
      const previousPhotoEvidenceEnabled = process.env.PHOTO_EVIDENCE_ENABLED;
      const previousPhotoVerificationEnabled =
        process.env.PHOTO_VERIFICATION_ENABLED;
      const previousStorageBucket = process.env.FIREBASE_STORAGE_BUCKET;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      process.env.PHOTO_VERIFICATION_ENABLED = "true";
      process.env.FIREBASE_STORAGE_BUCKET = "test-bucket";
      try {
        const capabilityUid = `integration-photo-capability-${randomUUID()}`;
        createdFirebaseUids.add(capabilityUid);
        const context = await store.getContext(capabilityUid);
        const photoTask = (await store.listTasks(capabilityUid)).find(
          (task) => task.verificationMode === "PHOTO_AI",
        );

        expect(context.capabilities.photoEvidence).toEqual({
          enabled: true,
          reason: null,
        });
        expect(context.capabilities.geminiPhotoVerification).toEqual({
          enabled: true,
          reason: null,
        });
        expect(photoTask?.capability).toEqual({
          enabled: true,
          reason: null,
        });
      } finally {
        if (previousPhotoEvidenceEnabled === undefined) {
          delete process.env.PHOTO_EVIDENCE_ENABLED;
        } else {
          process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
        }
        if (previousPhotoVerificationEnabled === undefined) {
          delete process.env.PHOTO_VERIFICATION_ENABLED;
        } else {
          process.env.PHOTO_VERIFICATION_ENABLED =
            previousPhotoVerificationEnabled;
        }
        if (previousStorageBucket === undefined) {
          delete process.env.FIREBASE_STORAGE_BUCKET;
        } else {
          process.env.FIREBASE_STORAGE_BUCKET = previousStorageBucket;
        }
      }
    },
    60_000,
  );

  it("exposes admin photo AI operational status without secrets", () => {
    const previousPhotoEvidenceEnabled = process.env.PHOTO_EVIDENCE_ENABLED;
    const previousPhotoVerificationEnabled =
      process.env.PHOTO_VERIFICATION_ENABLED;
    const previousStorageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    const previousVerifierUrl = process.env.AI_VERIFIER_URL;
    process.env.PHOTO_EVIDENCE_ENABLED = "true";
    process.env.PHOTO_VERIFICATION_ENABLED = "true";
    process.env.FIREBASE_STORAGE_BUCKET = "test-bucket";
    process.env.AI_VERIFIER_URL = "http://127.0.0.1:4400";

    try {
      const status = store.getPhotoAiOperationalStatus();

      expect(status.photoEvidence.enabled).toBe(true);
      expect(status.geminiPhotoVerification.enabled).toBe(true);
      expect(status.storageBucketConfigured).toBe(true);
      expect(status.storageBucketName).toBe("test-bucket");
      expect(status.aiVerifierUrlConfigured).toBe(true);
      expect(status.aiVerifierUrl).toBe("http://127.0.0.1:4400");
      expect(status.generalPhotoAiTasksEnabled).toBe(true);
      expect(status.radarPhotoAiTasksEnabled).toBe(false);
      expect(JSON.stringify(status)).not.toContain("GEMINI_API_KEY");
      expect(JSON.stringify(status)).not.toContain("DATABASE_URL");
    } finally {
      if (previousPhotoEvidenceEnabled === undefined) {
        delete process.env.PHOTO_EVIDENCE_ENABLED;
      } else {
        process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
      }
      if (previousPhotoVerificationEnabled === undefined) {
        delete process.env.PHOTO_VERIFICATION_ENABLED;
      } else {
        process.env.PHOTO_VERIFICATION_ENABLED =
          previousPhotoVerificationEnabled;
      }
      if (previousStorageBucket === undefined) {
        delete process.env.FIREBASE_STORAGE_BUCKET;
      } else {
        process.env.FIREBASE_STORAGE_BUCKET = previousStorageBucket;
      }
      if (previousVerifierUrl === undefined) {
        delete process.env.AI_VERIFIER_URL;
      } else {
        process.env.AI_VERIFIER_URL = previousVerifierUrl;
      }
    }
  });

  it(
    "completes Gemini photo tasks only when explicitly enabled and stays idempotent",
    async () => {
      const previousPhotoEvidenceEnabled = process.env.PHOTO_EVIDENCE_ENABLED;
      const previousPhotoVerificationEnabled =
        process.env.PHOTO_VERIFICATION_ENABLED;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      process.env.PHOTO_VERIFICATION_ENABLED = "true";
      const verifier = {
        verifyInline: vi.fn().mockResolvedValue({
          decision: "PASS",
          confidence: 0.92,
          labels: ["plant", "flower"],
          reasonCodes: ["RULES_SATISFIED"],
          explanation: "A plant and flower are visible.",
          model: "fake-gemini",
          ruleVersion: "1.0.0",
        }),
      };
      store = new PersistentStoreService(
        prisma,
        undefined,
        undefined,
        verifier as never,
      );
      try {
        const photoUid = `integration-gemini-photo-${randomUUID()}`;
        createdFirebaseUids.add(photoUid);
        const photoTask = (await store.listTasks(photoUid)).find(
          (task) => task.verificationMode === "PHOTO_AI",
        );
        expect(photoTask).toBeDefined();

        const before = await store.getTree(photoUid);
        const first = await store.completeGeminiPhotoTask(
          photoUid,
          photoTask!.id,
          {
            imageBase64: "ZmFrZS1qcGVn",
            contentType: "image/jpeg",
            idempotencyKey: "gemini-plant-photo",
          },
        );
        await store.completeGeminiPhotoTask(photoUid, photoTask.id, {
          imageBase64: "ZmFrZS1qcGVn",
          contentType: "image/jpeg",
          idempotencyKey: "gemini-plant-photo",
        });
        const afterRetry = await store.getTree(photoUid);

        expect(verifier.verifyInline).toHaveBeenCalledTimes(1);
        expect(first.status).toBe("COMPLETED");
        expect(afterRetry.growthPoints).toBe(
          before.growthPoints + photoTask.growthPoints,
        );
      } finally {
        if (previousPhotoEvidenceEnabled === undefined) {
          delete process.env.PHOTO_EVIDENCE_ENABLED;
        } else {
          process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
        }
        if (previousPhotoVerificationEnabled === undefined) {
          delete process.env.PHOTO_VERIFICATION_ENABLED;
        } else {
          process.env.PHOTO_VERIFICATION_ENABLED =
            previousPhotoVerificationEnabled;
        }
      }
    },
    60_000,
  );

  it(
    "does not complete uploaded evidence while photo verification is disabled",
    async () => {
      const previousPhotoEvidenceEnabled = process.env.PHOTO_EVIDENCE_ENABLED;
      const previousPhotoVerificationEnabled =
        process.env.PHOTO_VERIFICATION_ENABLED;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      delete process.env.PHOTO_VERIFICATION_ENABLED;
      const photoUid = `integration-storage-verifier-disabled-${randomUUID()}`;
      createdFirebaseUids.add(photoUid);
      const fakeStorage = {
        assertUploaded: vi.fn(async () => undefined),
        createSignedReadUrl: vi.fn(async (path: string) =>
          `https://storage.test/${encodeURIComponent(path)}`,
        ),
        deleteObject: vi.fn(async () => undefined),
      };
      const fakeVerifier = {
        verify: vi.fn(async () => ({
          decision: "PASS",
          confidence: 0.93,
          labels: ["plant"],
          reasonCodes: ["RULES_SATISFIED"],
          explanation: "A plant is visible.",
          model: "integration-verifier",
          ruleVersion: "1.0.0",
        })),
      };
      const photoStore = new PersistentStoreService(
        prisma,
        undefined,
        fakeStorage as never,
        fakeVerifier as never,
      );
      try {
        const photoTask = (await photoStore.listTasks(photoUid)).find(
          (task) => task.verificationMode === "PHOTO_AI",
        );
        expect(photoTask).toBeDefined();
        const evidence = await photoStore.initializeEvidence(
          photoUid,
          photoTask!.id,
          "plant.jpg",
          "image/jpeg",
        );

        await expect(
          photoStore.completeEvidence(
            photoUid,
            evidence.id,
            "1234567890abcdef",
          ),
        ).rejects.toThrow("Photo verification is disabled");
        expect(fakeStorage.assertUploaded).not.toHaveBeenCalled();
        expect(fakeVerifier.verify).not.toHaveBeenCalled();
      } finally {
        if (previousPhotoEvidenceEnabled === undefined) {
          delete process.env.PHOTO_EVIDENCE_ENABLED;
        } else {
          process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
        }
        if (previousPhotoVerificationEnabled === undefined) {
          delete process.env.PHOTO_VERIFICATION_ENABLED;
        } else {
          process.env.PHOTO_VERIFICATION_ENABLED =
            previousPhotoVerificationEnabled;
        }
      }
    },
    60_000,
  );

  it.each([
    "Unsupported evidence content type",
    "Evidence image must be between 1 byte and 10 MB",
    "No such object",
  ])(
    "does not call the verifier when storage validation fails: %s",
    async (storageError) => {
      const previousPhotoEvidenceEnabled = process.env.PHOTO_EVIDENCE_ENABLED;
      const previousPhotoVerificationEnabled =
        process.env.PHOTO_VERIFICATION_ENABLED;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      process.env.PHOTO_VERIFICATION_ENABLED = "true";
      const photoUid = `integration-storage-validation-${randomUUID()}`;
      createdFirebaseUids.add(photoUid);
      const fakeStorage = {
        assertUploaded: vi.fn(async () => {
          throw new Error(storageError);
        }),
        createSignedReadUrl: vi.fn(async (path: string) =>
          `https://storage.test/${encodeURIComponent(path)}`,
        ),
        deleteObject: vi.fn(async () => undefined),
      };
      const fakeVerifier = {
        verify: vi.fn(async () => ({
          decision: "PASS",
          confidence: 0.93,
          labels: ["plant"],
          reasonCodes: ["RULES_SATISFIED"],
          explanation: "A plant is visible.",
          model: "integration-verifier",
          ruleVersion: "1.0.0",
        })),
      };
      const photoStore = new PersistentStoreService(
        prisma,
        undefined,
        fakeStorage as never,
        fakeVerifier as never,
      );
      try {
        const photoTask = (await photoStore.listTasks(photoUid)).find(
          (task) => task.verificationMode === "PHOTO_AI",
        );
        expect(photoTask).toBeDefined();
        const evidence = await photoStore.initializeEvidence(
          photoUid,
          photoTask!.id,
          "plant.jpg",
          "image/jpeg",
        );

        await expect(
          photoStore.completeEvidence(
            photoUid,
            evidence.id,
            "1234567890abcdef",
          ),
        ).rejects.toThrow(storageError);
        expect(fakeStorage.createSignedReadUrl).not.toHaveBeenCalled();
        expect(fakeVerifier.verify).not.toHaveBeenCalled();
      } finally {
        if (previousPhotoEvidenceEnabled === undefined) {
          delete process.env.PHOTO_EVIDENCE_ENABLED;
        } else {
          process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
        }
        if (previousPhotoVerificationEnabled === undefined) {
          delete process.env.PHOTO_VERIFICATION_ENABLED;
        } else {
          process.env.PHOTO_VERIFICATION_ENABLED =
            previousPhotoVerificationEnabled;
        }
      }
    },
    60_000,
  );

  it(
    "rejects Gemini photo tasks when the verifier does not pass",
    async () => {
      const previousPhotoEvidenceEnabled = process.env.PHOTO_EVIDENCE_ENABLED;
      const previousPhotoVerificationEnabled =
        process.env.PHOTO_VERIFICATION_ENABLED;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      process.env.PHOTO_VERIFICATION_ENABLED = "true";
      const verifier = {
        verifyInline: vi.fn().mockResolvedValue({
          decision: "REVIEW",
          confidence: 0.64,
          labels: ["chair"],
          reasonCodes: ["MISSING_REQUIRED_LABEL"],
          explanation: "No plant is visible.",
          model: "fake-gemini",
          ruleVersion: "1.0.0",
        }),
      };
      store = new PersistentStoreService(
        prisma,
        undefined,
        undefined,
        verifier as never,
      );
      try {
        const photoUid = `integration-gemini-photo-rejected-${randomUUID()}`;
        createdFirebaseUids.add(photoUid);
        const photoTask = (await store.listTasks(photoUid)).find(
          (task) => task.verificationMode === "PHOTO_AI",
        );
        expect(photoTask).toBeDefined();

        await expect(
          store.completeGeminiPhotoTask(photoUid, photoTask!.id, {
            imageBase64: "ZmFrZS1qcGVn",
            contentType: "image/jpeg",
            idempotencyKey: "gemini-chair-photo",
          }),
        ).rejects.toThrow("Photo verification did not pass");

        expect((await store.getTree(photoUid)).growthPoints).toBe(0);
      } finally {
        if (previousPhotoEvidenceEnabled === undefined) {
          delete process.env.PHOTO_EVIDENCE_ENABLED;
        } else {
          process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
        }
        if (previousPhotoVerificationEnabled === undefined) {
          delete process.env.PHOTO_VERIFICATION_ENABLED;
        } else {
          process.env.PHOTO_VERIFICATION_ENABLED =
            previousPhotoVerificationEnabled;
        }
      }
    },
    60_000,
  );

  it(
    "completes uploaded photo evidence once and deletes terminal storage objects",
    async () => {
      const previousPhotoEvidenceEnabled = process.env.PHOTO_EVIDENCE_ENABLED;
      const previousPhotoVerificationEnabled =
        process.env.PHOTO_VERIFICATION_ENABLED;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      process.env.PHOTO_VERIFICATION_ENABLED = "true";
      const photoUid = `integration-storage-photo-pass-${randomUUID()}`;
      createdFirebaseUids.add(photoUid);
      const deletedPaths: string[] = [];
      const fakeStorage = {
        assertUploaded: vi.fn(async () => undefined),
        createSignedReadUrl: vi.fn(async (path: string) =>
          `https://storage.test/${encodeURIComponent(path)}`,
        ),
        deleteObject: vi.fn(async (path: string) => {
          deletedPaths.push(path);
        }),
      };
      const fakeVerifier = {
        verify: vi.fn(async () => ({
          decision: "PASS",
          confidence: 0.93,
          labels: ["plant", "leaf"],
          reasonCodes: ["RULES_SATISFIED"],
          explanation: "A plant is clearly visible.",
          model: "integration-verifier",
          ruleVersion: "1.0.0",
        })),
      };
      const photoStore = new PersistentStoreService(
        prisma,
        undefined,
        fakeStorage as never,
        fakeVerifier as never,
      );
      try {
        const photoTask = (await photoStore.listTasks(photoUid)).find(
          (task) => task.verificationMode === "PHOTO_AI",
        );
        expect(photoTask).toBeDefined();
        const before = await photoStore.getTree(photoUid);
        const evidence = await photoStore.initializeEvidence(
          photoUid,
          photoTask!.id,
          "plant.jpg",
          "image/jpeg",
        );

        const first = await photoStore.completeEvidence(
          photoUid,
          evidence.id,
          "1234567890abcdef",
        );
        const retry = await photoStore.completeEvidence(
          photoUid,
          evidence.id,
          "1234567890abcdef",
        );
        const after = await photoStore.getTree(photoUid);

        expect(first.decision).toBe("PASS");
        expect(retry.decision).toBe("PASS");
        expect(fakeVerifier.verify).toHaveBeenCalledTimes(1);
        expect(after.growthPoints).toBe(
          before.growthPoints + photoTask.growthPoints,
        );
        expect(deletedPaths).toContain(evidence.storagePath);
      } finally {
        if (previousPhotoEvidenceEnabled === undefined) {
          delete process.env.PHOTO_EVIDENCE_ENABLED;
        } else {
          process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
        }
        if (previousPhotoVerificationEnabled === undefined) {
          delete process.env.PHOTO_VERIFICATION_ENABLED;
        } else {
          process.env.PHOTO_VERIFICATION_ENABLED =
            previousPhotoVerificationEnabled;
        }
      }
    },
    60_000,
  );

  it(
    "rejects failed uploaded photo evidence without awarding growth",
    async () => {
      const previousPhotoEvidenceEnabled = process.env.PHOTO_EVIDENCE_ENABLED;
      const previousPhotoVerificationEnabled =
        process.env.PHOTO_VERIFICATION_ENABLED;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      process.env.PHOTO_VERIFICATION_ENABLED = "true";
      const photoUid = `integration-storage-photo-fail-${randomUUID()}`;
      createdFirebaseUids.add(photoUid);
      const deletedPaths: string[] = [];
      const fakeStorage = {
        assertUploaded: vi.fn(async () => undefined),
        createSignedReadUrl: vi.fn(async (path: string) =>
          `https://storage.test/${encodeURIComponent(path)}`,
        ),
        deleteObject: vi.fn(async (path: string) => {
          deletedPaths.push(path);
        }),
      };
      const fakeVerifier = {
        verify: vi.fn(async () => ({
          decision: "FAIL",
          confidence: 0.2,
          labels: ["sky"],
          reasonCodes: ["MISSING_REQUIRED_LABEL", "LOW_CONFIDENCE"],
          explanation: "No required evidence is visible.",
          model: "integration-verifier",
          ruleVersion: "1.0.0",
        })),
      };
      const photoStore = new PersistentStoreService(
        prisma,
        undefined,
        fakeStorage as never,
        fakeVerifier as never,
      );
      try {
        const photoTask = (await photoStore.listTasks(photoUid)).find(
          (task) => task.verificationMode === "PHOTO_AI",
        );
        expect(photoTask).toBeDefined();
        const before = await photoStore.getTree(photoUid);
        const evidence = await photoStore.initializeEvidence(
          photoUid,
          photoTask!.id,
          "sky.jpg",
          "image/jpeg",
        );

        const result = await photoStore.completeEvidence(
          photoUid,
          evidence.id,
          "abcdef1234567890",
        );
        const after = await photoStore.getTree(photoUid);
        const updatedTask = (await photoStore.listTasks(photoUid)).find(
          (task) => task.id === photoTask.id,
        );
        const retryEvidence = await photoStore.initializeEvidence(
          photoUid,
          photoTask.id,
          "plant-retry.jpg",
          "image/jpeg",
        );

        expect(result.decision).toBe("FAIL");
        expect(result.status).toBe("REJECTED");
        expect(after.growthPoints).toBe(before.growthPoints);
        expect(updatedTask?.status).toBe("REJECTED");
        expect(retryEvidence.id).not.toBe(evidence.id);
        expect(deletedPaths).toContain(evidence.storagePath);
      } finally {
        if (previousPhotoEvidenceEnabled === undefined) {
          delete process.env.PHOTO_EVIDENCE_ENABLED;
        } else {
          process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
        }
        if (previousPhotoVerificationEnabled === undefined) {
          delete process.env.PHOTO_VERIFICATION_ENABLED;
        } else {
          process.env.PHOTO_VERIFICATION_ENABLED =
            previousPhotoVerificationEnabled;
        }
      }
    },
    60_000,
  );

  it(
    "lets another household member review photo evidence exactly once",
    async () => {
      const previousPhotoEvidenceEnabled =
        process.env.PHOTO_EVIDENCE_ENABLED;
      const previousPhotoVerificationEnabled =
        process.env.PHOTO_VERIFICATION_ENABLED;
      const previousLineAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      process.env.PHOTO_EVIDENCE_ENABLED = "true";
      process.env.PHOTO_VERIFICATION_ENABLED = "true";
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
      const submitterUid = `integration-photo-${randomUUID()}`;
      const reviewerUid = `integration-reviewer-${randomUUID()}`;
      const submitterLineUserId = `U${randomUUID().replace(/-/g, "")}`;
      const reviewerLineUserId = `U${randomUUID().replace(/-/g, "")}`;
      createdFirebaseUids.add(submitterUid);
      createdFirebaseUids.add(reviewerUid);
      createdLineTargets.add(submitterLineUserId);
      createdLineTargets.add(reviewerLineUserId);
      const deletedPaths: string[] = [];
      const fakeStorage = {
        assertUploaded: async () => undefined,
        createSignedReadUrl: async (path: string) =>
          `https://storage.test/${encodeURIComponent(path)}`,
        deleteObject: async (path: string) => {
          deletedPaths.push(path);
        },
      };
      const fakeVerifier = {
        verify: async () => ({
          decision: "REVIEW",
          confidence: 0.72,
          labels: ["plant"],
          reasonCodes: ["LOW_CONFIDENCE"],
          explanation: "A plant is visible but needs a person to confirm.",
          model: "integration-verifier",
          ruleVersion: "1.0.0",
        }),
      };
      const photoStore = new PersistentStoreService(
        prisma,
        undefined,
        fakeStorage as never,
        fakeVerifier as never,
      );
      const submitterContext = await photoStore.getContext(submitterUid);
      const invite = await photoStore.createHouseholdInvite(submitterUid);
      await photoStore.joinHousehold(reviewerUid, invite.code, "志願陪伴者");
      const submitterLineCode =
        await photoStore.createLineBindingCode(submitterUid);
      await photoStore.bindLineUserWithCode(
        submitterLineCode.code,
        submitterLineUserId,
      );
      const reviewerLineCode =
        await photoStore.createLineBindingCode(reviewerUid);
      await photoStore.bindLineUserWithCode(
        reviewerLineCode.code,
        reviewerLineUserId,
      );

      const photoTask = (await photoStore.listTasks(submitterUid)).find(
        (task) => task.verificationMode === "PHOTO_AI",
      );
      expect(photoTask).toBeDefined();
      const evidence = await photoStore.initializeEvidence(
        submitterUid,
        photoTask!.id,
        "plant.jpg",
        "image/jpeg",
      );
      const verification = await photoStore.completeEvidence(
        submitterUid,
        evidence.id,
        "1234567890abcdef",
      );

      expect(verification.decision).toBe("REVIEW");
      expect((await photoStore.getTree(submitterUid)).growthPoints).toBe(0);
      expect(await photoStore.listFamilyReviews(submitterUid)).toEqual([]);
      const reviewerQueue = await photoStore.listFamilyReviews(reviewerUid);
      expect(reviewerQueue).toHaveLength(1);
      const reviewerNotifications = await prisma.lineNotificationLog.findMany({
        where: { target: reviewerLineUserId, type: "PHOTO_REVIEW_REQUEST" },
      });
      const submitterNotifications = await prisma.lineNotificationLog.findMany({
        where: { target: submitterLineUserId, type: "PHOTO_REVIEW_REQUEST" },
      });
      expect(reviewerNotifications).toHaveLength(1);
      expect(reviewerNotifications[0]?.status).toBe("SKIPPED");
      expect(submitterNotifications).toHaveLength(0);

      await photoStore.decideFamilyReview(
        reviewerUid,
        reviewerQueue[0]!.id,
        "PASS",
      );
      await photoStore.decideFamilyReview(
        reviewerUid,
        reviewerQueue[0]!.id,
        "PASS",
      );

      await photoStore.setActiveHousehold(
        reviewerUid,
        submitterContext.activeHouseholdId,
      );
      expect((await photoStore.getTree(reviewerUid)).growthPoints).toBe(80);
      expect(deletedPaths.length).toBeGreaterThanOrEqual(1);
      expect(new Set(deletedPaths)).toEqual(new Set([evidence.storagePath]));
      if (previousPhotoEvidenceEnabled === undefined) {
        delete process.env.PHOTO_EVIDENCE_ENABLED;
      } else {
        process.env.PHOTO_EVIDENCE_ENABLED = previousPhotoEvidenceEnabled;
      }
      if (previousPhotoVerificationEnabled === undefined) {
        delete process.env.PHOTO_VERIFICATION_ENABLED;
      } else {
        process.env.PHOTO_VERIFICATION_ENABLED =
          previousPhotoVerificationEnabled;
      }
      if (previousLineAccessToken === undefined) {
        delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
      } else {
        process.env.LINE_CHANNEL_ACCESS_TOKEN = previousLineAccessToken;
      }
    },
    60_000,
  );

  it(
    "publishes valid admin routes and keeps published versions immutable",
    async () => {
      const route = await store.createAdminExplorationRoute({
        slug: `admin-route-${randomUUID()}`,
        name: "後台測試路線",
        description: "用公開介面驗證草稿、任務與發布後不可修改。",
        badgeName: "後台測試徽章",
        badgeAssetKey: "admin-test",
      });
      createdRouteIds.add(route.id);
      const firstRoutes = await store.createAdminExplorationQuest({
        routeId: route.id,
        sequence: 1,
        locationName: "測試地標",
        category: "NATURE",
        safetyNote: "待現場確認。",
        accessibilityTags: ["待確認"],
        title: "觀察一棵樹",
        description: "停下來觀察一棵樹的形狀。",
        verificationMode: "SELF_CHECK",
        growthPoints: 5,
        triggerType: "GEOFENCE",
        latitude: 25.0316,
        longitude: 121.5362,
        radiusMeters: 50,
      });
      const firstDraft = firstRoutes.find((item) => item.id === route.id)!;
      const secondRoutes = await store.createAdminExplorationQuest({
        routeId: route.id,
        sequence: 2,
        locationName: "第二個測試地標",
        category: "REST",
        safetyNote: "待現場確認。",
        accessibilityTags: ["待確認"],
        title: "停下來休息",
        description: "依自己的狀況停下來休息。",
        verificationMode: "SELF_CHECK",
        growthPoints: 4,
        triggerType: "GEOFENCE",
        latitude: 25.032,
        longitude: 121.5368,
        radiusMeters: 50,
      });
      const draft = secondRoutes.find((item) => item.id === route.id)!;
      createdTaskIds.add(firstDraft.quests[0]!.taskId);
      createdTaskIds.add(draft.quests[1]!.taskId);
      const reordered = await store.reorderAdminExplorationQuests(route.id, [
        draft.quests[1]!.id,
        draft.quests[0]!.id,
      ]);
      expect(
        reordered.find((item) => item.id === route.id)?.quests[0]?.title,
      ).toBe("停下來休息");

      const published = await store.publishAdminExplorationRoute(route.id);
      expect(published.status).toBe("PUBLISHED");
      expect(
        (await store.getPublicExplorationRoute(route.slug)).totalQuestCount,
      ).toBe(2);
      await expect(
        store.updateAdminExplorationRoute(route.id, { name: "不應被修改" }),
      ).rejects.toThrow("immutable");
    },
    60_000,
  );

  it(
    "computes exploration distance on the server and awards a route badge once",
    async () => {
      const explorerUid = `integration-explorer-${randomUUID()}`;
      const routeId = randomUUID();
      const distanceTaskId = randomUUID();
      const placeTaskId = randomUUID();
      createdFirebaseUids.add(explorerUid);
      createdRouteIds.add(routeId);
      createdTaskIds.add(distanceTaskId);
      createdTaskIds.add(placeTaskId);
      let now = new Date("2026-07-06T05:00:00.000Z");
      const explorationStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);

      await prisma.explorationRoute.create({
        data: {
          id: routeId,
          slug: `integration-route-${randomUUID()}`,
          name: "整合測試綠徑",
          description: "驗證伺服器計距、地標解鎖與徽章。",
          badgeName: "整合測試徽章",
          badgeAssetKey: "integration-leaf",
          status: "PUBLISHED",
          publishedAt: now,
          quests: {
            create: [
              {
                sequence: 1,
                locationName: "第一段步行",
                category: "DISTANCE",
                triggerType: "DISTANCE",
                unlockDistanceMeters: 80,
                task: {
                  create: {
                    id: distanceTaskId,
                    title: "完成第一段步行",
                    description: "走完第一段後確認自己的狀態。",
                    verificationMode: "SELF_CHECK",
                    verificationRule: { source: "exploration" },
                    growthPoints: 6,
                  },
                },
              },
              {
                sequence: 2,
                locationName: "測試地標",
                category: "NATURE",
                triggerType: "GEOFENCE",
                latitude: 25.0338,
                longitude: 121.5357,
                radiusMeters: 50,
                task: {
                  create: {
                    id: placeTaskId,
                    title: "抵達測試地標",
                    description: "抵達後完成一項自我確認。",
                    verificationMode: "SELF_CHECK",
                    verificationRule: { source: "exploration" },
                    growthPoints: 8,
                  },
                },
              },
            ],
          },
        },
      });

      const session = await explorationStore.startExplorationSession(
        explorerUid,
        routeId,
      );
      const firstEventKey = `walk-${randomUUID()}`;
      const first = await explorationStore.recordExplorationSessionEvent(
        explorerUid,
        session.id,
        {
          eventKey: firstEventKey,
          latitude: 25.0328,
          longitude: 121.5357,
          accuracyMeters: 10,
          occurredAt: now.toISOString(),
        },
      );
      expect(first.acceptedDistanceMeters).toBe(0);

      now = new Date("2026-07-06T05:00:01.000Z");
      await expect(
        explorationStore.recordExplorationSessionEvent(
          explorerUid,
          session.id,
          {
            eventKey: `walk-jump-${randomUUID()}`,
            latitude: 25.05,
            longitude: 121.5357,
            accuracyMeters: 10,
            occurredAt: now.toISOString(),
          },
        ),
      ).rejects.toThrow("too fast");

      now = new Date("2026-07-06T05:02:00.000Z");
      const secondEventKey = `walk-${randomUUID()}`;
      const second = await explorationStore.recordExplorationSessionEvent(
        explorerUid,
        session.id,
        {
          eventKey: secondEventKey,
          latitude: 25.0338,
          longitude: 121.5357,
          accuracyMeters: 10,
          occurredAt: now.toISOString(),
        },
      );
      expect(second.acceptedDistanceMeters).toBeGreaterThanOrEqual(100);
      expect(new Set(second.newlyUnlockedTaskIds)).toEqual(
        new Set([distanceTaskId, placeTaskId]),
      );

      const duplicate = await explorationStore.recordExplorationSessionEvent(
        explorerUid,
        session.id,
        {
          eventKey: secondEventKey,
          latitude: 25.0338,
          longitude: 121.5357,
          accuracyMeters: 10,
          occurredAt: now.toISOString(),
        },
      );
      expect(duplicate.duplicate).toBe(true);

      const unlockedTasks = await explorationStore.listTasks(explorerUid);
      const distanceTask = unlockedTasks.find(
        (task) => task.title === "完成第一段步行",
      );
      const placeTask = unlockedTasks.find(
        (task) => task.title === "抵達測試地標",
      );
      await explorationStore.completeTask(explorerUid, distanceTask!.id);
      await explorationStore.completeTask(explorerUid, placeTask!.id);
      await explorationStore.completeTask(explorerUid, placeTask!.id);

      const state = await explorationStore.getExplorationState(explorerUid);
      const completedRoute = state.routes.find((route) => route.id === routeId);
      expect(completedRoute?.completedQuestCount).toBe(2);
      expect(completedRoute?.badgeAwarded).toBe(true);
      expect(
        await prisma.explorationRouteAward.count({
          where: { routeId, user: { firebaseUid: explorerUid } },
        }),
      ).toBe(1);

      now = new Date("2026-07-06T09:02:01.000Z");
      await expect(
        explorationStore.recordExplorationSessionEvent(
          explorerUid,
          session.id,
          {
            eventKey: `walk-expired-${randomUUID()}`,
            latitude: 25.0338,
            longitude: 121.5357,
            accuracyMeters: 10,
            occurredAt: now.toISOString(),
          },
        ),
      ).rejects.toThrow("Active exploration session not found");

      await explorationStore.endExplorationSession(explorerUid, session.id);
      const ended = await prisma.explorationSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(ended.status).toBe("EXPIRED");
      expect(ended.lastLatitude).toBeNull();
      expect(ended.lastLongitude).toBeNull();
      expect(ended.lastStepTotal).toBeNull();
      expect(ended.stepSource).toBeNull();
      const receipts = await prisma.locationEventReceipt.findMany({
        where: { user: { firebaseUid: explorerUid } },
      });
      expect(receipts.every((receipt) => receipt.coarseCell.length > 0)).toBe(
        true,
      );
    },
    60_000,
  );

  it(
    "completes a composite journey witness only from consecutive in-area location, dwell, and health steps",
    async () => {
      const explorerUid = `integration-journey-witness-${randomUUID()}`;
      const routeId = randomUUID();
      const taskId = randomUUID();
      createdFirebaseUids.add(explorerUid);
      createdRouteIds.add(routeId);
      createdTaskIds.add(taskId);
      let now = new Date("2026-08-30T01:00:00.000Z");
      const explorationStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);
      const center = { latitude: 25.0338, longitude: 121.5357 };
      const westInside = { ...center, longitude: center.longitude - 0.001 };
      const westOutside = { ...center, longitude: center.longitude - 0.002 };
      const farOutside = { ...center, longitude: center.longitude - 0.03 };

      await prisma.explorationRoute.create({
        data: {
          id: routeId,
          slug: `integration-journey-witness-${randomUUID()}`,
          name: "連續場域見證測試路線",
          description: "驗證停留、步數與場域內距離必須同時完成。",
          badgeName: "完整行程葉",
          badgeAssetKey: "composite-journey-leaf",
          status: "PUBLISHED",
          publishedAt: now,
          quests: {
            create: {
              sequence: 1,
              locationName: "測試步行場域",
              category: "WALK",
              triggerType: "GEOFENCE",
              latitude: center.latitude,
              longitude: center.longitude,
              radiusMeters: 150,
              task: {
                create: {
                  id: taskId,
                  title: "完成一段場域內同行",
                  description: "在場域內連續停留並完成步數與距離。",
                  verificationMode: "LOCATION_CHECK_IN",
                  verificationRule: {
                    source: "exploration",
                    minimumSeconds: 60,
                    minimumStepCount: 100,
                    minimumDistanceMeters: 200,
                    maximumSampleGapSeconds: 120,
                    stepSources: ["APPLE_HEALTH", "HEALTH_CONNECT"],
                    excludesManualEntries: true,
                  },
                  growthPoints: 9,
                },
              },
            },
          },
        },
      });

      const treeBefore = await explorationStore.getTree(explorerUid);
      const session = await explorationStore.startExplorationSession(
        explorerUid,
        routeId,
      );
      const record = async (
        eventKey: string,
        location: { latitude: number; longitude: number },
        stepCountSinceStart: number,
      ) =>
        explorationStore.recordExplorationSessionEvent(
          explorerUid,
          session.id,
          {
            eventKey,
            ...location,
            accuracyMeters: 8,
            occurredAt: now.toISOString(),
            stepCountSinceStart,
            stepSource: "APPLE_HEALTH",
            stepsExcludeManualEntries: true,
          },
        );

      await record(`outside-${randomUUID()}`, westOutside, 0);
      expect(
        await prisma.explorationQuestWitness.count({
          where: { sessionId: session.id },
        }),
      ).toBe(0);

      now = new Date(now.getTime() + 60_000);
      await record(`inside-anchor-${randomUUID()}`, westInside, 20);
      let state = await explorationStore.getExplorationState(explorerUid);
      const journeyRoute = () =>
        state.routes.find((route) => route.id === routeId);
      expect(journeyRoute()?.quests[0]?.journeyWitness).toMatchObject({
        status: "IN_PROGRESS",
        dwellSeconds: 0,
        stepCount: 0,
        distanceMeters: 0,
      });
      const assignment = (await explorationStore.listTasks(explorerUid)).find(
        (task) => task.title === "完成一段場域內同行",
      );
      await expect(
        explorationStore.completeTask(explorerUid, assignment!.id),
      ).rejects.toThrow("require location, dwell, and step evidence");

      now = new Date(now.getTime() + 30_000);
      await record(`inside-progress-${randomUUID()}`, center, 70);
      state = await explorationStore.getExplorationState(explorerUid);
      expect(journeyRoute()?.quests[0]?.journeyWitness).toMatchObject({
        status: "IN_PROGRESS",
        dwellSeconds: 30,
        stepCount: 50,
      });
      const firstDistance =
        journeyRoute()?.quests[0]?.journeyWitness?.distanceMeters ?? 0;
      expect(firstDistance).toBeGreaterThanOrEqual(100);

      now = new Date(now.getTime() + 121_000);
      const gapAnchor = await record(
        `far-gap-anchor-${randomUUID()}`,
        farOutside,
        120,
      );
      expect(gapAnchor.acceptedDistanceMeters).toBe(0);
      now = new Date(now.getTime() + 121_000);
      await record(`reentry-anchor-${randomUUID()}`, westInside, 220);
      state = await explorationStore.getExplorationState(explorerUid);
      expect(journeyRoute()?.quests[0]?.journeyWitness).toMatchObject({
        dwellSeconds: 30,
        stepCount: 50,
        distanceMeters: firstDistance,
      });

      now = new Date(now.getTime() + 10_000);
      await expect(
        record(`implausible-steps-${randomUUID()}`, center, 400),
      ).rejects.toThrow("step increase is too fast");
      state = await explorationStore.getExplorationState(explorerUid);
      expect(state.activeSession?.lastStepTotal).toBe(220);
      expect(journeyRoute()?.quests[0]?.journeyWitness?.stepCount).toBe(50);

      now = new Date(now.getTime() + 30_000);
      const completionEventKey = `inside-complete-${randomUUID()}`;
      const completed = await record(completionEventKey, center, 270);
      const completedRoute = completed.routes.find(
        (route) => route.id === routeId,
      );
      expect(completedRoute?.quests[0]?.journeyWitness).toMatchObject({
        tier: "COMPOSITE",
        status: "COMPLETED",
        dwellSeconds: 60,
        stepCount: 100,
      });
      expect(
        completedRoute?.quests[0]?.journeyWitness?.distanceMeters,
      ).toBeGreaterThanOrEqual(200);
      expect(completedRoute?.quests[0]?.completed).toBe(true);
      expect(completedRoute?.badgeAwarded).toBe(true);

      const duplicate = await record(completionEventKey, center, 270);
      expect(duplicate.duplicate).toBe(true);
      expect((await explorationStore.getTree(explorerUid)).growthPoints).toBe(
        treeBefore.growthPoints + 9,
      );
      expect(
        await prisma.growthEntry.count({
          where: { idempotencyKey: `assignment:${assignment!.id}` },
        }),
      ).toBe(1);

      await explorationStore.endExplorationSession(explorerUid, session.id);
      const ended = await prisma.explorationSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(ended.lastLatitude).toBeNull();
      expect(ended.lastLongitude).toBeNull();
      const receipts = await prisma.locationEventReceipt.findMany({
        where: { sessionId: session.id },
      });
      expect(receipts.every((receipt) => receipt.coarseCell.length > 0)).toBe(
        true,
      );
      expect(
        receipts.every((receipt) => !receipt.coarseCell.includes(".")),
      ).toBe(true);

      now = new Date(now.getTime() + 60_000);
      const laterSession = await explorationStore.startExplorationSession(
        explorerUid,
        routeId,
      );
      await explorationStore.recordExplorationSessionEvent(
        explorerUid,
        laterSession.id,
        {
          eventKey: `after-completion-${randomUUID()}`,
          ...center,
          accuracyMeters: 8,
          occurredAt: now.toISOString(),
          stepCountSinceStart: 0,
          stepSource: "APPLE_HEALTH",
          stepsExcludeManualEntries: true,
        },
      );
      expect(
        await prisma.explorationQuestWitness.count({
          where: { sessionId: laterSession.id },
        }),
      ).toBe(0);
      expect((await explorationStore.getTree(explorerUid)).growthPoints).toBe(
        treeBefore.growthPoints + 9,
      );
    },
    60_000,
  );

  it(
    "unlocks and completes radar missions idempotently per household",
    async () => {
      const radarUid = `integration-radar-${randomUUID()}`;
      const otherUid = `integration-radar-other-${randomUUID()}`;
      createdFirebaseUids.add(radarUid);
      createdFirebaseUids.add(otherUid);
      let now = new Date("2026-07-07T06:00:00.000Z");
      const radarStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);

      const draft = await radarStore.createAdminRadarMission({
        title: "華山綠意觀察",
        description: "觀察一處城市綠意，確認自己已停下來看見它。",
        category: "NATURE",
        tag: "觀察",
        latitude: 25.04411,
        longitude: 121.52944,
        radiusMeters: 90,
        startsAt: "2026-07-07T05:00:00.000Z",
        endsAt: "2026-07-07T07:00:00.000Z",
        verificationMode: "SELF_CHECK",
        growthPoints: 8,
        badgeName: "城市觀察者",
      });
      createdRadarMissionIds.add(draft.id);
      const mission = await radarStore.publishAdminRadarMission(draft.id);
      expect(mission.publicationStatus).toBe("PUBLISHED");

      await expect(
        radarStore.unlockRadarMission(radarUid, mission.id, {
          eventKey: `radar-far-${randomUUID()}`,
          latitude: 25.08,
          longitude: 121.52944,
          accuracyMeters: 10,
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow("inside the mission radius");
      await expect(
        radarStore.unlockRadarMission(radarUid, mission.id, {
          eventKey: `radar-blurry-${randomUUID()}`,
          latitude: 25.04411,
          longitude: 121.52944,
          accuracyMeters: 51,
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow("within 50 meters");

      const unlocked = await radarStore.unlockRadarMission(radarUid, mission.id, {
        eventKey: `radar-near-${randomUUID()}`,
        latitude: 25.04411,
        longitude: 121.52944,
        accuracyMeters: 10,
        occurredAt: now.toISOString(),
      });
      expect(unlocked.missions.find((item) => item.id === mission.id)?.status).toBe(
        "UNLOCKED",
      );

      const before = await radarStore.getTree(radarUid);
      await radarStore.completeRadarMission(radarUid, mission.id);
      await radarStore.completeRadarMission(radarUid, mission.id);
      const afterRetry = await radarStore.getTree(radarUid);
      expect(afterRetry.growthPoints).toBe(before.growthPoints + 8);
      const radarContext = await radarStore.getContext(radarUid);
      const prompts = await radarStore.getRecentCompanionPrompts(radarUid);
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        sourceType: "RADAR_MISSION",
        householdId: radarContext.activeHouseholdId,
        participantName: "同行成林使用者",
        sourceTitle: "華山綠意觀察",
        companionReply:
          "可以回覆：『看到你完成「華山綠意觀察」了，今天有做一件照顧自己的事，很棒。』",
        shareSummary: "完成「華山綠意觀察」，生命樹長出新葉 +8。",
      });

      const familyUid = `integration-radar-family-${randomUUID()}`;
      createdFirebaseUids.add(familyUid);
      const invite = await radarStore.createHouseholdInvite(radarUid);
      await radarStore.joinHousehold(familyUid, invite.code, "家人");
      const familyPrompts = await radarStore.getRecentCompanionPrompts(
        familyUid,
      );
      expect(familyPrompts).toHaveLength(1);
      expect(familyPrompts[0]).toMatchObject({
        householdId: radarContext.activeHouseholdId,
        sourceTitle: "華山綠意觀察",
        shareSummary: "完成「華山綠意觀察」，生命樹長出新葉 +8。",
      });

      await radarStore.unlockRadarMission(otherUid, mission.id, {
        eventKey: `radar-other-${randomUUID()}`,
        latitude: 25.04411,
        longitude: 121.52944,
        accuracyMeters: 10,
        occurredAt: now.toISOString(),
      });
      expect((await radarStore.getTree(otherUid)).growthPoints).toBe(0);
      expect(await radarStore.getRecentCompanionPrompts(otherUid)).toHaveLength(
        0,
      );

      now = new Date("2026-07-07T08:00:00.000Z");
      const expiredDraft = await radarStore.createAdminRadarMission({
        title: "過期雷達任務",
        description: "用來驗證過期後不可新解鎖。",
        category: "WELLNESS",
        tag: "測試",
        latitude: 25.04411,
        longitude: 121.52944,
        radiusMeters: 90,
        startsAt: "2026-07-07T05:00:00.000Z",
        endsAt: "2026-07-07T07:00:00.000Z",
        verificationMode: "SELF_CHECK",
        growthPoints: 5,
      });
      createdRadarMissionIds.add(expiredDraft.id);
      const expired = await radarStore.publishAdminRadarMission(expiredDraft.id);
      await expect(
        radarStore.unlockRadarMission(radarUid, expired.id, {
          eventKey: `radar-expired-${randomUUID()}`,
          latitude: 25.04411,
          longitude: 121.52944,
          accuracyMeters: 10,
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow("not currently available");
    },
    60_000,
  );

  it("refuses to publish PHOTO_AI radar missions while Blaze is disabled", async () => {
    const photoRadar = await prisma.radarMission.create({
      data: {
        title: "照片辨識雷達任務",
        description: "本階段不應發布。",
        category: "PHOTO",
        tag: "拍照",
        latitude: 25.04411,
        longitude: 121.52944,
        radiusMeters: 90,
        startsAt: new Date("2026-07-07T05:00:00.000Z"),
        endsAt: new Date("2026-07-07T07:00:00.000Z"),
        verificationMode: VerificationMode.PHOTO_AI,
        growthPoints: 12,
      },
    });
    createdRadarMissionIds.add(photoRadar.id);

    await expect(
      store.publishAdminRadarMission(photoRadar.id),
    ).rejects.toThrow("PHOTO_AI radar missions are not supported in this MVP");
  });

  it(
    "requires radar timer missions to elapse after unlock",
    async () => {
      const timerRadarUid = `integration-radar-timer-${randomUUID()}`;
      createdFirebaseUids.add(timerRadarUid);
      let now = new Date("2026-07-07T09:00:00.000Z");
      const radarStore = new PersistentStoreService(prisma, {
        now: () => now,
      } as ClockService);
      const draft = await radarStore.createAdminRadarMission({
        title: "二二八公園三分鐘慢呼吸",
        description: "找安全的位置，進行三分鐘慢呼吸。",
        category: "WELLNESS",
        tag: "慢呼吸",
        latitude: 25.04236,
        longitude: 121.51542,
        radiusMeters: 90,
        startsAt: "2026-07-07T08:00:00.000Z",
        endsAt: "2026-07-07T10:00:00.000Z",
        verificationMode: "TIMER",
        minimumSeconds: 180,
        growthPoints: 10,
        badgeName: "慢呼吸同行者",
      });
      createdRadarMissionIds.add(draft.id);
      const mission = await radarStore.publishAdminRadarMission(draft.id);
      await radarStore.unlockRadarMission(timerRadarUid, mission.id, {
        eventKey: `radar-timer-${randomUUID()}`,
        latitude: 25.04236,
        longitude: 121.51542,
        accuracyMeters: 10,
        occurredAt: now.toISOString(),
      });

      now = new Date("2026-07-07T09:02:59.000Z");
      await expect(
        radarStore.completeRadarMission(timerRadarUid, mission.id),
      ).rejects.toThrow("1 more seconds");

      now = new Date("2026-07-07T09:03:00.000Z");
      await radarStore.completeRadarMission(timerRadarUid, mission.id);
      expect((await radarStore.getTree(timerRadarUid)).growthPoints).toBe(10);
    },
    60_000,
  );
});
