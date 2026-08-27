import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CompleteRadarMissionDto, RedeemVenueOfferDto } from "./api.dto";

const witness = {
  code: `TCA1_${randomBytes(32).toString("base64url")}`,
  latitude: 25.033,
  longitude: 121.5654,
  accuracyMeters: 8,
  occurredAt: "2026-08-27T12:00:00.000Z",
};
const options = { whitelist: true, forbidNonWhitelisted: true };

describe("venue witness request validation", () => {
  it("accepts numeric fresh-proof fields and preserves non-witness completion", async () => {
    expect(
      await validate(
        plainToInstance(CompleteRadarMissionDto, { venueWitness: witness }),
        options,
      ),
    ).toEqual([]);
    expect(
      await validate(plainToInstance(CompleteRadarMissionDto, {}), options),
    ).toEqual([]);
  });

  it.each([
    { latitude: "25.033" },
    { longitude: 181 },
    { accuracyMeters: -1 },
    { accuracyMeters: 51 },
    { occurredAt: "yesterday" },
    { code: `TCR1_${randomBytes(32).toString("base64url")}` },
    { code: "wrong-code" },
    { completedAt: "2026-08-27T12:00:00.000Z" },
  ])("rejects invalid or unrecognized nested fields: %j", async (override) => {
    const errors = await validate(
      plainToInstance(CompleteRadarMissionDto, {
        venueWitness: { ...witness, ...override },
      }),
      options,
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("keeps venue and redemption codes non-interchangeable", async () => {
    expect(
      await validate(
        plainToInstance(RedeemVenueOfferDto, {
          code: `TCR1_${randomBytes(32).toString("base64url")}`,
        }),
        options,
      ),
    ).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(RedeemVenueOfferDto, { code: witness.code }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
