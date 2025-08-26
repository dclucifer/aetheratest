// /vo/compile.js
// Compiles VO assets: SSML (ElevenLabs), Gemini instruction text, read-time estimates.

import { pickVoRecipe } from "./recipe.js";
import { applyPronunciationSSML } from "./dict.js";

export function estimateReadMs(text, lang = "id") {
  const w = (text || "").trim().split(/\s+/).filter(Boolean).length;
  const wpm = lang === "en" ? 180 : 170; // rough average
  return Math.round((w / wpm) * 60000);
}

function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
const br = (ms) => `<break time="${ms}ms"/>`;
const wrap = (s) => `<s>${esc(s)}</s>`;

export function toSSML(result, recipe, lang = "id", opts = {}) {
  const { hook = "", scenes = [], cta = "" } = result || {};
  const pause = recipe.pauseMs ?? 240;

  const body = (scenes || []).map(sc => wrap(Array.isArray(sc) ? sc.join(" ") : (sc || ""))).join(br(pause));

  let ssml = `
<speak>
  <prosody rate="${recipe.rate}" pitch="${recipe.pitch}">
    <emphasis level="strong">${esc(hook)}</emphasis>${br(300)}
    ${body}${br(300)}
    <emphasis level="moderate">${esc(cta)}</emphasis>
  </prosody>
</speak>`.trim();

  if (opts.applyPronDict !== false) ssml = applyPronunciationSSML(ssml, lang);
  return ssml;
}

export function toGeminiText(result, recipe, lang = "id") {
  const { hook = "", scenes = [], cta = "" } = result || {};
  const join = (s) => Array.isArray(s) ? s.join(" ") : String(s || "");
  const langLine = lang === "en" ? "Read in clear American English." : "Bacakan dalam Bahasa Indonesia yang jelas.";
  return [
    `${langLine} Style: ${recipe.voiceHint}. Pace ${recipe.rate}, pitch ${recipe.pitch}. Add natural short pauses between sentences. Emphasize key benefits.`,
    `HOOK: ${hook}`,
    ...(scenes || []).map((sc, i) => `SCENE ${i + 1}: ${join(sc)}`),
    `CTA: ${cta}`
  ].join("\n");
}

export function annotateReadTimes(result, lang = "id") {
  const { scenes = [] } = result || {};
  return (scenes || []).map(sc => {
    const txt = Array.isArray(sc) ? sc.join(" ") : String(sc || "");
    return { text: txt, estMs: estimateReadMs(txt, lang) };
  });
}

export function buildVOAssets(result, state = {}) {
  const lang = (state.lang || "id").toLowerCase() === "en" ? "en" : "id";
  const platform = state.platform || "tiktok_video";
  const recipe = pickVoRecipe(platform, lang);
  const ssml = toSSML(result, recipe, lang, { applyPronDict: true });
  const geminiText = toGeminiText(result, recipe, lang);
  const readTimes = annotateReadTimes(result, lang);
  return { lang, platform, recipe, ssml, geminiText, readTimes };
}
