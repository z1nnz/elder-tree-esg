import type { TaipeiDistrictBoundary } from "./taipei-district-boundaries";

export type TaipeiDistrictName = TaipeiDistrictBoundary["name"];
export type TaipeiMissionMode = "SELF_CHECK" | "TIMER";

export type TaipeiDistrictMission = {
  title: string;
  mode: TaipeiMissionMode;
  points: number;
  status: string;
  heat: string;
  summary: string;
};

export type TaipeiHeatSpot = {
  district: TaipeiDistrictName;
  lift: number;
  scale: number;
  label: string;
  value: number;
};

export const taipeiDistrictMissions: Record<string, TaipeiDistrictMission> = {
  北投區: {
    title: "補水與坡道路線",
    mode: "SELF_CHECK",
    points: 8,
    status: "可發布",
    heat: "#ff3d2e",
    summary: "靠近坡道路線時提醒補水與放慢步調，適合做成安全半徑任務。",
  },
  士林區: {
    title: "花草觀察任務",
    mode: "SELF_CHECK",
    points: 10,
    status: "熱區",
    heat: "#ffb020",
    summary: "在公園或綠帶附近觀察一種植物顏色，完成後生命樹長出新葉。",
  },
  內湖區: {
    title: "湖畔安靜聆聽",
    mode: "TIMER",
    points: 12,
    status: "計時",
    heat: "#fb8500",
    summary: "抵達湖畔或親水空間後停下三分鐘，讓任務變成一段安靜的休息。",
  },
  中山區: {
    title: "街區溫和步行",
    mode: "SELF_CHECK",
    points: 7,
    status: "可接取",
    heat: "#ff6b21",
    summary: "在街區短距離移動後確認身體狀態，不追速度，只確認自己還舒服。",
  },
  大同區: {
    title: "老街慢行觀察",
    mode: "SELF_CHECK",
    points: 6,
    status: "待上架",
    heat: "#ffd166",
    summary: "沿著老街慢慢走，觀察一個今天注意到的小細節。",
  },
  松山區: {
    title: "河濱伸展 3 分鐘",
    mode: "TIMER",
    points: 11,
    status: "計時",
    heat: "#ffbe0b",
    summary: "在河濱安全區停下做溫和伸展，計時完成後才計入成長值。",
  },
  南港區: {
    title: "綠帶呼吸練習",
    mode: "TIMER",
    points: 12,
    status: "熱區",
    heat: "#ffb020",
    summary: "靠近綠帶後進行一段呼吸練習，讓任務雷達像城市裡的提醒燈。",
  },
  中正區: {
    title: "陪伴通話提醒",
    mode: "SELF_CHECK",
    points: 9,
    status: "可接取",
    heat: "#14b8a6",
    summary: "光點提醒你停一下。今天也許只要喝水、看一片葉子，就很好。",
  },
  信義區: {
    title: "安全地標打卡",
    mode: "SELF_CHECK",
    points: 9,
    status: "可接取",
    heat: "#ffb020",
    summary: "在明確地標附近完成自我確認，讓城市探索保留安全邊界。",
  },
  萬華區: {
    title: "市場補水休息",
    mode: "SELF_CHECK",
    points: 7,
    status: "可發布",
    heat: "#ffd166",
    summary: "在市場或街區移動後補水休息，照顧自己也是任務的一部分。",
  },
  大安區: {
    title: "大安森林公園伸展",
    mode: "TIMER",
    points: 12,
    status: "首發",
    heat: "#ef233c",
    summary: "首發路線任務。停下來伸展幾分鐘，完成後生命樹會記得這一步。",
  },
  文山區: {
    title: "步道鳥類觀察",
    mode: "SELF_CHECK",
    points: 10,
    status: "熱區",
    heat: "#fb8500",
    summary: "在步道或公園邊界觀察鳥類，但不餵食，讓探索也保持對環境的尊重。",
  },
};

export const taipeiHeatSpots: TaipeiHeatSpot[] = [
  { district: "北投區", lift: 0.44, scale: 0.66, label: "補水", value: 96 },
  { district: "士林區", lift: 0.48, scale: 0.58, label: "花草", value: 58 },
  { district: "中正區", lift: 0.5, scale: 0.56, label: "陪伴", value: 48 },
  { district: "大安區", lift: 0.58, scale: 0.78, label: "伸展", value: 104 },
  { district: "文山區", lift: 0.5, scale: 0.62, label: "觀鳥", value: 72 },
];

export const taipeiMissionDistricts: TaipeiDistrictName[] = ["中正區", "士林區", "大安區"];

export function getTaipeiDistrictMission(name?: string | null): TaipeiDistrictMission | null {
  if (!name) return null;
  return taipeiDistrictMissions[name] ?? null;
}

export function missionModeLabel(mode: TaipeiMissionMode) {
  return mode === "TIMER" ? "計時任務" : "自我確認";
}

