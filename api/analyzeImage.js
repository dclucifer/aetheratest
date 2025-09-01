import { softVerifySupabaseJWT } from './_lib/auth.js';

// File: api/analyzeImage.js

export default async function handler(request, response) {

  // --- Soft Supabase JWT verification ---
  try {
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    const requireAuth = process.env.REQUIRE_AUTH === '1';
    const ver = softVerifySupabaseJWT(authHeader, { require: requireAuth });
    if (!ver.ok) {
      return response.status(ver.code || 401).json({ error: ver.reason || 'Unauthorized' });
    }
    // Optional: attach user info
    request.user = { sub: ver.sub, email: ver.email, payload: ver.payload };
  } catch (e) {
    // Do not block if soft mode
    if (process.env.REQUIRE_AUTH === '1') {
      return response.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // Ambil mode dari body, default ke 'fullDescription' jika tidak ada
  const { base64Data, mimeType, textData, mode = 'fullDescription', focusLabel = '' } = request.body;

  const userApiKey = request.headers['x-user-api-key'];
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ error: 'Kunci API tidak dikonfigurasi di server.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  let payload;
  let responseMimeType = "text/plain"; // Default untuk ekstraksi keyword

  if (mode === 'fullDescription') {
    if (!base64Data || !mimeType) {
      return response.status(400).json({ error: 'Data gambar (base64Data, mimeType) diperlukan untuk mode fullDescription.' });
    }
    responseMimeType = "application/json"; // Minta output JSON untuk mode ini
    payload = {
      contents: [{
        parts: [
          { text: `Analyze this PRODUCT image in depth and return STRICT JSON only. Goals: ultra-specific identity for T2I/I2V prompts.
If focus label provided, LIMIT analysis STRICTLY to the product matching that label, ignore model/body/background and unrelated clothing. Focus label: "${(focusLabel||'').toString().slice(0,80)}".
1) description: Long, concrete visual description in English focusing ONLY on the product (not background).
2) palette: 5 dominant colors in HEX.
3) brand_guess: If any brand/label/logo is visible, guess the brand name; else empty string.
4) model_guess: If any model/series/variant text is visible, guess; else empty string.
5) ocr_text: Any readable packaging/label text (array of strings, best-effort OCR). If not present, empty array.
6) distinctive_features: Array of 5-10 short bullet phrases capturing unique, non-generic identity traits (shape geometry, cuts, logo mark shape, accents, materials, finishes, stitch/pattern, ports/buttons layout, cap/nozzle type, etc.).

STRICT OUTPUT SHAPE (JSON only, no extra text):
{"description":"...","palette":["#RRGGBB",...],"brand_guess":"","model_guess":"","ocr_text":["..."],"distinctive_features":["..."]}` },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };
  } else if (mode === 'extractKeywords') {
    if (!textData) {
      return response.status(400).json({ error: 'Data teks (textData) diperlukan untuk mode extractKeywords.' });
    }
    payload = {
      contents: [{
        parts: [
          { text: `You will receive DESCRIPTION/CONTEXT (may be plain text or JSON with description, palette, brand_guess, model_guess, ocr_text, distinctive_features). Optional focus label: "${(focusLabel||'').toString().slice(0,80)}".
Return a single comma-separated KEYWORD STRING optimized for text-to-image models, with 40-60 tokens.
- Start with identity lock tokens: brand=<brand_guess if any>, model=<model_guess if any>, logo_mark=<short shape/geometry>, must_keep_colors=<top 2-3 HEX>.
- Then list ultra-specific nouns/adjectives: product type, materials, finish, geometry, edges, accents, texture, patterns, proportions, ports/buttons layout, packaging details, camera angle, lens, lighting style, environment (ONLY if essential), background color.
- Prefer concrete terms, avoid subjective words; no sentences; no quotes.
DESCRIPTION/CONTEXT:\n${typeof textData === 'string' ? textData : JSON.stringify(textData)}` }
        ]
      }]
    };
  } else {
    return response.status(400).json({ error: 'Mode tidak valid. Gunakan "fullDescription" atau "extractKeywords".' });
  }

  try {
    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      let errorBody = null;
      try { errorBody = await geminiResponse.clone().json(); } catch {
        try {
          const txt = await geminiResponse.text();
          errorBody = txt ? { error: { message: txt } } : null;
        } catch {}
      }
      console.error("Google API Error:", errorBody);
      return response.status(geminiResponse.status).json({ error: errorBody?.error?.message || "Gagal menghubungi Google API." });
    }

    const result = await geminiResponse.json();
    const generatedText = result.candidates[0].content.parts[0].text;
    
    // Kirim kembali JSON atau teks biasa tergantung mode
    if (responseMimeType === "application/json") {
        let parsed = null;
        try { parsed = JSON.parse(generatedText); }
        catch {
          parsed = { description: String(generatedText || '').slice(0, 2000), palette: [] };
        }
        return response.status(200).json(parsed);
    } else {
        return response.status(200).json({ keywords: generatedText });
    }

  } catch (error) {
    console.error(`Error in Vercel Function (${mode}):`, error);
    return response.status(500).json({ error: "Terjadi kesalahan di server saat menganalisis." });
  }
}