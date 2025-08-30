
// js/pipeline/prompt.ast.js
// Build an intermediate, model-agnostic representation for each shot.

/**
 * @typedef {Object} ShotAST
 * @property {Object} subject
 * @property {Object|null} subject.product
 * @property {Object|null} subject.character
 * @property {Object} scene
 * @property {string} scene.visualIdea
 * @property {string|null} scene.description
 * @property {string|null} scene.background
 * @property {Object} camera
 * @property {string} camera.shot
 * @property {string} camera.lens
 * @property {string} camera.angle
 * @property {string|null} camera.movement
 * @property {Object|null} lighting
 * @property {string[]|null} mood
 * @property {string|null} wardrobe
 * @property {string[]|null} palette
 * @property {string[]|null} quality
 * @property {string[]|null} negatives
 */

/**
 * Create a Shot AST from pieces.
 * @param {Object} opts
 * @returns {ShotAST}
 */
export function buildShotAST({
  visualIdea,
  productDNA,
  character,
  scene,
  camera,
  lighting,
  mood,
  wardrobe,
  palette,
  quality,
  negatives
}) {
  return {
    subject: {
      product: productDNA || null,
      character: character || null
    },
    scene: {
      visualIdea: visualIdea || scene?.visualIdea || "",
      description: scene?.description || null,
      background: scene?.background || null
    },
    camera: camera || { shot: "medium shot", lens: "50mm", angle: "eye-level", movement: null },
    lighting: lighting || { key: "soft 45°", fill: "1/3", bg: "clean background" },
    mood: mood || ["calm", "premium"],
    wardrobe: wardrobe || null,
    palette: palette || [],
    quality: quality || ["photorealistic", "natural skin texture", "no over-processing"],
    negatives: negatives || []
  };
}

/**
 * Map a raw shot (from LLM) to AST, injecting continuity where helpful.
 * Expects keys like: visual_idea, camera, lighting, mood, wardrobe, palette, quality, negative_prompt
 */
export function fromRawShot(raw = {}, continuity = {}) {
  return buildShotAST({
    visualIdea: raw.visual_idea || raw.visualIdea || "",
    productDNA: continuity.productDNA || null,
    character: continuity.character || null,
    scene: {
      visualIdea: raw.visual_idea || raw.visualIdea || "",
      description: raw.scene_description || raw.scene || null,
      background: raw.background || continuity.background || null
    },
    camera: raw.camera || {
      shot: raw.shot || "medium shot",
      lens: "85mm portrait lens",
      angle: "eye-level",
      movement: raw.movement || null
    },
    lighting: raw.lighting || { key: "soft 45°", fill: "1/3", bg: "clean background" },
    mood: raw.mood || continuity.mood || ["calm", "premium"],
    wardrobe: raw.wardrobe || continuity.wardrobe || null,
    palette: raw.palette || continuity.palette || [],
    quality: raw.quality || ["photorealistic", "natural skin texture"],
    negatives: (raw.negative_prompt || raw.negatives || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  });
}

/**
 * Merge continuity defaults into the AST without overwriting explicit fields.
 */
export function mergeContinuity(ast, continuity = {}) {
  const out = { ...ast };
  if (continuity.background && !out.scene.background) {
    out.scene.background = continuity.background;
  }
  if (Array.isArray(continuity.palette) && (!out.palette || out.palette.length === 0)) {
    out.palette = continuity.palette;
  }
  if (continuity.wardrobe && !out.wardrobe) {
    out.wardrobe = continuity.wardrobe;
  }
  if (continuity.productDNA && !out.subject.product) {
    out.subject.product = continuity.productDNA;
  }
  if (continuity.character && !out.subject.character) {
    out.subject.character = continuity.character;
  }
  return out;
}
