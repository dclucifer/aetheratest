// js/utils.js
import { t } from './i18n.js';

export const elements = {
    loginOverlay: document.getElementById('login-overlay'),
    loginBtn: document.getElementById('login-btn'),
    appContainer: document.getElementById('app-container'),
    generatorPage: document.getElementById('generator-page'),
    historyPage: document.getElementById('history-page'),
    settingsPage: document.getElementById('settings-page'),
    accountPage: document.getElementById('account-page'),
    navGenerator: document.getElementById('nav-generator'),
    navHistory: document.getElementById('nav-history'),
    navSettings: document.getElementById('nav-settings'),
    navAccount: document.getElementById('nav-account'),
    logoutBtn: document.getElementById('logout-btn'),
    mobileLogoutBtn: document.getElementById('mobile-logout-btn'),
    mobileMenuButton: document.getElementById('mobile-menu-button'),
    mobileMenu: document.getElementById('mobile-menu'),
    menuOpenIcon: document.getElementById('menu-open-icon'),
    menuCloseIcon: document.getElementById('menu-close-icon'),
    generateBtn: document.getElementById('generate-btn'),
    btnText: document.getElementById('btn-text'),
    btnLoader: document.getElementById('btn-loader'),
    imageLoader: document.getElementById('image-loader'),
    imageHelper: document.getElementById('image-helper'),
    imagePreview: document.getElementById('image-preview'),
    imagePreviewContainer: document.getElementById('image-preview-container'),
    removeImageBtn: document.getElementById('remove-image-btn'),
    outputPanel: document.getElementById('output-panel'),
    historyPanel: document.getElementById('history-panel'),
    initialState: document.getElementById('initial-state'),
    modeSingleBtn: document.getElementById('mode-single'),
    modeCarouselBtn: document.getElementById('mode-carousel'),
    scriptCountGroup: document.getElementById('script-count-group'),
    slideCountGroup: document.getElementById('slide-count-group'),
    carouselTemplateGroup: document.getElementById('carousel-template-group'),
    visualStrategyGroup: document.getElementById('visual-strategy-group'),
    strategyDefaultBtn: document.getElementById('strategy-default'),
    strategyFacelessBtn: document.getElementById('strategy-faceless'),
    strategyCharacterBtn: document.getElementById('strategy-character'),
    ratio916Btn: document.getElementById('ratio-916'),
    ratio11Btn: document.getElementById('ratio-11'),
    ratio169Btn: document.getElementById('ratio-169'),
    downloadAllContainer: document.getElementById('download-all-container'),
    personaSelector: document.getElementById('persona-selector'),
    visualDnaStorage: document.getElementById('visual-dna-storage'),
    customApiKeySettingsInput: document.getElementById('custom-api-key-settings'),
    apiStatus: document.getElementById('api-status'),
    systemPromptTextarea: document.getElementById('system-prompt'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    settingsPresetSelector: document.getElementById('settings-preset-selector'),
    savePresetBtn: document.getElementById('save-preset-btn'),
    managePresetsBtn: document.getElementById('manage-presets-btn'),
    manageCharacterPresetsBtn: document.getElementById('manage-character-presets-btn'),
    langIdBtn: document.getElementById('lang-id'),
    langEnBtn: document.getElementById('lang-en'),
    notification: document.getElementById('notification'),
    editModal: {
        el: document.getElementById('edit-modal'),
        closeBtn: document.getElementById('close-modal-btn'),
        regenerateBtn: document.getElementById('regenerate-btn'),
        originalDisplay: document.getElementById('original-script-display-stage1'),
        instructionInput: document.getElementById('revision-instruction'),
    },
    apiKeyModal: {
        el: document.getElementById('api-key-modal'),
        input: document.getElementById('modal-api-key-input'),
        saveBtn: document.getElementById('save-api-key-from-modal-btn'),
    },
    personaModal: {
        el: document.getElementById('persona-modal'),
        title: document.getElementById('persona-modal-title'),
        nameInput: document.getElementById('persona-name'),
        descInput: document.getElementById('persona-desc'),
        idInput: document.getElementById('persona-id'),
        saveBtn: document.getElementById('save-persona-btn'),
        closeBtn: document.getElementById('close-persona-modal-btn'),
        addBtn: document.getElementById('add-persona-btn'),
        listContainer: document.getElementById('persona-list-container'),
        defaultContainer: document.getElementById('default-persona-container')
    },
    confirmModal: {
        el: document.getElementById('confirm-modal'),
        title: document.getElementById('confirm-modal-title'),
        message: document.getElementById('confirm-modal-message'),
        confirmBtn: document.getElementById('confirm-modal-confirm-btn'),
        cancelBtn: document.getElementById('confirm-modal-cancel-btn'),
    },
    inputs: {
        productName: document.getElementById('product-name'),
        productDesc: document.getElementById('product-desc'),
        productImage: document.getElementById('product-image'),
        writingStyle: document.getElementById('writing-style'),
        toneVibe: document.getElementById('tone-vibe'),
        targetAudience: document.getElementById('target-audience'),
        hookType: document.getElementById('hook-type'),
        ctaType: document.getElementById('cta-type'),
        slideCount: document.getElementById('slide-count'),
        scriptCount: document.getElementById('script-count'),
        carouselTemplate: document.getElementById('carousel-template'),
    },
    mobileNavGenerator: document.getElementById('mobile-nav-generator'),
    mobileNavHistory: document.getElementById('mobile-nav-history'),
    mobileNavSettings: document.getElementById('mobile-nav-settings'),
    mobileNavAccount: document.getElementById('mobile-nav-account'),
};

export const themeState = {
  current: localStorage.getItem('direktiva_theme') || 'dark'
};
export const languageState = {
  current: localStorage.getItem('direktiva_language') || 'id'
};
export let confirmCallback = null;
export let tempGeneratedPart = null;

// Translations are now loaded from JSON files in the locales folder
// See js/i18n.js for the new translation system

export function setLoadingState(isLoading, button, textEl, loaderEl) {
    if (!button) return;
    
    button.disabled = isLoading;
    
    // Universal loading state handling
    if (isLoading) {
        button.classList.add('btn-loading');
        
        // Check if button already has spinner structure
        let spinner = button.querySelector('.btn-spinner');
        if (!spinner) {
            // Create spinner structure if it doesn't exist
            const originalText = button.textContent || button.innerHTML;
            button.innerHTML = `
                <span class="btn-text">${originalText}</span>
                <span class="btn-spinner">
                    <div class="spinner"></div>
                </span>
            `;
        } else {
            // Show existing spinner
            spinner.style.display = 'flex';
            const textSpan = button.querySelector('.btn-text');
            if (textSpan) textSpan.style.opacity = '0';
        }
    } else {
        button.classList.remove('btn-loading');
        
        const spinner = button.querySelector('.btn-spinner');
        const textSpan = button.querySelector('.btn-text');
        
        if (spinner && textSpan) {
            spinner.style.display = 'none';
            textSpan.style.opacity = '1';
        }
    }
    
    // Special handling for generate button
    if (isLoading && button.id === 'generate-btn') {
        if (elements.initialState) elements.initialState.style.display = 'none';
        elements.outputPanel.innerHTML = ''; // Kosongkan panel dulu

        const scriptCount = parseInt(elements.inputs.scriptCount.value, 10) || 1;
        const skeletonTemplate = document.getElementById('skeleton-card-template');

        for (let i = 0; i < scriptCount; i++) {
            const clone = skeletonTemplate.content.cloneNode(true);
            elements.outputPanel.appendChild(clone);
        }
    }
}

export function showNotification(message, type = 'default', duration = 3000) {
    // Try to translate if a translation exists for the provided key
    let displayMessage = message;
    let isTranslationKey = typeof message === 'string' && message.includes('_') && !message.includes(' ');
    
    try {
        const translated = t(message);
        // Only use the translated message if it's different from the key
        if (translated && translated !== message) {
            displayMessage = translated;
            isTranslationKey = false; // Successfully translated
        }
    } catch (error) {
        console.warn('Translation error in showNotification:', error);
    }

    // Removed previous single-timeout retry; replace with bounded polling below

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Add icon based on type using standardized icon classes
    let iconClass = '';
    switch(type) {
        case 'success':
            iconClass = 'icon-check';
            break;
        case 'error':
            iconClass = 'icon-error';
            break;
        case 'warning':
            iconClass = 'icon-warning';
            break;
        default:
            iconClass = 'icon-info';
    }
    
    notification.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="icon icon-md ${iconClass} flex-shrink-0 notification-icon"></div>
            <div class="flex-1 notification-message">${displayMessage}</div>
            <button class="icon-btn notification-close" onclick="this.parentElement.parentElement.remove()">
                <div class="icon icon-sm icon-close"></div>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // If this looks like a translation key but wasn't translated yet, poll briefly
    if (isTranslationKey && displayMessage === message) {
        const originalKey = message;
        let attempts = 0;
        const maxAttempts = 20; // ~3s total with 150ms interval
        const intervalMs = 150;
        const messageElement = notification.querySelector('.notification-message');
        const intervalId = setInterval(() => {
            try {
                const retryTranslated = t(originalKey);
                if (retryTranslated && retryTranslated !== originalKey) {
                    if (messageElement && messageElement.textContent === originalKey) {
                        messageElement.textContent = retryTranslated;
                    }
                    clearInterval(intervalId);
                }
            } catch (retryError) {
                // Stop polling on unexpected errors to avoid noise
                clearInterval(intervalId);
            } finally {
                attempts++;
                if (attempts >= maxAttempts) {
                    clearInterval(intervalId);
                }
            }
        }, intervalMs);
    }
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// Notification with action button (e.g., Undo)
export function showActionNotification(message, actionLabel, actionCallback, type = 'success', duration = 7000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="icon icon-md icon-info flex-shrink-0 notification-icon"></div>
            <div class="flex-1 notification-message">${message}</div>
            <button class="px-3 py-1 rounded bg-gray-800 text-white hover:bg-gray-700 action-btn">${actionLabel}</button>
            <button class="icon-btn notification-close"><div class="icon icon-sm icon-close"></div></button>
        </div>
    `;
    const close = () => { try{ notification.remove(); }catch(_){} };
    notification.querySelector('.notification-close')?.addEventListener('click', close);
    notification.querySelector('.action-btn')?.addEventListener('click', async () => {
        try { await actionCallback?.(); } finally { close(); }
    });
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(close, duration);
}

export function copyToClipboard(text, button = null) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    
    try {
        document.execCommand('copy');
        showNotification(t('notification_copy_success'));
        
        // Add visual feedback for copy button
        if (button) {
            const originalContent = button.innerHTML;
            button.innerHTML = '<div class="icon icon-md icon-check text-green-500"></div>';
            button.classList.add('copy-success');
            
            // Add highlight animation to the content being copied
            const contentElement = button.closest('.result-card, .script-part, .slide-text');
            if (contentElement) {
                contentElement.classList.add('copy-highlight');
                setTimeout(() => {
                    contentElement.classList.remove('copy-highlight');
                }, 600);
            }
            
            setTimeout(() => {
                button.innerHTML = originalContent;
                button.classList.remove('copy-success');
            }, 1500);
        }
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
    document.body.removeChild(ta);
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

export function openInputModal(title, message, placeholder, onConfirm) {
    const modal = document.getElementById('input-modal');
    const titleEl = document.getElementById('input-modal-title');
    const messageEl = document.getElementById('input-modal-message');
    const inputEl = document.getElementById('input-modal-input');
    const cancelBtn = document.getElementById('input-modal-cancel-btn');
    const confirmBtn = document.getElementById('input-modal-confirm-btn');
    
    // Set modal content
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (inputEl) {
        inputEl.placeholder = placeholder || '';
        inputEl.value = '';
    }
    
    // Show modal
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.querySelector('.modal-content').classList.remove('scale-95');
    
    // Focus input
    if (inputEl) {
        setTimeout(() => inputEl.focus(), 100);
    }
    
    // Setup event handlers
    const handleConfirm = () => {
        const value = inputEl ? inputEl.value.trim() : '';
        closeInputModal();
        if (onConfirm) onConfirm(value);
    };
    
    const handleCancel = () => {
        closeInputModal();
    };
    
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };
    
    // Remove existing listeners to prevent duplicates
    if (confirmBtn) {
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        document.getElementById('input-modal-confirm-btn').addEventListener('click', handleConfirm);
    }
    if (cancelBtn) {
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        document.getElementById('input-modal-cancel-btn').addEventListener('click', handleCancel);
    }
    if (inputEl) {
        inputEl.addEventListener('keypress', handleKeyPress);
    }
}

export function closeInputModal() {
    const modal = document.getElementById('input-modal');
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.querySelector('.modal-content').classList.add('scale-95');
}

export function openConfirmModal(message, onConfirm) {
    elements.confirmModal.message.textContent = message;
    confirmCallback = onConfirm;
    elements.confirmModal.el.classList.remove('opacity-0', 'pointer-events-none');
    elements.confirmModal.el.querySelector('.modal-content').classList.remove('scale-95');
}

export function closeConfirmModal() {
    elements.confirmModal.el.classList.add('opacity-0', 'pointer-events-none');
    elements.confirmModal.el.querySelector('.modal-content').classList.add('scale-95');
    confirmCallback = null;
}

export function openEditModal(cardElement) {
  try{ window.onbeforeunload = null; }catch(e){}

    const { editModal } = elements;
    const script = JSON.parse(cardElement.dataset.script);

    // Reset modal ke tampilan awal (Tahap 1)
    document.getElementById('edit-modal-stage-1').style.display = 'flex';
    document.getElementById('edit-modal-stage-1').style.flexDirection = 'column';
    document.getElementById('edit-modal-stage-2').style.display = 'none';

    // Reset checkboxes dan input
    document.querySelectorAll('.section-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('revision-instruction').value = '';

    // (PERUBAHAN KUNCI) Cari elemen display yang baru dan isi dengan skrip
    const originalDisplayStage1 = document.getElementById('original-script-display-stage1');
    if (editModal.originalDisplay) {
        editModal.originalDisplay.textContent = getSimpleScriptTextForModal(script);
    }

    // Simpan ID kartu yang sedang diedit
    localStorage.setItem('cardBeingEditedId', cardElement.id);
    try{ const d=JSON.parse(localStorage.getItem('edit_draft_'+cardElement.id)||'null'); if(d){ (document.getElementById('revision-instruction')||{}).value=d.text||''; (document.getElementById('revision-instruction-stage2')||{}).value=d.text||''; (d.sections||[]).forEach(id=>{ const el=document.getElementById(id); if(el && el.classList.contains('section-checkbox')) el.checked=true; }); } }catch(e){}
    const _save=()=>{ const text=(document.getElementById('revision-instruction')||{}).value||''; const sections=Array.from(document.querySelectorAll('.section-checkbox')).filter(cb=>cb.checked).map(cb=>cb.id); localStorage.setItem('edit_draft_'+cardElement.id, JSON.stringify({text,sections,ts:Date.now()})); if(text||sections.length>0){ window.onbeforeunload=(e)=>{ e.preventDefault(); e.returnValue=''; return ''; }; } };
    const _debounce=(()=>{ let t; return ()=>{ clearTimeout(t); t=setTimeout(_save, 500); }; })();
    const t1=document.getElementById('revision-instruction'); if(t1) t1.addEventListener('input', _debounce);
    const t2=document.getElementById('revision-instruction-stage2'); if(t2) t2.addEventListener('input', _debounce);
    document.querySelectorAll('.section-checkbox').forEach(cb=>cb.addEventListener('change', _debounce));
    
    // Tampilkan modal
    editModal.el.classList.remove('opacity-0', 'pointer-events-none');
    editModal.el.querySelector('.modal-content').classList.remove('scale-95');
}

export function showBeforeAfter(originalScript, newPart, sectionsToUpdate) {
    document.getElementById('edit-modal-stage-1').style.display = 'none';
    document.getElementById('edit-modal-stage-2').style.display = 'block';

    const beforeDisplay = document.getElementById('before-script-display')
    const afterDisplay = document.getElementById('after-script-display');
    const instructionInput = document.getElementById('revision-instruction-stage2');

    // (PERUBAHAN KUNCI) Selalu isi kembali kolom "Versi Asli" dengan skrip lengkap
    if (beforeDisplay) {
        beforeDisplay.textContent = getSimpleScriptTextForModal(originalScript, ['hook', 'body', 'cta']);
    }
    
    // Buat objek skrip baru yang sudah diperbarui secara lengkap
    const updatedScript = { ...originalScript, ...newPart };

    // Tampilkan hasil regenerasi yang LENGKAP di kolom "after"
    afterDisplay.textContent = getSimpleScriptTextForModal(updatedScript, ['hook', 'body', 'cta']);
    
    // Simpan hasil sementara (hanya bagian yang baru)
    tempGeneratedPart = newPart;
    
    // Salin instruksi ke input di Tahap 2
    instructionInput.value = document.getElementById('revision-instruction').value;
}

export function getSimpleScriptTextForModal(script, sections = ['hook', 'body', 'cta']) {
    if (!script) return t('script_not_found') || "Skrip tidak ditemukan.";
    
    let textForDisplay = `${t('title_label') || 'Judul'}: ${script.title}\n\n`;

    const createPartText = (partName, partData) => {
        if (!partData) return '';
        let text = `--- ${partName.toUpperCase()} ---\n`;
        text += `${t('script_text_label') || 'Teks Skrip'}: ${partData.text}\n`;
        partData.shots.forEach((shot, i) => {
            text += `${t('visual_idea_label') || 'Ide Visual'} ${i + 1}: ${shot.visual_idea}\n`;
        });
        return text + '\n';
    };

    if (script.hook && sections.includes('hook')) {
        textForDisplay += createPartText("HOOK", script.hook);
    }
    if (script.body && sections.includes('body')) {
        textForDisplay += createPartText("BODY", script.body);
    }
    if (script.cta && sections.includes('cta')) {
        textForDisplay += createPartText("CTA", script.cta);
    }
    
    if (script.slides) { // Add support for Carousel mode
         script.slides.forEach((slide, i) => {
            if(sections.includes(`slide${i}`)){ // Only show revised slides (if needed)
                textForDisplay += `--- SLIDE ${i + 1} ---\n`;
                textForDisplay += `${t('slide_text_label') || 'Slide Text'}: ${slide.slide_text}\n`;
            }
        });
    }

    return textForDisplay;
}

export function closeEditModal() {
    const { editModal } = elements;
    editModal.el.classList.add('opacity-0', 'pointer-events-none');
    editModal.el.querySelector('.modal-content').classList.add('scale-95');
    localStorage.removeItem('cardBeingEditedId');
    tempGeneratedPart = null; // Clear temporary data when modal is closed
}

export function getFullScriptText(cardElementOrScript, forDisplay = false) {
    // Logika untuk mendapatkan teks skrip lengkap
    const script = (typeof cardElementOrScript.dataset?.script === 'string')
        ? JSON.parse(cardElementOrScript.dataset.script)
        : cardElementOrScript;

    let fullText = `${t('script_title_label') || 'Judul'}: ${script.title}\n\n`;

    if (script.hook) { // Single Post Mode
        if (script.character_sheet && script.character_sheet.length > 0) {
            script.character_sheet.forEach(cs => {
                fullText += `${t('character_label') || 'Karakter'}: ${getCharacterDescriptionString(cs)}\n`;
            });
            fullText += '\n';
        }

        const createPartText = (part, partData) => {
            let text = `${part}:\n${partData.text}\n`;
            partData.shots.forEach((shot, i) => {
                text += ` ${t('shot_label') || 'Shot'} ${i + 1} ${t('visual_idea_label_short') || 'Ide'}: ${shot.visual_idea}\n`;
                text += ` ${t('shot_label') || 'Shot'} ${i + 1} ${t('t2i_prompt_label_short') || 'T2I'}: ${shot.text_to_image_prompt}\n`;
                text += ` ${t('shot_label') || 'Shot'} ${i + 1} ${t('i2v_prompt_label_short') || 'I2V'}: ${shot.image_to_video_prompt}\n`;
            });
            return text;
        };
        fullText += createPartText(t('hook_title'), script.hook);
        fullText += `\n${createPartText(t('body_title'), script.body)}`;
        fullText += `\n${createPartText(t('cta_title'), script.cta)}`;
    } else if (script.slides) { // Carousel Mode
        script.slides.forEach((slide, i) => {
            fullText += `--- ${t('slide_label')} ${i + 1} ---\n`;
            fullText += `${t('slide_text_label')}: ${slide.slide_text}\n`;
            fullText += `${t('t2i_prompt_label')}: ${slide.text_to_image_prompt}\n`;
            if (slide.layout_suggestion) fullText += `${t('slide_layout_suggestion')}: ${slide.layout_suggestion}\n`;
            if (slide.engagement_idea) fullText += `${t('slide_engagement_idea')}: ${slide.engagement_idea}\n`;
            fullText += `\n`;
        });
    }
    return fullText;
}

export function getCharacterDescriptionString(cs) {
    if (!cs) return '';

    // Gunakan array untuk menampung bagian-bagian deskripsi
    const parts = [];

    // Nama dan Usia
    if (cs.name) parts.push(cs.name);
    if (cs.age) parts.push(`${cs.age} years old`);

    // Atribut Fisik
    if (cs.ethnicity) parts.push(cs.ethnicity);
    if (cs.skin_tone) parts.push(`${cs.skin_tone} skin`);
    if (cs.face_shape) parts.push(`${cs.face_shape} face`);
    if (cs.body_shape) parts.push(cs.body_shape);

    // Deskripsi Rambut (gabungkan style dan warna)
    const hairParts = [];
    if (cs.hair_style) hairParts.push(cs.hair_style);
    if (cs.hair_color) hairParts.push(cs.hair_color);
    if (hairParts.length > 0) {
        parts.push(`${hairParts.join(' ')} hair`);
    }

    // Deskripsi Mata
    if (cs.eye_color) parts.push(`${cs.eye_color} eyes`);

    // Gabungkan semua bagian dengan koma
    return parts.join(', ');
}

// Function to handle A/B variant usage with visual prompt regeneration
window.useVariant = async function(partKey, variantIndex) {
    // Find the card element that contains this variant
    const partElement = document.querySelector(`[data-part="${partKey}"]`);
    if (!partElement) return;
    
    const cardElement = partElement.closest('.result-card');
    if (!cardElement) return;
    
    // Get the script data from the card
    const scriptData = JSON.parse(cardElement.dataset.script || '{}');
    if (!scriptData) return;
    
    // Get the variant text
    const variantKey = `${partKey}_variants`;
    const variants = scriptData[variantKey];
    if (!variants || !variants[variantIndex]) return;
    
    const newText = variants[variantIndex];
    
    // Import and use the applyVariantToScript function that handles visual prompt regeneration
    try {
        const { applyVariantToScript } = await import('./ui.results.js');
        await applyVariantToScript(cardElement, scriptData, partKey, newText);
        
        // Add visual feedback
        const variantElement = partElement.querySelector(`[data-variant-index="${variantIndex}"]`);
        if (variantElement) {
            variantElement.style.backgroundColor = '#065f46'; // green-800
            variantElement.style.borderColor = '#10b981'; // emerald-500
            setTimeout(() => {
                variantElement.style.backgroundColor = '';
                variantElement.style.borderColor = '';
            }, 2000);
        }
    } catch (error) {
        console.error('Error applying variant:', error);
        // Fallback to simple text update if regeneration fails
        if (scriptData[partKey] && scriptData[partKey].text) {
            scriptData[partKey].text = newText;
        }
        cardElement.dataset.script = JSON.stringify(scriptData);
        
        const textElement = partElement.querySelector('p');
        if (textElement) {
            textElement.textContent = newText;
        }
        
        const translatedMessage = t('variant_applied_success', { part: partKey.toUpperCase() }) || `Variant ${partKey.toUpperCase()} successfully applied!`;
        showNotification(translatedMessage, 'success');
    }
};
