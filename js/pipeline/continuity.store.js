
// js/pipeline/continuity.store.js
// Lightweight continuity store (background/palette/wardrobe) to keep shots consistent.

const KEY = "aethera.continuity.v1";

const DEFAULTS = {
  background: "clean white background",
  palette: ["warm beige", "graphite", "soft white"],
  wardrobe: "simple beige top and jeans",
  productDNA: null, // {brand, model, features[], colors[]}
  character: null   // {gender, age, ethnicity, skin_tone, hair_color, hair_style, eye_color, unique_features}
};

export function getContinuity() {
  try {
    const cur = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULTS, ...cur };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export function setContinuity(patch = {}) {
  const cur = getContinuity();
  const next = { ...cur, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function resetContinuity() {
  localStorage.removeItem(KEY);
  return getContinuity();
}
