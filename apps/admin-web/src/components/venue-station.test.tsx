import type {
  PartnerCampaignSummary,
  VenueCodeSummary,
} from "@elder-tree/contracts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiRequestError } from "../lib/api";
import { VenueStation } from "./venue-station";
import { PartnerWorkspace } from "./partner-workspace";

vi.mock("../lib/api", async (original) => {
  const module = await original<typeof import("../lib/api")>();
  return {
    ...module,
    api: {
      venueCode: vi.fn(),
      venueMetrics: vi.fn(),
      redeemVenueOffer: vi.fn(),
      partnerWorkspace: vi.fn(),
    },
  };
});
vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    async decodeFromStream() {
      return { stop: vi.fn() };
    }
  },
}));

const campaign: PartnerCampaignSummary = {
  id: "test-campaign",
  organizationId: "test-org",
  organizationName: "本機測試組織",
  title: "一起走進季節裡",
  description: "完成一段友善步道，留下今天的足跡。",
  venueName: "本機測試據點",
  latitude: 25.033,
  longitude: 121.5654,
  radiusMeters: 60,
  startsAt: "2026-08-27T00:00:00Z",
  endsAt: "2026-08-29T00:00:00Z",
  verificationMode: "TIMER",
  minimumSeconds: 180,
  growthPoints: 12,
  accessibilityNotes: "設有平緩步道。",
  safetyNotes: "雨天暫停活動。",
  optionalOffer: "一杯飲水，不需消費。",
  purchaseRequired: false,
  requiresVenueWitness: true,
  status: "APPROVED",
  submittedAt: "2026-08-26T00:00:00Z",
  reviewedAt: "2026-08-26T01:00:00Z",
  reviewNote: "測試",
  radarMissionId: "test-mission",
  metrics: {
    deliveredToAppCount: 0,
    arrivedCount: 0,
    completedCount: 0,
    completionRate: 0,
  },
  createdAt: "2026-08-26T00:00:00Z",
  updatedAt: "2026-08-26T01:00:00Z",
};
const venueCode: VenueCodeSummary = {
  code: `TCA1_${"a".repeat(43)}`,
  serverTime: "2026-08-28T00:00:00Z",
  expiresAt: "2026-08-28T00:01:00Z",
};
const redemptionCode = `TCR1_${"b".repeat(43)}`;
function mount(value = campaign) {
  return render(
    <VenueStation
      organizationId="test-org"
      campaign={value}
      onClose={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.mocked(api.venueMetrics).mockResolvedValue({
    witnessedCount: 3,
    redeemedCount: 1,
  });
  vi.mocked(api.venueCode).mockResolvedValue(venueCode);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("venue station", () => {
  it("opens from an approved campaign and restores focus to its trigger on close", async () => {
    const organization = {
      id: campaign.organizationId,
      name: campaign.organizationName,
      role: "ORG_ADMIN" as const,
    };
    vi.mocked(api.partnerWorkspace).mockResolvedValue({
      organization,
      campaigns: [campaign],
    });
    render(<PartnerWorkspace organizations={[organization]} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "開啟現場工作台" }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: campaign.venueName, level: 2 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "收起工作台" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "開啟現場工作台" }),
    );
    expect(api.venueCode).not.toHaveBeenCalled();
  });

  it("does not expose the station for unapproved or non-witness campaigns", async () => {
    const organization = {
      id: campaign.organizationId,
      name: campaign.organizationName,
      role: "ORG_ADMIN" as const,
    };
    vi.mocked(api.partnerWorkspace).mockResolvedValue({
      organization,
      campaigns: [
        { ...campaign, status: "SUBMITTED" },
        { ...campaign, id: "no-witness", requiresVenueWitness: false },
      ],
    });
    render(<PartnerWorkspace organizations={[organization]} />);
    await screen.findByText("等待審核");
    expect(screen.queryByRole("button", { name: "開啟現場工作台" })).toBeNull();
    expect(api.venueMetrics).not.toHaveBeenCalled();
  });

  it("does not issue a code until requested, and clears it on leaving the tab", async () => {
    mount();
    await screen.findByText("3");
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: campaign.venueName, level: 2 }),
    );
    expect(api.venueCode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "開啟到場碼" }));
    expect(
      await screen.findByRole("img", { name: "本旅程短效到場碼" }),
    ).toBeTruthy();
    expect(api.venueCode).toHaveBeenCalledWith("test-org", "test-campaign");
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByRole("img", { name: "本旅程短效到場碼" })).toBeNull();
    expect(screen.getByText("畫面已安全收起")).toBeTruthy();
  });

  it("hides expired codes and stops automatic renewal after a network failure", async () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.mocked(api.venueCode)
      .mockResolvedValueOnce(venueCode)
      .mockRejectedValueOnce(new Error("offline"));
    mount();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "開啟到場碼" }));
    });
    expect(screen.getByRole("img", { name: "本旅程短效到場碼" })).toBeTruthy();
    now += 60_000;
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.queryByRole("img", { name: "本旅程短效到場碼" })).toBeNull();
    expect(api.venueCode).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert").textContent).toContain("檢查連線");
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(api.venueCode).toHaveBeenCalledTimes(2);
  });

  it("ignores a late response after the operator changes operation", async () => {
    let resolve!: (value: VenueCodeSummary) => void;
    vi.mocked(api.venueCode).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "開啟到場碼" }));
    fireEvent.click(screen.getByRole("button", { name: "核銷回饋" }));
    await act(async () => resolve(venueCode));
    expect(screen.queryByRole("img", { name: "本旅程短效到場碼" })).toBeNull();
    expect(screen.getByRole("button", { name: "確認核銷" })).toBeTruthy();
  });

  it("requires explicit confirmation and labels a repeated redemption honestly", async () => {
    vi.mocked(api.redeemVenueOffer).mockResolvedValue({
      id: "test-receipt",
      campaignId: campaign.id,
      offer: campaign.optionalOffer!,
      witnessedAt: venueCode.serverTime,
      redeemedAt: venueCode.serverTime,
      alreadyRedeemed: true,
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "核銷回饋" }));
    fireEvent.change(screen.getByLabelText("領取碼／掃描器輸入"), {
      target: { value: redemptionCode },
    });
    expect(api.redeemVenueOffer).not.toHaveBeenCalled();
    // Keyboard scanners may append Enter; a form submission must never redeem.
    fireEvent.submit(
      screen.getByLabelText("領取碼／掃描器輸入").closest("form")!,
    );
    expect(api.redeemVenueOffer).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "確認核銷" }).getAttribute("type"),
    ).toBe("button");
    fireEvent.click(screen.getByRole("button", { name: "確認核銷" }));
    fireEvent.click(screen.getByRole("button", { name: "正在確認核銷…" }));
    expect(await screen.findByText("先前已領取")).toBeTruthy();
    expect(screen.queryByText("本次已登記領取")).toBeNull();
    expect(api.redeemVenueOffer).toHaveBeenCalledTimes(1);
    expect(api.redeemVenueOffer).toHaveBeenCalledWith(
      "test-org",
      campaign.id,
      redemptionCode,
    );
    expect(screen.getByText(/請勿再次交付/)).toBeTruthy();
  });

  it("retains a code for retry when the server cannot confirm redemption", async () => {
    vi.mocked(api.redeemVenueOffer).mockRejectedValueOnce(
      new ApiRequestError(409, "Redemption code has expired or is unavailable"),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "核銷回饋" }));
    fireEvent.change(screen.getByLabelText("領取碼／掃描器輸入"), {
      target: { value: redemptionCode },
    });
    fireEvent.click(screen.getByRole("button", { name: "確認核銷" }));
    expect((await screen.findByRole("alert")).textContent).toContain("已過期");
    expect(screen.queryByText("本次已登記領取")).toBeNull();
  });

  it("does not invent zero metrics or enable offers for a journey without a reward", async () => {
    vi.mocked(api.venueMetrics).mockRejectedValueOnce(new Error("offline"));
    mount({ ...campaign, optionalOffer: null });
    expect(await screen.findByText("成效暫時讀取不到，請重試。")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "核銷回饋" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("stops a camera stream granted after the operator has already left", async () => {
    const stop = vi.fn();
    let grant!: (value: {
      getTracks: () => Array<{ stop: () => void }>;
    }) => void;
    const getUserMedia = vi.fn().mockReturnValue(
      new Promise((done) => {
        grant = done;
      }),
    );
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const page = mount();
    fireEvent.click(screen.getByRole("button", { name: "核銷回饋" }));
    fireEvent.click(screen.getByRole("button", { name: "開啟鏡頭掃描" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    page.unmount();
    await act(async () => grant({ getTracks: () => [{ stop }] }));
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
