
import { t } from '../i18n.js';
import { getScripts } from '../state.js';
import { showNotification, languageState } from '../utils.js';
import { appendVOToZip } from './exportZip.js';
async function ensureJSZip(){ if(window.JSZip) return window.JSZip; await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); return window.JSZip; }
function toSafeName(s){ return String(s||'').trim().replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,64)||'script'; }
function makeSRT(script){ const lines=(script.body?.text||script.body||'').toString().split('\n').filter(Boolean); const dur=2; let t=0,idx=1,out=''; for(const ln of lines){ const start=new Date(t*1000).toISOString().substr(11,8)+',000'; const end=new Date((t+dur)*1000).toISOString().substr(11,8)+',000'; out+=`${idx}\n${start} --> ${end}\n${ln}\n\n`; t+=dur; idx++; } return out; }
function makeCSV(script){ const lines=(script.body?.text||script.body||'').toString().split('\n').filter(Boolean); const dur=2; let t=0,out='start,end,text\n'; for(const ln of lines){ const start=(t).toFixed(2); const end=(t+dur).toFixed(2); out+=`${start},${end},"${ln.replace(/"/g,'""')}"\n`; t+=dur; } return out; }
function makePlatformPack(script){ const title=script.title||''; const hook=(script.hook?.text||script.hook||'').toString(); const body=(script.body?.text||script.body||'').toString(); const cta=(script.cta?.text||script.cta||'').toString(); const hashtags=Array.isArray(script.hashtags)?script.hashtags.join(' '):(script.hashtags||''); return `TITLE\n${title}\n\nHOOK\n${hook}\n\nBODY\n${body}\n\nCTA\n${cta}\n\nHASHTAGS\n${hashtags}\n`; }
async function generateThumbBlob(script){ const W=1080,H=1920; const c=document.createElement('canvas'); c.width=W;c.height=H; const x=c.getContext('2d'); const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,'#0f172a'); g.addColorStop(1,'#1e293b'); x.fillStyle=g; x.fillRect(0,0,W,H); x.globalAlpha=.5; x.fillStyle='#22d3ee'; x.fillRect(0,H*.72,W,H*.28); x.globalAlpha=1; const pad=64, maxW=W-pad*2; const hook=(script.hook?.text||script.hook||script.title||'').toString(); let fs=88; x.fillStyle='#e2e8f0'; x.textBaseline='top'; x.font=`bold ${fs}px Inter, system-ui, -apple-system, Segoe UI, Roboto`; function wrap(t){ const w=t.split(/\s+/); const lines=[]; let line=''; for(const ww of w){ const test=line?line+' '+ww:ww; if(x.measureText(test).width>maxW){ if(line) lines.push(line); line=ww; } else line=test; } if(line) lines.push(line); return lines; } let lines=wrap(hook); while(lines.length>10 && fs>44){ fs-=6; x.font=`bold ${fs}px Inter, system-ui, -apple-system, Segoe UI, Roboto`; lines=wrap(hook); } const startY=pad; lines.slice(0,10).forEach((ln,i)=>x.fillText(ln,pad,startY+i*(fs*1.2))); const cta=(script.cta?.text||script.cta||'').toString(); if(cta){ x.font=`600 48px Inter, system-ui, -apple-system, Segoe UI, Roboto`; x.fillStyle='#0b1320'; x.fillText(cta.slice(0,70), pad, H*.74); } return await new Promise(r=>c.toBlob(r,'image/png')); }
export async function exportZipForScripts(scripts, includeThumbs){ const JSZip=await ensureJSZip(); const zip=new JSZip(); if(!Array.isArray(scripts)||!scripts.length){ showNotification(t('notification_no_script_to_download')||'No script to export','warning'); return; } const root=zip.folder('aethera_exports'); for(let i=0;i<scripts.length;i++){ const s=scripts[i]; const base=toSafeName(s.title||`script_${i+1}`); const sub=root.folder(`${String(i+1).padStart(2,'0')}_${base}`); sub.file(`${base}.json`, JSON.stringify(s,null,2)); sub.file(`${base}.srt`, makeSRT(s)); sub.file(`${base}.csv`, makeCSV(s)); sub.file(`${base}_platform_pack.txt`, makePlatformPack(s)); if(includeThumbs){ const b=await generateThumbBlob(s); if(b) sub.file(`${base}_thumb_1080x1920.png`, b); } } 
// === VO export (Gemini + ElevenLabs NO-API) ===
try {
    const sel = document.getElementById('platform-target');
    const pf = (sel?.value || 'tiktok').toLowerCase();
    const platformMap = {
      tiktok: 'tiktok_video',
      shopee: 'shopee_video',
      instagram: 'igreels',
      threads: 'threads',
      shorts: 'shorts'
    };
  
    const voState = {
      platform: platformMap[pf] || 'tiktok_video',
      lang: (languageState?.current === 'en') ? 'en' : 'id',
      vo: { engine: 'gemini', geminiVoice: 'Kore' } // metadata; ElevenLabs tetap NO-API
    };
  
    // "s" = object script saat ini, "sub" = folder JSZip per-item
    appendVOToZip(sub, s, voState);
  } catch (e) {
    console.warn('appendVOToZip failed:', e);
  }
  // === end VO export ===
  
const blob=await zip.generateAsync({type:'blob'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`aethera_exports_${Date.now()}.zip`; a.click(); URL.revokeObjectURL(a.href); showNotification(t('zip_export_done') || 'ZIP exported.', 'success'); }
export async function exportAllZip(includeThumbs){ return exportZipForScripts(getScripts(), includeThumbs); }
export function initResultsExportToolbar(){ const btn=document.getElementById('export-all-zip-btn'); const chk=document.getElementById('include-thumbs'); if(btn && !btn.__bound){ btn.__bound=true; btn.addEventListener('click', ()=> exportAllZip(!!chk?.checked)); } }
