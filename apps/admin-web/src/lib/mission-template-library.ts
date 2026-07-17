export type RadarMissionTemplate = {
  name: string;
  city: string;
  safetyNote: string;
  title: string;
  description: string;
  category: string;
  tag: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
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
};

export type PhotoAiTaskIdea = {
  title: string;
  category: string;
  expectedLabels: string[];
  description: string;
  safetyNote: string;
  companionReply: string;
};

const selfCareTemplates = {
  hydration: {
    elderMessage: "你完成了「{title}」。有記得喝水，就是把身體放在心上。",
    companionReply:
      "可以回覆：『今天有記得補水，很棒。晚點出門也可以帶一瓶水。』",
    volunteerNote:
      "先肯定補水這個具體行動；若要延伸，只提醒下次出門帶水，不追問感受。",
    shareSummary: "完成「{title}」，生命樹長出新葉 +{growthPoints}。",
  },
  breathing: {
    elderMessage: "你完成了「{title}」。願意慢下來，是照顧自己的開始。",
    companionReply:
      "可以回覆：『看到你完成慢呼吸了，願意停一下也很不錯。』",
    volunteerNote:
      "先回應已完成的慢呼吸行動；若要邀約，下次可一起找安全座位練習。",
    shareSummary: "完成「{title}」，生命樹長出新葉 +{growthPoints}。",
  },
  nature: {
    elderMessage: "你完成了「{title}」。今天有看見自然，也把自己帶回生活裡。",
    companionReply:
      "可以回覆：『看到你今天有出去看看植物，很好。下次也可以慢慢走，不用趕。』",
    volunteerNote:
      "先肯定外出與觀察；不要要求長者回報太多細節，保持輕鬆接續。",
    shareSummary: "完成「{title}」，生命樹長出新葉 +{growthPoints}。",
  },
  stretch: {
    elderMessage: "你完成了「{title}」。溫和伸展一下，身體會記得這份照顧。",
    companionReply:
      "可以回覆：『今天有做溫和伸展，很棒。舒服就好，不用勉強。』",
    volunteerNote:
      "提醒以安全與舒服為主；若有不適，請停止並休息。",
    shareSummary: "完成「{title}」，生命樹長出新葉 +{growthPoints}。",
  },
};

export const taipeiValidationTemplates: RadarMissionTemplate[] = [
  {
    name: "中正紀念堂補水確認",
    city: "台北",
    safetyNote: "大型開放廣場，仍需避開車道與施工區。",
    title: "中正紀念堂廣場補水確認",
    description: "走到廣場附近，停下來喝水並確認今天身體狀態。",
    category: "HYDRATION",
    tag: "補水",
    latitude: 25.03461,
    longitude: 121.52187,
    radiusMeters: 120,
    verificationMode: "SELF_CHECK",
    minimumSeconds: 180,
    growthPoints: 6,
    badgeName: "城市補水者",
    companionPromptTemplates: selfCareTemplates.hydration,
  },
  {
    name: "二二八公園慢呼吸",
    city: "台北",
    safetyNote: "公園公共空間，請找明亮、可停留且不阻礙行人的位置。",
    title: "二二八公園三分鐘慢呼吸",
    description: "找安全的位置，安靜慢呼吸三分鐘，再讓生命樹長出新葉。",
    category: "WELLNESS",
    tag: "慢呼吸",
    latitude: 25.04236,
    longitude: 121.51542,
    radiusMeters: 120,
    verificationMode: "TIMER",
    minimumSeconds: 180,
    growthPoints: 10,
    badgeName: "慢呼吸同行者",
    companionPromptTemplates: selfCareTemplates.breathing,
  },
  {
    name: "大安森林公園伸展",
    city: "台北",
    safetyNote: "選擇寬敞步道旁或草地邊緣，不在自行車道與路口停留。",
    title: "大安森林公園溫和伸展",
    description: "在安全寬敞的位置做五分鐘溫和伸展，舒服就好，不需要勉強。",
    category: "WELLNESS",
    tag: "伸展",
    latitude: 25.03297,
    longitude: 121.53595,
    radiusMeters: 130,
    verificationMode: "TIMER",
    minimumSeconds: 300,
    growthPoints: 12,
    badgeName: "綠蔭伸展者",
    companionPromptTemplates: selfCareTemplates.stretch,
  },
];

export const taiwanSafeMissionTemplates: RadarMissionTemplate[] = [
  ...taipeiValidationTemplates,
  {
    name: "新北大都會公園看天色",
    city: "新北",
    safetyNote: "河濱公園空間大，但請避開自行車快速通行區。",
    title: "新北大都會公園看天色",
    description: "在安全位置停下來，看一分鐘天空與雲，確認自己今天的步調。",
    category: "NATURE",
    tag: "天空",
    latitude: 25.05284,
    longitude: 121.47527,
    radiusMeters: 140,
    verificationMode: "SELF_CHECK",
    minimumSeconds: 180,
    growthPoints: 7,
    badgeName: "看見天空的人",
    companionPromptTemplates: selfCareTemplates.nature,
  },
  {
    name: "台中草悟道慢走",
    city: "台中",
    safetyNote: "以人行道與綠廊為主，過馬路時不操作手機。",
    title: "草悟道十分鐘慢走",
    description: "沿著草悟道用舒服速度慢走，途中不用趕，只要留意身體感覺。",
    category: "WELLNESS",
    tag: "慢走",
    latitude: 24.15104,
    longitude: 120.66331,
    radiusMeters: 130,
    verificationMode: "TIMER",
    minimumSeconds: 600,
    growthPoints: 14,
    badgeName: "城市慢走者",
    companionPromptTemplates: selfCareTemplates.breathing,
  },
  {
    name: "台南河樂廣場補水",
    city: "台南",
    safetyNote: "廣場階梯與水域邊緣要留意腳步，不靠近濕滑處。",
    title: "河樂廣場補水休息",
    description: "在廣場附近找安全座位，喝水並休息一下，再繼續今天的行程。",
    category: "HYDRATION",
    tag: "補水",
    latitude: 22.99423,
    longitude: 120.19511,
    radiusMeters: 110,
    verificationMode: "SELF_CHECK",
    minimumSeconds: 180,
    growthPoints: 7,
    badgeName: "南城補水者",
    companionPromptTemplates: selfCareTemplates.hydration,
  },
  {
    name: "高雄中央公園樹影觀察",
    city: "高雄",
    safetyNote: "公園內請選擇明亮步道，不進入草叢深處或偏僻角落。",
    title: "中央公園樹影觀察",
    description: "找一棵附近的樹，觀察葉子或樹影一分鐘，不採摘植物。",
    category: "NATURE",
    tag: "樹影",
    latitude: 22.62371,
    longitude: 120.30186,
    radiusMeters: 120,
    verificationMode: "SELF_CHECK",
    minimumSeconds: 180,
    growthPoints: 9,
    badgeName: "樹影觀察者",
    companionPromptTemplates: selfCareTemplates.nature,
  },
  {
    name: "花蓮文創園區散步",
    city: "花蓮",
    safetyNote: "園區平面空間較好行走，仍需注意階梯與活動人潮。",
    title: "花蓮文創園區舒服散步",
    description: "在園區內慢慢走三分鐘，看看建築或植物，找回今天的節奏。",
    category: "WELLNESS",
    tag: "散步",
    latitude: 23.97503,
    longitude: 121.60445,
    radiusMeters: 120,
    verificationMode: "TIMER",
    minimumSeconds: 180,
    growthPoints: 10,
    badgeName: "花蓮慢行者",
    companionPromptTemplates: selfCareTemplates.breathing,
  },
  {
    name: "台東森林公園自然聆聽",
    city: "台東",
    safetyNote: "選擇主要步道與入口附近，避免獨自前往偏遠路段。",
    title: "台東森林公園自然聆聽",
    description: "停下來聽三分鐘自然聲音，若覺得太熱或不舒服就先休息。",
    category: "NATURE",
    tag: "聆聽",
    latitude: 22.76086,
    longitude: 121.15841,
    radiusMeters: 140,
    verificationMode: "TIMER",
    minimumSeconds: 180,
    growthPoints: 10,
    badgeName: "自然聆聽者",
    companionPromptTemplates: selfCareTemplates.nature,
  },
  {
    name: "澎湖觀音亭海風休息",
    city: "澎湖",
    safetyNote: "海邊風大，請遠離濕滑岸邊與低矮護欄。",
    title: "觀音亭海風補水休息",
    description: "在安全處停下來喝水，看一眼海面或天空，讓身體休息一下。",
    category: "HYDRATION",
    tag: "海風",
    latitude: 23.5661,
    longitude: 119.5636,
    radiusMeters: 100,
    verificationMode: "SELF_CHECK",
    minimumSeconds: 180,
    growthPoints: 8,
    badgeName: "海風補水者",
    companionPromptTemplates: selfCareTemplates.hydration,
  },
];

export const photoAiTaskIdeas: PhotoAiTaskIdea[] = [
  {
    title: "拍一片今天看到的葉子",
    category: "PLANT",
    expectedLabels: ["leaf", "plant", "tree", "grass"],
    description:
      "適合一般 PHOTO_AI 任務。只辨識植物或葉片，不要求拍人、不辨識身分。",
    safetyNote: "不得採摘植物；拍攝時站在步道或安全空間。",
    companionReply:
      "可以回覆：『看到你今天有留意到一片葉子，這樣慢慢觀察也很好。』",
  },
  {
    title: "拍一朵花或一株草",
    category: "PLANT",
    expectedLabels: ["flower", "plant", "grass"],
    description:
      "適合公園、校園、社區花圃；Gemini 只需確認畫面中有花草植物。",
    safetyNote: "不靠近車道、不跨越圍欄、不進入私人花圃。",
    companionReply:
      "可以回覆：『那朵花看起來是今天的小發現，謝謝你把它留下來。』",
  },
  {
    title: "拍自己的水瓶或杯子",
    category: "HYDRATION",
    expectedLabels: ["water bottle", "bottle", "cup", "glass", "drink"],
    description:
      "用來驗證補水任務。只確認水瓶、杯子或飲品容器，不判斷喝了多少。",
    safetyNote: "拍完再喝水，不邊走邊操作手機。",
    companionReply:
      "可以回覆：『有記得帶水很好，今天走路慢慢來就好。』",
  },
  {
    title: "拍一張安全座椅或休息點",
    category: "REST",
    expectedLabels: ["bench", "chair", "seat", "park"],
    description:
      "用於鼓勵長者找到能坐下的地方；低信心時交給家人或陪伴者覆核。",
    safetyNote: "不拍陌生人正面，不拍車牌或住家門牌。",
    companionReply:
      "可以回覆：『找到能坐下來休息的地方很好，累了就先坐一下。』",
  },
];
