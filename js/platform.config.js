// js/platform.config.js
// Centralized, platform-aware configuration and plan builder with contentMode support.

export const PLATFORM_CONFIG = {
  tiktok: {
    aspect: "9:16",
    maxDuration: 23,
    cutsEverySec: 0.8,
    retentionHooksEvery: 4,
    beatMap: [
      { t: 0,  action: "HOOK_PATTERN_INTERRUPT", textMaxWords: 6 },
      { t: 3,  action: "PROOF/DEMO_QUICK" },
      { t: 7,  action: "BENEFIT_1 + ON-SCREEN CAPTION" },
      { t: 12, action: "BENEFIT_2 + B-ROLL" },
      { t: 18, action: "MICRO_LOOP_SETUP" },
      { t: 21, action: "CTA_SUPER_SHORT" }
    ],
    caption: { maxChars: 150, hashtagPolicy: { total: 3, mix: ["2 broad", "1 niche"] } },
    audio: { useTrending: true, fallback: "original" },
    cta: { style: "ultra-short", placement: "t=21-23" },
    commentBait: ["Mau versi murahnya? ketik 'MURAH'"]
  },
  shopee: {
    aspect: "9:16",
    maxDuration: 35,
    scriptMode: "DTC_SHORT + LIVE_MACROS",
    blocks: ["ANCHOR_PRICE","USP_TRIPLE","TRUST_PROOF","URGENCY_TIMER","CTA_VOUCHER"],
    objections: ["kualitas","kecepatan kirim","COD","garansi"],
    liveMacros: ["Tanya warna: 'Hitam/Putih?'", "Ketik 'BELI' untuk voucher"],
    cta: { copyID: "CTA_SHOPEE_BUY_NOW", mentions: ["Voucher","Gratis Ongkir","COD"] },
    deepLink: true
  },
  instagram: {
    targets: ["reels","carousel","story"],
    reels: {
      aspect: "9:16",
      maxDuration: 29,
      aestheticsFirst: true,
      safeZones: ["avoid bottom 15% for UI"],
      caption: { mode: "save/share oriented", includes: ["line breaks","1 question"] },
      coverFrame: "auto-pick best frame at t≈0.5s",
      cta: { goal: "SAVE+SHARE", copy: "Save this for later" }
    },
    carousel: {
      slides: 7,
      structure: ["Slide1 HOOK big text","Slide2-6 value bites","Slide7 CTA save/share"],
      fontMaxWordsPerSlide: 12
    }
  },
  threads: {
    threadLen: { min: 3, max: 7 },
    tone: "conversational",
    ending: "open_question",
    media: { allowImage: true, clipUnder10s: true },
    caption: { skimmable: true, lineBreaks: true }
  },
  shorts: {
    aspect: "9:16",
    maxDuration: 58,
    pacing: "fast",
    retentionHooksEvery: 4,
    cta: { placement: "last 2s", copy: "Subscribe for the next tip" },
    commentsPinTemplate: "Link & resources in the pinned comment"
  }
};

/**
 * Build human-readable notes and machine-usable plan.
 * @param {string} platform
 * @param {string} lang - "id" | "en"
 * @param {string} contentMode - "post" | "carousel"
 */
export function buildPlatformPlan(platform, lang="id", contentMode="post") {
  const root = PLATFORM_CONFIG[platform];
  if (!root) return { promptNotes:"", beats:[], cta:{}, commentBait:[], meta:{}, cfg:{} };

  const isCarousel = contentMode === "carousel";

  // Choose effective sub-config (IG special-cased)
  let cfg = root;
  if (platform === "instagram") {
    cfg = isCarousel ? (root.carousel || root) : (root.reels || root);
  }

  const isEn = lang === "en";
  const lines = [];
  if (!isCarousel) {
    if (cfg.aspect) lines.push(`${isEn ? "Aspect" : "Rasio"}: ${cfg.aspect}`);
    if (cfg.maxDuration) lines.push(`${isEn ? "Target duration" : "Durasi target"} ≤ ${cfg.maxDuration}s`);
    if (cfg.pacing) lines.push(`${isEn ? "Pacing" : "Tempo"}: ${cfg.pacing}`);
    if (cfg.cutsEverySec) lines.push(`${isEn ? "Cut cadence" : "Frekuensi cut"} ≈ ${cfg.cutsEverySec} cut/s`);
    if (cfg.safeZones) lines.push(`${isEn ? "Safe-zones" : "Area aman"}: ${Array.isArray(cfg.safeZones) ? cfg.safeZones.join(", ") : cfg.safeZones}`);
    if (cfg.caption?.mode) lines.push(`${isEn ? "Caption" : "Caption"}: ${cfg.caption.mode}`);
    if (cfg.retentionHooksEvery) lines.push(`${isEn ? "Retention hook every" : "Hook retensi tiap"} ${cfg.retentionHooksEvery}s`);
  } else {
    const slides = cfg.slides || 7;
    lines.push(`${isEn ? "Slides" : "Jumlah slide"}: ${slides}`);
    if (cfg.fontMaxWordsPerSlide) lines.push(`${isEn ? "Max words/slide" : "Maks kata/slide"}: ${cfg.fontMaxWordsPerSlide}`);
    if (cfg.structure) lines.push(`${isEn ? "Structure" : "Struktur"}: ${cfg.structure.join(" → ")}`);
  }

  const promptNotes = lines.length ? `\n- ${lines.join("\n- ")}` : "";
  const beats = isCarousel ? [] : (cfg.beatMap || cfg.blocks || []);
  const cta = cfg.cta || {};
  const commentBait = cfg.commentBait || [];
  const meta = isCarousel
    ? { slides: (cfg.slides || 7), fontMaxWordsPerSlide: cfg.fontMaxWordsPerSlide || 12 }
    : { hashtags: cfg.caption?.hashtagPolicy || null, audio: cfg.audio || null, deepLink: cfg.deepLink || false, coverFrame: cfg.coverFrame || null };

  return { promptNotes, beats, cta, commentBait, meta, cfg };
}