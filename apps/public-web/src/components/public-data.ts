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

export const participationPaths = [
  {
    icon: Sprout,
    eyebrow: "自主模式",
    title: "一個人，也能開始",
    body: "不用先綁定任何人。選擇舒服的任務、探索自己的城市，照顧一棵屬於自己的生命樹。",
  },
  {
    icon: Users,
    eyebrow: "親友模式",
    title: "想一起，就邀請重要的人",
    body: "家人、朋友可以共享家庭樹、交換訊息與互相確認任務，但陪伴從來不是使用資格。",
  },
  {
    icon: HeartHandshake,
    eyebrow: "社區陪伴",
    title: "沒有家人，也有人接得住",
    body: "由社工、長照單位、協會與審核志工建立安全的陪伴關係，權限最小化，也能隨時撤回。",
  },
];

export const techFlow = [
  { icon: Smartphone, label: "手機", detail: "探索、任務與自主選擇" },
  { icon: MapPinned, label: "開源地圖", detail: "距離與地標觸發" },
  { icon: Bot, label: "任務驗證", detail: "低信心交給人判斷" },
  { icon: Cpu, label: "實體樹", detail: "把成長帶進生活空間" },
  { icon: Building2, label: "營運平台", detail: "安全、稽核與機構協作" },
];

export const productHighlights = [
  {
    icon: Radar,
    title: "城市任務雷達",
    body: "把城市變成溫柔版冒險地圖：任務在安全地點附近出現，靠近才解鎖，不鼓勵危險競速。",
  },
  {
    icon: Camera,
    title: "照片任務驗證（未開放）",
    body: "花草、植物、水杯等低風險任務未來可逐步開放；正式開放前，App 不上傳照片也不呼叫 Gemini。",
  },
  {
    icon: Trees,
    title: "家庭樹與實體樹",
    body: "任務不是冷冰冰的點數，而是長成一棵家裡看得到、社區也看得到的樹。",
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
    time: "Blaze 後開放",
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
    title: "不以家庭作門票",
    body: "沒有可綁定對象，仍能使用完整的任務、探索與成長系統。",
  },
  {
    title: "不以焦慮作誘因",
    body: "沒有斷簽懲罰，也不鼓勵超出身體能力的競賽。",
  },
  {
    title: "不把永續當口號",
    body: "模擬與真實成果分開標示，每筆成長都有可追溯來源。",
  },
];

export const futureFeatures = [
  {
    title: "城市季節任務",
    body: "春季賞花、夏季補水、秋季落葉觀察，把任務變成跟城市節氣一起呼吸的活動。",
  },
  {
    title: "生命樹房間",
    body: "App 與實體樹同步顯示每個人的生命樹狀態，讓成果像家裡的一盞燈一樣存在。",
  },
  {
    title: "陪伴者安全媒合",
    body: "志工、社工、協會與長照單位可在審核後陪伴沒有家人可綁定的使用者。",
  },
  {
    title: "實體樹 ambient mode",
    body: "任務完成後實體樹亮起葉片、播放柔和光效，把數位成長帶回生活空間。",
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
