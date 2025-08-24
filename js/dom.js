// js/dom.js
// Centralized DOM cache & lightweight query helpers
export const $ = (sel, ctx=document) => ctx.querySelector(sel);
export const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

export const elements = {
  loginOverlay: $('#login-overlay'),
  loginBtn: $('#login-btn'),
  appContainer: $('#app-container'),

  generatorPage: $('#generator-page'),
  historyPage: $('#history-page'),
  settingsPage: $('#settings-page'),

  navGenerator: $('#nav-generator'),
  navHistory: $('#nav-history'),
  navSettings: $('#nav-settings'),
  logoutBtn: $('#logout-btn'),
  mobileLogoutBtn: $('#mobile-logout-btn'),

  mobileMenuButton: $('#mobile-menu-button'),
  mobileMenu: $('#mobile-menu'),
  menuOpenIcon: $('#menu-open-icon'),
  menuCloseIcon: $('#menu-close-icon'),

  generateBtn: $('#generate-btn'),
  btnText: $('#btn-text'),
  btnLoader: $('#btn-loader'),

  imageLoader: $('#image-loader'),
  imageHelper: $('#image-helper'),
  imagePreview: $('#image-preview'),
  imagePreviewContainer: $('#image-preview-container'),
  removeImageBtn: $('#remove-image-btn'),

  outputPanel: $('#output-panel'),
  historyPanel: $('#history-panel'),
  initialState: $('#initial-state'),

  modeSingleBtn: $('#mode-single'),
  modeCarouselBtn: $('#mode-carousel'),

  scriptCountGroup: $('#script-count-group'),
  slideCountGroup: $('#slide-count-group'),
  carouselTemplateGroup: $('#carousel-template-group'),
  visualStrategyGroup: $('#visual-strategy-group'),

  strategyDefaultBtn: $('#strategy-default'),
  strategyFacelessBtn: $('#strategy-faceless'),
  strategyCharacterBtn: $('#strategy-character'),
  ratio916Btn: $('#ratio-916'),
  ratio11Btn: $('#ratio-11'),
  ratio169Btn: $('#ratio-169'),

  downloadAllContainer: $('#download-all-container'),
  personaSelector: $('#persona-selector'),
  visualDnaStorage: $('#visual-dna-storage'),

  customApiKeySettingsInput: $('#custom-api-key-settings'),
  apiStatus: $('#api-status'),
  systemPromptTextarea: $('#system-prompt'),
  saveSettingsBtn: $('#save-settings-btn'),
  settingsPresetSelector: $('#settings-preset-selector'),
  savePresetBtn: $('#save-preset-btn'),
  managePresetsBtn: $('#manage-presets-btn'),
  manageCharacterPresetsBtn: $('#manage-character-presets-btn'),

  langIdBtn: $('#lang-id'),
  langEnBtn: $('#lang-en'),
  notification: $('#notification'),

  editModal: {
    el: $('#edit-modal'),
    closeBtn: $('#close-modal-btn'),
    regenerateBtn: $('#regenerate-btn'),
    originalDisplay: $('#original-script-display'),
    instructionInput: $('#revision-instruction'),
  },
  apiKeyModal: {
    el: $('#api-key-modal'),
    input: $('#modal-api-key-input'),
    saveBtn: $('#save-api-key-from-modal-btn'),
  },
  personaModal: {
    el: $('#persona-modal'),
    title: $('#persona-modal-title'),
    nameInput: $('#persona-name'),
    descInput: $('#persona-desc'),
    idInput: $('#persona-id'),
    saveBtn: $('#save-persona-btn'),
    closeBtn: $('#close-persona-modal-btn'),
    addBtn: $('#add-persona-btn'),
    listContainer: $('#persona-list-container'),
    defaultContainer: $('#default-persona-container')
  },
  confirmModal: {
    el: $('#confirm-modal'),
    title: $('#confirm-modal-title'),
    message: $('#confirm-modal-message'),
    confirmBtn: $('#confirm-modal-confirm-btn'),
    cancelBtn: $('#confirm-modal-cancel-btn'),
  },
  inputModal: {
    el: $('#input-modal'),
    title: $('#input-modal-title'),
    message: $('#input-modal-message'),
    input: $('#input-modal-input'),
    confirmBtn: $('#input-modal-confirm-btn'),
    cancelBtn: $('#input-modal-cancel-btn'),
  },

  inputs: {
    productName: $('#product-name'),
    productDesc: $('#product-desc'),
    productImage: $('#product-image'),
    writingStyle: $('#writing-style'),
    toneVibe: $('#tone-vibe'),
    targetAudience: $('#target-audience'),
    hookType: $('#hook-type'),
    ctaType: $('#cta-type'),
    slideCount: $('#slide-count'),
    scriptCount: $('#script-count'),
    carouselTemplate: $('#carousel-template'),
  },

  mobileNavGenerator: $('#mobile-nav-generator'),
  mobileNavHistory: $('#mobile-nav-history'),
  mobileNavSettings: $('#mobile-nav-settings'),
};
