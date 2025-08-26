// /vo/dict.js
// Pronunciation dictionaries for ID/EN. Applied to SSML using <sub alias="...">term</sub>.

export const PRON_ID = {
  "Elavoz": "E-la-voz",
  "viscose": "vis-kos",
  "niacinamide": "nia-si-na-mayd",
  "keranjang": "ke-ranjang"
};

export const PRON_EN = {
  "niacinamide": "nai-uh-SIN-uh-mide",
  "viscose": "VIS-kohss"
};

export function applyPronunciationSSML(ssml, lang = "id") {
  const dict = lang === "en" ? PRON_EN : PRON_ID;
  let out = ssml;
  for (const [term, alias] of Object.entries(dict)) {
    const re = new RegExp(`\\b${term}\\b`, "g");
    out = out.replace(re, `<sub alias="${alias}">${term}</sub>`);
  }
  return out;
}
