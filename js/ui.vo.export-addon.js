// /js/ui.vo.export-addon.js
// Adds export/preview buttons for VO.
// - Gemini: API preview via /api/tts/gemini
// - ElevenLabs: NO-API (SSML copy/download only)

import { copyVOBlock, copyGeminiText, copyElevenSSML, downloadVOFiles, previewBrowserTTS } from "./ui.vo.js";
import { previewGeminiAPI } from "./ui.vo.gemini.js";

export function mountVOExportButtons({ container, getState, getWinnerResult, options = {} }) {
  const makeBtn = (label, cls="btn") => { const b = document.createElement("button"); b.className = cls; b.textContent = label; return b; };

  const btnCopyVO   = makeBtn("Copy VO (SSML + Gemini)", "btn");
  const btnCopyGem  = makeBtn("Copy Gemini Text", "btn ghost");
  const btnCopySSML = makeBtn("Copy ElevenLabs SSML", "btn ghost");
  const btnDlVO     = makeBtn("Download VO Files", "btn ghost");
  const btnPrevLoc  = makeBtn("Preview (Browser TTS)", "btn ghost");
  const btnPrevGem  = options.useGeminiApi === false ? null : makeBtn("Preview Gemini (API)", "btn ghost");

  const getR = () => { const s=getState(); const r=getWinnerResult(); if(!r){ alert("Belum ada hasil."); return null; } return { s, r }; };

  btnCopyVO.addEventListener("click", async ()=>{ const o=getR(); if(!o) return; await copyVOBlock(o.r,o.s); if (window.toast) toast("VO copied"); });
  btnCopyGem.addEventListener("click", async ()=>{ const o=getR(); if(!o) return; await copyGeminiText(o.r,o.s); if (window.toast) toast("Gemini text copied"); });
  btnCopySSML.addEventListener("click", async ()=>{ const o=getR(); if(!o) return; await copyElevenSSML(o.r,o.s); if (window.toast) toast("SSML copied"); });
  btnDlVO.addEventListener("click", ()=>{ const o=getR(); if(!o) return; downloadVOFiles(o.r,o.s); });
  btnPrevLoc.addEventListener("click", ()=>{ const o=getR(); if(!o) return; previewBrowserTTS(o.r,o.s); });
  if (btnPrevGem) btnPrevGem.addEventListener("click", ()=>{ const o=getR(); if(!o) return; previewGeminiAPI(o.r,o.s, options.geminiVoice || "Kore").catch(e=>alert(e.message)); });

  container.append(btnCopyVO, btnCopyGem, btnCopySSML, btnDlVO, btnPrevLoc);
  if (btnPrevGem) container.append(btnPrevGem);
}
