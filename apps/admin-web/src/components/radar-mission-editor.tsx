"use client";

import type {
  RadarMissionInput,
  RadarMissionSummary,
} from "@elder-tree/contracts";
import { FormEvent, useState } from "react";
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
};

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
      };
      const saved = editingId
        ? await api.updateRadarMission(editingId, input)
        : await api.createRadarMission(input);
      await refresh(saved);
      setEditingId(null);
      setDraft(emptyRadarDraft);
      setMessage(editingId ? "雷達任務已更新。" : "雷達任務草稿已建立。");
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

  return (
    <section className="workspace radar-admin" data-view-root>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">限時城市任務</span>
          <h2>任務雷達</h2>
          <p>發布台北市中心的限時任務點；MVP 僅支援自我確認與計時任務。</p>
        </div>
      </div>

      <div className="radar-admin-grid">
        <form className="quest-form" onSubmit={submit}>
          <h3>{editingId ? "編輯雷達任務" : "新增雷達任務"}</h3>
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
                      | "SELF_CHECK"
                      | "TIMER",
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
                    {mission.publicationStatus}
                  </span>
                  <h3>{mission.title}</h3>
                  <p>{mission.description}</p>
                  <small>
                    {mission.tag}・{mission.radiusMeters}m・+
                    {mission.growthPoints}・
                    {new Date(mission.endsAt).toLocaleString("zh-TW")}
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
    </section>
  );
}

function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
