
// hooks-cta-loader.js
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return await res.json();
}

export const HooksCtaRegistry = {
  hooksConfig: null,
  ctaMapping: null,
  hookInstructions: null,
  ctaInstructions: null,

  async init() {
    const hooks = (await import('./constants/hooks_config.json')).default;
    const ctas  = (await import('./constants/cta_mapping.json')).default;
    const hIns  = (await import('./constants/instructions.hooks.json')).default;
    const cIns  = (await import('./constants/instructions.cta.json')).default;
    this.hooksConfig      = hooks;
    this.ctaMapping       = ctas;
    this.hookInstructions = hIns;
    this.ctaInstructions  = cIns;
  },

  suggestCtas(platform, hook) {
    return this.ctaMapping?.[platform]?.[hook] || [];
  },

  getHookInstruction(hookKey, lang='id') {
    return this.hookInstructions?.[hookKey]?.[lang] || null;
  },

  getCtaInstruction(ctaKey, lang='id') {
    return this.ctaInstructions?.[ctaKey]?.[lang] || null;
  },

  listHookGroups() { return this.hooksConfig?.categories || []; },
  listFormats()    { return this.hooksConfig?.formats || []; }
}
