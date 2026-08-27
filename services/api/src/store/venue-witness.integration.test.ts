import { createHash, randomUUID } from "node:crypto";
import type {
  PartnerCampaignInput,
  VenueWitnessSubmission,
} from "@elder-tree/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service";
import { PersistentStoreService } from "./persistent-store.service";

const describeWithDatabase = process.env.DATABASE_URL
  ? describe
  : describe.skip;
if (process.env.DATABASE_URL)
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describeWithDatabase("venue witness", () => {
  const uids: string[] = [];
  const organizationIds: string[] = [];
  const missionIds: string[] = [];
  let prisma: PrismaService;
  let partnerUid: string;
  let adminUid: string;
  let outsiderUid: string;
  let organizationId: string;
  let otherOrganizationId: string;

  async function createUser(store: PersistentStoreService) {
    const uid = `venue-test-${randomUUID()}`;
    uids.push(uid);
    await store.getContext(uid);
    return uid;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    const store = new PersistentStoreService(prisma);
    partnerUid = await createUser(store);
    adminUid = await createUser(store);
    outsiderUid = await createUser(store);
    await prisma.user.update({
      where: { firebaseUid: adminUid },
      data: { role: "PLATFORM_ADMIN" },
    });
    for (const uid of [partnerUid, outsiderUid]) {
      const user = await prisma.user.update({
        where: { firebaseUid: uid },
        data: { role: "ORG_ADMIN" },
      });
      const organization = await prisma.organization.create({
        data: {
          name: "到場見證整合測試據點",
          memberships: { create: { userId: user.id, role: "ORG_ADMIN" } },
        },
      });
      organizationIds.push(organization.id);
    }
    [organizationId, otherOrganizationId] = organizationIds;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: uids } },
      include: { householdLinks: true },
    });
    const householdIds = [
      ...new Set(
        users.flatMap((user) =>
          user.householdLinks.map((link) => link.householdId),
        ),
      ),
    ];
    await prisma.organization.deleteMany({
      where: { id: { in: organizationIds } },
    });
    await prisma.radarMission.deleteMany({ where: { id: { in: missionIds } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: uids } } });
    await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
    await prisma.$disconnect();
  });

  async function fixture(overrides: Partial<PartnerCampaignInput> = {}) {
    let now = Date.now();
    const store = new PersistentStoreService(prisma, {
      now: () => new Date(now),
    });
    const uid = await createUser(store);
    const draft = await store.createPartnerCampaign(
      partnerUid,
      organizationId,
      {
        title: "一起走進友善據點",
        description: "沿著無障礙步道到場，向現場夥伴完成見證。",
        venueName: "整合測試廣場",
        latitude: 25.033,
        longitude: 121.5654,
        radiusMeters: 60,
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 3_600_000).toISOString(),
        verificationMode: "SELF_CHECK",
        growthPoints: 12,
        accessibilityNotes: "設有平緩步道與座椅。",
        safetyNotes: "白天開放，雨天暫停。",
        optionalOffer: "自願領取一杯水，不需消費。",
        purchaseRequired: false,
        requiresVenueWitness: true,
        ...overrides,
      },
    );
    await store.submitPartnerCampaign(partnerUid, organizationId, draft.id);
    const campaign = await store.approvePartnerCampaign(
      adminUid,
      draft.id,
      "核准小額非現金試辦。",
    );
    const missionId = campaign.radarMissionId!;
    missionIds.push(missionId);
    const position = () => ({
      latitude: 25.033,
      longitude: 121.5654,
      accuracyMeters: 8,
      occurredAt: new Date(now).toISOString(),
    });
    const unlock = async (memberUid = uid) =>
      store.unlockRadarMission(memberUid, missionId, {
        eventKey: randomUUID(),
        ...position(),
      });
    const issue = () =>
      store.createVenueChallenge(partnerUid, organizationId, campaign.id);
    const proof = (code: string): VenueWitnessSubmission => ({
      code,
      ...position(),
    });
    await unlock();
    return {
      store,
      uid,
      campaign,
      missionId,
      unlock,
      issue,
      proof,
      advance: (ms: number) => {
        now += ms;
      },
    };
  }

  it("shares a venue code across members but awards once per account, including across circles", async () => {
    const f = await fixture();
    const { code } = await f.issue();
    const secondUid = await createUser(f.store);
    await f.unlock(secondUid);
    const before = await f.store.getTree(f.uid);
    await Promise.all([
      f.store.completeRadarMission(f.uid, f.missionId, "first", f.proof(code)),
      f.store.completeRadarMission(f.uid, f.missionId, "retry", f.proof(code)),
      f.store.completeRadarMission(
        secondUid,
        f.missionId,
        "second-member",
        f.proof(code),
      ),
    ]);
    expect((await f.store.getTree(f.uid)).growthPoints).toBe(
      before.growthPoints + 12,
    );
    expect(
      await f.store.getVenueMetrics(partnerUid, organizationId, f.campaign.id),
    ).toEqual({ witnessedCount: 2, redeemedCount: 0 });
    const receipt = await f.store.getVenueReceipt(f.uid, f.missionId);
    expect(receipt).toMatchObject({
      campaignId: f.campaign.id,
      redeemedAt: null,
    });
    expect(Object.keys(receipt!).sort()).toEqual([
      "campaignId",
      "id",
      "offer",
      "redeemedAt",
      "witnessedAt",
    ]);
    expect(await f.store.getVenueReceipt(outsiderUid, f.missionId)).toBeNull();

    const member = await prisma.user.findUniqueOrThrow({
      where: { firebaseUid: f.uid },
    });
    const circle = await prisma.household.create({
      data: {
        name: "切換後的測試樹伴圈",
        members: { create: { userId: member.id, relationship: "測試成員" } },
        trees: { create: { name: "第二棵測試生命樹" } },
      },
    });
    await f.store.setActiveHousehold(f.uid, circle.id);
    // Removing the original test circle must not reset the account-level receipt.
    await prisma.household.delete({ where: { id: member.activeHouseholdId! } });
    await f.unlock();
    const otherTree = await f.store.getTree(f.uid);
    await expect(
      f.store.completeRadarMission(
        f.uid,
        f.missionId,
        undefined,
        f.proof(code),
      ),
    ).rejects.toThrow("already completed");
    expect((await f.store.getTree(f.uid)).growthPoints).toBe(
      otherTree.growthPoints,
    );
    expect((await f.store.getVenueReceipt(f.uid, f.missionId))?.id).toBe(
      receipt!.id,
    );
    expect(
      (
        await prisma.venueWitnessReceipt.findUniqueOrThrow({
          where: { id: receipt!.id },
        })
      ).householdId,
    ).toBeNull();
    expect(
      await prisma.venueChallenge.findFirst({
        where: { campaignId: f.campaign.id },
      }),
    ).toMatchObject({
      tokenHash: createHash("sha256").update(code).digest("hex"),
    });
  });

  it("rejects missing, stale, inaccurate, out-of-radius and wrong-journey proof without awarding growth", async () => {
    const f = await fixture();
    const other = await fixture();
    const { code } = await f.issue();
    const wrongCode = await other.issue();
    const base = f.proof(code);
    const before = await f.store.getTree(f.uid);
    const invalid: Array<VenueWitnessSubmission | undefined> = [
      undefined,
      { ...base, code: "invalid" },
      { ...base, code: wrongCode.code },
      {
        ...base,
        occurredAt: new Date(
          Date.parse(base.occurredAt) - 30_001,
        ).toISOString(),
      },
      {
        ...base,
        occurredAt: new Date(Date.parse(base.occurredAt) + 5_001).toISOString(),
      },
      { ...base, occurredAt: "not-a-date" },
      { ...base, accuracyMeters: 50.01 },
      { ...base, accuracyMeters: -1 },
      { ...base, accuracyMeters: Number.NaN },
      { ...base, latitude: 91 },
      { ...base, longitude: Number.POSITIVE_INFINITY },
      { ...base, latitude: 25.04 },
    ];
    for (const proof of invalid) {
      await expect(
        f.store.completeRadarMission(f.uid, f.missionId, undefined, proof),
      ).rejects.toThrow();
    }
    expect((await f.store.getTree(f.uid)).growthPoints).toBe(
      before.growthPoints,
    );
    expect(await f.store.getVenueReceipt(f.uid, f.missionId)).toBeNull();
    f.advance(60_000);
    await expect(
      f.store.completeRadarMission(
        f.uid,
        f.missionId,
        undefined,
        f.proof(code),
      ),
    ).rejects.toThrow("expired");
    await f.store.completeRadarMission(
      f.uid,
      f.missionId,
      undefined,
      f.proof((await f.issue()).code),
    );
  });

  it("enforces the timer and active publication instead of treating a scan as completion", async () => {
    const f = await fixture({ verificationMode: "TIMER", minimumSeconds: 30 });
    const { code } = await f.issue();
    await expect(
      f.store.completeRadarMission(
        f.uid,
        f.missionId,
        undefined,
        f.proof(code),
      ),
    ).rejects.toThrow("timer requires");
    expect(await f.store.getVenueReceipt(f.uid, f.missionId)).toBeNull();
    f.advance(30_000);
    await prisma.radarMission.update({
      where: { id: f.missionId },
      data: { status: "ARCHIVED" },
    });
    await expect(f.issue()).rejects.toThrow("not currently available");
    await expect(
      f.store.completeRadarMission(
        f.uid,
        f.missionId,
        undefined,
        f.proof(code),
      ),
    ).rejects.toThrow("not published");
    await prisma.radarMission.update({
      where: { id: f.missionId },
      data: { status: "PUBLISHED" },
    });
    await f.store.completeRadarMission(
      f.uid,
      f.missionId,
      undefined,
      f.proof(code),
    );
    f.advance(3_600_000);
    await expect(f.issue()).rejects.toThrow("not currently available");
    await expect(
      f.store.createVenueRedemptionCode(f.uid, f.missionId),
    ).rejects.toThrow("not currently available");
  });

  it("isolates partner access and redeems once under concurrency, with stable retry results", async () => {
    const f = await fixture();
    await expect(
      f.store.createVenueChallenge(outsiderUid, organizationId, f.campaign.id),
    ).rejects.toThrow("access required");
    await expect(
      f.store.createVenueChallenge(
        outsiderUid,
        otherOrganizationId,
        f.campaign.id,
      ),
    ).rejects.toThrow("not found");
    await expect(
      f.store.getVenueMetrics(outsiderUid, organizationId, f.campaign.id),
    ).rejects.toThrow("access required");
    await expect(
      f.store.createVenueRedemptionCode(f.uid, f.missionId),
    ).rejects.toThrow("Complete the witnessed journey first");
    const issues = await Promise.allSettled([f.issue(), f.issue()]);
    expect(
      issues.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const issued = issues.find((result) => result.status === "fulfilled");
    if (!issued || issued.status !== "fulfilled")
      throw new Error("Expected one venue code");
    await f.store.completeRadarMission(
      f.uid,
      f.missionId,
      undefined,
      f.proof(issued.value.code),
    );
    const growth = (await f.store.getTree(f.uid)).growthPoints;
    const redemption = await f.store.createVenueRedemptionCode(
      f.uid,
      f.missionId,
    );
    await expect(
      f.store.redeemVenueOffer(
        outsiderUid,
        organizationId,
        f.campaign.id,
        redemption.code,
      ),
    ).rejects.toThrow("access required");
    await expect(
      f.store.redeemVenueOffer(
        outsiderUid,
        otherOrganizationId,
        f.campaign.id,
        redemption.code,
      ),
    ).rejects.toThrow("Invalid redemption code");
    const results = await Promise.all([
      f.store.redeemVenueOffer(
        partnerUid,
        organizationId,
        f.campaign.id,
        redemption.code,
      ),
      f.store.redeemVenueOffer(
        partnerUid,
        organizationId,
        f.campaign.id,
        redemption.code,
      ),
    ]);
    const first = results.find((result) => !result.alreadyRedeemed)!;
    const retry = results.find((result) => result.alreadyRedeemed)!;
    expect(first.redeemedAt).not.toBeNull();
    expect(retry).toEqual({ ...first, alreadyRedeemed: true });
    expect(
      await f.store.getVenueMetrics(partnerUid, organizationId, f.campaign.id),
    ).toEqual({ witnessedCount: 1, redeemedCount: 1 });
    expect(
      await prisma.auditLog.count({
        where: { entityId: first.id, action: "VENUE_OFFER_REDEEMED" },
      }),
    ).toBe(1);
    expect((await f.store.getTree(f.uid)).growthPoints).toBe(growth);
    await expect(
      f.store.createVenueRedemptionCode(f.uid, f.missionId),
    ).rejects.toThrow("already redeemed");
    f.advance(3_600_000);
    expect(
      await f.store.redeemVenueOffer(
        partnerUid,
        organizationId,
        f.campaign.id,
        redemption.code,
      ),
    ).toEqual(retry);
    const membership = await prisma.organizationMember.findFirstOrThrow({
      where: { organizationId },
    });
    const membershipKey = {
      organizationId_userId: { organizationId, userId: membership.userId },
    };
    await prisma.organizationMember.update({
      where: membershipKey,
      data: { role: "PARTICIPANT" },
    });
    try {
      await expect(
        f.store.redeemVenueOffer(
          partnerUid,
          organizationId,
          f.campaign.id,
          redemption.code,
        ),
      ).rejects.toThrow("access required");
    } finally {
      await prisma.organizationMember.update({
        where: membershipKey,
        data: { role: "ORG_ADMIN" },
      });
    }
  });

  it("invalidates replaced and expired redemption codes while preserving earned growth", async () => {
    const f = await fixture();
    await f.store.completeRadarMission(
      f.uid,
      f.missionId,
      undefined,
      f.proof((await f.issue()).code),
    );
    const first = await f.store.createVenueRedemptionCode(f.uid, f.missionId);
    await expect(
      f.store.createVenueRedemptionCode(f.uid, f.missionId),
    ).rejects.toThrow("Please wait");
    f.advance(10_000);
    const second = await f.store.createVenueRedemptionCode(f.uid, f.missionId);
    expect(second.code).not.toBe(first.code);
    await expect(
      f.store.redeemVenueOffer(
        partnerUid,
        organizationId,
        f.campaign.id,
        first.code,
      ),
    ).rejects.toThrow("Invalid redemption code");
    f.advance(300_000);
    await expect(
      f.store.redeemVenueOffer(
        partnerUid,
        organizationId,
        f.campaign.id,
        second.code,
      ),
    ).rejects.toThrow("expired");
    expect(
      (await f.store.getVenueReceipt(f.uid, f.missionId))?.redeemedAt,
    ).toBeNull();
    const third = await f.store.createVenueRedemptionCode(f.uid, f.missionId);
    await f.store.redeemVenueOffer(
      partnerUid,
      organizationId,
      f.campaign.id,
      third.code,
    );
  });

  it("completes free witnessed journeys without an offer and never issues a redemption code", async () => {
    const f = await fixture({ optionalOffer: null });
    await f.store.completeRadarMission(
      f.uid,
      f.missionId,
      undefined,
      f.proof((await f.issue()).code),
    );
    expect(
      (await f.store.getVenueReceipt(f.uid, f.missionId))?.offer,
    ).toBeNull();
    await expect(
      f.store.createVenueRedemptionCode(f.uid, f.missionId),
    ).rejects.toThrow("no optional offer");
  });
});
