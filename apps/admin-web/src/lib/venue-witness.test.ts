import { describe, expect, it } from "vitest";
import { ApiRequestError } from "./api";
import {
  isRedemptionCode,
  venueCodeLifetimeMs,
  venueErrorMessage,
} from "./venue-witness";

describe("venue witness presentation", () => {
  const code = {
    code: `TCA1_${"a".repeat(43)}`,
    serverTime: "2026-08-28T00:00:00Z",
    expiresAt: "2026-08-28T00:01:00Z",
  };
  it("uses server-relative expiry and clamps malformed or implausible responses", () => {
    expect(venueCodeLifetimeMs(code)).toBe(60_000);
    expect(venueCodeLifetimeMs({ ...code, expiresAt: code.serverTime })).toBe(
      0,
    );
    expect(venueCodeLifetimeMs({ ...code, serverTime: "wrong" })).toBe(0);
    expect(venueCodeLifetimeMs({ ...code, code: "invalid" })).toBe(0);
    expect(
      venueCodeLifetimeMs({ ...code, expiresAt: "2026-08-29T00:00:00Z" }),
    ).toBe(60_000);
  });
  it("does not interchange venue and redemption tokens or accept arbitrary URLs", () => {
    expect(isRedemptionCode(code.code)).toBe(false);
    expect(isRedemptionCode(`TCR1_${"b".repeat(43)}`)).toBe(true);
    expect(isRedemptionCode("https://example.com/")).toBe(false);
  });
  it("gives actionable Chinese errors without exposing server-provided content", () => {
    expect(
      venueErrorMessage(
        new ApiRequestError(
          409,
          "Redemption code has expired or is unavailable",
        ),
      ),
    ).toContain("已過期");
    expect(venueErrorMessage(new ApiRequestError(403, "anything"))).toContain(
      "權限",
    );
    expect(
      venueErrorMessage(new ApiRequestError(500, code.code)),
    ).not.toContain(code.code);
    expect(venueErrorMessage(new TypeError("Failed to fetch"))).toContain(
      "不要先交付",
    );
  });
});
