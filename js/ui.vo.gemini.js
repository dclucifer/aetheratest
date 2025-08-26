import { buildVOAssets } from '../vo/compile.js';

export async function previewGeminiAPI(result, state = {}, voiceName = 'Kore', opts = {}) {
  const { geminiText } = buildVOAssets(result, state);
  const btn = opts?.button || null;

  // guard & loading UI
  if (btn && btn.__busy) return;
  const setBusy = (b) => {
    if (!btn) return;
    btn.__busy = b;
    btn.disabled = b;
    btn.classList.toggle('opacity-50', b);
    btn.textContent = b ? '⏳ Generating...' : '▶️ Preview Gemini (API)';
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
    audio.addEventListener('ended', () => setBusy(false));
    audio.addEventListener('error', () => setBusy(false));
    await audio.play();
  } catch (e) {
    setBusy(false);
    alert(e.message || e);
  }
}
