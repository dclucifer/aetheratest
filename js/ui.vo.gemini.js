// js/ui.vo.gemini.js
import { buildVOAssets } from '../vo/compile.js';
import { showNotification } from './utils.js';

// singleton <audio> + cache + controller
function getAudioEl() {
  let el = document.getElementById('aethera-vo-audio');
  if (!el) {
    el = document.createElement('audio');
    el.id = 'aethera-vo-audio';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

// cache di memory saja (tidak ke localStorage supaya tidak membengkak)
if (!window.__voCache) window.__voCache = new Map(); // key -> { src, mime, createdAt }
if (!window.__voState) window.__voState = {}; // { busyBtn, playingKey, controller }

function hashKey(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function makeKey(voInput, state) {
  const base = [
    (voInput?.hook || ''), 
    (voInput?.scenes?.[0] || ''), 
    (voInput?.cta || ''),
    (state?.platform || ''), 
    (state?.lang || '')
  ].join('|');
  return 'vo:' + hashKey(base);
}

function setBusy(btn, isBusy) {
  if (!btn) return;
  btn.__busy = isBusy;
  btn.disabled = isBusy;
  btn.classList.toggle('opacity-50', isBusy);
  btn.textContent = isBusy ? '⏳ Generating…' : '▶️ Preview Gemini (API)';
}

export async function previewGeminiAPI(result, state = {}, voiceName = 'Kore', opts = {}) {
  const { geminiText } = buildVOAssets(result, state);
  const btn = opts?.button || null;
  const key = opts?.cacheKey || makeKey(result, state); // gunakan cache per konten

  // kalau sedang generate sebelumnya, cegah double klik
  if (btn && btn.__busy) return;

  // kalau ada yang sedang play → stop dulu
  stopGeminiPreview();

  // cek cache dulu
  const cached = window.__voCache.get(key);
  if (cached?.src) {
    const audio = getAudioEl();
    audio.src = cached.src;
    window.__voState.playingKey = key;

    audio.onended = () => { setBusy(btn, false); window.__voState.busyBtn = null; };
    audio.onerror = () => { setBusy(btn, false); window.__voState.busyBtn = null; };

    try {
      setBusy(btn, true);
      showNotification('Playing cached preview…', 'success');
      await audio.play();
    } catch (e) {
      setBusy(btn, false);
      window.__voState.busyBtn = null;
      showNotification(e.message || 'Failed to play', 'error');
    }
    return;
  }

  // tidak ada cache → generate
  setBusy(btn, true);
  showNotification('Generating audio…', 'info');

  // siapkan AbortController untuk bisa di-stop saat generating
  const controller = new AbortController();
  window.__voState.controller = controller;
  window.__voState.busyBtn = btn;

  try {
    const r = await fetch('/api/tts/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: geminiText, voiceName }),
      signal: controller.signal
    });

    const bodyText = await r.text();
    if (!r.ok) {
      let msg = bodyText;
      try { const j = JSON.parse(bodyText); msg = j.error || bodyText; } catch {}
      throw new Error(msg);
    }

    const { audio_base64, mime } = JSON.parse(bodyText);
    const src = `data:${mime || 'audio/wav'};base64,${audio_base64}`;

    // simpan cache
    window.__voCache.set(key, { src, mime: mime || 'audio/wav', createdAt: Date.now() });

    const audio = getAudioEl();
    audio.src = src;
    window.__voState.playingKey = key;

    audio.onended = () => { setBusy(btn, false); window.__voState.busyBtn = null; };
    audio.onerror = () => { setBusy(btn, false); window.__voState.busyBtn = null; };

    await audio.play();
    showNotification('Playing preview…', 'success');
  } catch (e) {
    // kalau user tekan Stop saat generating → controller.abort()
    if (e?.name === 'AbortError') {
      showNotification('Preview canceled.', 'info');
    } else {
      showNotification(e.message || 'Preview failed', 'error');
      alert(e.message || e);
    }
    setBusy(btn, false);
  } finally {
    window.__voState.controller = null;
    // busyBtn akan direset di onended/onerror/play-catch di atas
  }
}

export function stopGeminiPreview() {
  // hentikan generation jika masih jalan
  try { window.__voState.controller?.abort(); } catch(_) {}

  // hentikan audio yang lagi play
  try {
    const audio = getAudioEl();
    audio.pause();
    // reset posisi & buffer; 'load' akan membatalkan current src playback
    audio.src = '';
    audio.load();
  } catch(_) {}

  // reset state tombol
  const btn = window.__voState.busyBtn;
  if (btn) {
    setBusy(btn, false);
    window.__voState.busyBtn = null;
  }
  window.__voState.playingKey = null;

  showNotification('Preview stopped.', 'info');
}
