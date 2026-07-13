import {
  Bot,
  Building2,
  Camera,
  Cpu,
  Footprints,
  HeartHandshake,
  Leaf,
  MapPinned,
  Radar,
  ShieldCheck,
  Smartphone,
  Sprout,
  Trees,
  Users,
  type LucideIcon,
} from "lucide-react";

export const navItems = [
  { href: "/product", label: "產品" },
  { href: "/explore", label: "城市探索" },
  { href: "/partners", label: "合作" },
  { href: "/impact", label: "理念" },
];

export const brandLines = [
  "追逐一個更願意生活的自己。",
  "讓城市像溫柔的冒險地圖。",
  "一個人也能開始，需要時再讓陪伴靠近。",
  "每一步都不只是紀錄，而是生命樹長出新葉。",
  "照顧自己，也可以成為對世界溫柔的一部分。",
];

export const pageHeroTiles = [
  ["走出去", "從一杯水、一段路、一片葉子開始。"],
  ["慢慢來", "沒有斷簽懲罰，也不用追著排行榜跑。"],
  ["被看見", "需要時，讓可信任的人靠近一點。"],
  ["長成樹", "小小完成，會被記成看得見的風景。"],
];

export const participationPaths = [
  {
    icon: Sprout,
    eyebrow: "自己開始",
    title: "一個人，也能開始",
    body: "不用先綁定任何人。先選一個舒服的任務，讓今天有一個願意出門的理由。",
  },
  {
    icon: Users,
    eyebrow: "親友陪伴",
    title: "想一起，再邀請重要的人",
    body: "家人或朋友可以一起看見生命樹、交換訊息、確認任務；但陪伴不是使用門票。",
  },
  {
    icon: HeartHandshake,
    eyebrow: "可信任網絡",
    title: "沒有家人，也能有人靠近",
    body: "社工、長照單位、協會與審核志工可以成為陪伴網絡，權限清楚，也能撤回。",
  },
];

export const techFlow = [
  { icon: Smartphone, label: "手機", detail: "把任務放進日常，不打擾生活節奏" },
  { icon: MapPinned, label: "城市地圖", detail: "靠近地點才解鎖，不鼓勵危險競速" },
  { icon: Bot, label: "任務判斷", detail: "能自動的先自動，不確定就交給人" },
  { icon: Cpu, label: "實體樹", detail: "把完成感帶回房間、客廳與機構空間" },
  { icon: Building2, label: "營運後台", detail: "讓合作單位看見任務、審核與成果" },
];

export const productFlow = [
  {
    icon: Smartphone,
    step: "01",
    title: "留下名字",
    body: "建立一棵自己的生命樹。關掉 App 再回來，它還在原地等你。",
  },
  {
    icon: MapPinned,
    step: "02",
    title: "走進城市",
    body: "打開探索頁就能看見目前位置。靠近任務會自動解鎖，完成後才會讓生命樹成長。",
  },
  {
    icon: Radar,
    step: "03",
    title: "靠近任務",
    body: "進入安全範圍只代表可以接取；真正完成後，樹才會長出新葉。",
  },
  {
    icon: Footprints,
    step: "04",
    title: "停一下，做完它",
    body: "補水、觀察、伸展、安靜聆聽。任務不催促你變好，只陪你回到生活。",
  },
  {
    icon: Trees,
    step: "05",
    title: "生命樹成長",
    body: "每一次完成都被安全記錄；同一件事不會因為重送而重複加分。",
  },
  {
    icon: Users,
    step: "06",
    title: "讓陪伴靠近",
    body: "家人、志工或合作單位只看必要摘要；LINE 只負責提醒、求助與覆核通知，不取代 App。",
  },
];

export const productHighlights = [
  {
    icon: Radar,
    title: "任務雷達",
    body: "任務像城市裡的光點，靠近才出現。它提醒你停一下，不逼你衝刺。",
  },
  {
    icon: Camera,
    title: "照片 AI 驗證",
    body: "花草與補水任務可以用 App 拍照驗證；不確定時交給家人覆核，不讓系統硬判。",
  },
  {
    icon: Trees,
    title: "生命樹",
    body: "點數不只是數字。它會長成一棵樹，留住你願意照顧自己的證據。",
  },
];

export const radarMissions = [
  {
    icon: Leaf,
    label: "觀察花草",
    distance: "120m",
    time: "剩 18 分",
    points: "+8",
    className: "mission-plant",
  },
  {
    icon: Camera,
    label: "拍下水杯",
    distance: "附近",
    time: "照片服務未開放",
    points: "+6",
    className: "mission-water",
  },
  {
    icon: Footprints,
    label: "溫和步行",
    distance: "400m",
    time: "常駐",
    points: "+10",
    className: "mission-walk",
  },
];

export const impactPrinciples = [
  {
    title: "家人不是門票",
    body: "沒有可綁定的人，也能走路、接任務、照顧一棵自己的樹。",
  },
  {
    title: "不拿焦慮催你",
    body: "沒有斷簽懲罰，也不把身體推進排行榜。今天能做多少，就做多少。",
  },
  {
    title: "永續要能被追溯",
    body: "公益成果和示範數字分開。每一次成長，都要知道從哪裡來。",
  },
];

export const impactJourney = [
  {
    icon: Sprout,
    title: "先照顧自己",
    body: "喝水、散步、看一朵花。小到不需要用力，才可能每天發生。",
  },
  {
    icon: HeartHandshake,
    title: "再讓人靠近",
    body: "需要時邀請家人、志工或社福單位。陪伴是一種選擇，不是限制。",
  },
  {
    icon: Building2,
    title: "讓社區接住",
    body: "合作單位可以發布安全任務，讓散步、關懷與活動留下清楚紀錄。",
  },
  {
    icon: Leaf,
    title: "長成公共成果",
    body: "當許多人的日常被看見，永續就不只是口號，而是一批可追溯的行動。",
  },
];

export const partnerRoles = [
  {
    icon: Building2,
    eyebrow: "社福／長照",
    title: "替需要的人先把關",
    body: "由可信任單位建立陪伴關係，避免陌生人直接碰到敏感資料。",
  },
  {
    icon: Users,
    eyebrow: "志工團體",
    title: "讓關懷有節奏",
    body: "志工可以參與陪伴與任務覆核，但權限要小、關係要能撤回。",
  },
  {
    icon: HeartHandshake,
    eyebrow: "社區組織",
    title: "把地方活動變成一段路",
    body: "社區散步、植物觀察、補水休息，都能變成安全、低壓的任務。",
  },
  {
    icon: Leaf,
    eyebrow: "企業 ESG",
    title: "讓公益回到人身上",
    body: "企業支持可以對應公益批次，但真實成果和展示數字要清楚分開。",
  },
];

export const partnerProcess = [
  "合作洽詢",
  "安全審核",
  "建立任務",
  "陪伴／覆核",
  "成果摘要",
];

export const routeFallbackQuests = [
  {
    locationName: "捷運 5 號出口",
    title: "選擇今日舒適步調",
    verificationMode: "SELF_CHECK",
    growthPoints: 5,
    safetyNote: "先確認身體狀態，不用追求速度。",
  },
  {
    locationName: "百花園／噴水池",
    title: "觀察今日最喜歡的顏色",
    verificationMode: "SELF_CHECK",
    growthPoints: 8,
    safetyNote: "停留在步道邊，不靠近危險水域。",
  },
  {
    locationName: "大生態池",
    title: "安靜聆聽自然 3 分鐘",
    verificationMode: "TIMER",
    growthPoints: 10,
    safetyNote: "保持距離、不餵食、不打擾動物。",
  },
  {
    locationName: "落羽松觀景平台",
    title: "觀察鳥類但不餵食",
    verificationMode: "SELF_CHECK",
    growthPoints: 10,
    safetyNote: "以觀察取代接觸，保留安全距離。",
  },
  {
    locationName: "露天音樂臺",
    title: "進行 5 分鐘溫和伸展",
    verificationMode: "TIMER",
    growthPoints: 12,
    safetyNote: "只做舒服幅度，感到不適就停止。",
  },
];

export const futureFeatures = [
  {
    title: "城市季節任務",
    body: "春天看花、夏天補水、秋天看落葉。任務跟著城市呼吸，而不是跟著壓力跑。",
  },
  {
    title: "生命樹房間",
    body: "App 與實體樹同步，讓完成感像家裡的一盞燈，安靜地亮著。",
  },
  {
    title: "陪伴者安全媒合",
    body: "志工、社工、協會與長照單位審核後加入，陪伴沒有家人可綁定的人。",
  },
  {
    title: "實體樹環境光",
    body: "任務完成後葉片亮起，把數位裡的成長帶回房間、機構與社區空間。",
  },
];

export const proofItems = [
  {
    icon: ShieldCheck,
    title: "權限最小化",
    body: "位置、家庭、任務紀錄分層使用；公益成果與私人資料分開。",
  },
  {
    icon: Radar,
    title: "安全任務池",
    body: "雷達任務先由後台發布，不自動亂生在危險地點。",
  },
  {
    icon: Trees,
    title: "可回到真實世界",
    body: "App 成長值未來能連到實體樹與永續合作批次。",
  },
];

export type IconCard = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export const contactHref = (subject: string) => {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return email
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : "https://github.com/z1nnz/elder-tree-esg";
};

export const formatRemaining = (seconds: number) => {
  if (seconds <= 0) return "已結束";
  const hours = Math.floor(seconds / 3600);
  if (hours >= 72) return "長期開放";
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `剩 ${hours} 小時 ${minutes} 分` : `剩 ${minutes} 分`;
};
