import { buildVOAssets } from '../vo/compile.js';
import { showNotification } from './utils.js';

export async function previewGeminiAPI(result, state = {}, voiceName = 'Kore', opts = {}) {
  const { geminiText } = buildVOAssets(result, state);
  const btn = opts?.button || null;
  // simpan tombol ke global agar bisa direset saat stop
  if (btn) window.__voBusyBtn = btn;

  // guard & loading UI
  if (btn && btn.__busy) return;
  const setBusy = (b) => {
    if (!btn) return;
    btn.__busy = b;
    btn.disabled = b;
    btn.classList.toggle('opacity-50', b);
    btn.textContent = b ? '⏳ Generating...' : '▶️ Preview Gemini (API)';
    showNotification('Generating audio...', 'info')
  };
  setBusy(true);

  try {
    // stop audio sebelumnya
    if (window.__voAudio) { try { window.__voAudio.pause(); } catch(_){} }

    const r = await fetch('/api/tts/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: geminiText, voiceName })
    });
    const bodyText = await r.text();
    if (!r.ok) {
      let msg = bodyText;
      try { const j = JSON.parse(bodyText); msg = j.error || bodyText; } catch {}
      throw new Error(msg);
    }
    const { audio_base64, mime } = JSON.parse(bodyText);
    const audio = new Audio(`data:${mime||'audio/wav'};base64,${audio_base64}`);
    window.__voAudio = audio;
    audio.addEventListener('ended', () => { setBusy(false); window.__voBusyBtn = null; });
    audio.addEventListener('error', () => { setBusy(false); window.__voBusyBtn = null; });
    await audio.play();
    showNotification('Audio generated successfully', 'Playing')
  } catch (e) {
    setBusy(false);
    alert(e.message || e);
  }
}

export function stopGeminiPreview() {
  try {
    if (window.__voAudio) {
      window.__voAudio.pause();
      window.__voAudio.currentTime = 0;
    }
  } catch(_) {}
  const btn = window.__voBusyBtn;
  if (btn) {
    btn.__busy = false;
    btn.disabled = false;
    btn.classList.remove('opacity-50');
    btn.textContent = '▶️ Preview Gemini (API)';
  }
  window.__voBusyBtn = null;
}
