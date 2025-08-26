// api/tts/gemini.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return jsonErr(res, 405, "Method not allowed");

    const raw  = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const text = raw.text;
    const voiceName = raw.voiceName || "Kore";
    const apiKey = req.headers["x-user-api-key"] || process.env.GEMINI_API_KEY;

    if (!apiKey) return jsonErr(res, 500, "GEMINI_API_KEY missing");
    if (!text)  return jsonErr(res, 400, "text required");

    // ✅ REST payload yang benar untuk TTS
    const payload = {
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        { role: "user", parts: [{ text }] } // penting: sertakan role
      ],
      generationConfig: {                   // penting: gunakan generationConfig (bukan "config")
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } }
        }
      }
    };

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload)
      }
    );

    const txt = await r.text();
    if (!r.ok) return jsonErr(res, r.status, `Gemini API ${r.status}: ${txt}`);

    let data;
    try { data = JSON.parse(txt); } catch { return jsonErr(res, 502, "Invalid JSON from Gemini", { raw: txt }); }

    const cand = data?.candidates?.[0];
    const part = cand?.content?.parts?.find(p => p?.inlineData?.data);
    const b64pcm = part?.inlineData?.data;

    if (!b64pcm) {
      return jsonErr(res, 502, "No audio data in Gemini response", {
        finishReason: cand?.finishReason, safetyRatings: cand?.safetyRatings, raw: data
      });
    }

    const pcm = Buffer.from(b64pcm, "base64");
    const wav = toWavFromPCM16Mono(pcm, 24000);
    const audio_base64 = Buffer.from(wav).toString("base64");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({ audio_base64, mime: "audio/wav" });
  } catch (err) {
    return jsonErr(res, 500, String(err?.message || err));
  }
}

function jsonErr(res, code, message, extra = {}) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(code).json({ error: message, ...extra });
}

function toWavFromPCM16Mono(pcmBuffer, sampleRate = 24000) {
  const numChannels = 1, bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
}
