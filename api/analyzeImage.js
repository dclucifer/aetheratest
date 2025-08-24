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
  const { base64Data, mimeType, textData, mode = 'fullDescription' } = request.body;

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
          // Prompt baru yang meminta output JSON
          { text: `Analisis gambar produk ini secara mendalam. 
            1. Berikan deskripsi visual yang sangat detail dalam Bahasa Inggris. Jelaskan bentuk, warna, material, tekstur, bagian penting, gaya desain, dan elemen unik lainnya. Fokus hanya pada deskripsi objek.
            2. Identifikasi dan daftar 3-5 warna paling dominan dari produk dalam format HEX code.
            PENTING: Output Anda harus dalam format JSON yang valid, tanpa tambahan teks apapun di luar JSON tersebut. Formatnya adalah: {"description": "...", "palette": ["#RRGGBB", "#RRGGBB", ...]}` 
          },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "description": { "type": "STRING" },
            "palette": { "type": "ARRAY", "items": { "type": "STRING" } }
          },
          required: ["description", "palette"]
        }
      }
    };
  } else if (mode === 'extractKeywords') {
    if (!textData) {
      return response.status(400).json({ error: 'Data teks (textData) diperlukan untuk mode extractKeywords.' });
    }
    payload = {
      contents: [{
        parts: [
          // Prompt baru untuk ekstraksi keywords
          { text: `From the following product description, extract a comma-separated list of highly specific, concrete visual keywords perfect for a text-to-image AI model. Focus on object, material, shape, texture, lighting, and unique details. Ignore marketing phrases and subjective words.
            Description: "${textData}"`
          }
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