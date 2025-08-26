// /js/ui.vo.gemini.js
// Client helper to preview audio using your Gemini API endpoint (serverless).

import { buildVOAssets } from "../vo/compile.js";

export async function previewGeminiAPI(result, state = {}, voiceName = "Kore") {
  const { geminiText } = buildVOAssets(result, state);
  const r = await fetch("/api/tts/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: geminiText, voiceName })
  });
  if (!r.ok) throw new Error(await r.text());
  const { audio_base64, mime } = await r.json();
  const audio = new Audio(`data:${mime||"audio/wav"};base64,${audio_base64}`);
  audio.play();
}
