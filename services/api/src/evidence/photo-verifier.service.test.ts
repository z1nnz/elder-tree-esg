import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { PhotoVerifierService } from "./photo-verifier.service";

const input = {
  evidenceId: "evidence-1",
  taskTitle: "拍下一株植物",
  imageBase64: "test-only",
  contentType: "image/jpeg",
  requiredLabels: ["plant"],
  forbiddenLabels: [],
};
const result = {
  decision: "FAIL",
  confidence: 0.2,
  labels: [],
  reason_codes: ["LOW_CONFIDENCE"],
  explanation: "Not enough evidence",
  model: "configured-provider",
  rule_version: "1.0.0",
};

describe("PhotoVerifierService availability boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not treat a missing provider as failed user evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ ...result, model: "rules-only" })),
    );
    await expect(
      new PhotoVerifierService().verifyInline(input),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([
    new TypeError("network unavailable"),
    new DOMException("timed out", "TimeoutError"),
  ])(
    "turns transport failures into retryable service errors",
    async (error) => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
      await expect(
        new PhotoVerifierService().verifyInline(input),
      ).rejects.toMatchObject({ status: 503 });
    },
  );

  it.each([
    Response.json({ status: "unexpected" }),
    new Response("not-json"),
    new Response("private upstream detail", { status: 502 }),
  ])("rejects malformed or failed provider replies", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      new PhotoVerifierService().verifyInline(input),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each(["PASS", "REVIEW", "FAIL"])(
    "preserves a real provider %s decision",
    async (decision) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json({ ...result, decision })),
      );
      await expect(
        new PhotoVerifierService().verifyInline(input),
      ).resolves.toMatchObject({ decision, model: result.model });
    },
  );
});
