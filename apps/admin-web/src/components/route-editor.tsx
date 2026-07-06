"use client";

import type {
  ExplorationQuestInput,
  ExplorationRouteSummary,
} from "@elder-tree/contracts";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";

const mapStyleUrl =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

interface QuestDraft {
  locationName: string;
  category: string;
  safetyNote: string;
  accessibilityTags: string;
  sourceUrl: string;
  title: string;
  description: string;
  verificationMode: "SELF_CHECK" | "TIMER";
  minimumSeconds: number;
  growthPoints: number;
  triggerType: "GEOFENCE" | "DISTANCE";
  latitude: number;
  longitude: number;
  radiusMeters: number;
  unlockDistanceMeters: number;
}

const emptyQuest: QuestDraft = {
  locationName: "",
  category: "NATURE",
  safetyNote: "設施與無障礙資訊待現場確認。",
  accessibilityTags: "待確認",
  sourceUrl: "",
  title: "",
  description: "",
  verificationMode: "SELF_CHECK" as const,
  minimumSeconds: 180,
  growthPoints: 5,
  triggerType: "GEOFENCE" as const,
  latitude: 25.0316,
  longitude: 121.5362,
  radiusMeters: 60,
  unlockDistanceMeters: 400,
};

export function RouteEditor({
  routes,
  onRoutesChange,
}: {
  routes: ExplorationRouteSummary[];
  onRoutesChange: (routes: ExplorationRouteSummary[]) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [selectedId, setSelectedId] = useState(routes[0]?.id ?? "");
  const [routeName, setRouteName] = useState("");
  const [quest, setQuest] = useState<QuestDraft>(emptyQuest);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = useMemo(
    () => routes.find((route) => route.id === selectedId) ?? routes[0],
    [routes, selectedId],
  );

  function selectRoute(id: string) {
    setSelectedId(id);
    setEditingQuestId(null);
    setQuest(emptyQuest);
    setMessage(null);
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyleUrl,
      center: [121.5362, 25.0316],
      zoom: 14.4,
    });
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current.on("click", (event) => {
      setQuest((value) => ({
        ...value,
        latitude: Number(event.lngLat.lat.toFixed(6)),
        longitude: Number(event.lngLat.lng.toFixed(6)),
        triggerType: "GEOFENCE",
      }));
    });
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    for (const item of selected?.quests ?? []) {
      if (item.latitude === null || item.longitude === null) continue;
      const element = document.createElement("button");
      element.className = item.completed
        ? "quest-marker completed"
        : item.unlocked
          ? "quest-marker unlocked"
          : "quest-marker";
      element.textContent = String(item.sequence);
      element.title = item.locationName;
      const marker = new maplibregl.Marker({ element })
        .setLngLat([item.longitude, item.latitude])
        .addTo(map.current!);
      markers.current.push(marker);
    }
  }, [selected]);

  async function refreshRoutes(next?: ExplorationRouteSummary[]) {
    onRoutesChange(next ?? (await api.explorationRoutes()));
  }

  async function createRoute(event: FormEvent) {
    event.preventDefault();
    const name = routeName.trim();
    if (!name) return;
    setBusy(true);
    setMessage(null);
    try {
      const created = await api.createExplorationRoute({
        slug: `${name
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "")}-${Date.now().toString(36)}`,
        name,
        description: "由營運後台建立的城市探索路線，發布前請完成安全與現場資訊確認。",
        badgeName: `${name}探索者`,
        badgeAssetKey: "community-leaf",
      });
      await refreshRoutes([created, ...routes]);
      selectRoute(created.id);
      setRouteName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "路線建立失敗");
    } finally {
      setBusy(false);
    }
  }

  function editQuest(item: NonNullable<typeof selected>["quests"][number]) {
    if (selected?.status !== "DRAFT") return;
    setEditingQuestId(item.id);
    setQuest({
      locationName: item.locationName,
      category: item.category,
      safetyNote: item.safetyNote ?? "",
      accessibilityTags: item.accessibilityTags.join(", "),
      sourceUrl: item.sourceUrl ?? "",
      title: item.title,
      description: item.description,
      verificationMode: item.verificationMode,
      minimumSeconds: item.minimumSeconds ?? 180,
      growthPoints: item.growthPoints,
      triggerType: item.triggerType,
      latitude: item.latitude ?? 25.0316,
      longitude: item.longitude ?? 121.5362,
      radiusMeters: item.radiusMeters ?? 60,
      unlockDistanceMeters: item.unlockDistanceMeters ?? 400,
    });
    if (item.latitude !== null && item.longitude !== null) {
      map.current?.flyTo({
        center: [item.longitude, item.latitude],
        zoom: 16,
      });
    }
  }

  async function submitQuest(event: FormEvent) {
    event.preventDefault();
    if (!selected || selected.status !== "DRAFT") return;
    setBusy(true);
    setMessage(null);
    try {
      const input: ExplorationQuestInput = {
        routeId: selected.id,
        sequence:
          selected.quests.find((item) => item.id === editingQuestId)?.sequence ??
          selected.quests.length + 1,
        locationName: quest.locationName,
        category: quest.category,
        safetyNote: quest.safetyNote,
        accessibilityTags: quest.accessibilityTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        sourceUrl: quest.sourceUrl || null,
        title: quest.title,
        description: quest.description,
        verificationMode: quest.verificationMode,
        minimumSeconds:
          quest.verificationMode === "TIMER" ? quest.minimumSeconds : null,
        growthPoints: quest.growthPoints,
        triggerType: quest.triggerType,
        latitude: quest.triggerType === "GEOFENCE" ? quest.latitude : null,
        longitude: quest.triggerType === "GEOFENCE" ? quest.longitude : null,
        radiusMeters:
          quest.triggerType === "GEOFENCE" ? quest.radiusMeters : null,
        unlockDistanceMeters:
          quest.triggerType === "DISTANCE"
            ? quest.unlockDistanceMeters
            : null,
      };
      const next = editingQuestId
        ? await api.updateExplorationQuest(editingQuestId, input)
        : await api.createExplorationQuest(input);
      await refreshRoutes(next);
      setQuest(emptyQuest);
      setEditingQuestId(null);
      setMessage(editingQuestId ? "任務點已更新。" : "任務點已加入草稿。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "任務建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function moveQuest(targetId: string) {
    if (!selected || selected.status !== "DRAFT" || !draggingId) return;
    const from = selected.quests.findIndex((item) => item.id === draggingId);
    const to = selected.quests.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const reordered = [...selected.quests];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved!);
    setBusy(true);
    try {
      const next = await api.reorderExplorationQuests(
        selected.id,
        reordered.map((quest) => quest.id),
      );
      await refreshRoutes(next);
    } finally {
      setDraggingId(null);
      setBusy(false);
    }
  }

  async function publish() {
    if (!selected) return;
    setBusy(true);
    try {
      await api.publishExplorationRoute(selected.id);
      await refreshRoutes();
      setMessage("路線已發布；後續修改請建立新版本草稿。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "發布失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace route-workspace" data-view-root>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">MapLibre 任務編輯器</span>
          <h2>城市探索路線</h2>
          <p>點擊地圖設定地標；已發布版本不可直接修改。</p>
        </div>
        <form className="route-create" onSubmit={createRoute}>
          <input
            value={routeName}
            onChange={(event) => setRouteName(event.target.value)}
            placeholder="新路線名稱"
            minLength={2}
            required
          />
          <button className="primary-button" disabled={busy}>
            建立草稿
          </button>
        </form>
      </div>

      <div className="route-tabs">
        {routes.map((route) => (
          <button
            key={route.id}
            className={route.id === selected?.id ? "active" : ""}
            onClick={() => selectRoute(route.id)}
          >
            {route.name}
            <small>{route.status}</small>
          </button>
        ))}
      </div>

      {!selected ? (
        <div className="empty-state">尚未建立城市探索路線。</div>
      ) : (
        <div className="route-editor-grid">
          <div>
            <div className="map-editor" ref={mapContainer} />
            <p className="map-help">
              點擊地圖即可帶入座標。底圖使用 OpenFreeMap，資料來源標示由地圖元件提供。
            </p>
            <div className="quest-sort-list">
              {selected.quests.map((item) => (
                <article
                  key={item.id}
                  draggable={selected.status === "DRAFT"}
                  onDragStart={() => setDraggingId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void moveQuest(item.id)}
                >
                  <b>{item.sequence}</b>
                  <div>
                    <strong>{item.locationName}</strong>
                    <span>
                      {item.triggerType === "GEOFENCE"
                        ? `${item.radiusMeters}m 範圍`
                        : `${item.unlockDistanceMeters}m 距離`}
                      ・{item.title}
                    </span>
                  </div>
                  {selected.status === "DRAFT" ? (
                    <button type="button" onClick={() => editQuest(item)}>
                      編輯
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <form className="quest-form" onSubmit={submitQuest}>
            <h3>
              {selected.status === "DRAFT"
                ? editingQuestId
                  ? "編輯任務點"
                  : "新增任務點"
                : "路線預覽"}
            </h3>
            <label>
              地點名稱
              <input
                value={quest.locationName}
                onChange={(event) =>
                  setQuest({ ...quest, locationName: event.target.value })
                }
                disabled={selected.status !== "DRAFT"}
                required
              />
            </label>
            <label>
              任務標題
              <input
                value={quest.title}
                onChange={(event) =>
                  setQuest({ ...quest, title: event.target.value })
                }
                disabled={selected.status !== "DRAFT"}
                required
              />
            </label>
            <label>
              任務說明
              <textarea
                value={quest.description}
                onChange={(event) =>
                  setQuest({ ...quest, description: event.target.value })
                }
                disabled={selected.status !== "DRAFT"}
                required
              />
            </label>
            <div className="form-pair">
              <label>
                觸發
                <select
                  value={quest.triggerType}
                  onChange={(event) =>
                    setQuest({
                      ...quest,
                      triggerType: event.target.value as
                        | "GEOFENCE"
                        | "DISTANCE",
                    })
                  }
                  disabled={selected.status !== "DRAFT"}
                >
                  <option value="GEOFENCE">地標範圍</option>
                  <option value="DISTANCE">累積距離</option>
                </select>
              </label>
              <label>
                完成方式
                <select
                  value={quest.verificationMode}
                  onChange={(event) =>
                    setQuest({
                      ...quest,
                      verificationMode: event.target.value as
                        | "SELF_CHECK"
                        | "TIMER",
                    })
                  }
                  disabled={selected.status !== "DRAFT"}
                >
                  <option value="SELF_CHECK">自我確認</option>
                  <option value="TIMER">計時</option>
                </select>
              </label>
            </div>
            <div className="form-pair">
              <label>
                {quest.triggerType === "GEOFENCE" ? "半徑（25–150m）" : "距離（m）"}
                <input
                  type="number"
                  value={
                    quest.triggerType === "GEOFENCE"
                      ? quest.radiusMeters
                      : quest.unlockDistanceMeters
                  }
                  onChange={(event) =>
                    setQuest({
                      ...quest,
                      ...(quest.triggerType === "GEOFENCE"
                        ? { radiusMeters: Number(event.target.value) }
                        : { unlockDistanceMeters: Number(event.target.value) }),
                    })
                  }
                  disabled={selected.status !== "DRAFT"}
                />
              </label>
              <label>
                成長值（1–50）
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={quest.growthPoints}
                  onChange={(event) =>
                    setQuest({
                      ...quest,
                      growthPoints: Number(event.target.value),
                    })
                  }
                  disabled={selected.status !== "DRAFT"}
                />
              </label>
            </div>
            {quest.verificationMode === "TIMER" ? (
              <label>
                計時秒數
                <input
                  type="number"
                  min={30}
                  max={3600}
                  value={quest.minimumSeconds}
                  onChange={(event) =>
                    setQuest({
                      ...quest,
                      minimumSeconds: Number(event.target.value),
                    })
                  }
                  disabled={selected.status !== "DRAFT"}
                />
              </label>
            ) : null}
            {quest.triggerType === "GEOFENCE" ? (
              <div className="form-pair">
                <label>
                  緯度
                  <input value={quest.latitude} readOnly />
                </label>
                <label>
                  經度
                  <input value={quest.longitude} readOnly />
                </label>
              </div>
            ) : null}
            <label>
              安全提醒
              <textarea
                value={quest.safetyNote}
                onChange={(event) =>
                  setQuest({ ...quest, safetyNote: event.target.value })
                }
                disabled={selected.status !== "DRAFT"}
              />
            </label>
            <label>
              無障礙標籤（逗號分隔）
              <input
                value={quest.accessibilityTags}
                onChange={(event) =>
                  setQuest({
                    ...quest,
                    accessibilityTags: event.target.value,
                  })
                }
                disabled={selected.status !== "DRAFT"}
              />
            </label>
            {selected.status === "DRAFT" ? (
              <>
                <button className="primary-button" disabled={busy}>
                  {editingQuestId ? "儲存任務點" : "加入任務點"}
                </button>
                {editingQuestId ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingQuestId(null);
                      setQuest(emptyQuest);
                    }}
                  >
                    取消編輯
                  </button>
                ) : null}
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy || selected.quests.length === 0}
                  onClick={() => void publish()}
                >
                  驗證並發布
                </button>
              </>
            ) : (
              <div className="published-panel">
                <b>{selected.badgeName}</b>
                <span>{selected.totalQuestCount} 個任務點</span>
                <button
                  type="button"
                  onClick={() =>
                    void api.simulateExplorationStep(selected.id, 1)
                  }
                >
                  播放受控 Demo 第一步
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const draft = await api.duplicateExplorationRoute(
                      selected.id,
                    );
                    await refreshRoutes([draft, ...routes]);
                    selectRoute(draft.id);
                  }}
                >
                  複製成新版草稿
                </button>
                {selected.status === "PUBLISHED" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.archiveExplorationRoute(selected.id);
                      await refreshRoutes();
                    }}
                  >
                    封存此版本
                  </button>
                ) : null}
              </div>
            )}
            {message ? <p className="form-message">{message}</p> : null}
          </form>
        </div>
      )}
    </section>
  );
}
