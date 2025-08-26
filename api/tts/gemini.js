// api/tts/gemini.js
// Vercel Node API (CommonJS) + dynamic import agar aman di proyek non-ESM.

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Body bisa berupa string (Vercel) atau object
    const raw = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { text, voiceName = "Kore" } = raw;
    const apiKey = req.headers["x-user-api-key"] || process.env.GEMINI_API_KEY;

    if (!apiKey) return jsonErr(res, 500, "GEMINI_API_KEY missing");
    if (!text)  return jsonErr(res, 400, "text required");

    // ✅ dynamic import → tidak bikin crash di proyek tanpa "type":"module"
    let GoogleGenerativeAI;
    try {
      ({ GoogleGenerativeAI } = await import("@google/genai"));
    } catch (e) {
      return jsonErr(res, 500, `@google/genai not found or ESM error: ${e?.message || e}`);
    }

    const ai = new GoogleGenerativeAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });

    // cari bagian audio (inlineData.data)
    const part = response?.candidates?.[0]?.content?.parts?.find(p => p?.inlineData?.data);
    const b64pcm = part?.inlineData?.data;

    if (!b64pcm) {
      // kirim JSON yang bisa dibaca FE (hindari "A server error occurred")
      return jsonErr(res, 502, "No audio data in Gemini response", { raw: response });
    }

    // Bungkus PCM 24k mono → WAV
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
