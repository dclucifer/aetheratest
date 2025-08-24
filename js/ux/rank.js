
// js/ux/rank.js
import { scoreHook } from '../ui.results.js';
import { t } from '../i18n.js';

export function initRankAll() {
  const btn = document.getElementById('rank-all-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    // Block action if no current generated results in output panel
    const panel = document.getElementById('output-panel');
    const cards = Array.from(panel ? panel.querySelectorAll('.result-card') : []);
    if (cards.length < 2) {
      try { (await import('../utils.js')).showNotification('Rank requires at least 2 results', 'warning'); } catch(_){ }
      return;
    }
    const scored = [];
    for (const card of cards) {
      const hookEl = card.querySelector('.hook-text');
      const bodyEl = card.querySelector('.body-text');
      const ctaEl = card.querySelector('.cta-text');
      const hook = hookEl ? hookEl.textContent.trim() : '';
      const cta = ctaEl ? ctaEl.textContent.trim() : '';
      let score = await scoreHook(hook);
      score += Math.min((bodyEl?.textContent || '').split(/\s+/).length, 120) * 0.1;
      score += /now|today|grab|discount|sale|link|tap|shop/i.test(cta) ? 20 : 0;
      scored.push({ card, score });
    }
    scored.sort((a,b)=>b.score-a.score);
    const panel2 = document.getElementById('output-panel');
    if (!panel2) return;
    scored.forEach(({card}) => panel2.appendChild(card));
    btn.textContent = '⭐ ' + (t('rank_button_active') || 'Ranked (best → worst)');
    setTimeout(() => { btn.textContent = '⭐ ' + (t('rank_button_default') || 'Rank All'); }, 2000);
  });
}
