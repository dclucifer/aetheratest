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

  const { base64Data, mimeType, mode, textData, focusLabel = '' } = req.body;
  
  const userApiKey = req.headers['x-user-api-key'];
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return res.status(500).json({ error: 'Kunci API tidak dikonfigurasi di server.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  let prompt;
  let payload;

  if (mode === 'fullDescription') {
    // Tahap 1: Analisis gambar untuk deskripsi, palet, dan identitas produk yang ketat
    prompt = `Analyze this PRODUCT image in depth and return STRICT JSON only. Goals: ultra-specific identity for T2I/I2V prompts.
If focus label provided, LIMIT analysis STRICTLY to the product matching that label, ignore model/body/background and unrelated clothing. Focus label: "${(focusLabel||'').toString().slice(0,80)}".
1) description: Long, concrete visual description in English focusing ONLY on the product (not background).
2) palette: 5 dominant colors in HEX.
3) brand_guess: If any brand/label/logo is visible, guess the brand name; else empty string.
4) model_guess: If any model/series/variant text is visible, guess; else empty string.
5) ocr_text: Any readable packaging/label text (array of strings, best-effort OCR). If not present, empty array.
6) distinctive_features: Array of 5-10 short bullet phrases capturing unique, non-generic identity traits (shape geometry, cuts, logo mark shape, accents, materials, finishes, stitch/pattern, ports/buttons layout, cap/nozzle type, etc.).
7) logo_shape_hint: short phrase describing the logo mark silhouette/geometry if visible; else empty string.
8) packaging_form_factor: concise descriptor (e.g., "pump bottle", "jar with matte lid", "tubular can") if applicable; else empty string.
9) manufacturing_finishes: short list of finishes (e.g., brushed aluminum, glossy ABS, satin glass) if visible; else empty array.

STRICT OUTPUT SHAPE (JSON only, no extra text):
{"description":"...","palette":["#RRGGBB",...],"brand_guess":"","model_guess":"","ocr_text":["..."],"distinctive_features":["..."],"logo_shape_hint":"","packaging_form_factor":"","manufacturing_finishes":["..."]}`;

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
    // Tahap 2: Ekstrak keywords dari deskripsi/JSON identitas
    const context = typeof textData === 'string' ? textData : JSON.stringify(textData);
    prompt = `You will receive DESCRIPTION/CONTEXT (may be plain text or JSON with description, palette, brand_guess, model_guess, ocr_text, distinctive_features, logo_shape_hint, packaging_form_factor, manufacturing_finishes). Optional focus label: "${(focusLabel||'').toString().slice(0,80)}".
Return a single comma-separated KEYWORD STRING optimized for text-to-image models, with 40-60 tokens.
- Start with identity lock tokens: brand=<brand_guess if any>, model=<model_guess if any>, logo_mark=<logo_shape_hint if any>, must_keep_colors=<top 2-3 HEX>.
- Then list ultra-specific nouns/adjectives: product type, materials, finish, geometry, edges, accents, texture, patterns, proportions, ports/buttons layout, packaging details, camera angle, lens, lighting style, background color.
- Prefer concrete terms, avoid subjective words; no sentences; no quotes.
DESCRIPTION/CONTEXT:\n${context}`;

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