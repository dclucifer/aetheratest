// js/ui.vo.gemini.js
import { buildVOAssets } from '../vo/compile.js';
export async function previewGeminiAPI(result, state = {}, voiceName = 'Kore') {
  const { geminiText } = buildVOAssets(result, state);
  const r = await fetch('/api/tts/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: geminiText, voiceName })
  });
  const bodyText = await r.text();
  if (!r.ok) {
    let msg = bodyText; try { const j = JSON.parse(bodyText); msg = j.error || bodyText; } catch {}
    throw new Error(msg);
  }
  const { audio_base64, mime } = JSON.parse(bodyText);
  new Audio(`data:${mime||'audio/wav'};base64,${audio_base64}`).play();
}
