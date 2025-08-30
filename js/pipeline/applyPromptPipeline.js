
// js/pipeline/applyPromptPipeline.js
// Glue: from raw script JSON → AST → QC → contextual negatives → rendered prompts.

import { fromRawShot, mergeContinuity } from "./prompt.ast.js";
import { contextualizeNegatives } from "./prompt.negatives.js";
import { validateAndFix } from "./prompt.qc.js";
import { renderT2I, renderI2V } from "./prompt.renderers.js";
import { getContinuity } from "./continuity.store.js";

/**
 * Apply the prompt pipeline to every shot in {hook, body, cta}.
 * @param {Object} scriptJson - result object produced by your LLM planning step
 * @param {{model?: 'auto'|'imagen'|'gemini'|'imagefx'|'flux'|'leonardo'}} opts
 * @returns {{script: Object, warnings: string[]}}
 */
export function applyPromptPipeline(scriptJson, { model = "auto" } = {}) {
  try {
    const continuity = getContinuity();
    const warnings = [];
    const sections = ["hook", "body", "cta"];
    const out = JSON.parse(JSON.stringify(scriptJson || {}));

    sections.forEach(sec => {
      const block = out?.[sec];
      if (!block || !Array.isArray(block.shots)) return;

      block.shots = block.shots.map((shot, idx) => {
        let ast = fromRawShot(shot, continuity);
        ast = mergeContinuity(ast, continuity);

        // QC + gentle auto-repairs
        const qc = validateAndFix(ast);
        qc.warnings.forEach(w => warnings.push(`[${sec}#${idx + 1}] ${w}`));
        ast = qc.ast;

        // Negatives (contextual) if empty
        if (!ast.negatives || ast.negatives.length === 0) {
          ast.negatives = contextualizeNegatives(ast);
        }

        // Render final prompts
        const t2i = renderT2I(ast, model);
        const i2v = renderI2V(ast);

        return {
          ...shot,
          text_to_image_prompt: t2i,
          image_to_video_prompt: i2v,
          negative_prompt: ast.negatives.join(", "),
          _ast: ast // optional: useful for debugging in UI
        };
      });
    });

    out.__pipeline = { model, warnings, updatedAt: new Date().toISOString() };
    return { script: out, warnings };
  } catch (e) {
    console.error("[applyPromptPipeline] failed:", e);
    return { script: scriptJson, warnings: [`pipeline error: ${e?.message || e}`] };
  }
}
