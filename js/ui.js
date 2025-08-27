// js/ui.js
import { elements, themeState, languageState, getCharacterDescriptionString, openEditModal, showNotification } from './utils.js';
import { t, translations } from './i18n.js';
import { loadHistory } from './history.js';
import { populatePersonaSelector, renderDefaultPersonas, renderPersonas } from './persona.js';
import { handleCharacterModeChange } from './ui.character.js';

export function applyTheme(theme) {
    const isLight = theme === 'light';
    // Toggle kelas untuk hook CSS berbasis class
    document.body.classList.toggle('light-mode', isLight);
    document.body.classList.toggle('dark-mode', !isLight);
    // Toggle juga data attribute untuk hook CSS berbasis attribute
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    // Persist & state
    try { 
        localStorage.setItem('aethera_theme', isLight ? 'light' : 'dark');
        // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
        localStorage.setItem('aethera_settings_last_modified', new Date().toISOString());
    } catch {}
    themeState.current = isLight ? 'light' : 'dark';
    updateThemeToggleIcon(isLight ? 'light' : 'dark');
}

export function switchTheme(theme) {
    // kalau tidak dikirim parameter, toggle dari state sekarang
    const target = theme || (themeState.current === 'light' ? 'dark' : 'light');
    applyTheme(target);
    // opsional: tampilkan toast dengan fallback human-friendly jika translasi belum siap
    if (typeof showNotification === 'function') {
        const key = target === 'dark' ? 'dark_mode_active' : 'light_mode_active';
        const translated = t(key);
        let message = translated;
        if (!translated || translated === key) {
            const lang = (languageState && languageState.current) || 'id';
            if (lang === 'en') {
                message = key === 'light_mode_active' ? 'Light Mode Active' : 'Dark Mode Active';
            } else {
                message = key === 'light_mode_active' ? 'Mode Terang Aktif' : 'Mode Gelap Aktif';
            }
        }
        showNotification(message);
    }
}

export function updateThemeToggleIcon(theme) {
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
        sunIcon.classList.toggle('hidden', theme === 'dark');
        moonIcon.classList.toggle('hidden', theme === 'light');
    }
    
    // Update mobile theme toggle icons
    const mobileSunIcon = document.getElementById('mobile-theme-icon-sun');
    const mobileMoonIcon = document.getElementById('mobile-theme-icon-moon');
    if (mobileSunIcon && mobileMoonIcon) {
        mobileSunIcon.classList.toggle('hidden', theme === 'dark');
        mobileMoonIcon.classList.toggle('hidden', theme === 'light');
    }

    // Update mobile theme text label according to current theme and language
    const mobileThemeText = document.getElementById('mobile-theme-text');
    if (mobileThemeText) {
        const key = theme === 'dark' ? 'theme_dark' : 'theme_light';
        const fallback = theme === 'dark' ? 'Dark' : 'Light';
        const label = t(key);
        mobileThemeText.textContent = (label && label !== key) ? label : fallback;
    }
}

export async function applyLanguage(lang) {
    document.documentElement.lang = lang;
    localStorage.setItem('aethera_language', lang);
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_settings_last_modified', new Date().toISOString());
    languageState.current = lang;
    updateLanguageButtons();
    await translateUI();
    await updateSystemPromptForLanguage(lang);
}

async function updateSystemPromptForLanguage(lang) {
    // Import the prompts from settings
    const { DEFAULT_SYSTEM_PROMPT, ENGLISH_SYSTEM_PROMPT } = await import('./settings.js');
    const currentCustomPrompt = localStorage.getItem('aethera_system_prompt');
    const newPrompt = lang === 'en' ? ENGLISH_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT;
    
    // Always update system prompt to match the selected language
    // This ensures content generation uses the correct language prompt
    localStorage.setItem('aethera_system_prompt', newPrompt);
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_settings_last_modified', new Date().toISOString());
    
    // Update the textarea if it exists
    const systemPromptTextarea = document.getElementById('system-prompt');
    if (systemPromptTextarea) {
        systemPromptTextarea.value = newPrompt;
    }
    
    console.log(`System prompt updated for language: ${lang}`);
}

export async function switchLanguage(lang) {
    await applyLanguage(lang);
    
    // Re-render character sheet to apply new language
    const characterMode = document.getElementById('character-mode');
    if (characterMode) {
        handleCharacterModeChange();
    }
}

export function updateLanguageButtons() {
    elements.langIdBtn.classList.remove('bg-blue-600', 'text-white');
    elements.langIdBtn.classList.add('text-gray-400', 'hover:bg-gray-700');
    elements.langEnBtn.classList.remove('bg-blue-600', 'text-white');
    elements.langEnBtn.classList.add('text-gray-400', 'hover:bg-gray-700');

    if (localStorage.getItem('aethera_language') === 'id') {
        elements.langIdBtn.classList.add('bg-blue-600', 'text-white');
        elements.langIdBtn.classList.remove('text-gray-400', 'hover:bg-gray-700');
    } else {
        elements.langEnBtn.classList.add('bg-blue-600', 'text-white');
        elements.langEnBtn.classList.remove('text-gray-400', 'hover:bg-gray-700');
    }
    
    // Update mobile language buttons
    const mobileLangIdBtn = document.getElementById('mobile-lang-id');
    const mobileLangEnBtn = document.getElementById('mobile-lang-en');
    
    if (mobileLangIdBtn && mobileLangEnBtn) {
        mobileLangIdBtn.classList.remove('bg-blue-600', 'text-white');
        mobileLangIdBtn.classList.add('text-gray-400', 'hover:bg-gray-700');
        mobileLangEnBtn.classList.remove('bg-blue-600', 'text-white');
        mobileLangEnBtn.classList.add('text-gray-400', 'hover:bg-gray-700');

        if (localStorage.getItem('aethera_language') === 'id') {
            mobileLangIdBtn.classList.add('bg-blue-600', 'text-white');
            mobileLangIdBtn.classList.remove('text-gray-400', 'hover:bg-gray-700');
        } else {
            mobileLangEnBtn.classList.add('bg-blue-600', 'text-white');
            mobileLangEnBtn.classList.remove('text-gray-400', 'hover:bg-gray-700');
        }
    }
}

// Ensure function accessible globally for cross-module calls (e.g., cloud sync)
if (typeof window !== 'undefined') {
    window.updateLanguageButtons = updateLanguageButtons;
}
export function updateApiStatus() {
    const userApiKey = localStorage.getItem('aethera_user_api_key');
    if (userApiKey) {
        const key = 'api_status_user';
        const translated = t(key);
        elements.apiStatus.textContent = (translated && translated !== key) ? translated : (localStorage.getItem('aethera_language') === 'en' ? 'Using your API Key' : 'Menggunakan API Key Anda');
        elements.apiStatus.className = 'text-xs font-semibold text-green-400';
    } else {
        const key = 'api_status_default';
        const translated = t(key);
        elements.apiStatus.textContent = (translated && translated !== key) ? translated : (localStorage.getItem('aethera_language') === 'en' ? 'Using default API (limited)' : 'Menggunakan API default (terbatas)');
        elements.apiStatus.className = 'text-xs font-semibold text-yellow-400';
    }
}

export async function translateUI() {
    // Translation check is handled by t() function
    
    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.dataset.langKey;
        const translatedText = t(key);
        if (translatedText && translatedText !== key) {
            if (element.tagName === 'INPUT' && element.placeholder) {
                element.placeholder = translatedText;
            } else if (element.tagName === 'TEXTAREA' && element.placeholder) {
                element.placeholder = translatedText;
            }
            else if (element.tagName === 'OPTION') {
                element.textContent = translatedText;
            } else {
                element.textContent = translatedText;
            }
        }
    });
    
    // Handle data-lang-key-placeholder attributes
    document.querySelectorAll('[data-lang-key-placeholder]').forEach(element => {
        const key = element.dataset.langKeyPlaceholder;
        const translatedText = t(key);
        if (translatedText && translatedText !== key) {
            element.placeholder = translatedText;
        }
    });
    
    // Handle data-lang-key-title attributes
    document.querySelectorAll('[data-lang-key-title]').forEach(element => {
        const key = element.dataset.langKeyTitle;
        const translatedText = t(key);
        if (translatedText && translatedText !== key) {
            element.title = translatedText;
        }
    });
    const apiHelper = document.querySelector('[data-lang-key="gemini_api_key_helper"]');
    if (apiHelper) {
        apiHelper.innerHTML = `${t('gemini_api_key_helper')} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">Google AI Studio</a>.`;
    }
    updateApiStatus();
    renderDefaultPersonas();
    populatePersonaSelector();
    await loadHistory();
	/*
	const storedScripts = localStorage.getItem('lastGeneratedScripts');
    if (storedScripts) {
        const { lastGeneratedScripts, updateLastGeneratedScripts } = await import('./generator.js');
        const parsedScripts = JSON.parse(storedScripts) || [];
        updateLastGeneratedScripts(parsedScripts);
        if (lastGeneratedScripts.length > 0) {
            renderResults(lastGeneratedScripts);
        }
    }
    
    // Re-render results if any to apply new language
    const storedScripts = localStorage.getItem('lastGeneratedScripts');
    if (storedScripts) {
        const parsedScripts = JSON.parse(storedScripts) || [];
        updateLastGeneratedScripts(parsedScripts);
    }
    if (lastGeneratedScripts.length > 0) {
        renderResults(lastGeneratedScripts);
    }
    */
}

export function initSwiper(selector) {
    new Swiper(selector, {
        loop: false,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
    });
}


export function createMicroShotHTML(shot) {
    const template = document.getElementById('micro-shot-template');
    const shotEl = template.content.cloneNode(true).firstElementChild;

    // Isi data dinamis
    shotEl.querySelector('.visual-idea-text').textContent = shot.visual_idea;
    shotEl.querySelector('.prompt-t2i-display').textContent = shot.text_to_image_prompt;
    shotEl.querySelector('.prompt-i2v-display').textContent = shot.image_to_video_prompt;

    // Atur atribut untuk tombol salin
    const copyButtons = shotEl.querySelectorAll('.prompt-copy-btn');
    copyButtons[0].dataset.prompt = shot.text_to_image_prompt;
    copyButtons[1].dataset.prompt = shot.image_to_video_prompt;

    // Perbarui label berdasarkan bahasa
    shotEl.querySelector('[data-lang-key="visual_idea_label"]').textContent = t('visual_idea_label');
    shotEl.querySelector('[data-lang-key="t2i_prompt_label"]').textContent = t('t2i_prompt_label');
    shotEl.querySelector('[data-lang-key="i2v_prompt_label"]').textContent = t('i2v_prompt_label');

    return shotEl.outerHTML; // Kembalikan sebagai string HTML agar sesuai dengan implementasi createScriptPartHTML
}

export function createScriptPartHTML(part, data, variants = null) {
    const shotsHTML = data.shots.map(shot => createMicroShotHTML(shot)).join('<div class="my-2"></div>');
    
    let variantsHTML = '';
    if (variants && variants.length > 0) {
        const variantItems = variants.map((variant, index) => 
            `<div class="variant-item p-2 bg-gray-800/50 rounded border border-gray-600/30 hover:border-gray-500/50 transition-colors cursor-pointer" data-variant-index="${index}">
                <div class="flex justify-between items-start">
                    <p class="text-xs text-gray-300 flex-1">${variant}</p>
                    <div class="ml-2 flex items-center space-x-1">
                        <span class="text-xs text-yellow-400 font-medium">★ ${(Math.random() * 2 + 8).toFixed(1)}</span>
                        <button class="text-xs px-2 py-1 bg-blue-600/80 hover:bg-blue-600 rounded text-white transition-colors" onclick="useVariant('${part.key}', ${index})">
                            ${t('use_button') || 'Gunakan'}
                        </button>
                    </div>
                </div>
            </div>`
        ).join('');
        
        variantsHTML = `
            <div class="mt-3 border-t border-gray-600/30 pt-3">
                <div class="flex items-center justify-between mb-2">
                    <h6 class="text-xs font-semibold ${part.textColor} tracking-wider">A/B VARIANTS</h6>
                    <span class="text-xs text-gray-400">${variants.length} ${t('variants_label') || 'variasi'}</span>
                </div>
                <div class="space-y-2">
                    ${variantItems}
                </div>
            </div>`;
    }
    
    return `<div class="p-3 rounded-md ${part.bgColor} ${part.borderColor}" data-part="${part.key}">
        <h5 class="text-xs font-bold ${part.textColor} mb-2 tracking-wider">${part.title}</h5>
        <p class="text-sm ${part.bodyColor} mb-3">${data.text}</p>
        <div class="shots-container space-y-2">${shotsHTML}</div>
        ${variantsHTML}
    </div>`;
}

export function createReviewInsightHTML(insights) {
    if (!insights || !insights.selling_points?.length) return '';
    let pointsHTML = insights.selling_points.map(p => `<li><span class="text-green-400 mr-2">&#10003;</span>${p}</li>`).join('');
    return `<div class="p-4 rounded-md bg-gray-800/50 border border-gray-700/50"><h5 class="text-sm font-bold text-gray-300 mb-3">${t('selling_points_title')}</h5><div class="text-xs text-gray-400"><ul>${pointsHTML}</ul></div></div>`;
}

export function createEditableVisualSheetHTML(visual_dna) {
    if (!visual_dna) return '';
    return `<div class="p-4 rounded-md bg-blue-900/40 border border-blue-800/70 space-y-3">
        <h5 class="text-sm font-bold text-blue-300">${t('image_data_sheet_title')}</h5>
        <div class="editable-input bg-gray-900/50 p-2 h-24 overflow-y-auto">${visual_dna}</div>
    </div>`;
}

export function createCarouselSlideHTML(slide, slideIndex) {
    const template = document.getElementById('carousel-slide-template');
    const slideEl = template.content.cloneNode(true).firstElementChild;

    // Isi data dinamis utama
    slideEl.querySelector('.slide-title').textContent = `${t('slide_label')} ${slideIndex + 1}`;
    slideEl.querySelector('.slide-text').textContent = slide.slide_text;
    slideEl.querySelector('.prompt-t2i-display').textContent = slide.text_to_image_prompt;
    slideEl.querySelector('.prompt-copy-btn').dataset.prompt = slide.text_to_image_prompt;

    // Isi data kondisional (saran layout dan ide interaksi)
    const suggestionsContainer = slideEl.querySelector('.suggestions-container');
    const layoutP = slideEl.querySelector('.layout-suggestion-p');
    const engagementP = slideEl.querySelector('.engagement-idea-p');

    let hasSuggestion = false;

    if (slide.layout_suggestion) {
        layoutP.querySelector('.layout-suggestion-text').textContent = slide.layout_suggestion;
        layoutP.style.display = 'block';
        hasSuggestion = true;
    }

    if (slide.engagement_idea) {
        engagementP.querySelector('.engagement-idea-text').textContent = slide.engagement_idea;
        engagementP.style.display = 'block';
        hasSuggestion = true;
    }

    if (hasSuggestion) {
        suggestionsContainer.style.display = 'block';
    }

    // Perbarui label berdasarkan bahasa
    slideEl.querySelector('[data-lang-key="t2i_prompt_label"]').textContent = t('t2i_prompt_label');
    slideEl.querySelector('[data-lang-key="slide_layout_suggestion"]').textContent = t('slide_layout_suggestion');
    slideEl.querySelector('[data-lang-key="slide_engagement_idea"]').textContent = t('slide_engagement_idea');

    return slideEl.outerHTML; // Kembalikan sebagai string HTML agar sesuai dengan implementasi sebelumnya
}

export function createAssetsHTML(card) {
    return `
    <div class="mt-4 space-y-4">
        <button class="generate-assets-btn w-full btn-secondary text-sm font-semibold py-2 rounded-md">${t('generate_assets_button') || 'Generate Additional Assets (Titles, Hashtags, etc.)'}</button>
        <div class="additional-assets-container hidden bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
             <div class="asset-loader text-center py-4"><div class="icon icon-md icon-spinner text-blue-400 mx-auto"></div></div>
             <div class="asset-content hidden"></div>
        </div>
    </div>`;
}

export function updateCardContent(card, script) {
    const contentDiv = card.querySelector('.card-content');
	
    // Generate original character descriptions if not already done
    if (script.character_sheet && !script.original_character_descriptions) {
    const descriptions = new Set(); // Menggunakan Set untuk menghindari deskripsi duplikat
    const regex = /<char-desc>(.*?)<\/char-desc>/gi;

    ['hook', 'body', 'cta'].forEach(partName => {
        if (script[partName] && script[partName].shots) {
            script[partName].shots.forEach(shot => {
                // Jalankan regex pada kedua jenis prompt
                const allPrompts = (shot.text_to_image_prompt || '') + ' ' + (shot.image_to_video_prompt || '');
                let match;
                while ((match = regex.exec(allPrompts)) !== null) {
                    descriptions.add(match[1].trim()); // match[1] adalah teks di dalam tag
                }
            });
        }
    });
    script.original_character_descriptions = Array.from(descriptions);
}

// Store the script data in the card's dataset
card.dataset.script = JSON.stringify(script);
    let finalHTML = createReviewInsightHTML(script.review_insights);
    // Check if in Single Post Mode
    if (script.hook && script.body && script.cta) {
        finalHTML += createEditableVisualSheetHTML(script.visual_dna);
        const parts = {
            hook: { key: "hook", title: t('hook_title'), bgColor: "bg-sky-900/50", borderColor: "border-sky-800/70", textColor: "text-sky-300", bodyColor: "text-sky-100" },
            body: { key: "body", title: t('body_title'), bgColor: "bg-indigo-900/50", borderColor: "border-indigo-800/70", textColor: "text-indigo-300", bodyColor: "text-indigo-100" },
            cta: { key: "cta", title: t('cta_title'), bgColor: "bg-purple-900/50", borderColor: "border-purple-800/70", textColor: "text-purple-300", bodyColor: "text-purple-100" }
        };
        // Append parts to final HTML with A/B variants
        finalHTML += createScriptPartHTML(parts.hook, script.hook, script.hook_variants) +
                     createScriptPartHTML(parts.body, script.body, script.body_variants) +
                     createScriptPartHTML(parts.cta, script.cta, script.cta_variants);
        finalHTML += createAssetsHTML(card);
    } 
    // Check if in Carousel Mode
    else if (script.slides) {
        const slidesHTML = script.slides.map((slide, idx) => createCarouselSlideHTML(slide, idx)).join('');
        finalHTML += `
            <div class="swiper carousel-swiper-container bg-gray-900/50 p-4 rounded-lg relative">
                <div class="swiper-wrapper">${slidesHTML}</div>
                <div class="swiper-pagination !bottom-2"></div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>
            </div>
        `;
    }
    // Update the content of the card
    contentDiv.innerHTML = finalHTML;
    // restore persisted assets if exist (fix: use contentDiv scope)
    try {
        if (script.additional_assets_html) {
          const assetsContainer = contentDiv.querySelector('.additional-assets-container');
          const loader = contentDiv.querySelector('.asset-loader');
          const body = contentDiv.querySelector('.asset-content');
          assetsContainer?.classList.remove('hidden');
          loader?.classList.add('hidden');
          if (body) { body.classList.remove('hidden'); body.innerHTML = script.additional_assets_html; }
        }
      } catch(_) {}
}