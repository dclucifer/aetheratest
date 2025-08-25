// js/main.js
import { checkLogin, handleLogin, handleLogout } from './auth.js';
import { switchTheme, switchLanguage, applyTheme, applyLanguage, updateLanguageButtons, translateUI } from './ui.js';
import { switchMode, switchVisualStrategy, switchAspectRatio } from './ui.generator.js';
import { renderCharacterSheet, handleCharacterModeChange, handleCategoryChange } from './ui.character.js';
import { renderResults } from './ui.results.js';
import { showPage, toggleMobileMenu } from './ui.router.js';
import { handleImageUpload, handleRemoveImage, handleGenerate, handleRegenerate, handleGenerateAssets } from './generator.js';
import { saveApiKeyFromModal, saveSettings, loadSettings } from './settings.js';
import { handleSavePersona, handleDeletePersona, openPersonaModal, handleAddDefaultPersona, closePersonaModal } from './persona.js';
import { downloadAllScripts } from './download.js';
import { elements, closeConfirmModal, closeEditModal, showNotification, openConfirmModal, copyToClipboard, confirmCallback, tempGeneratedPart, languageState, setLoadingState } from './utils.js';
import { translations, t } from './i18n.js';
import { deleteFromHistory, nextPage, prevPage, setSearchQuery, setSortOrder, selectAllHistory, updateDeleteSelectedButton, setPostTypeFilter, toggleGroupByProduct, updateSelectAllCheckbox } from './history.js';
import { updateSingleScript, clearScripts } from './state.js';
import { populatePresetSelector, handleSavePreset, handleLoadPreset, loadLastSettings, saveLastSettings, openManagePresetsModal, closeManagePresetsModal, handlePresetManagement } from './presets.js';
import { populateCharacterPresetSelector, handleSaveCharacterPreset, handleLoadCharacterPreset, openManageCharacterPresetsModal, closeManageCharacterPresetsModal, handleCharacterPresetManagement } from './characterPresets.js';
import { loadTranslations } from './i18n.js';
import { initFormAnimations } from './ui.forms.js';
import { initMicroInteractions } from './ui.interactions.js';
import { initMigration } from './migration.js';
import { cloudStorage } from './cloud-storage.js';
import { initSyncIndicator } from './sync-ui.js';
import { initUXImprovements } from './ux-improvements.js';
import { initResultsExportToolbar } from './ux/exportZip.js';
import { initRankAll } from './ux/rank.js';

function pathSafeConsoleLogTranslations() {
    // helpful debug log that won't break when translations missing
    try {
        console.log('Language:', localStorage.getItem('aethera_language') || 'id');
        console.log('Has id.json:', !!(translations && Object.keys(translations.id || {}).length));
        console.log('Has en.json:', !!(translations && Object.keys(translations.en || {}).length));
        console.log('Sample t(light_mode_active):', t('light_mode_active'));
    } catch {}
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. INISIALISASI APLIKASI
    // Run migration first to ensure localStorage keys are updated
    initMigration();
    
    // Load translations first
    await loadTranslations();
    pathSafeConsoleLogTranslations();
    
    // Initialize form animations
    initFormAnimations();
    
    // Initialize micro-interactions
    initMicroInteractions();
    
    // Initialize sync indicator
    initSyncIndicator();
    
    // Initialize cloud storage
    await cloudStorage.init();
    
    // Clear old scripts to show effect of prompt fixes
    clearScripts();
    
    applyTheme(localStorage.getItem('aethera_theme') || 'dark');
    // Apply language after translations are loaded
    const savedLanguage = localStorage.getItem('aethera_language') || 'id';
    await applyLanguage(savedLanguage); // Use consistent language setup
    
    // Initialize UX improvements (mobile + desktop)
    initUXImprovements();
    // Initialize UX essentials only
    initResultsExportToolbar();
    initRankAll();

    checkLogin(); // Ini akan memanggil loadSettings di dalamnya
    showPage('generator');
    switchMode(localStorage.getItem('currentMode') || 'single');

    // Inisialisasi dropdowns dan muat pengaturan terakhir
    try {
        populatePresetSelector();
        populateCharacterPresetSelector();
    } catch (error) {
        console.warn('Failed to populate selectors on startup:', error.message);
    }
    loadLastSettings();

    // Inisialisasi ikon tema
    const initialTheme = localStorage.getItem('aethera_theme') || 'dark';
    document.getElementById('theme-icon-sun').classList.toggle('hidden', initialTheme === 'dark');
    document.getElementById('theme-icon-moon').classList.toggle('hidden', initialTheme === 'light');

    
    // =================================================================
    // 2. KUMPULAN EVENT LISTENER
    // =================================================================

    // --- Listener Terpusat untuk Interaksi Kartu & Riwayat ---
    document.getElementById('main-content').addEventListener('click', (e) => {
        const resultCard = e.target.closest('.result-card');
        if (resultCard) {
            if (e.target.closest('.prompt-copy-btn')) {
                const button = e.target.closest('.prompt-copy-btn');
                const originalPrompt = button.dataset.prompt;
                const cleanedPrompt = originalPrompt.replace(/<\/?char-desc>/gi, '');
                
                // Add loading state for copy button
                setLoadingState(true, button);
                
                try {
                    copyToClipboard(cleanedPrompt, button);
                } finally {
                    // Remove loading state after a short delay to show feedback
                    setTimeout(() => {
                        setLoadingState(false, button);
                    }, 500);
                }
                return;
            }
            if (e.target.closest('.generate-assets-btn')) {
                handleGenerateAssets(resultCard);
                return;
            }
        }
        const historyEntry = e.target.closest('.history-entry');
            if (historyEntry) {
                if (e.target.closest('.delete-history-btn')) {
                    openConfirmModal(
                        t('confirm_delete_entry') || 'Apakah Anda yakin ingin menghapus entri ini?',
                        async () => {
                            await deleteFromHistory(historyEntry.dataset.entryId);
                            showNotification(t('history_entry_deleted') || 'Entri riwayat berhasil dihapus.', 'success');
                        }
                    );
                }
            if (e.target.closest('.history-checkbox')) {
                updateDeleteSelectedButton();
                updateSelectAllCheckbox();
            }
        }
    });

    // --- Listener untuk Formulir & Tombol Utama ---
    elements.generateBtn.addEventListener('click', () => {
        saveLastSettings();
        handleGenerate();
    });
    document.getElementById('product-category').addEventListener('change', handleCategoryChange);
    document.getElementById('character-mode').addEventListener('change', handleCharacterModeChange);
    elements.personaSelector.addEventListener('change', () => {
        const selectedId = elements.personaSelector.value;
        const display = document.getElementById('persona-description-display');
        if (!selectedId) {
            display.classList.add('hidden');
            display.textContent = '';
            return;
        }
        const personas = JSON.parse(localStorage.getItem('aethera_personas')) || [];
        const selectedPersona = personas.find(p => p.id === selectedId);
        if (selectedPersona) {
            display.textContent = `${t('description_label')}: "${selectedPersona.description}"`;
            display.classList.remove('hidden');
        } else {
            display.classList.add('hidden');
        }
    });

    // --- Listener untuk Elemen Dinamis di Area Karakter ---
    document.getElementById('dynamic-character-sheet-area').addEventListener('click', (e) => {
        if (e.target.closest('#save-character-preset-btn')) {
            handleSaveCharacterPreset();
        }
        if (e.target.closest('#add-character-btn')) {
            const area = e.currentTarget;
            const newIndex = area.querySelectorAll('.character-sheet-instance').length;
            const newSheet = renderCharacterSheet(newIndex);
            area.insertBefore(newSheet, e.target.closest('#add-character-btn'));
            handleCategoryChange();
        }
        if (e.target.closest('.remove-character-btn')) {
            e.target.closest('.character-sheet-instance').remove();
            document.querySelectorAll('.character-sheet-instance .character-title').forEach((title, index) => {
                title.textContent = t('character_number', { number: index + 1 });
            });
        }
    });

    // --- Listener untuk Sistem Preset ---
    elements.settingsPresetSelector.addEventListener('change', handleLoadPreset);
    elements.savePresetBtn.addEventListener('click', handleSavePreset);
    elements.managePresetsBtn.addEventListener('click', openManagePresetsModal);
    document.getElementById('character-preset-selector').addEventListener('change', handleLoadCharacterPreset);
    elements.manageCharacterPresetsBtn.addEventListener('click', openManageCharacterPresetsModal);

    // --- Listener untuk Semua Modal ---
    const managePresetsModal = document.getElementById('manage-presets-modal');
    document.getElementById('close-manage-presets-modal-btn').addEventListener('click', async () => {
        const { setLoadingState } = await import('./utils.js');
        const btn = document.getElementById('close-manage-presets-modal-btn');
        setLoadingState(true, btn);
        try {
            closeManagePresetsModal();
        } finally {
            setLoadingState(false, btn);
        }
    });
    managePresetsModal.addEventListener('click', (e) => e.target === managePresetsModal && closeManagePresetsModal());
    document.getElementById('preset-list-container').addEventListener('click', handlePresetManagement);

    const manageCharPresetsModal = document.getElementById('manage-character-presets-modal');
    document.getElementById('close-manage-character-presets-modal-btn').addEventListener('click', async () => {
        const { setLoadingState } = await import('./utils.js');
        const btn = document.getElementById('close-manage-character-presets-modal-btn');
        setLoadingState(true, btn);
        try {
            closeManageCharacterPresetsModal();
        } finally {
            setLoadingState(false, btn);
        }
    });
    manageCharPresetsModal.addEventListener('click', (e) => e.target === manageCharPresetsModal && closeManageCharacterPresetsModal());
    document.getElementById('character-preset-list-container').addEventListener('click', handleCharacterPresetManagement);
    
    document.getElementById('cancel-revision-btn').addEventListener('click', closeEditModal);
    document.getElementById('regenerate-again-btn').addEventListener('click', () => {
        const newInstruction = document.getElementById('revision-instruction-stage2').value;
        document.getElementById('revision-instruction').value = newInstruction;
        handleRegenerate();
    });
    document.getElementById('apply-changes-btn').addEventListener('click', async () => {
        const cardBeingEditedId = localStorage.getItem('cardBeingEditedId');
        const cardBeingEdited = document.getElementById(cardBeingEditedId);
        if (!cardBeingEdited) {
            closeEditModal();
            return;
        }
        const { setLoadingState } = await import('./utils.js');
        const applyBtn = document.getElementById('apply-changes-btn');
        setLoadingState(true, applyBtn);
        const previousScript = JSON.parse(cardBeingEdited.dataset.script);
        let finalScript = { ...previousScript };
        if (tempGeneratedPart) {
            finalScript = { ...finalScript, ...tempGeneratedPart };
            // Regenerasi visual prompts hanya untuk bagian yang berubah agar konsisten
            try {
                const revisedSections = [];
                if (typeof tempGeneratedPart.hook?.text === 'string') revisedSections.push('hook');
                if (typeof tempGeneratedPart.body?.text === 'string') revisedSections.push('body');
                if (typeof tempGeneratedPart.cta?.text === 'string') revisedSections.push('cta');
                if (revisedSections.length > 0) {
                    const { regenerateVisualPrompts } = await import('./ui.results.js');
                    for (const sec of revisedSections) {
                        const newText = finalScript[sec].text;
                        const shots = await regenerateVisualPrompts(finalScript, sec, newText);
                        if (Array.isArray(shots) && shots.length) {
                            finalScript[sec].shots = shots;
                        }
                    }
                }
            } catch (_) {}
        }
        const { updateCardContent, initSwiper } = await import('./ui.js');
        updateCardContent(cardBeingEdited, finalScript);
        updateSingleScript(finalScript);
        // Refresh overlay agar perubahan langsung terlihat tanpa menutup overlay
        try { const { openScriptViewer } = await import('./ui.results.js'); await openScriptViewer(cardBeingEdited, finalScript); } catch(_){}
        const { showActionNotification } = await import('./utils.js');
        showActionNotification(t('notification_script_updated') || 'Skrip berhasil diperbarui!', t('undo_button') || 'Urungkan', async () => {
            updateCardContent(cardBeingEdited, previousScript);
            updateSingleScript(previousScript);
            try { const { openScriptViewer } = await import('./ui.results.js'); await openScriptViewer(cardBeingEdited, previousScript); } catch(_){}
        }, 'success');
        closeEditModal();
        setLoadingState(false, applyBtn);
    });
    
    // --- Listener untuk Navigasi & Kontrol Lainnya ---
    elements.loginBtn.addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keyup', (e) => e.key === 'Enter' && handleLogin());
    document.getElementById('login-email').addEventListener('keyup', (e) => e.key === 'Enter' && handleLogin());
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.mobileLogoutBtn.addEventListener('click', handleLogout);

    elements.navGenerator.addEventListener('click', (e) => { e.preventDefault(); showPage('generator'); });
    elements.navHistory.addEventListener('click', async (e) => {
        e.preventDefault();
        const { loadHistory } = await import('./history.js');
        await loadHistory();
        showPage('history');
    });
    elements.navSettings.addEventListener('click', (e) => { e.preventDefault(); showPage('settings'); });

    elements.mobileMenuButton.addEventListener('click', toggleMobileMenu);
    elements.mobileNavGenerator.addEventListener('click', (e) => { e.preventDefault(); showPage('generator'); toggleMobileMenu(); });
    elements.mobileNavHistory.addEventListener('click', async (e) => {
        e.preventDefault();
        const { loadHistory } = await import('./history.js');
        await loadHistory();
        showPage('history');
        toggleMobileMenu();
    });
    elements.mobileNavSettings.addEventListener('click', (e) => { e.preventDefault(); showPage('settings'); toggleMobileMenu(); });

    elements.apiKeyModal.saveBtn.addEventListener('click', async () => {
        const { setLoadingState } = await import('./utils.js');
        setLoadingState(elements.apiKeyModal.saveBtn, true);
        try {
            await saveApiKeyFromModal();
        } finally {
            setLoadingState(elements.apiKeyModal.saveBtn, false);
        }
    });

    elements.modeSingleBtn.addEventListener('click', () => switchMode('single'));
    elements.modeCarouselBtn.addEventListener('click', () => switchMode('carousel'));

    // Platform selector (unified)
    try {
        const platformSelect = document.getElementById('platform-target');
        const savedPlatform = localStorage.getItem('platform_target') || localStorage.getItem('targetPlatform') || 'tiktok';
        if (platformSelect) {
            platformSelect.value = savedPlatform;
            platformSelect.addEventListener('change', () => {
                const p = platformSelect.value;
                localStorage.setItem('platform_target', p);
                // Back-compat old key used elsewhere
                localStorage.setItem('targetPlatform', p);
                showNotification(`${t('target_platform_label') || 'Target Platform'}: ${p}`, 'success');
                // Optional: suggest CTA based on platform
                try {
                    const cta = document.getElementById('cta-type');
                    if (cta) {
                        const suggest = (
                            p === 'tiktok' ? 'cta_tiktok' :
                            p === 'shopee' ? 'cta_shopee' :
                            p === 'instagram' ? 'cta_instagram' :
                            p === 'threads' ? 'cta_instagram' :
                            p === 'shorts' ? 'cta_youtube' : 'cta_general'
                        );
                        if (Array.from(cta.options).some(o => o.value === suggest)) {
                            cta.value = suggest;
                        }
                    }
                } catch(_) {}
            });
        }
    } catch(_) {}

    elements.strategyDefaultBtn.addEventListener('click', () => switchVisualStrategy('default'));
    elements.strategyFacelessBtn.addEventListener('click', () => switchVisualStrategy('faceless'));
    elements.strategyCharacterBtn.addEventListener('click', () => switchVisualStrategy('character'));

    elements.ratio916Btn.addEventListener('click', () => switchAspectRatio('9:16'));
    elements.ratio11Btn.addEventListener('click', () => switchAspectRatio('1:1'));
    elements.ratio169Btn.addEventListener('click', () => switchAspectRatio('16:9'));

    elements.inputs.productImage.addEventListener('change', handleImageUpload);
    elements.removeImageBtn.addEventListener('click', handleRemoveImage);

    elements.editModal.closeBtn.addEventListener('click', closeEditModal);
    elements.editModal.regenerateBtn.addEventListener('click', handleRegenerate);
    elements.editModal.el.addEventListener('click', (e) => e.target === elements.editModal.el && closeEditModal());
    try { const { translateUI } = await import('./ui.js'); translateUI(); } catch(_){}

    // Empty states for output/history when there is no content
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer && resultsContainer.children.length === 0) {
        resultsContainer.innerHTML = `<div class="text-center text-gray-500 py-8">${t('empty_results_prompt') || 'Belum ada hasil. Isi detail produk dan klik Generate untuk memulai.'}</div>`;
    }
    const historyPanel = document.getElementById('history-panel');
    if (historyPanel && historyPanel.children.length === 0) {
        historyPanel.innerHTML = `<div class="text-center text-gray-500 py-8">${t('empty_history_prompt') || 'Belum ada riwayat. Hasil skrip Anda akan tampil di sini.'}</div>`;
    }

    elements.downloadAllContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('download-all-btn')) {
            downloadAllScripts(e.target.dataset.format);
        }
    });
    elements.saveSettingsBtn.addEventListener('click', saveSettings);

    elements.personaModal.addBtn.addEventListener('click', () => openPersonaModal());
    elements.personaModal.closeBtn.addEventListener('click', async () => {
        const { setLoadingState } = await import('./utils.js');
        setLoadingState(true, elements.personaModal.closeBtn);
        try {
            closePersonaModal();
        } finally {
            setLoadingState(false, elements.personaModal.closeBtn);
        }
    });
    elements.personaModal.saveBtn.addEventListener('click', async () => {
        const { setLoadingState } = await import('./utils.js');
        setLoadingState(true, elements.personaModal.saveBtn);
        try {
            await handleSavePersona();
        } finally {
            setLoadingState(false, elements.personaModal.saveBtn);
        }
    });
    elements.personaModal.listContainer.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-persona-btn');
        if (editBtn) {
            const personas = JSON.parse(localStorage.getItem('aethera_personas')) || [];
            const persona = personas.find(p => p.id === editBtn.dataset.id);
            if (persona) openPersonaModal(persona);
        }
        const deleteBtn = e.target.closest('.delete-persona-btn');
        if (deleteBtn) {
            handleDeletePersona(deleteBtn.dataset.id);
        }
    });
    elements.personaModal.defaultContainer.addEventListener('click', e => {
        if (e.target.closest('.add-default-persona-btn')) {
            const addBtn = e.target.closest('.add-default-persona-btn');
            handleAddDefaultPersona(addBtn.dataset.name, addBtn.dataset.desc);
        }
    });

    elements.confirmModal.cancelBtn.addEventListener('click', async () => {
        const { setLoadingState } = await import('./utils.js');
        setLoadingState(true, elements.confirmModal.cancelBtn);
        try {
            closeConfirmModal();
        } finally {
            setLoadingState(false, elements.confirmModal.cancelBtn);
        }
    });
    elements.confirmModal.el.addEventListener('click', (e) => e.target === elements.confirmModal.el && closeConfirmModal());
    elements.confirmModal.confirmBtn.addEventListener('click', async () => {
        const { setLoadingState } = await import('./utils.js');
        setLoadingState(true, elements.confirmModal.confirmBtn);
        try {
            if (typeof confirmCallback === 'function') {
                await confirmCallback();
            }
            closeConfirmModal();
        } finally {
            setLoadingState(false, elements.confirmModal.confirmBtn);
        }
    });

    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        const currentTheme = localStorage.getItem('aethera_theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        switchTheme(newTheme);
    });

    elements.langIdBtn.addEventListener('click', async () => await switchLanguage('id'));
    elements.langEnBtn.addEventListener('click', async () => await switchLanguage('en'));

    // Mobile theme and language toggle listeners
    const mobileThemeToggle = document.getElementById('mobile-theme-toggle-btn');
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('aethera_theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            switchTheme(newTheme);
        });
    }

    if (elements.mobileLangIdBtn) elements.mobileLangIdBtn.addEventListener('click', async () => await switchLanguage('id'));
    if (elements.mobileLangEnBtn) elements.mobileLangEnBtn.addEventListener('click', async () => await switchLanguage('en'));

    // === Bulk history actions ===
    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', async () => {
            openConfirmModal(
                t('confirm_delete_all'),
                async () => {
                    const { deleteAllHistory } = await import('./history.js');
                    await deleteAllHistory();
                    showNotification(t('history_deleted_all'), 'success');
                    document.getElementById('delete-selected-btn')?.classList.add('hidden');
                }
            );
        });
    }

    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => {
            const ids = Array.from(document.querySelectorAll('.history-checkbox:checked'))
                .map(cb => cb.closest('.history-entry')?.dataset.entryId)
                .filter(Boolean);
            if (ids.length === 0) return;
            openConfirmModal(
                t('confirm_delete_selected').replace('{n}', ids.length),
                async () => {
                    await deleteFromHistory(ids);
                    showNotification(t('history_deleted_selected'), 'success');
                    document.getElementById('delete-selected-btn')?.classList.add('hidden');
                }
            );
        });
    }
    
    // === History pagination controls ===
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    if (prevPageBtn) prevPageBtn.addEventListener('click', prevPage);
    if (nextPageBtn) nextPageBtn.addEventListener('click', nextPage);
    
    // === History search and filter ===
    const historySearch = document.getElementById('history-search');
    const historySort = document.getElementById('history-sort');
    const selectAllHistoryCheckbox = document.getElementById('select-all-history');
    
    if (historySearch) {
        historySearch.addEventListener('input', (e) => {
            setSearchQuery(e.target.value);
        });
    }
    
    if (historySort) {
        historySort.addEventListener('change', (e) => {
            setSortOrder(e.target.value);
        });
    }
    
    if (selectAllHistoryCheckbox) {
        selectAllHistoryCheckbox.addEventListener('change', (e) => {
            selectAllHistory(e.target.checked);
        });
    }
    
    // Initialize back to top functionality
    // Remove call to initBackToTop since it's not defined/exported
    // (call removed)
    
    // Post type filter tabs
    document.querySelectorAll('.post-type-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.dataset.filter;
            setPostTypeFilter(filter);
        });
    });
    
    // Group by product checkbox
    const groupByProductCheckbox = document.getElementById('group-by-product');
    if (groupByProductCheckbox) {
        groupByProductCheckbox.addEventListener('change', toggleGroupByProduct);
    }
});


// === Aethera: Header scroll effect & About/Readme modals ===
(function(){
  const headerEl = document.querySelector('header.sticky');
  function updateHeaderOnScroll(){
    const scrolled = (window.scrollY || document.documentElement.scrollTop) > 8;
    if (!headerEl) return;
    headerEl.classList.toggle('bg-gray-900/70', !scrolled);
    headerEl.classList.toggle('bg-gray-900/50',  scrolled);
    headerEl.classList.toggle('backdrop-blur-sm', !scrolled);
    headerEl.classList.toggle('backdrop-blur-md', scrolled);
    headerEl.classList.toggle('shadow-sm', scrolled);
  }
  window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });
  updateHeaderOnScroll();

  function openModal(el){ el?.classList.remove('opacity-0','pointer-events-none'); el?.querySelector('.modal-content')?.classList.remove('scale-95'); }
  function closeModal(el){ el?.classList.add('opacity-0','pointer-events-none');  el?.querySelector('.modal-content')?.classList.add('scale-95'); }

  const aboutModal = document.getElementById('about-modal');
  const navAbout   = document.getElementById('nav-about');
  const mNavAbout  = document.getElementById('mobile-nav-about');

  [navAbout, mNavAbout].forEach(b => b && b.addEventListener('click', e => { e.preventDefault(); openModal(aboutModal); }));

  document.querySelectorAll('.about-close').forEach(b => b.addEventListener('click', () => closeModal(aboutModal)));

  aboutModal && aboutModal.addEventListener('click', e => { if (e.target === aboutModal) closeModal(aboutModal); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(aboutModal); } });
})();

// =================================================================
// ONBOARDING TUTORIAL SYSTEM
// =================================================================

// =================================================================
// ONBOARDING FUNCTIONALITY (moved to onboarding.js)
// =================================================================

const freedomSlider = document.getElementById('creative-freedom');
const freedomValue = document.getElementById('freedom-value');

const updateFreedomLabel = (value) => {
    let label = t('freedom_balanced');
    if (value <= 0.3) label = t('freedom_very_obedient');
    if (value >= 0.9) label = t('freedom_very_creative');
    freedomValue.textContent = `${value} (${label})`;
};

if (freedomSlider) {
  freedomSlider.addEventListener('input', (e) => {
    updateFreedomLabel(e.target.value);
  });
  // Inisialisasi label saat pertama kali dimuat
  updateFreedomLabel(freedomSlider.value);
}

// === Aethera: Manual modal (iframe) ===
(function(){
  function openModal(el){ el?.classList.remove('opacity-0','pointer-events-none'); el?.querySelector('.modal-content')?.classList.remove('scale-95'); }
  function closeModal(el){ el?.classList.add('opacity-0','pointer-events-none');  el?.querySelector('.modal-content')?.classList.add('scale-95'); }
  const manualModal = document.getElementById('manual-modal');
  const navManual = document.getElementById('nav-manual');
  const mNavManual = document.getElementById('mobile-nav-manual');
  [navManual, mNavManual].forEach(b => b && b.addEventListener('click', (e) => { e.preventDefault(); openModal(manualModal); }));
  document.querySelectorAll('.manual-close').forEach(b => b.addEventListener('click', () => closeModal(manualModal)));
  manualModal?.addEventListener('click', (e) => { if (e.target === manualModal) closeModal(manualModal); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(manualModal); });
})();

// === Aethera: header glass via .is-scrolled class ===
(function(){
  const headerEl = document.querySelector('header.sticky');
  function onScroll(){
    const y = (window.scrollY || document.documentElement.scrollTop) || 0;
    if (!headerEl) return;
    if (y > 8) headerEl.classList.add('is-scrolled');
    else headerEl.classList.remove('is-scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();


try{ import('./ux/exportZip.js').then(m=>m.initResultsExportToolbar && m.initResultsExportToolbar()); }catch(e){}
try{ import('./ux/rank.js').then(m=>m.initRankAll && m.initRankAll()); }catch(e){}
