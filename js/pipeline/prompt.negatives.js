
// js/pipeline/prompt.negatives.js
// Contextual negative prompts tailored per shot type and scene focus.

export const BASE_NEGATIVES = [
  "low quality", "text", "watermark", "over-processed", "over-sharpened",
  "doll-like face", "plastic skin", "extra fingers", "missing fingers"
];

/**
 * Build a contextual negative list based on shot type and idea.
 * @param {Object} ast - Canonical AST for a shot
 * @returns {string[]}
 */
export function contextualizeNegatives(ast) {
  const shot = (ast?.camera?.shot || "").toLowerCase();
  const idea = (ast?.scene?.visualIdea || "").toLowerCase();
  const neg = new Set(BASE_NEGATIVES);

  // Close-up face realism issues
  if (shot.includes("close")) {
    [
      "waxy texture",
      "glassy eyes",
      "unnaturally smooth skin",
      "overly perfect symmetry",
      "ai artifacts around eyelashes"
    ].forEach(x => neg.add(x));
  }

  // Full-body distortions
  if (shot.includes("full")) {
    ["warped limbs", "distorted torso", "unnatural body bend"].forEach(x => neg.add(x));
  }

  // Macro / product artifact issues
  if (shot.includes("macro") || idea.includes("macro") || idea.includes("product")) {
    ["specular clipping", "chromatic aberration", "excessive bloom", "posterization"].forEach(x => neg.add(x));
  }

  // Hand-specific artifacts
  if (shot.includes("hand") || idea.includes("hand") || idea.includes("holding")) {
    ["melted fingers", "extra/missing fingers", "deformed nails"].forEach(x => neg.add(x));
  }

  return Array.from(neg);
}
