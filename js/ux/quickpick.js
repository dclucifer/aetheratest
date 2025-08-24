
export function initQuickPersonaPicks() {
  try {
    const container = document.getElementById('quick-persona-chips');
    if (!container) return;
    const personas = JSON.parse(localStorage.getItem('aethera_personas') || '[]');
    if (!personas.length) return;
    const top = personas.slice(0, 6);
    container.innerHTML = '';
    top.forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'px-2 py-1 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700';
      chip.textContent = p.name || 'Persona';
      chip.title = (p.description || '').slice(0, 140);
      chip.addEventListener('click', () => {
        const nameEl = document.getElementById('persona-name');
        const descEl = document.getElementById('persona-desc');
        if (nameEl) nameEl.value = p.name || '';
        if (descEl) descEl.value = p.description || '';
        const disp = document.getElementById('persona-description-display');
        if (disp) disp.textContent = p.description || '';
      });
      container.appendChild(chip);
    });
  } catch (e) {
    console.warn('initQuickPersonaPicks failed', e);
  }
}
