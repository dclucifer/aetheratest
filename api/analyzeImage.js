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
          { text: `You are a meticulous product photographer and branding specialist. Your primary goal is to deconstruct a product's visual identity from an image into hyper-specific details for generating photorealistic images. Return STRICT JSON only.
    
    Focus Label (if provided, analyze ONLY this item): "${(focusLabel||'').toString().slice(0,80)}"
    
    **Analysis categories (MUST be filled with extreme detail):**
    1.  **description**: A detailed, objective description in English, separating observations for the product's exterior, interior, and handle.
    2.  **palette**: An array of 5-6 dominant and accent colors in HEX format.
    3.  **brand_guess**: Guess the brand name if a logo is visible, otherwise an empty string.
    4.  **model_guess**: Guess the model/series name if visible, otherwise an empty string.
    5.  **ocr_text**: Extract any and all readable text from the product or its packaging (array of strings).
    6.  **distinctive_features**: The most critical part. Provide an array of short, descriptive English phrases. Be a detective. **Separately describe the exterior, interior, and handle.**
        * **Exterior:** e.g., "smooth matte navy blue outer coating", "polished chrome base".
        * **Interior:** e.g., "black granite non-stick surface", "subtle white and grey speckle pattern".
        * **Handle & Construction:** e.g., "light wood-texture ergonomic handle", "attached with two prominent silver rivets", "polished metallic rim".
        * **Overall Shape:** e.g., "deep circular sauce pan body".
    
    **STRICT OUTPUT SHAPE (JSON only, no extra text):**
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