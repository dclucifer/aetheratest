// /api/tts/gemini.js
// Serverless endpoint: Gemini Speech Generation (single-speaker).
// Requires: GEMINI_API_KEY env. Returns base64 WAV (24kHz).

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { text, voiceName = "Kore" } = req.body || {};
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY missing" });
    if (!text) return res.status(400).json({ error: "text required" });

    const { GoogleGenerativeAI } = await import("@google/genai");

    const ai = new GoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

    // Generate audio (PCM 24k) per official docs
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const b64pcm = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64pcm) return res.status(500).json({ error: "No audio data from Gemini" });

    const pcm = Buffer.from(b64pcm, "base64");

    // Wrap raw PCM (s16le, mono, 24kHz) into a WAV container
    const wav = toWavFromPCM16Mono(pcm, 24000);
    const audio_base64 = Buffer.from(wav).toString("base64");
    return res.status(200).json({ audio_base64, mime: "audio/wav" });
  } catch (err) {
    console.error("Gemini TTS error", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

// PCM16 mono -> WAV utility
function toWavFromPCM16Mono(pcmBuffer, sampleRate = 24000) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
}
