import { softVerifySupabaseJWT } from './_lib/auth.js';

// File: api/generateScript.js

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

  const { prompt, schema, temperature } = request.body;
  
  // Memutuskan kunci API mana yang akan digunakan
  const userApiKey = request.headers['x-user-api-key'];
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return response.status(500).json({ error: 'Kunci API tidak dikonfigurasi di server.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: temperature || 0.7 // Default 0.7 jika tidak disediakan
    },
  };

  try {
    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.json();
      console.error("Google API Error:", errorBody);
      // Teruskan pesan error yang lebih detail dari Google jika tersedia
      const errorMessage = errorBody.error?.message || "Gagal menghubungi Google API. Cek log server untuk detail.";
      return response.status(geminiResponse.status).json({ error: errorMessage });
    }

    const result = await geminiResponse.json();
    const parsedResult = JSON.parse(result.candidates[0].content.parts[0].text);
    
    return response.status(200).json(parsedResult);

  } catch (error) {
    console.error("Error in Vercel Function (generateScript):", error);
    return response.status(500).json({ error: "Terjadi kesalahan di server." });
  }
}
