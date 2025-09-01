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
          { text: `Analyze this PRODUCT image and return STRICT JSON only.
If focus label provided, LIMIT analysis STRICTLY to the product matching that label; ignore background/model. Focus label: "${(focusLabel||'').toString().slice(0,80)}".

Return fields:
1) description: Precise English description focusing ONLY on the product (materials, geometry, finish, colors, wear/age if any). Avoid subjective words.
2) palette: Top 5 dominant colors in HEX.
3) brand_guess: If any brand/label is visible, guess brand; else empty string.
4) model_guess: If any model/series text is visible, guess; else empty string.
5) ocr_text: Array of readable packaging/label text; empty array if none.
6) distinctive_features: Array of 8–14 compact bullets describing identity traits. Include when present:
   - exterior color name + HEX, interior color/finish (e.g., dark granite speckled non-stick)
   - handle material/color/finish and wood-grain or texture details
   - rim/band color or ring, lid/no-lid, spout/rim shape
   - body geometry (e.g., deep bowl-like curved body, rounded base, diameter approx.)
   - logo/brand mark presence and placement/shape
   - material (stainless, cast aluminum, etc.) and surface finish (matte, glossy)
   - unique contrast/accent that helps re-identify the product

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
          { text: `You will receive DESCRIPTION/CONTEXT (plain text or JSON: description, palette, brand_guess, model_guess, ocr_text, distinctive_features). Optional focus: "${(focusLabel||'').toString().slice(0,80)}".
Return a single comma-separated KEYWORD STRING (40–70 tokens) optimized for generic text-to-image models.
- Start with identity locks: brand=<brand_guess>, model=<model_guess>, must_keep_colors=<top 2–3 HEX>.
- Add concrete tokens: product type, materials, finish, geometry, rim/band, handle material & color, interior coating (e.g., dark granite speckled non-stick), exterior color name, logo/mark placement, accents, patterns, proportions.
- Avoid subjective words and full sentences; no quotes.` }
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