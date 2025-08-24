
// js/ux/beginnerMode.js
import { elements } from '../utils.js';

const ADVANCED_IDS = [
  'character-preset-controls',
  'character-mode-group',
  'dynamic-character-sheet-area',
  'persona-list-container',
  'manage-character-presets-btn',
  'add-persona-btn'
];

function setMode(mode) {
  localStorage.setItem('aethera_user_mode', mode);
  const isBeginner = mode === 'beginner';
  document.body.classList.toggle('beginner-mode', isBeginner);
  // Hide advanced blocks
  ADVANCED_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isBeginner ? 'none' : '';
  });
}

export function initBeginnerMode() {
  const saved = localStorage.getItem('aethera_user_mode') || 'beginner';
  const btnBeg = document.getElementById('mode-beginner-btn');
  const btnPro = document.getElementById('mode-pro-btn');
  if (btnBeg && btnPro) {
    const syncButtons = () => {
      const isBeginner = (localStorage.getItem('aethera_user_mode') || 'beginner') === 'beginner';
      btnBeg.classList.toggle('bg-blue-600', isBeginner);
      btnBeg.classList.toggle('text-white', isBeginner);
      btnPro.classList.toggle('bg-blue-600', !isBeginner);
      btnPro.classList.toggle('text-white', !isBeginner);
      btnPro.classList.toggle('bg-gray-700', isBeginner);
    };
    btnBeg.addEventListener('click', () => { setMode('beginner'); syncButtons(); });
    btnPro.addEventListener('click', () => { setMode('pro'); syncButtons(); });
    setMode(saved);
    syncButtons();
  }
}
