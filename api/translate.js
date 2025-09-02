// api/translate.js
import { softVerifySupabaseJWT } from './_lib/auth.js';

export default async function handler(request, response) {
  try {
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    const requireAuth = process.env.REQUIRE_AUTH === '1';
    const ver = softVerifySupabaseJWT(authHeader, { require: requireAuth });
    if (!ver.ok) {
      return response.status(ver.code || 401).json({ error: ver.reason || 'Unauthorized' });
    }
  } catch (_) {
    if (process.env.REQUIRE_AUTH === '1') {
      return response.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { texts } = request.body || {};
  if (!Array.isArray(texts) || texts.length === 0) {
    return response.status(400).json({ error: 'texts array is required' });
  }

  const userApiKey = request.headers['x-user-api-key'];
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'Kunci API tidak dikonfigurasi di server.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  try {
    // Translate each text individually to control context bleeding
    const outputs = [];
    for (const t of texts) {
      const payload = {
        contents: [{ parts: [{ text: `Translate the following into NATURAL English. Keep names and product terms intact. Output ONLY the translated text without quotes or commentary.\n---\n${String(t||'').slice(0,4000)}` }] }],
        generationConfig: { temperature: 0.2 }
      };
      const r = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) {
        const msg = await r.text().catch(()=> '');
        throw new Error(msg || 'Translation API error');
      }
      const data = await r.json();
      const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      outputs.push(out);
    }
    return response.status(200).json({ translations: outputs });
  } catch (e) {
    return response.status(500).json({ error: e?.message || 'Translation failed' });
  }
}

