
// js/ux/batch.js
import { handleGenerate } from '../generator.js';
import { elements, showNotification } from '../utils.js';
import { t } from '../i18n.js';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = lines.map(l => l.split(',').map(x => x.trim()));
  return rows;
}

async function runOne(product, platform, duration) {
  const pn = document.getElementById('product-name'); if (pn) pn.value = product;
  const dur = document.getElementById('script-duration'); if (dur) dur.value = duration || '30';
  const hook = document.getElementById('hook-type'); if (hook) hook.value = 'curiosity';
  const cta = document.getElementById('cta-type'); if (cta) cta.value = 'urgency_discount';
  const ar = (platform === 'youtube') ? '16:9' : '9:16';
  localStorage.setItem('aspectRatio', ar);
  await handleGenerate();
}

export function initBatchMode() {
  const openBtn = document.getElementById('open-batch-btn');
  const modal = document.getElementById('batch-modal');
  const closeBtn = document.getElementById('close-batch');
  const runBtn = document.getElementById('batch-run');
  if (!openBtn || !modal) return;
  const open = () => modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');
  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  runBtn?.addEventListener('click', async () => {
    const text = document.getElementById('batch-csv')?.value || '';
    if (!text.trim()) { showNotification(t('batch_csv_required') || 'Masukkan CSV minimal 1 baris', 'warning'); return; }
    const rows = parseCSV(text);
    for (const row of rows) {
      const [product, platform='tiktok', duration='30'] = row;
      if (!product) continue;
      await runOne(product, platform, duration);
    }
    close();
  });
}
