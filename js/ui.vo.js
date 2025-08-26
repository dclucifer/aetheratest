// /js/ui.vo.js
// UI helpers for VO: build assets, copy, download, preview via Browser TTS.

import { buildVOAssets } from "../vo/compile.js";
import { speakSequence } from "./tts.browser.js";

export function renderVOBlock(result, state = {}) {
  const assets = buildVOAssets(result, state);
  const wrap = (label, content) => `\n\n=== ${label} ===\n${content}`;

  const textBlock = [
    `VOICE RECIPE: ${assets.recipe.voiceHint} (rate ${assets.recipe.rate}, pitch ${assets.recipe.pitch}, pause ${assets.recipe.pauseMs}ms)`,
    `LANG: ${assets.lang.toUpperCase()} | PLATFORM: ${assets.platform}`,
    wrap("GEMINI VO INSTRUCTIONS", assets.geminiText),
    wrap("ELEVENLABS SSML", assets.ssml),
    wrap("READ ESTIMATES", assets.readTimes.map((r, i) => `Scene ${i + 1}: ${(r.estMs / 1000).toFixed(1)}s`).join("\n"))
  ].join("\n");

  return { textBlock, ...assets };
}

export async function copyVOBlock(result, state = {}) {
  const { textBlock } = renderVOBlock(result, state);
  await navigator.clipboard.writeText(textBlock);
  return true;
}

export async function copyGeminiText(result, state={}){
  const { geminiText } = buildVOAssets(result, state);
  await navigator.clipboard.writeText(geminiText);
}

export async function copyElevenSSML(result, state={}){
  const { ssml } = buildVOAssets(result, state);
  await navigator.clipboard.writeText(ssml);
}

export function downloadText(name, content){
  const blob = new Blob([content], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

export function downloadVOFiles(result, state={}){
  const { ssml, geminiText, lang, platform } = buildVOAssets(result, state);
  downloadText(`vo_${platform}_${lang}.ssml`, ssml);
  downloadText(`vo_${platform}_${lang}_gemini.txt`, geminiText);
}

export function previewBrowserTTS(result, state = {}) {
  const { ssml, recipe, lang } = buildVOAssets(result, state);
  const lines = [];
  if (result.hook) lines.push(result.hook);
  if (Array.isArray(result.scenes)) {
    result.scenes.forEach(sc => lines.push(Array.isArray(sc) ? sc.join(" ") : String(sc||"")));
  } else if (result.body) { lines.push(result.body); }
  if (result.cta) lines.push(result.cta);
  if (!lines.length) {
    const plain = ssml.replace(new RegExp("<[^>]+>", "g"), " ")
                      .replace(/\&lt;/g,"<").replace(/\&gt;/g,">").replace(/\&amp;/g,"&")
                      .split(" ").filter(Boolean).join(" ");
    lines.push(plain);
  }
  speakSequence(lines, { lang, ratePct: recipe.rate, pitchSt: recipe.pitch });
}
