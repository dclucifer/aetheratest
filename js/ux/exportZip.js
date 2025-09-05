import { t } from '../i18n.js';
import { getScripts } from '../state.js';
import { showNotification, languageState } from '../utils.js';
import { appendVOToZip } from '../export.vo.js';
import { showNotification as notify } from '../utils.js';

async function ensureGeminiImage(){
  // nothing to load client-side; we'll call our backend /api/renderImage
  return true;
}

async function renderImageFromPrompt(prompt, aspect){
  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
  const headers={ 'Content-Type':'application/json' };
  const userApiKey=localStorage.getItem('direktiva_user_api_key');
  if(userApiKey) headers['x-user-api-key']=userApiKey;
  const body = JSON.stringify({ prompt, aspect: aspect||'9:16', model:'gemini-2.5-flash-image-preview' });
  for(let attempt=1; attempt<=3; attempt++){
    try{
      const r=await fetch('/api/renderImage',{ method:'POST', headers, body });
      if(!r.ok){
        const txt = await r.text().catch(()=> '');
        // Try to parse nested JSON string
        let code=null, retrySec=null;
        try{
          const j = JSON.parse(txt||'{}');
          let err = j.error;
          if (typeof err === 'string') { try{ err = JSON.parse(err); }catch(_){} }
          code = err?.error?.code || err?.code || null;
          const details = err?.error?.details || err?.details || [];
          const retry = (details.find(d=>d['@type']?.includes('RetryInfo'))||{}).retryDelay;
          if (typeof retry === 'string' && retry.endsWith('s')) retrySec = parseInt(retry.replace(/s$/,''),10);
        }catch(_){ }
        if (code===429 && attempt<3){
          await sleep(((retrySec||60)*1000) + Math.floor(Math.random()*500));
          continue;
        }
        console.warn('renderImageFromPrompt error response:', txt);
        return null;
      }
      const data=await r.json();
      const b64=(data && data.imageBase64) || '';
      if(!b64) return null;
      const byteStr=atob(b64); const len=byteStr.length; const bytes=new Uint8Array(len);
      for(let i=0;i<len;i++) bytes[i]=byteStr.charCodeAt(i);
      return new Blob([bytes], { type:'image/png' });
    }catch(e){
      if (attempt>=3) { console.warn('renderImageFromPrompt failed', e); return null; }
      await sleep(1500);
    }
  }
  return null;
}

async function ensureJSZip(){
  if (window.JSZip) return window.JSZip;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload=res; s.onerror=rej; document.head.appendChild(s);
  });
  return window.JSZip;
}

function toSafeName(s){
  return String(s||'').trim().replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,64)||'script';
}

function makeSRT(script){
  const lines=(script.body?.text||script.body||'').toString().split('\n').filter(Boolean);
  const dur=2; let t=0,idx=1,out='';
  for (const ln of lines){
    const start=new Date(t*1000).toISOString().substr(11,8)+',000';
    const end=new Date((t+dur)*1000).toISOString().substr(11,8)+',000';
    out+=`${idx}\n${start} --> ${end}\n${ln}\n\n`; t+=dur; idx++;
  }
  return out;
}

function makeCSV(script){
  const lines=(script.body?.text||script.body||'').toString().split('\n').filter(Boolean);
  const dur=2; let t=0,out='start,end,text\n';
  for (const ln of lines){
    const start=(t).toFixed(2); const end=(t+dur).toFixed(2);
    out+=`${start},${end},"${ln.replace(/"/g,'""')}"\n`; t+=dur;
  }
  return out;
}

function makePlatformPack(script){
  const title=script.title||'';
  const hook=(script.hook?.text||script.hook||'').toString();
  const body=(script.body?.text||script.body||'').toString();
  const cta=(script.cta?.text||script.cta||'').toString();
  const hashtags=Array.isArray(script.hashtags)?script.hashtags.join(' '):(script.hashtags||'');
  return `TITLE\n${title}\n\nHOOK\n${hook}\n\nBODY\n${body}\n\nCTA\n${cta}\n\nHASHTAGS\n${hashtags}\n`;
}

async function generateThumbBlob(script){
  const W=1080,H=1920;
  const c=document.createElement('canvas'); c.width=W;c.height=H;
  const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,'#0f172a'); g.addColorStop(1,'#1e293b');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  x.globalAlpha=.5; x.fillStyle='#22d3ee'; x.fillRect(0,H*.72,W,H*.28); x.globalAlpha=1;
  const pad=64, maxW=W-pad*2;
  const hook=(script.hook?.text||script.hook||script.title||'').toString();
  let fs=88; x.fillStyle='#e2e8f0'; x.textBaseline='top';
  x.font=`bold ${fs}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
  function wrap(t){
    const w=t.split(/\s+/); const lines=[]; let line='';
    for (const ww of w){
      const test=line?line+' '+ww:ww;
      if (x.measureText(test).width>maxW){ if(line) lines.push(line); line=ww; } else line=test;
    }
    if(line) lines.push(line); return lines;
  }
  let lines=wrap(hook);
  while(lines.length>10 && fs>44){ fs-=6; x.font=`bold ${fs}px Inter, system-ui, -apple-system, Segoe UI, Roboto`; lines=wrap(hook); }
  const startY=pad; lines.slice(0,10).forEach((ln,i)=>x.fillText(ln,pad,startY+i*(fs*1.2)));
  const cta=(script.cta?.text||script.cta||'').toString();
  if(cta){ x.font=`600 48px Inter, system-ui, -apple-system, Segoe UI, Roboto`; x.fillStyle='#0b1320'; x.fillText(cta.slice(0,70), pad, H*.74); }
  return await new Promise(r=>c.toBlob(r,'image/png'));
}

export async function exportZipForScripts(scripts, includeThumbs){
  const JSZip=await ensureJSZip();
  const zip=new JSZip();

  if(!Array.isArray(scripts)||!scripts.length){
    showNotification(t('notification_no_script_to_download')||'No script to export','warning');
    return;
  }

  const root=zip.folder('aethera_exports');

  // siapkan voState sekali di awal
  const sel = document.getElementById('platform-target');
  const pf = (sel?.value || 'tiktok').toLowerCase();
  const platformMap = { tiktok:'tiktok_video', shopee:'shopee_video', instagram:'igreels', threads:'threads', shorts:'shorts' };
  const voState = {
    platform: platformMap[pf] || 'tiktok_video',
    lang: (languageState?.current === 'en') ? 'en' : 'id',
    vo: { engine: 'gemini', geminiVoice: 'Kore' } // metadata; ElevenLabs tetap NO-API
  };

  for(let i=0;i<scripts.length;i++){
    const s=scripts[i];
    const base=toSafeName(s.title||`script_${i+1}`);
    const sub=root.folder(`${String(i+1).padStart(2,'0')}_${base}`);

    // aset default
    sub.file(`${base}.json`, JSON.stringify(s,null,2));
    sub.file(`${base}.srt`, makeSRT(s));
    sub.file(`${base}.csv`, makeCSV(s));
    sub.file(`${base}_platform_pack.txt`, makePlatformPack(s));

    if(includeThumbs){
      const b=await generateThumbBlob(s);
      if(b) sub.file(`${base}_thumb_1080x1920.png`, b);
    }
    
    const voInput = {
      hook:  s?.hook?.text  || s?.hook  || '',
      scenes:[s?.body?.text  || s?.body  || ''],
      cta:   s?.cta?.text   || s?.cta   || ''
    };

    // === VO export per item ===
    try {
      appendVOToZip(sub, voInput, voState);
    } catch (e) {
      console.warn('appendVOToZip failed:', e);
    }
    // === end VO export ===

    // === IMAGE RENDERS per shot (Gemini 2.5 Flash Image Preview) ===
    try{
      await ensureGeminiImage();
      const allShots=[];
      const pushShots = (partName, part)=>{ if(part && Array.isArray(part.shots)) part.shots.forEach((sh,idx)=> allShots.push({ part:partName, idx, sh })); };
      pushShots('hook', s.hook); pushShots('body', s.body); pushShots('cta', s.cta);
      const aspect = (s?.meta?.aspect)||'9:16';
      for(const item of allShots){
        const prompt = String(item.sh?.text_to_image_prompt||'').trim();
        if(!prompt) continue;
        const blob = await renderImageFromPrompt(prompt, aspect);
        if(blob){
          const fname = `${base}_${item.part}_shot${item.idx+1}.png`;
          sub.file(fname, blob);
        }
        // throttle between requests to respect RPM limits
        await new Promise(r=>setTimeout(r, 1200));
      }
    }catch(e){ console.warn('image render failed:', e); }
    // === end IMAGE RENDERS ===
  }

  const blob=await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`aethera_exports_${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  showNotification(t('zip_export_done') || 'ZIP exported.', 'success');
}

export async function exportAllZip(includeThumbs){
  return exportZipForScripts(getScripts(), includeThumbs);
}

export function initResultsExportToolbar(){
  const btn=document.getElementById('export-all-zip-btn');
  const chk=document.getElementById('include-thumbs');
  if(btn && !btn.__bound){
    btn.__bound=true;
    btn.addEventListener('click', ()=> exportAllZip(!!chk?.checked));
  }
}

// Export only images for a single script (all shots)
export async function exportImagesZipForScript(script){
  const JSZip = await ensureJSZip();
  const zip = new JSZip();
  const root = zip.folder('aethera_images');
  const base = toSafeName(script.title || 'script');
  const sub  = root.folder(base);
  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
  try{
    await ensureGeminiImage();
    const allShots = [];
    const pushShots=(partName, part)=>{ if(part && Array.isArray(part.shots)) part.shots.forEach((sh,idx)=> allShots.push({ part:partName, idx, sh })); };
    pushShots('hook', script.hook); pushShots('body', script.body); pushShots('cta', script.cta);
    const aspect = (script?.meta?.aspect)||'9:16';
    for(const item of allShots){
      const prompt = String(item.sh?.text_to_image_prompt||'').trim();
      if(!prompt) continue;
      const blob = await renderImageFromPrompt(prompt, aspect);
      if(blob){ const fname = `${base}_${item.part}_shot${item.idx+1}.png`; sub.file(fname, blob); }
      // Jeda 30 detik antar-render sesuai instruksi
      await sleep(30000);
    }
  }catch(e){ console.warn('exportImagesZipForScript failed', e); }
  const blob = await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`aethera_images_${Date.now()}.zip`;
  a.click(); URL.revokeObjectURL(a.href);
  showNotification(t('zip_export_done') || 'ZIP exported.', 'success');
}
