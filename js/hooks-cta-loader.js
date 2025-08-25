
// hooks-cta-loader.js
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return await res.json();
}

export const HooksCtaRegistry = {
  hooksConfig: null,
  ctaMapping: null,
  async init() {
    const hooks = (await import('../constants/hooks_config.json')).default;
    const ctas  = (await import('../constants/cta_mapping.json')).default;
    this.hooksConfig = hooks;
    this.ctaMapping  = ctas;
  },
  suggestCtas(p, h) { return this.ctaMapping?.[p]?.[h] || []; },
  listFormats() { return this.hooksConfig?.formats || []; }
};

export function validateFirstFrame(text) {
  const maxChars = 42;
  const ok = (text || '').trim().length > 0 && text.length <= maxChars;
  return { ok, maxChars, length: (text || '').length };
}
