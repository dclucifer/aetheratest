import { buildVOAssets } from '../vo/compile.js';

function makePreviewHTML(geminiTextDefault) {
  return `<!doctype html><meta charset="utf-8"><title>VO Preview (Gemini)</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,Inter,Arial;padding:16px;background:#0b1220;color:#e5e7eb}
.row{display:flex;gap:8px;align-items:center;margin:8px 0}
textarea{width:100%;height:200px;background:#0f1629;color:#e5e7eb;border:1px solid #23314d;border-radius:8px;padding:10px}
select,button{padding:8px 12px;border-radius:8px;border:1px solid #23314d;background:#111a2e;color:#e5e7eb;cursor:pointer}
button[disabled]{opacity:.6;cursor:not-allowed}.hint{color:#9aa4b2;font-size:12px}</style>
<h2>VO Preview (Gemini)</h2>
<div class="row"><label>Voice:</label><select id="voice"><option value="Kore" selected>Kore</option><option value="Puck">Puck</option></select></div>
<textarea id="text"></textarea>
<div class="row"><button id="play">▶️ Preview Gemini</button><span id="status" class="hint"></span></div>
<script>
  const ta=document.getElementById('text'); ta.value=${JSON.stringify(geminiTextDefault||'')};
  const btn=document.getElementById('play'); const status=document.getElementById('status');
  let busy=false, audioRef=null;
  btn.onclick=async()=>{ if(busy) return; busy=true; btn.disabled=true; status.textContent='Generating audio...';
    try{
      if(audioRef){ try{ audioRef.pause(); }catch(e){} }
      const voice=document.getElementById('voice').value || 'Kore';
      const r=await fetch('/api/tts/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:ta.value,voiceName:voice})});
      const txt=await r.text(); if(!r.ok){ let m=txt; try{const j=JSON.parse(txt); m=j.error||txt;}catch{} throw new Error(m); }
      const {audio_base64,mime}=JSON.parse(txt);
      audioRef=new Audio('data:'+(mime||'audio/wav')+';base64,'+audio_base64);
      audioRef.onended=()=>{busy=false;btn.disabled=false;status.textContent='';};
      audioRef.onerror=()=>{busy=false;btn.disabled=false;status.textContent='(audio error)';};
      await audioRef.play(); status.textContent='Playing...';
    }catch(e){ status.textContent = e.message||String(e); busy=false; btn.disabled=false; }
  };
</script>`;
}

export function appendVOToZip(zipOrFolder, result, state = {}, opts = {}) {
  const { ssml, geminiText, lang, platform, recipe, readTimes } = buildVOAssets(result, state);
  const meta = {
    lang, platform,
    engine: state?.vo?.engine || 'gemini',
    geminiVoice: state?.vo?.geminiVoice || 'Kore',
    elevenVoice: state?.vo?.elevenVoice || '',
    recipe, readTimes
  };
  const base = opts.base || `VO/${platform}_${lang}`;
  const add = (name, content) => {
    if (typeof zipOrFolder.folder === 'function' && !name.includes('/')) zipOrFolder.file(name, content);
    else zipOrFolder.file(`${base}/${name}`, content);
  };
  add(`vo_${platform}_${lang}.ssml`, ssml);
  add(`vo_${platform}_${lang}_gemini.txt`, geminiText);
  add(`vo_meta_${platform}_${lang}.json`, JSON.stringify(meta, null, 2));
  // NEW: HTML preview ikut ke ZIP
  add(`vo_preview_gemini.html`, makePreviewHTML(geminiText));
}
