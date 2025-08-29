// i18n.js - internationalization system with JSON file loading
// Usage: import { t, setLanguage, getLanguage, loadTranslations } from './i18n.js';

// Removed circular import on languageState from utils.js to avoid stale state issues

// Global translations object
let translations = { id: {}, en: {} };

// Load translations from JSON files
export async function loadTranslations() {
  try {
    // Use URLs relative to this module to work in both dev and build
    const idUrl = new URL('../locales/id.json', import.meta.url);
    const enUrl = new URL('../locales/en.json', import.meta.url);

    const [idResponse, enResponse] = await Promise.all([
      fetch(idUrl),
      fetch(enUrl)
    ]);
    
    const [idTranslations, enTranslations] = await Promise.all([
      idResponse.json(),
      enResponse.json()
    ]);
    
    translations = {
      id: idTranslations,
      en: enTranslations
    };
    
    console.log('Translations loaded successfully');
    return translations;
  } catch (error) {
    console.error('Failed to load translations:', error);
    // Fallback to empty translations
    translations = { id: {}, en: {} };
    return translations;
  }
}

export function t(key, params = {}) {
  const lang = (typeof localStorage !== 'undefined' && (localStorage.getItem('direktiva_language') || localStorage.getItem('aethera_language')))
    || (typeof document !== 'undefined' && document.documentElement.lang)
    || 'id';
  
  // If translations not yet loaded, return key silently to avoid noisy logs
  if (!translations || (!translations[lang] && !translations.en && !translations.id)) {
    return key;
  }
  
  const lookup = (l) => key.split('.').reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), translations[l] || {});
  let value = lookup(lang);
  // Fallback chain: try English, then Indonesian, then the key itself
  if (value == null) value = lookup('en');
  if (value == null) value = lookup('id');

  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
  }
  return value ?? key;
}

export function setLanguage(lang) {
  try { localStorage.setItem('aethera_language', lang); } catch {}
  try { localStorage.setItem('direktiva_language', lang); } catch {}
  if (typeof document !== 'undefined') {
    try { document.documentElement.lang = lang; } catch {}
  }
}

export function getLanguage() {
  return (typeof localStorage !== 'undefined' && (localStorage.getItem('direktiva_language') || localStorage.getItem('aethera_language'))) || 'id';
}

// Export translations for backward compatibility
export { translations };
