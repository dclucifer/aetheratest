
import { populateCharacterPresetSelector, handleLoadCharacterPreset } from '../characterPresets.js';

export function initQuickCharacterPicks() {
  try {
    const container = document.getElementById('quick-character-chips');
    if (!container) return;
    const presets = JSON.parse(localStorage.getItem('aethera_character_presets') || '[]');
    if (!presets.length) return;
    const top = presets.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).slice(0,6);
    container.innerHTML = '';
    top.forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'px-2 py-1 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700';
      chip.textContent = p.name || 'Preset';
      chip.title = (p.characters?.[0]?.vibe || p.characters?.[0]?.notes || '').slice(0,140);
      chip.addEventListener('click', async () => {
        const sel = document.getElementById('character-preset-selector');
        if (sel) {
          populateCharacterPresetSelector();
          if (![...sel.options].some(o=>o.value===p.id)) {
            const opt = document.createElement('option');
            opt.value = p.id; opt.textContent = p.name || 'Preset';
            sel.appendChild(opt);
          }
          sel.value = p.id;
          await handleLoadCharacterPreset();
        }
      });
      container.appendChild(chip);
    });
  } catch (e) {
    console.warn('initQuickCharacterPicks failed', e);
  }
}
