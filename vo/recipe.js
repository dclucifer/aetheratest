// /vo/recipe.js
// Platforms: tiktok_video, shopee_video, igreels, threads, shorts
// Each has ID & EN variants. Includes alias normalizer.

export const VO_PRESETS = {
  tiktok_video: {
    id: { rate: "+12%", pitch: "+2st", pauseMs: 220, voiceHint: "energetic, upbeat, Indonesian" },
    en: { rate: "+10%", pitch: "+1st", pauseMs: 220, voiceHint: "energetic, upbeat, American English" }
  },
  shopee_video: {
    id: { rate: "+8%", pitch: "+1st", pauseMs: 260, voiceHint: "clear, friendly promo, Indonesian" },
    en: { rate: "+6%", pitch: "+1st", pauseMs: 260, voiceHint: "clear, friendly promo, English" }
  },
  igreels: {
    id: { rate: "+8%", pitch: "+1st", pauseMs: 240, voiceHint: "aesthetic, calm assertive, Indonesian" },
    en: { rate: "+6%", pitch: "+1st", pauseMs: 240, voiceHint: "aesthetic, calm assertive, English" }
  },
  threads: {
    id: { rate: "+4%", pitch: "+0st", pauseMs: 260, voiceHint: "conversational, friendly, Indonesian" },
    en: { rate: "+4%", pitch: "+0st", pauseMs: 260, voiceHint: "conversational, friendly, English" }
  },
  shorts: {
    id: { rate: "+10%", pitch: "+1st", pauseMs: 220, voiceHint: "punchy, confident, Indonesian" },
    en: { rate: "+10%", pitch: "+1st", pauseMs: 220, voiceHint: "punchy, confident, English" }
  }
};

const ALIASES = {
  "tiktok": "tiktok_video", "tiktok video": "tiktok_video",
  "shopee": "shopee_video", "shopee video": "shopee_video",
  "reels": "igreels", "ig reels": "igreels", "instagram": "igreels",
  "youtube shorts": "shorts", "ytshorts": "shorts", "yt shorts": "shorts", "shorts": "shorts",
  "thread": "threads", "instagram threads": "threads"
};

export function normalizePlatform(p = "tiktok_video") {
  const k = String(p || "").toLowerCase().trim();
  return VO_PRESETS[k] ? k : (ALIASES[k] || "tiktok_video");
}

export function pickVoRecipe(platform = "tiktok_video", lang = "id") {
  const key = normalizePlatform(platform);
  const pack = VO_PRESETS[key] || VO_PRESETS.tiktok_video;
  return (String(lang).toLowerCase() === "en") ? pack.en : pack.id;
}
