export function initVariantCountControl() {
  const sel = document.getElementById('ab-variant-count');
  if (!sel) return;
  const current = localStorage.getItem('ab_variant_count') || '3';
  sel.value = current;
  sel.addEventListener('change', () => {
    localStorage.setItem('ab_variant_count', sel.value);
  });
}
