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
    // NOTE: This is a placeholder route; replace with actual image-generation endpoint when available.
    // For now we call the same generateContent with responseMimeType: "image/png" if supported by the model.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }]}],
      generationConfig: {
        responseMimeType: 'image/png',
        aspectRatio: aspect
      }
    };
    const r = await fetch(url,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    if(!r.ok){
      let msg = '';
      try{ msg = await r.text(); }catch(_){ }
      return response.status(r.status).json({ error: msg||'Image model error' });
    }
    const data = await r.arrayBuffer();
    // Some deployments return JSON wrapper; try to detect
    try{
      const asJson = JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
      // expect base64 in candidates[0].content.parts[0].inline_data.data
      const b64 = asJson?.candidates?.[0]?.content?.parts?.find(p=>p?.inline_data?.data)?.inline_data?.data || '';
      if(!b64) return response.status(500).json({ error:'Empty image' });
      return response.status(200).json({ imageBase64: b64 });
    }catch(_){
      // if raw binary png arrived, convert to base64
      const b64 = Buffer.from(data).toString('base64');
      return response.status(200).json({ imageBase64: b64 });
    }
  }catch(e){
    return response.status(500).json({ error: e?.message || 'Render failed' });
  }
}

