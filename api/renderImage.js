import { softVerifySupabaseJWT } from './_lib/auth.js';

export default async function handler(request, response){
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

  const { prompt, aspect = '9:16', model = 'gemini-2.5-flash-image-preview' } = request.body || {};
  if(!prompt || typeof prompt!=='string'){
    return response.status(400).json({ error:'prompt is required' });
  }

  const apiKey = request.headers['x-user-api-key'] || process.env.GEMINI_API_KEY;
  if(!apiKey){
    return response.status(500).json({ error:'Missing API key' });
  }

  try{
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    // Embed aspect hint in prompt text; API doesn't accept aspectRatio in generationConfig
    const aspectHint = (() => {
      const a = String(aspect||'').trim();
      if (a === '9:16') return 'portrait orientation (vertical 9:16)';
      if (a === '4:5')  return 'portrait orientation (vertical 4:5)';
      if (a === '16:9') return 'landscape orientation (wide 16:9)';
      if (a === '1:1')  return 'square composition (1:1)';
      return '';
    })();
    const promptWithHint = aspectHint ? `${prompt}\nComposition: ${aspectHint}.` : prompt;
    const payload = {
      contents: [ { role: 'user', parts: [ { text: promptWithHint } ] } ]
    };
    const r = await fetch(url,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    if(!r.ok){
      let msg = '';
      try{ msg = await r.text(); }catch(_){ }
      return response.status(r.status).json({ error: msg||'Image model error' });
    }
    const result = await r.json();
    const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
    let b64 = '';
    for (const c of candidates) {
      const parts = c?.content?.parts || [];
      for (const p of parts) {
        if (p?.inline_data?.data) { b64 = p.inline_data.data; break; }
      }
      if (b64) break;
    }
    if (!b64) return response.status(500).json({ error: 'Empty image' });
    return response.status(200).json({ imageBase64: b64 });
  }catch(e){
    return response.status(500).json({ error: e?.message || 'Render failed' });
  }
}

