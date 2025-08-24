import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

// Re-create __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Import API handlers
const generateScriptHandler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, schema, temperature, mode } = req.body;
  
  // Handle visual regeneration mode with specific schema
  let finalSchema = schema;
  if (mode === 'visual_regeneration') {
    finalSchema = {
      type: "object",
      properties: {
        shots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              visual_idea: { type: "string" },
              text_to_image_prompt: { type: "string" },
              image_to_video_prompt: { type: "string" },
              negative_prompt: { type: "string" }
            },
            required: ["visual_idea", "text_to_image_prompt", "image_to_video_prompt", "negative_prompt"]
          }
        }
      },
      required: ["shots"]
    };
  }
  
  // Memutuskan kunci API mana yang akan digunakan
  const userApiKey = req.headers['x-user-api-key'];
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return res.status(500).json({ error: 'Kunci API tidak dikonfigurasi di server.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: finalSchema,
      temperature: temperature || 0.7
    },
  };

  try {
    const fetch = (await import('node-fetch')).default;
    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.json();
      console.error("Google API Error:", errorBody);
      const errorMessage = errorBody.error?.message || "Gagal menghubungi Google API. Cek log server untuk detail.";
      return res.status(geminiResponse.status).json({ error: errorMessage });
    }

    const result = await geminiResponse.json();
    const responseText = result.candidates[0].content.parts[0].text;
    console.log('Raw API Response:', responseText);
    
    const parsedResult = JSON.parse(responseText);
    console.log('Parsed Result:', JSON.stringify(parsedResult, null, 2));
    
    // For visual_regeneration mode, return the result directly as it should contain shots array
    if (mode === 'visual_regeneration') {
      return res.status(200).json(parsedResult);
    }
    
    // Check variants in the first script object (array response)
    const firstScript = Array.isArray(parsedResult) ? parsedResult[0] : parsedResult;
    console.log('Has variants:', {
      hook_variants: !!firstScript.hook_variants,
      body_variants: !!firstScript.body_variants,
      cta_variants: !!firstScript.cta_variants
    });
    
    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error("Error in generateScript:", error);
    return res.status(500).json({ error: "Terjadi kesalahan internal server." });
  }
};

const analyzeImageHandler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { base64Data, mimeType, mode, textData } = req.body;
  
  const userApiKey = req.headers['x-user-api-key'];
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return res.status(500).json({ error: 'Kunci API tidak dikonfigurasi di server.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  let prompt;
  let payload;

  if (mode === 'fullDescription') {
    // Tahap 1: Analisis gambar untuk deskripsi dan palet warna
    prompt = `Analisis gambar ini secara mendalam dan berikan:

1. **DESKRIPSI VISUAL LENGKAP:**
   - Objek utama dan detail spesifik (bentuk, tekstur, material)
   - Komposisi dan tata letak (foreground, background, positioning)
   - Pencahayaan dan bayangan (arah cahaya, mood lighting)
   - Gaya fotografi/artistik (close-up, wide shot, angle, perspective)
   - Konteks dan setting (indoor/outdoor, environment, atmosphere)
   - Emosi dan mood yang terpancar dari gambar
   - Elemen branding atau teks yang terlihat
   - Kualitas dan style gambar (professional, casual, artistic, commercial)

2. **ANALISIS WARNA DETAIL:**
   - 5 warna dominan dalam format hex
   - Skema warna yang digunakan (monochromatic, complementary, triadic, dll)
   - Temperatur warna (warm/cool tones)
   - Saturasi dan brightness level

Format respons dalam JSON:
{
  "description": "deskripsi visual yang sangat detail dan komprehensif mencakup semua aspek di atas",
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"]
}`;
    
    payload = {
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType || "image/jpeg",
              data: base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json"
      }
    };
  } else if (mode === 'extractKeywords') {
    // Tahap 2: Ekstrak keywords dari deskripsi
    prompt = `Dari deskripsi visual berikut, ekstrak keywords yang sangat spesifik dan kaya untuk pembuatan konten kreatif:

"${textData}"

Ekstrak 15-20 keywords yang mencakup:
- **Objek & Produk:** nama spesifik item, brand, kategori
- **Visual Style:** gaya fotografi, komposisi, angle, lighting
- **Warna & Tekstur:** nama warna spesifik, material, finish
- **Mood & Emosi:** perasaan, atmosfer, vibe
- **Setting & Konteks:** lokasi, environment, situasi
- **Kualitas & Karakteristik:** adjektiva deskriptif yang kuat
- **Action & Movement:** gerakan, pose, dinamika
- **Technical Aspects:** depth of field, focus, perspective

Pisahkan dengan koma. Gunakan bahasa yang vivid dan spesifik, hindari kata-kata generik.

Format respons dalam JSON:
{
  "keywords": "keyword1, keyword2, keyword3, keyword4, keyword5, keyword6, keyword7, keyword8, keyword9, keyword10, keyword11, keyword12, keyword13, keyword14, keyword15, ..."
}`;
    
    payload = {
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    };
  } else {
    return res.status(400).json({ error: 'Mode tidak valid. Gunakan fullDescription atau extractKeywords.' });
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.json();
      console.error("Google API Error:", errorBody);
      const errorMessage = errorBody.error?.message || "Gagal menghubungi Google API.";
      return res.status(geminiResponse.status).json({ error: errorMessage });
    }

    const result = await geminiResponse.json();
    const responseText = result.candidates[0].content.parts[0].text;
    
    try {
      const parsedResponse = JSON.parse(responseText);
      return res.status(200).json(parsedResponse);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      return res.status(500).json({ error: 'Format respons tidak valid dari AI.' });
    }

  } catch (error) {
    console.error(`Error in analyzeImage (${mode}):`, error);
    return res.status(500).json({ error: "Terjadi kesalahan internal server." });
  }
};

// API Routes
app.post('/api/generate-script', generateScriptHandler);
app.post('/api/generateScript', generateScriptHandler); // Keep backward compatibility
app.post('/api/analyzeImage', analyzeImageHandler);

// Serve static files
// Wildcard route (Express 5 + path-to-regexp v6): gunakan regex, bukan '*'
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});