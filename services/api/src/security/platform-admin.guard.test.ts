import { describe, expect, it } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { PlatformAdminGuard } from "./platform-admin.guard";

function contextFor(uid: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { uid, role: "PARTICIPANT" } }),
    }),
  } as unknown as ExecutionContext;
}

describe("PlatformAdminGuard", () => {
  it("allows a Firebase identity only when Neon stores PLATFORM_ADMIN", async () => {
    const guard = new PlatformAdminGuard({
      user: {
        findUnique: async () => ({ role: "PLATFORM_ADMIN" }),
      },
    } as never);

    await expect(guard.canActivate(contextFor("admin-uid"))).resolves.toBe(true);
  });

  it("returns a forbidden error for a normal participant", async () => {
    const guard = new PlatformAdminGuard({
      user: {
        findUnique: async () => ({ role: "PARTICIPANT" }),
      },
    } as never);

    await expect(
      guard.canActivate(contextFor("participant-uid")),
    ).rejects.toMatchObject({ status: 403 });
  });
});
