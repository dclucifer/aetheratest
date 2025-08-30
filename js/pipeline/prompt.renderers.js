
// js/pipeline/prompt.renderers.js
// Natural-language renderers for T2I and I2V across different model targets.

const MODEL_STYLES = {
  auto:    { quality: "photorealistic, natural skin texture" },
  imagen:  { quality: "highly detailed photograph, true-to-life colors, natural skin texture" },
  gemini:  { quality: "highly detailed photograph, true-to-life colors, natural skin texture" },
  imagefx: { quality: "highly detailed photograph, true-to-life colors, natural skin texture" },
  flux:    { quality: "photorealistic, natural grain, balanced contrast" },
  leonardo:{ quality: "photo-real, soft contrast, balanced highlights" }
};

function joinSentences(lines) {
  return lines.filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
}

/**
 * Render a T2I prompt from AST for a specific model style (default: auto).
 * Avoids synthetic tokens; uses simple, concrete photography language.
 */
export function renderT2I(ast, target = "auto") {
  const {subject, scene, camera, lighting, mood, wardrobe, palette, quality, negatives} = ast || {};
  const style = MODEL_STYLES[target] || MODEL_STYLES.auto;

  const product = subject?.product;
  const character = subject?.character;

  const idLine = joinSentences([
    product?.brand && product?.model ? `${product.brand} ${product.model}` : null,
    Array.isArray(product?.features) && product.features.length ? `with ${product.features.join(", ")}` : null
  ]);

  const charLine = character ? joinSentences([
    `adult ${character.gender || "person"}, ${character.age || "25–35"}`,
    `${character.ethnicity || "Indonesian"}`,
    `${character.skin_tone || "natural skin tone"}`,
    `${character.hair_color || "black"} ${character.hair_style || "straight hair"}`,
    `${character.eye_color || "brown"} eyes`,
    "realistic proportions, subtle pores, slight asymmetry, baby hair"
  ]) : null;

  const paletteLine = Array.isArray(palette) && palette.length
    ? `dominant colors: ${palette.join(", ")}, color-graded to match brand hue`
    : null;

  const wardrobeLine = wardrobe ? `wardrobe: ${wardrobe}` : null;

  const cameraLine = camera ? `${camera.shot || "medium shot"}, ${camera.lens || "85mm portrait lens"}, ${camera.angle || "eye-level"}` : null;
  const lightLine  = lighting ? `soft key at 45°, gentle fill (1/3), ${lighting.bg || "clean background"}` : null;
  const moodLine   = Array.isArray(mood) && mood.length ? `mood: ${mood.join(", ")}` : null;

  const qualityLine = Array.isArray(quality) && quality.length ? quality.join(", ") : style.quality;
  const negLine = Array.isArray(negatives) && negatives.length ? `avoid: ${negatives.join(", ")}`
    : "avoid: low quality, text, watermark, plastic skin, doll-like face, deformed hands, extra/missing fingers";

  const header = scene?.visualIdea
    ? scene.visualIdea
    : (scene?.description || "");

  const bg = scene?.background ? `Keep the same ${scene.background}.` : null;

  return joinSentences([
    header,
    idLine,
    charLine,
    scene?.description || null,
    paletteLine,
    wardrobeLine,
    bg,
    `camera: ${cameraLine}`,
    `lighting: ${lightLine}`,
    `mood: ${moodLine}`,
    qualityLine,
    negLine
  ]);
}

/**
 * Render an I2V instruction (assumes the still image from T2I is used as first frame).
 */
export function renderI2V(ast) {
  const movement = ast?.camera?.movement || "slow 5% push-in";
  return joinSentences([
    "Start from the provided still image",
    "Natural micro-movement only: eye saccades, subtle blink, gentle breathing",
    movement,
    "Keep framing stable, no warping or extreme parallax"
  ]);
}
