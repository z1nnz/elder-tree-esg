"use client";

import type {
  CompanionPromptSummary,
  RadarMissionInput,
  RadarMissionSummary,
} from "@elder-tree/contracts";
import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { api } from "../lib/api";

const now = new Date();
const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

interface RadarDraft {
  title: string;
  description: string;
  category: string;
  tag: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  verificationMode: "SELF_CHECK" | "TIMER";
  minimumSeconds: number;
  growthPoints: number;
  badgeName: string;
  companionPromptTemplates: {
    elderMessage: string;
    companionReply: string;
    volunteerNote: string;
    shareSummary: string;
  };
}

const emptyRadarDraft: RadarDraft = {
  title: "",
  description: "",
  category: "NATURE",
  tag: "觀察",
  latitude: 25.04411,
  longitude: 121.52944,
  radiusMeters: 90,
  startsAt: toLocalInputValue(now),
  endsAt: toLocalInputValue(nextMonth),
  verificationMode: "SELF_CHECK",
  minimumSeconds: 180,
  growthPoints: 8,
  badgeName: "",
  companionPromptTemplates: {
    elderMessage: "",
    companionReply: "",
    volunteerNote: "",
    shareSummary: "",
  },
};

const validationTemplates = [
  {
    name: "中正紀念堂補水確認",
    title: "中正紀念堂廣場補水確認",
    description: "走到廣場附近，停下來喝水並確認今天身體狀態。",
    category: "HYDRATION",
    tag: "補水",
    latitude: 25.03461,
    longitude: 121.52187,
    radiusMeters: 120,
    verificationMode: "SELF_CHECK" as const,
    minimumSeconds: 180,
    growthPoints: 6,
    badgeName: "城市補水者",
    companionPromptTemplates: {
      elderMessage: "你完成了「{title}」。有記得喝水，就是把身體放在心上。",
      companionReply:
        "可以回覆：『今天有記得補水，很棒。晚點出門也可以帶一瓶水。』",
      volunteerNote:
        "先肯定補水這個具體行動；若要延伸，只提醒下次出門帶水，不追問感受。",
      shareSummary: "完成「{title}」，生命樹長出新葉 +{growthPoints}。",
    },
  },
  {
    name: "二二八公園慢呼吸",
    title: "二二八公園三分鐘慢呼吸",
    description: "找安全的位置，安靜慢呼吸三分鐘，再讓生命樹長出新葉。",
    category: "WELLNESS",
    tag: "慢呼吸",
    latitude: 25.04236,
    longitude: 121.51542,
    radiusMeters: 120,
    verificationMode: "TIMER" as const,
    minimumSeconds: 180,
    growthPoints: 10,
    badgeName: "慢呼吸同行者",
    companionPromptTemplates: {
      elderMessage: "你完成了「{title}」。願意慢下來，是照顧自己的開始。",
      companionReply:
        "可以回覆：『看到你完成三分鐘慢呼吸了，願意停一下也很不錯。』",
      volunteerNote:
        "先回應已完成的慢呼吸行動；若要邀約，下次可一起找安全座位練習。",
      shareSummary: "完成「{title}」，生命樹長出新葉 +{growthPoints}。",
    },
  },
];

export function RadarMissionEditor({
  missions,
  onMissionsChange,
}: {
  missions: RadarMissionSummary[];
  onMissionsChange: (missions: RadarMissionSummary[]) => void;
}) {
  const [draft, setDraft] = useState<RadarDraft>(emptyRadarDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<CompanionPromptSummary[]>([]);

  useEffect(() => {
    void refreshPrompts();
  }, []);

  async function refreshPrompts() {
    try {
      setPrompts(await api.companionPrompts());
    } catch {
      setPrompts([]);
    }
  }

  async function refresh(updated?: RadarMissionSummary) {
    if (updated) {
      onMissionsChange(
        missions.some((mission) => mission.id === updated.id)
          ? missions.map((mission) =>
              mission.id === updated.id ? updated : mission,
            )
          : [updated, ...missions],
      );
      return;
    }
    onMissionsChange(await api.radarMissions());
  }

  function edit(mission: RadarMissionSummary) {
    setEditingId(mission.id);
    setDraft({
      title: mission.title,
      description: mission.description,
      category: mission.category,
      tag: mission.tag,
      latitude: mission.latitude,
      longitude: mission.longitude,
      radiusMeters: mission.radiusMeters,
      startsAt: toLocalInputValue(new Date(mission.startsAt)),
      endsAt: toLocalInputValue(new Date(mission.endsAt)),
      verificationMode: mission.verificationMode,
      minimumSeconds: mission.minimumSeconds ?? 180,
      growthPoints: mission.growthPoints,
      badgeName: mission.badgeName ?? "",
      companionPromptTemplates: {
        elderMessage: mission.companionPromptTemplates.elderMessage ?? "",
        companionReply:
          mission.companionPromptTemplates.companionReply ?? "",
        volunteerNote: mission.companionPromptTemplates.volunteerNote ?? "",
        shareSummary: mission.companionPromptTemplates.shareSummary ?? "",
      },
    });
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const input: RadarMissionInput = {
        title: draft.title,
        description: draft.description,
        category: draft.category,
        tag: draft.tag,
        latitude: draft.latitude,
        longitude: draft.longitude,
        radiusMeters: draft.radiusMeters,
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: new Date(draft.endsAt).toISOString(),
        verificationMode: draft.verificationMode,
        minimumSeconds:
          draft.verificationMode === "TIMER" ? draft.minimumSeconds : null,
        growthPoints: draft.growthPoints,
        badgeName: draft.badgeName || null,
        companionPromptTemplates: normalizeCompanionTemplates(
          draft.companionPromptTemplates,
        ),
      };
      const saved = editingId
        ? await api.updateRadarMission(editingId, input)
        : await api.createRadarMission(input);
      await refresh(saved);
      setEditingId(null);
      setDraft(emptyRadarDraft);
      setMessage(editingId ? "雷達任務已更新。" : "雷達任務草稿已建立。");
      await refreshPrompts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "雷達任務儲存失敗");
    } finally {
      setBusy(false);
    }
  }

  async function publish(id: string) {
    setBusy(true);
    try {
      await refresh(await api.publishRadarMission(id));
      setMessage("雷達任務已發布。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "發布失敗");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    try {
      await refresh(await api.archiveRadarMission(id));
      setMessage("雷達任務已封存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "封存失敗");
    } finally {
      setBusy(false);
    }
  }

  function templateToDraft(
    template: (typeof validationTemplates)[number],
  ): RadarDraft {
    const startsAt = new Date(Date.now() - 5 * 60 * 1000);
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return {
      ...template,
      startsAt: toLocalInputValue(startsAt),
      endsAt: toLocalInputValue(endsAt),
    };
  }

  async function createValidationPack() {
    const confirmed = window.confirm(
      "將建立並發布 2 個台北市中心測試任務，有效期 7 天。確定繼續？",
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved: RadarMissionSummary[] = [];
      for (const template of validationTemplates) {
        const draft = templateToDraft(template);
        const created = await api.createRadarMission({
          title: `${draft.title} ${new Date().toLocaleDateString("zh-TW")}`,
          description: draft.description,
          category: draft.category,
          tag: draft.tag,
          latitude: draft.latitude,
          longitude: draft.longitude,
          radiusMeters: draft.radiusMeters,
          startsAt: new Date(draft.startsAt).toISOString(),
          endsAt: new Date(draft.endsAt).toISOString(),
          verificationMode: draft.verificationMode,
          minimumSeconds:
            draft.verificationMode === "TIMER" ? draft.minimumSeconds : null,
          growthPoints: draft.growthPoints,
          badgeName: draft.badgeName || null,
          companionPromptTemplates: normalizeCompanionTemplates(
            draft.companionPromptTemplates,
          ),
        });
        saved.push(await api.publishRadarMission(created.id));
      }
      onMissionsChange([...saved, ...missions]);
      setMessage("已建立並發布 2 個台北實機驗收任務。");
      await refreshPrompts();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "測試任務建立或發布失敗",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace radar-admin" data-view-root>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">限時城市任務</span>
          <h2>任務雷達</h2>
          <p>發布台北市中心的限時任務點；MVP 僅支援自我確認與計時任務。</p>
        </div>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void createValidationPack()}
        >
          一鍵建立實機測試任務
        </button>
      </div>

      <div className="radar-admin-grid">
        <form className="quest-form" onSubmit={submit}>
          <h3>{editingId ? "編輯雷達任務" : "新增雷達任務"}</h3>
          <div className="template-strip">
            <span>快速模板</span>
            {validationTemplates.map((template) => (
              <button
                type="button"
                key={template.name}
                disabled={busy}
                onClick={() => {
                  setEditingId(null);
                  setDraft(templateToDraft(template));
                  setMessage(
                    `已載入「${template.name}」模板，可微調後建立草稿。`,
                  );
                }}
              >
                {template.name}
              </button>
            ))}
          </div>
          <label>
            任務標題
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              required
            />
          </label>
          <label>
            任務說明
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              required
            />
          </label>
          <div className="form-pair">
            <label>
              分類
              <input
                value={draft.category}
                onChange={(event) =>
                  setDraft({ ...draft, category: event.target.value })
                }
                required
              />
            </label>
            <label>
              標籤
              <input
                value={draft.tag}
                onChange={(event) =>
                  setDraft({ ...draft, tag: event.target.value })
                }
                required
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              緯度
              <input
                type="number"
                step="0.000001"
                value={draft.latitude}
                onChange={(event) =>
                  setDraft({ ...draft, latitude: Number(event.target.value) })
                }
                required
              />
            </label>
            <label>
              經度
              <input
                type="number"
                step="0.000001"
                value={draft.longitude}
                onChange={(event) =>
                  setDraft({ ...draft, longitude: Number(event.target.value) })
                }
                required
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              半徑（25–150m）
              <input
                type="number"
                min={25}
                max={150}
                value={draft.radiusMeters}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    radiusMeters: Number(event.target.value),
                  })
                }
                required
              />
            </label>
            <label>
              成長值
              <input
                type="number"
                min={1}
                max={50}
                value={draft.growthPoints}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    growthPoints: Number(event.target.value),
                  })
                }
                required
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              開始時間
              <input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(event) =>
                  setDraft({ ...draft, startsAt: event.target.value })
                }
                required
              />
            </label>
            <label>
              結束時間
              <input
                type="datetime-local"
                value={draft.endsAt}
                onChange={(event) =>
                  setDraft({ ...draft, endsAt: event.target.value })
                }
                required
              />
            </label>
          </div>
          <div className="form-pair">
            <label>
              完成方式
              <select
                value={draft.verificationMode}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    verificationMode: event.target.value as
                      "SELF_CHECK" | "TIMER",
                  })
                }
              >
                <option value="SELF_CHECK">自我確認</option>
                <option value="TIMER">計時</option>
              </select>
            </label>
            <label>
              計時秒數
              <input
                type="number"
                min={30}
                max={3600}
                value={draft.minimumSeconds}
                disabled={draft.verificationMode !== "TIMER"}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    minimumSeconds: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <label>
            徽章名稱
            <input
              value={draft.badgeName}
              onChange={(event) =>
                setDraft({ ...draft, badgeName: event.target.value })
              }
              placeholder="可留空"
            />
          </label>
          <fieldset className="companion-template-fieldset">
            <legend>陪伴回應模板</legend>
            <small>
              任務完成後會轉成家人、志工或社福可接續的生活片段。請寫成自然的一句回覆，不要問任務或照片裡已經看得到的資訊。可使用 {"{title}"}、{"{tag}"}、{"{growthPoints}"}。
            </small>
            <label>
              長者鼓勵語
              <textarea
                value={draft.companionPromptTemplates.elderMessage}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    companionPromptTemplates: {
                      ...draft.companionPromptTemplates,
                      elderMessage: event.target.value,
                    },
                  })
                }
                placeholder="留空時使用系統預設鼓勵語"
              />
            </label>
            <label>
              家人／陪伴者回覆建議
              <textarea
                value={draft.companionPromptTemplates.companionReply}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    companionPromptTemplates: {
                      ...draft.companionPromptTemplates,
                      companionReply: event.target.value,
                    },
                  })
                }
                placeholder="例如：可以回覆：『看到你完成「{title}」了，今天有出去走走很棒。』"
              />
            </label>
            <label>
              志工／社福陪伴提示
              <textarea
                value={draft.companionPromptTemplates.volunteerNote}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    companionPromptTemplates: {
                      ...draft.companionPromptTemplates,
                      volunteerNote: event.target.value,
                    },
                  })
                }
                placeholder="例如：先肯定完成，再詢問是否需要休息或陪同。"
              />
            </label>
            <label>
              可分享摘要
              <textarea
                value={draft.companionPromptTemplates.shareSummary}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    companionPromptTemplates: {
                      ...draft.companionPromptTemplates,
                      shareSummary: event.target.value,
                    },
                  })
                }
                placeholder="例如：完成「{title}」，生命樹長出新葉 +{growthPoints}。"
              />
            </label>
          </fieldset>
          <button className="primary-button" disabled={busy}>
            {editingId ? "儲存任務" : "建立草稿"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setEditingId(null);
                setDraft(emptyRadarDraft);
              }}
            >
              取消編輯
            </button>
          ) : null}
          {message ? <p className="form-message">{message}</p> : null}
        </form>

        <div className="radar-admin-side">
          <RadarMissionPreview draft={draft} editingId={editingId} />
          <CompanionPromptFeed prompts={prompts} />
          <div className="radar-admin-list">
            {missions.length === 0 ? (
              <div className="empty-state">尚未建立雷達任務。</div>
            ) : (
              missions.map((mission) => (
                <article key={mission.id}>
                  <div>
                    <span
                      className={`status-pill ${mission.publicationStatus.toLowerCase()}`}
                    >
                      {missionStatusLabel(mission)}
                    </span>
                    <h3>{mission.title}</h3>
                    <p>{mission.description}</p>
                    <small>
                      {mission.tag}・{mission.radiusMeters}m・+
                      {mission.growthPoints}・
                      {mission.verificationMode === "TIMER"
                        ? `計時 ${mission.minimumSeconds ?? 0}s`
                        : "自我確認"}
                      ・{new Date(mission.endsAt).toLocaleString("zh-TW")}
                    </small>
                  </div>
                  <div className="radar-admin-actions">
                    {mission.publicationStatus === "DRAFT" ? (
                      <>
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => edit(mission)}
                        >
                          編輯
                        </button>
                        <button
                          className="primary-button"
                          disabled={busy}
                          onClick={() => void publish(mission.id)}
                        >
                          發布
                        </button>
                      </>
                    ) : null}
                    {mission.publicationStatus === "PUBLISHED" ? (
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => void archive(mission.id)}
                      >
                        封存
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RadarMissionPreview({
  draft,
  editingId,
}: {
  draft: RadarDraft;
  editingId: string | null;
}) {
  const startsAt = new Date(draft.startsAt);
  const endsAt = new Date(draft.endsAt);
  const windowValid =
    Number.isFinite(startsAt.getTime()) && Number.isFinite(endsAt.getTime());
  return (
    <aside className="radar-admin-preview" aria-label="雷達任務預覽">
      <span className="eyebrow">MISSION PREVIEW</span>
      <h3>
        {draft.title || (editingId ? "編輯中的雷達任務" : "新的雷達任務草稿")}
      </h3>
      <p>
        {draft.description ||
          "填入任務說明後，這裡會顯示給 App 使用者看的任務摘要。"}
      </p>
      <div className="radar-preview-map">
        <i
          style={
            {
              "--x": `${coordinateToPercent(draft.longitude, 121.46, 121.62)}%`,
              "--y": `${coordinateToPercent(draft.latitude, 25.12, 24.96)}%`,
            } as CSSProperties
          }
        />
      </div>
      <dl>
        <div>
          <dt>座標</dt>
          <dd>
            {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}
          </dd>
        </div>
        <div>
          <dt>半徑</dt>
          <dd>{draft.radiusMeters}m</dd>
        </div>
        <div>
          <dt>完成方式</dt>
          <dd>
            {draft.verificationMode === "TIMER"
              ? `計時 ${draft.minimumSeconds}s`
              : "自我確認"}
          </dd>
        </div>
        <div>
          <dt>成長值</dt>
          <dd>+{draft.growthPoints}</dd>
        </div>
      </dl>
      <small>
        {windowValid
          ? `${startsAt.toLocaleString("zh-TW")} — ${endsAt.toLocaleString("zh-TW")}`
          : "請設定有效時間窗"}
      </small>
      <div className="companion-preview">
        <strong>陪伴回應預覽</strong>
        <p>
          {previewPrompt(
            draft.companionPromptTemplates.companionReply,
            `可以回覆：『看到你完成「${draft.title || "這個任務"}」了，今天有做一件照顧自己的事，很棒。』`,
            draft,
          )}
        </p>
      </div>
    </aside>
  );
}

function CompanionPromptFeed({
  prompts,
}: {
  prompts: CompanionPromptSummary[];
}) {
  return (
    <aside className="companion-prompt-feed" aria-label="最近產生的陪伴回應">
      <span className="eyebrow">COMPANION RESPONSES</span>
      <h3>最近陪伴回應</h3>
      {prompts.length === 0 ? (
        <p>完成雷達任務後，這裡會顯示家人／志工可轉述的自然回應。</p>
      ) : (
        prompts.slice(0, 4).map((prompt) => (
          <article key={prompt.id}>
            <small>
              {prompt.tag}・+{prompt.growthPoints}・
              {new Date(prompt.createdAt).toLocaleString("zh-TW")}
            </small>
            <strong>{prompt.sourceTitle}</strong>
            <p>{prompt.companionReply}</p>
          </article>
        ))
      )}
    </aside>
  );
}

function normalizeCompanionTemplates(
  templates: RadarDraft["companionPromptTemplates"],
) {
  return {
    elderMessage: templates.elderMessage.trim() || null,
    companionReply: templates.companionReply.trim() || null,
    volunteerNote: templates.volunteerNote.trim() || null,
    shareSummary: templates.shareSummary.trim() || null,
  };
}

function previewPrompt(template: string, fallback: string, draft: RadarDraft) {
  const source = template.trim() || fallback;
  return source.replace(/\{(title|tag|category|growthPoints)\}/g, (_, key) => {
    const replacements = {
      title: draft.title || "這個任務",
      tag: draft.tag || "任務",
      category: draft.category || "任務",
      growthPoints: String(draft.growthPoints || 0),
    };
    return replacements[key as keyof typeof replacements] ?? "";
  });
}

function coordinateToPercent(value: number, min: number, max: number) {
  if (max === min) return 50;
  return Math.min(92, Math.max(8, ((value - min) / (max - min)) * 100));
}

function missionStatusLabel(mission: RadarMissionSummary) {
  if (
    mission.publicationStatus === "PUBLISHED" &&
    mission.status === "EXPIRED"
  ) {
    return "已過期";
  }
  return {
    DRAFT: "草稿",
    PUBLISHED: "已發布",
    ARCHIVED: "已封存",
  }[mission.publicationStatus];
}

function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
