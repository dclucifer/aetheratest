// js/modal.js
import { elements } from './utils.js';

export function openConfirmModal(message, onConfirm) {
  const m = elements.confirmModal;
  if (!m?.el) return;
  m.message.textContent = message || '';
  m.el.classList.remove('pointer-events-none','opacity-0');
  m._ok = () => {
    closeConfirmModal();
    if (typeof onConfirm === 'function') onConfirm();
  };
  m.confirmBtn.onclick = m._ok;
  m.cancelBtn.onclick = closeConfirmModal;
}
export function closeConfirmModal() {
  const m = elements.confirmModal;
  if (!m?.el) return;
  m.el.classList.add('opacity-0','pointer-events-none');
  m.confirmBtn.onclick = null;
  m.cancelBtn.onclick = null;
}

export function openEditModal() {
  const m = elements.editModal;
  if (!m?.el) return;
  m.el.classList.remove('pointer-events-none','opacity-0');
}
export function closeEditModal() {
  const m = elements.editModal;
  if (!m?.el) return;
  m.el.classList.add('opacity-0','pointer-events-none');
}

export function openInputModal(title, message, placeholder, onConfirm) {
  const m = elements.inputModal;
  if (!m?.el) return;
  
  m.title.textContent = title || 'Input Required';
  m.message.textContent = message || '';
  m.input.placeholder = placeholder || 'Enter value...';
  m.input.value = '';
  
  m.el.classList.remove('pointer-events-none','opacity-0');
  
  // Focus on input after modal is shown
  setTimeout(() => m.input.focus(), 100);
  
  m._onConfirm = () => {
    const value = m.input.value.trim();
    closeInputModal();
    if (typeof onConfirm === 'function') onConfirm(value);
  };
  
  m.confirmBtn.onclick = m._onConfirm;
  m.cancelBtn.onclick = closeInputModal;
  
  // Handle Enter key
  m.input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      m._onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeInputModal();
    }
  };
}

export function closeInputModal() {
  const m = elements.inputModal;
  if (!m?.el) return;
  
  m.el.classList.add('opacity-0','pointer-events-none');
  m.confirmBtn.onclick = null;
  m.cancelBtn.onclick = null;
  m.input.onkeydown = null;
  m.input.value = '';
}
