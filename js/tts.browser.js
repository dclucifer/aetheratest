// /js/tts.browser.js
// Minimal Browser TTS (Web Speech API) for local preview (no external API).

let VOICES = [];
function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  VOICES = window.speechSynthesis.getVoices();
  if (!VOICES.length) {
    window.speechSynthesis.onvoiceschanged = () => {
      VOICES = window.speechSynthesis.getVoices();
    };
  }
}
loadVoices();

export function pickVoice(lang = "id") {
  if (!("speechSynthesis" in window)) return null;
  const code = lang === "en" ? "en-US" : "id-ID";
  const exact = VOICES.find(v => v.lang === code);
  if (exact) return exact;
  const byPrefix = VOICES.find(v => v.lang && v.lang.slice(0,2) === code.slice(0,2));
  return byPrefix || VOICES[0] || null;
}

function pctToRate(pct = "+0%") {
  const n = parseFloat(String(pct).replace("%","")) || 0; // +12% -> 12
  const rate = 1 + (n/100);
  return Math.max(0.5, Math.min(2, rate));
}
function stToPitch(st = "+0st") {
  const n = parseFloat(String(st).replace("st","")) || 0; // semitones
  const pitch = 1 + (n/12);
  return Math.max(0, Math.min(2, pitch));
}

export function speakSequence(lines = [], { lang="id", ratePct="+0%", pitchSt="+0st", voice=null, onend } = {}) {
  if (!("speechSynthesis" in window)) throw new Error("Browser TTS not supported");
  window.speechSynthesis.cancel();
  const v = voice || pickVoice(lang);
  const rate = pctToRate(ratePct);
  const pitch = stToPitch(pitchSt);

  let idx = 0;
  const playNext = () => {
    if (idx >= lines.length) { if (onend) onend(); return; }
    const text = String(lines[idx++] || "").trim();
    if (!text) { playNext(); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (v) u.voice = v;
    u.lang = lang === "en" ? "en-US" : "id-ID";
    u.rate = rate; u.pitch = pitch; u.volume = 1;
    u.onend = playNext; u.onerror = playNext;
    window.speechSynthesis.speak(u);
  };
  playNext();
}

export function cancelSpeak(){
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
