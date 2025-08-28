// js/ui.router.js
import { elements } from './utils.js';

export function showPage(pageId) {
  elements.generatorPage.classList.toggle('hidden', pageId !== 'generator');
  elements.historyPage.classList.toggle('hidden', pageId !== 'history');
  elements.settingsPage.classList.toggle('hidden', pageId !== 'settings');
  elements.accountPage?.classList.toggle('hidden', pageId !== 'account');

  [elements.navGenerator, elements.mobileNavGenerator].forEach(el => el?.classList.toggle('active', pageId === 'generator'));
  [elements.navHistory, elements.mobileNavHistory].forEach(el => el?.classList.toggle('active', pageId === 'history'));
  [elements.navSettings, elements.mobileNavSettings].forEach(el => el?.classList.toggle('active', pageId === 'settings'));
  [elements.navAccount, elements.mobileNavAccount].forEach(el => el?.classList.toggle('active', pageId === 'account'));
}

export function toggleMobileMenu() {
  elements.mobileMenu.classList.toggle('hidden');
  elements.menuOpenIcon.classList.toggle('hidden');
  elements.menuCloseIcon.classList.toggle('hidden');
}

// Global function for empty state buttons
export function switchToGenerator() {
  showPage('generator');
}

// Make switchToGenerator available globally for onclick handlers
window.switchToGenerator = switchToGenerator;
