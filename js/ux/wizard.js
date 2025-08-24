
// js/ux/wizard.js
import { elements } from '../utils.js';
import { handleGenerate } from '../generator.js';

export function initQuickstartWizard() {
  const openBtn = document.getElementById('open-quickstart-btn');
  const modal = document.getElementById('quickstart-modal');
  const closeBtn = document.getElementById('close-quickstart');
  const cancelBtn = document.getElementById('qs-cancel');
  const runBtn = document.getElementById('qs-generate');
  if (!openBtn || !modal) return;
  const open = () => modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');
  openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  runBtn?.addEventListener('click', async () => {
    // Fill minimal fields
    const product = (document.getElementById('qs-product')?.value || '').trim();
    const platform = document.getElementById('qs-platform')?.value || 'tiktok';
    const duration = document.getElementById('qs-duration')?.value || '30';
    if (product) {
      const pn = document.getElementById('product-name'); if (pn) pn.value = product;
    }
    const dur = document.getElementById('script-duration'); if (dur) dur.value = duration;
    // Set hook/cta defaults for quick success
    const hook = document.getElementById('hook-type'); if (hook) hook.value = 'curiosity';
    const cta = document.getElementById('cta-type'); if (cta) cta.value = 'urgency_discount';
    // Aspect ratio based on platform
    const ar = (platform === 'youtube') ? '16:9' : '9:16';
    localStorage.setItem('aspectRatio', ar);
    try {
      await handleGenerate();
      close();
    } catch (e) {
      // Leave modal open for correction
    }
  });
}
