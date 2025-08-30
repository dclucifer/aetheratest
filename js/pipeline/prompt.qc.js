
// js/pipeline/prompt.qc.js
// Minimal quality checks and gentle auto-repairs for the AST.

/**
 * Validate and gently fix a Shot AST. Returns warnings (not hard errors).
 * @param {import('./prompt.ast.js').ShotAST} ast
 * @returns {{ast: any, warnings: string[]}}
 */
export function validateAndFix(ast) {
  const warnings = [];
  const out = JSON.parse(JSON.stringify(ast || {}));

  // Ensure fundamental blocks
  if (!out.camera) out.camera = {};
  if (!out.camera.shot) {
    out.camera.shot = "medium shot";
    warnings.push("camera.shot missing → default medium shot");
  }
  if (!out.camera.lens) {
    out.camera.lens = out.camera.shot.toLowerCase().includes("close")
      ? "85mm portrait lens"
      : "50mm standard lens";
    warnings.push("camera.lens missing → default applied");
  }
  if (!out.camera.angle) {
    out.camera.angle = "eye-level";
    warnings.push("camera.angle missing → eye-level");
  }
  if (!out.lighting) {
    out.lighting = { key: "soft 45°", fill: "1/3", bg: "clean background" };
    warnings.push("lighting missing → soft 45° / clean background");
  }

  // Contradictions: close-up should not be ultrawide
  const lensStr = String(out.camera.lens || "");
  if (String(out.camera.shot).toLowerCase().includes("close") && /\b(14|16|18|20|24|28)mm\b/.test(lensStr)) {
    out.camera.lens = "85mm portrait lens";
    warnings.push("fixed lens: close-up should not use ultrawide");
  }

  // Ensure negatives list exists (filled later if empty)
  if (!Array.isArray(out.negatives)) out.negatives = [];

  return { ast: out, warnings };
}
