"use client";

import type {
  PartnerCampaignInput,
  PartnerCampaignSummary,
  PartnerOrganizationSummary,
  PartnerWorkspaceSummary,
} from "@elder-tree/contracts";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  Leaf,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Send,
  Users,
} from "lucide-react";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../lib/api";
import { VenueStation } from "./venue-station";

type CampaignForm = Omit<PartnerCampaignInput, "startsAt" | "endsAt"> & {
  startsAt: string;
  endsAt: string;
};

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function newCampaignForm(): CampaignForm {
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    venueName: "",
    latitude: 25.033,
    longitude: 121.5654,
    radiusMeters: 60,
    startsAt: localDateTime(startsAt),
    endsAt: localDateTime(endsAt),
    verificationMode: "SELF_CHECK",
    minimumSeconds: null,
    growthPoints: 10,
    badgeName: null,
    accessibilityNotes: "",
    safetyNotes: "",
    optionalOffer: null,
    purchaseRequired: false,
    requiresVenueWitness: false,
  };
}

function campaignToForm(campaign: PartnerCampaignSummary): CampaignForm {
  return {
    title: campaign.title,
    description: campaign.description,
    venueName: campaign.venueName,
    latitude: campaign.latitude,
    longitude: campaign.longitude,
    radiusMeters: campaign.radiusMeters,
    startsAt: localDateTime(new Date(campaign.startsAt)),
    endsAt: localDateTime(new Date(campaign.endsAt)),
    verificationMode: campaign.verificationMode,
    minimumSeconds: campaign.minimumSeconds,
    growthPoints: campaign.growthPoints,
    badgeName: campaign.badgeName,
    accessibilityNotes: campaign.accessibilityNotes,
    safetyNotes: campaign.safetyNotes,
    optionalOffer: campaign.optionalOffer,
    purchaseRequired: false,
    requiresVenueWitness: campaign.requiresVenueWitness ?? false,
  };
}

export function PartnerWorkspace({
  organizations,
}: {
  organizations: PartnerOrganizationSummary[];
}) {
  const [organizationId, setOrganizationId] = useState(organizations[0]!.id);
  const [workspace, setWorkspace] = useState<PartnerWorkspaceSummary | null>(
    null,
  );
  const [editing, setEditing] = useState<PartnerCampaignSummary | null>(null);
  const [station, setStation] = useState<PartnerCampaignSummary | null>(null);
  const [form, setForm] = useState<CampaignForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const stationReturnFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!station && stationReturnFocus.current) {
      document.getElementById(stationReturnFocus.current)?.focus();
      stationReturnFocus.current = null;
    }
  }, [station]);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const nextWorkspace = await api.partnerWorkspace(organizationId);
      if (sequence === loadSequence.current) setWorkspace(nextWorkspace);
    } catch {
      if (sequence === loadSequence.current) {
        setError("無法讀取夥伴工作區，請重新登入或稍後再試。");
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      (workspace?.campaigns ?? []).reduce(
        (sum, campaign) => ({
          delivered: sum.delivered + campaign.metrics.deliveredToAppCount,
          arrived: sum.arrived + campaign.metrics.arrivedCount,
          completed: sum.completed + campaign.metrics.completedCount,
        }),
        { delivered: 0, arrived: 0, completed: 0 },
      ),
    [workspace],
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const input: PartnerCampaignInput = {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        minimumSeconds:
          form.verificationMode === "TIMER" ? form.minimumSeconds : null,
        purchaseRequired: false,
      };
      if (editing) {
        await api.updatePartnerCampaign(organizationId, editing.id, input);
      } else {
        await api.createPartnerCampaign(organizationId, input);
      }
      setEditing(null);
      setForm(null);
      await load();
    } catch {
      setError("提案未儲存。請確認時間、位置半徑與必填說明。");
    } finally {
      setSaving(false);
    }
  }

  async function submit(campaignId: string) {
    setSaving(true);
    setError(null);
    try {
      await api.submitPartnerCampaign(organizationId, campaignId);
      await load();
    } catch {
      setError("提案未送出，請重新整理後再試。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="partner-page">
      <header className="partner-header">
        <div className="partner-brand">
          <Leaf size={22} />
          <div>
            <strong>同行成林</strong>
            <span>共創夥伴台</span>
          </div>
        </div>
        {organizations.length > 1 ? (
          <label className="partner-organization-select">
            組織
            <select
              value={organizationId}
              disabled={saving}
              onChange={(event) => {
                loadSequence.current += 1;
                setOrganizationId(event.target.value);
                setWorkspace(null);
                setEditing(null);
                setForm(null);
                setStation(null);
                setError(null);
              }}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <section className="partner-content">
        <div className="partner-title-row">
          <div>
            <span className="eyebrow">旅程共創夥伴</span>
            <h1>{workspace?.organization.name ?? "夥伴工作區"}</h1>
            <p>提出不必消費也能完成的共行旅程；平台核准後才會發布到 App。</p>
          </div>
          {!form && !station ? (
            <button
              className="primary-button"
              onClick={() => {
                setEditing(null);
                setForm(newCampaignForm());
              }}
            >
              <Plus size={17} />
              新增旅程提案
            </button>
          ) : null}
        </div>

        {error ? <p className="form-error partner-error">{error}</p> : null}

        <div className="metric-grid partner-metrics">
          <PartnerMetric
            icon={Send}
            label="任務送達 App"
            value={totals.delivered}
          />
          <PartnerMetric
            icon={MapPin}
            label="進入旅程場域"
            value={totals.arrived}
          />
          <PartnerMetric
            icon={CheckCircle2}
            label="完成旅程"
            value={totals.completed}
          />
          <PartnerMetric
            icon={Clock3}
            label="等待平台審核"
            unit="份提案"
            value={
              workspace?.campaigns.filter(
                (campaign) => campaign.status === "SUBMITTED",
              ).length ?? 0
            }
          />
        </div>

        {station ? (
          <VenueStation
            key={`${organizationId}:${station.id}`}
            organizationId={organizationId}
            campaign={station}
            onClose={() => {
              stationReturnFocus.current = `open-venue-${station.id}`;
              setStation(null);
            }}
          />
        ) : form ? (
          <CampaignEditor
            form={form}
            editing={editing}
            saving={saving}
            onChange={setForm}
            onCancel={() => {
              setEditing(null);
              setForm(null);
            }}
            onSubmit={save}
          />
        ) : (
          <section className="partner-list" aria-busy={loading}>
            <div className="panel-heading">
              <div>
                <h2>旅程提案</h2>
                <p>審核前可修改草稿；送出後由平台確認安全、價值與回饋邊界。</p>
              </div>
            </div>
            {loading ? <p className="partner-empty">正在讀取提案…</p> : null}
            {!loading && workspace?.campaigns.length === 0 ? (
              <p className="partner-empty">
                還沒有提案，先建立第一個低風險試辦旅程。
              </p>
            ) : null}
            {workspace?.campaigns.map((campaign) => (
              <article className="partner-campaign" key={campaign.id}>
                <div className="partner-campaign-heading">
                  <div>
                    <span
                      className={`status status-${campaign.status.toLowerCase()}`}
                    >
                      {campaignStatusLabel(campaign.status)}
                    </span>
                    <h3>{campaign.title}</h3>
                    <p>
                      <Building2 size={14} /> {campaign.venueName} ·{" "}
                      {formatDate(campaign.startsAt)}
                    </p>
                  </div>
                  <div className="partner-campaign-actions">
                    {campaign.status === "APPROVED" &&
                    campaign.requiresVenueWitness ? (
                      <button
                        id={`open-venue-${campaign.id}`}
                        className="secondary-button"
                        type="button"
                        onClick={() => setStation(campaign)}
                      >
                        <QrCode size={17} aria-hidden="true" /> 開啟現場工作台
                      </button>
                    ) : null}
                    {campaign.status === "DRAFT" ||
                    campaign.status === "REJECTED" ? (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setEditing(campaign);
                          setForm(campaignToForm(campaign));
                        }}
                      >
                        <Pencil size={15} /> 修改
                      </button>
                    ) : null}
                    {campaign.status === "DRAFT" ? (
                      <button
                        className="secondary-button"
                        disabled={saving}
                        onClick={() => void submit(campaign.id)}
                      >
                        送交審核 <ArrowRight size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="partner-campaign-description">
                  {campaign.description}
                </p>
                {campaign.reviewNote ? (
                  <p className="partner-review-note">
                    平台說明：{campaign.reviewNote}
                  </p>
                ) : null}
                <div className="partner-funnel">
                  <span>
                    <Eye size={14} /> 送達{" "}
                    {campaign.metrics.deliveredToAppCount}
                  </span>
                  <span>
                    <MapPin size={14} /> 到場 {campaign.metrics.arrivedCount}
                  </span>
                  <span>
                    <Users size={14} /> 完成 {campaign.metrics.completedCount}
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}

function PartnerMetric({
  icon: Icon,
  label,
  value,
  unit = "彙總人次",
}: {
  icon: typeof Send;
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-icon green">
        <Icon size={20} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{unit}</small>
      </div>
    </div>
  );
}

function CampaignEditor({
  form,
  editing,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: CampaignForm;
  editing: PartnerCampaignSummary | null;
  saving: boolean;
  onChange: (form: CampaignForm) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) =>
    onChange({ ...form, [key]: value });
  return (
    <form className="partner-editor" onSubmit={onSubmit}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{editing ? "修改草稿" : "建立草稿"}</span>
          <h2>{editing ? editing.title : "新的共行旅程提案"}</h2>
          <p>所有欄位會交由平台審核；優惠只能是自願回饋，不能成為完成條件。</p>
        </div>
      </div>
      <div className="partner-form-grid">
        <PartnerField label="旅程名稱" wide>
          <input
            required
            minLength={2}
            maxLength={100}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </PartnerField>
        <PartnerField label="旅程目的與行動" wide>
          <textarea
            required
            minLength={8}
            maxLength={500}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </PartnerField>
        <PartnerField label="旅程據點">
          <input
            required
            value={form.venueName}
            onChange={(e) => set("venueName", e.target.value)}
          />
        </PartnerField>
        <PartnerField label="見證方式">
          <select
            value={form.verificationMode}
            onChange={(e) => {
              const mode = e.target.value === "TIMER" ? "TIMER" : "SELF_CHECK";
              onChange({
                ...form,
                verificationMode: mode,
                minimumSeconds:
                  mode === "TIMER" ? (form.minimumSeconds ?? 180) : null,
              });
            }}
          >
            <option value="SELF_CHECK">現場自我確認</option>
            <option value="TIMER">現場停留計時</option>
          </select>
        </PartnerField>
        <PartnerField label="緯度">
          <input
            required
            type="number"
            step="0.000001"
            value={form.latitude}
            onChange={(e) => set("latitude", Number(e.target.value))}
          />
        </PartnerField>
        <PartnerField label="經度">
          <input
            required
            type="number"
            step="0.000001"
            value={form.longitude}
            onChange={(e) => set("longitude", Number(e.target.value))}
          />
        </PartnerField>
        <PartnerField label="場域半徑（公尺）">
          <input
            required
            type="number"
            min={25}
            max={150}
            value={form.radiusMeters}
            onChange={(e) => set("radiusMeters", Number(e.target.value))}
          />
        </PartnerField>
        {form.verificationMode === "TIMER" ? (
          <PartnerField label="最短停留秒數">
            <input
              required
              type="number"
              min={30}
              max={3600}
              value={form.minimumSeconds ?? 180}
              onChange={(e) => set("minimumSeconds", Number(e.target.value))}
            />
          </PartnerField>
        ) : (
          <div />
        )}
        <PartnerField label="開始時間">
          <input
            required
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </PartnerField>
        <PartnerField label="結束時間">
          <input
            required
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
          />
        </PartnerField>
        <PartnerField label="建議年輪進度">
          <input
            required
            type="number"
            min={1}
            max={50}
            value={form.growthPoints}
            onChange={(e) => set("growthPoints", Number(e.target.value))}
          />
        </PartnerField>
        <PartnerField label="季節收藏名稱">
          <input
            value={form.badgeName ?? ""}
            onChange={(e) => set("badgeName", e.target.value || null)}
          />
        </PartnerField>
        <PartnerField label="無障礙資訊" wide>
          <textarea
            required
            minLength={4}
            maxLength={500}
            value={form.accessibilityNotes}
            onChange={(e) => set("accessibilityNotes", e.target.value)}
          />
        </PartnerField>
        <PartnerField label="安全說明" wide>
          <textarea
            required
            minLength={4}
            maxLength={500}
            value={form.safetyNotes}
            onChange={(e) => set("safetyNotes", e.target.value)}
          />
        </PartnerField>
        <PartnerField label="自願優惠（選填）" wide>
          <input
            maxLength={240}
            value={form.optionalOffer ?? ""}
            onChange={(e) => set("optionalOffer", e.target.value || null)}
            placeholder="例如：完成後可自願領取飲水，不需消費"
          />
        </PartnerField>
        <PartnerField label="到場見證" wide>
          <select
            value={form.requiresVenueWitness ? "required" : "optional"}
            onChange={(e) =>
              set("requiresVenueWitness", e.target.value === "required")
            }
          >
            <option value="optional">依上方見證方式完成，不需掃碼</option>
            <option value="required">
              完成條件後，另需掃描現場短效碼與定位
            </option>
          </select>
          <small>
            啟用後須由現場夥伴展示到場碼，並交由平台審核；有自願回饋時才開放領取碼核銷。
          </small>
        </PartnerField>
      </div>
      <div className="partner-editor-note">
        <CheckCircle2 size={17} />{" "}
        本旅程不要求購買商品，也不會向夥伴顯示個人姓名或精確移動軌跡。
      </div>
      <div className="partner-editor-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "儲存中…" : "儲存草稿"}
        </button>
      </div>
    </form>
  );
}

function PartnerField({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? "partner-field wide" : "partner-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function campaignStatusLabel(status: PartnerCampaignSummary["status"]) {
  return {
    DRAFT: "草稿",
    SUBMITTED: "等待審核",
    APPROVED: "已核准",
    REJECTED: "請修正",
    ARCHIVED: "已封存",
  }[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
