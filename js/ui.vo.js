// /js/ui.vo.js
// UI helpers for VO: build assets, copy, download, preview via Browser TTS.

import { buildVOAssets } from "../vo/compile.js";
import { speakSequence } from "./tts.browser.js";

async function ensureJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  return window.JSZip;
}

function makePreviewHTML(geminiTextDefault) {
  // NOTE: file ini bekerja sempurna bila dihosting di domain app-mu (agar /api/tts/gemini bisa diakses).
  // Jika dibuka dari file://, fetch ke /api/tts/gemini akan diblok CORS/browser.
  return `<!doctype html>
<html lang="en"><meta charset="utf-8">
<title>VO Preview (Gemini)</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,Segoe UI,Roboto,Inter,Arial;padding:16px;background:#0b1220;color:#e5e7eb}
  .row{display:flex;gap:8px;align-items:center;margin:8px 0}
  textarea{width:100%;height:200px;background:#0f1629;color:#e5e7eb;border:1px solid #23314d;border-radius:8px;padding:10px}
  select,button{padding:8px 12px;border-radius:8px;border:1px solid #23314d;background:#111a2e;color:#e5e7eb;cursor:pointer}
  button[disabled]{opacity:.6;cursor:not-allowed}
  .hint{color:#9aa4b2;font-size:12px}
</style>
<h2>VO Preview (Gemini)</h2>
<div class="row">
  <label>Voice:</label>
  <select id="voice">
    <option value="Kore" selected>Kore</option>
    <option value="Puck">Puck</option>
  </select>
</div>
<textarea id="text"></textarea>
<div class="row">
  <button id="play">▶️ Preview Gemini</button>
  <span id="status" class="hint"></span>
</div>
<script>
  const ta = document.getElementById('text');
  ta.value = ${JSON.stringify(geminiTextDefault || '')};
  const btn = document.getElementById('play');
  const status = document.getElementById('status');
  let audioRef = null, busy = false;
  async function play() {
    if (busy) return;
    busy = true; btn.disabled = true; status.textContent = 'Generating audio...';
    try {
      if (audioRef) { try{ audioRef.pause(); }catch(e){} }
      const voiceName = document.getElementById('voice').value || 'Kore';
      const r = await fetch('/api/tts/gemini', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text: ta.value, voiceName })
      });
      const txt = await r.text();
      if (!r.ok) { let msg = txt; try{ const j=JSON.parse(txt); msg=j.error||txt; }catch{} throw new Error(msg); }
      const { audio_base64, mime } = JSON.parse(txt);
      audioRef = new Audio(\`data:\${mime||'audio/wav'};base64,\${audio_base64}\`);
      audioRef.onended = ()=>{ busy=false; btn.disabled=false; status.textContent=''; };
      audioRef.onerror = ()=>{ busy=false; btn.disabled=false; status.textContent='(audio error)'; };
      audioRef.play().then(()=>{ status.textContent='Playing...'; });
    } catch(e) {
      status.textContent = e.message || String(e);
      busy=false; btn.disabled=false;
    }
  }
  btn.addEventListener('click', play);
</script>
</html>`;
}

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

export async function downloadVOFiles(result, state={}){
  const { ssml, geminiText, lang, platform } = buildVOAssets(result, state);
  const JSZip = await ensureJSZip();
  const zip = new JSZip();
  const folder = zip.folder(`VO/${platform}_${lang}`);
  folder.file(`vo_${platform}_${lang}_gemini.txt`, geminiText);
  folder.file(`vo_${platform}_${lang}.ssml`, ssml);
  folder.file(`vo_preview_gemini.html`, makePreviewHTML(geminiText));
  const blob = await zip.generateAsync({ type:'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vo_${platform}_${lang}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
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
