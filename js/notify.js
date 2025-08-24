// js/notify.js
import { elements } from './dom.js';

export function showNotification(message, type='success', ms=2500) {
  const n = elements.notification;
  if (!n) return;
  n.textContent = message;
  n.classList.remove('error','success');
  if (type) n.classList.add(type);
  n.style.opacity = '1';
  n.style.transform = 'translateY(0)';
  clearTimeout(n._t);
  n._t = setTimeout(() => {
    n.style.opacity = '0';
    n.style.transform = 'translateY(10px)';
  }, ms);
}
