// api/tts/gemini.js
// Node serverless on Vercel (Pages Functions style)
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const raw = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { text, voiceName = 'Kore' } = raw;
    const apiKey = req.headers['x-user-api-key'] || process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });
    if (!text)  return res.status(400).json({ error: 'text required' });

    // Payload persis seperti dokumentasi resmi (REST)
    const payload = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } }
        }
      },
      model: 'gemini-2.5-flash-preview-tts'
    };

    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      }
    );

    const textBody = await r.text();
    if (!r.ok) {
      // lempar detail ke client supaya kelihatan di console
      return res.status(r.status).json({ error: `Gemini API ${r.status}: ${textBody}` });
    }

    const data = JSON.parse(textBody);
    const b64pcm = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64pcm) {
      return res.status(500).json({ error: 'No audio data in Gemini response', raw: data });
    }

    // Bungkus PCM 24kHz mono → WAV
    const pcm = Buffer.from(b64pcm, 'base64');
    const wav = toWavFromPCM16Mono(pcm, 24000);
    const audio_base64 = Buffer.from(wav).toString('base64');

    return res.status(200).json({ audio_base64, mime: 'audio/wav' });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

function toWavFromPCM16Mono(pcmBuffer, sampleRate = 24000) {
  const numChannels = 1, bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
}
