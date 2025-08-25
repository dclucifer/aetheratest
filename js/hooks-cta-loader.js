
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
    const [hooks, ctas] = await Promise.all([
      loadJSON('../constants/hooks_config.json'),
      loadJSON('../constants/cta_mapping.json')
    ]);
    this.hooksConfig = hooks;
    this.ctaMapping = ctas;
  },
  suggestCtas(platform, hookId) {
    if (!this.ctaMapping || !this.ctaMapping[platform]) return [];
    return this.ctaMapping[platform][hookId] || [];
  },
  listFormats() {
    return (this.hooksConfig && this.hooksConfig.formats) ? this.hooksConfig.formats : [];
  }
};

export function validateFirstFrame(text) {
  const maxChars = 42;
  const ok = (text || '').trim().length > 0 && text.length <= maxChars;
  return { ok, maxChars, length: (text || '').length };
}
