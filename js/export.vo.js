// js/export.vo.js
import { buildVOAssets } from '../vo/compile.js';

export function appendVOToZip(zipOrFolder, result, state = {}, opts = {}) {
  const { ssml, geminiText, lang, platform, recipe, readTimes } = buildVOAssets(result, state);
  const engine = state?.vo?.engine || 'gemini';
  const meta = {
    lang, platform, engine,
    geminiVoice: state?.vo?.geminiVoice || 'Kore',
    elevenVoice: state?.vo?.elevenVoice || '',
    recipe, readTimes
  };

  const base = opts.base || `VO/${platform}_${lang}`;
  const add = (name, content) => {
    // support dipanggil pada folder JSZip
    if (typeof zipOrFolder.folder === 'function' && !name.includes('/')) {
      zipOrFolder.file(name, content);
    } else {
      zipOrFolder.file(`${base}/${name}`, content);
    }
  };

  add(`vo_${platform}_${lang}.ssml`, ssml);
  add(`vo_${platform}_${lang}_gemini.txt`, geminiText);
  add(`vo_meta_${platform}_${lang}.json`, JSON.stringify(meta, null, 2));
}
