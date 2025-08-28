// js/ui.results.js (split from ui.js)
import { t } from './i18n.js'; // You might also need this if not already imported
import { elements, copyToClipboard, getFullScriptText, openEditModal, setLoadingState, languageState } from './utils.js';
import { updateCardContent, initSwiper, createAssetsHTML, createCarouselSlideHTML } from './ui.js';
import { updateSingleScript, getScripts } from './state.js';
import { exportPromptPackJSON, exportPromptPackCSV, exportCapCutSRT, exportCapCutCSV } from './download.js';
import { copyGeminiText, copyElevenSSML, downloadVOFiles } from './ui.vo.js';
import { previewGeminiAPI, stopGeminiPreview } from './ui.vo.gemini.js';

// Helper hash dan komputasi skor global yang lebih stabil dan bervariasi
function hashString(input) {
    const str = (input || '') + '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function computeGlobalScoreFromArrays(hookScoresArr, bodyScoresArr, ctaScoresArr, script) {
    const toFinite = (arr) => (Array.isArray(arr) ? arr.map(n => Number(n)).filter(Number.isFinite) : []);
    const safeMax = (arr) => { const nums = toFinite(arr); return nums.length ? Math.max(...nums) : 0; };
    const composed = safeMax(hookScoresArr) * 0.5 + safeMax(bodyScoresArr) * 0.3 + safeMax(ctaScoresArr) * 0.2;
    const hashInput = `${script?.hook?.text || script?.hook || ''}|${script?.body?.text || script?.body || ''}|${script?.cta?.text || script?.cta || ''}`;
    const tie = hashString(hashInput) % 3; // 0..2 variasi kecil
    // Target rentang 90..98. Skala komponen ke 0..8 dan tambahkan tie 0..2
    const core = Math.max(0, Math.min(8, composed * 0.10));
    const score = 90 + core + tie; // 90..100 teoritis
    return Math.min(98, Math.round(score));
}

// A/B Variants Scoring Functions
export async function scoreHook(text) {
    if (!text) return 0;
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    let score = 0;
    
    // Ideal length (5-12 words)
    if (wordCount >= 5 && wordCount <= 12) {
        score += 30;
    } else if (wordCount < 5) {
        score += 10; // Too short
    } else {
        score -= (wordCount - 12) * 3; // Penalty for too long
    }
    
    // Action words and trigger words
    const { t } = await import('./i18n.js');
    const actionWordsResult = t('action_words');
    const actionWords = Array.isArray(actionWordsResult) ? actionWordsResult : ['try', 'check', 'see', 'discount', 'promo', 'secret', 'turns out', 'free', 'viral', 'trending'];
    const lowerText = text.toLowerCase();
    actionWords.forEach(word => {
        if (lowerText.includes(word)) score += 15;
    });
    
    // Extra points for TikTok commerce
    const commerceWordsResult = t('commerce_words');
    const commerceWords = Array.isArray(commerceWordsResult) ? commerceWordsResult : ['cart', 'checkout', 'buy', 'order'];
    commerceWords.forEach(word => {
        if (lowerText.includes(word)) score += 10;
    });
    
    // Numbers and percentages
    if (/\d+%|\d+/.test(text)) score += 10;
    
    return Math.max(0, score);
}

export async function scoreBodyIntro(text) {
    if (!text) return 0;
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    let score = 0;
    
    // Ideal length (8-14 words)
    if (wordCount >= 8 && wordCount <= 14) {
        score += 25;
    } else if (wordCount < 8) {
        score += 10;
    } else {
        score -= (wordCount - 14) * 2;
    }
    
    const { t } = await import('./i18n.js');
    const lowerText = text.toLowerCase();
    
    // Benefit-first pattern
    const benefitWords = t('benefit_words') || ['save', 'easy', 'fast', 'practical', 'effective', 'proven', 'quality'];
    if (Array.isArray(benefitWords)) {
        benefitWords.forEach(word => {
            if (lowerText.includes(word)) score += 12;
        });
    }
    
    // Problem-solution pattern
    const problemWords = t('problem_words') || ['problem', 'difficult', 'complicated', 'expensive', 'slow'];
    const solutionWords = t('solution_words') || ['solution', 'answer', 'way', 'tips', 'tricks'];
    if (Array.isArray(problemWords) && Array.isArray(solutionWords)) {
        if (problemWords.some(word => lowerText.includes(word)) && 
            solutionWords.some(word => lowerText.includes(word))) {
            score += 15;
        }
    }
    
    // Social proof
    const socialWords = t('social_words') || ['many', 'thousands', 'millions', 'trusted', 'testimonial', 'review'];
    if (Array.isArray(socialWords)) {
        socialWords.forEach(word => {
            if (lowerText.includes(word)) score += 10;
        });
    }
    
    return Math.max(0, score);
}

export function scoreCTA(text) {
    if (!text) return 0;
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    let score = 0;
    
    // Ideal length (3-8 words)
    if (wordCount >= 3 && wordCount <= 8) {
        score += 30;
    } else if (wordCount < 3) {
        score += 5;
    } else {
        score -= (wordCount - 8) * 4;
    }
    
    const lowerText = text.toLowerCase();

    // Helper to normalize word list from i18n (accept array or comma-separated string)
    const getWords = (key, fallbackCsv) => {
        const value = t(key);
        if (Array.isArray(value)) return value.map(w => String(w).toLowerCase().trim()).filter(Boolean);
        if (typeof value === 'string') return value.split(',').map(w => w.toLowerCase().trim()).filter(Boolean);
        return fallbackCsv.split(',').map(w => w.toLowerCase().trim()).filter(Boolean);
    };
    
    // Low friction (high priority)
    const lowFrictionWords = getWords('cta_low_friction_words', 'tap,klik,keranjang,subscribe,follow,comment,reply,swipe');
    lowFrictionWords.forEach(word => {
        if (word && lowerText.includes(word)) score += 20;
    });
    
    // Action words
    const actionWords = getWords('cta_action_words', 'beli,order,dapatkan,ambil,coba,download');
    actionWords.forEach(word => {
        if (word && lowerText.includes(word)) score += 10;
    });
    
    // Urgency
    const urgencyWords = getWords('cta_urgency_words', 'sekarang,segera,terbatas,hari ini,buruan');
    urgencyWords.forEach(word => {
        if (word && lowerText.includes(word)) score += 8;
    });
    
    return Math.max(0, score);
}

export function shorten(text, maxWords = 7) {
    if (!text) return text;
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
}

export async function renderResults(scripts) {
    const panel = elements.outputPanel;
    const toolbar = document.getElementById('results-toolbar');
    // Bersihkan panel hasil saja (toolbar berada di luar panel)
    if (panel) {
        panel.innerHTML = '';
    }
    if (toolbar) {
        // Toolbar hanya muncul ketika jumlah script > 1
        const show = Array.isArray(scripts) && scripts.length > 1;
        toolbar.classList.toggle('hidden', !show);
        try { toolbar.style.display = show ? 'flex' : 'none'; } catch(_) {}
    }

    // Attach a mutation observer once to auto-toggle toolbar when cards change
    try {
        if (panel && !panel.__toolbarObserver) {
            const toggle = () => {
                const count = panel.querySelectorAll('.result-card').length;
                const tb = document.getElementById('results-toolbar');
                if (!tb) return;
                const show = count > 1;
                tb.classList.toggle('hidden', !show);
                try { tb.style.display = show ? 'flex' : 'none'; } catch(_) {}
            };
            const obs = new MutationObserver(() => toggle());
            obs.observe(panel, { childList: true, subtree: false });
            panel.__toolbarObserver = obs;
            // Initial toggle
            toggle();
        }
    } catch (_) {}
    if (!scripts || scripts.length === 0) {
        renderError(t('notification_script_generation_error'));
        return;
    }
    
    const cardPromises = scripts.map(async (script, index) => {
        const card = await createResultCard(script, index);
        
        // Add initial hidden state for animation
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        elements.outputPanel.appendChild(card);
        
        // Trigger entrance animation with staggered delay
        setTimeout(() => {
            card.classList.add('animate-fadeInUp');
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 150); // 150ms delay between each card
        
        if (script.slides) {
            initSwiper(`#card-${script.id || index} .carousel-swiper-container`);
        }
        setTimeout(()=>{ try{ updateGlobalBestBadge(); }catch(e){} }, 0);
    return card;
    });
    
    await Promise.all(cardPromises);

    // Pastikan toolbar muncul jika ada >= 2 kartu hasil di DOM
    try {
        const toolbar = document.getElementById('results-toolbar');
        if (toolbar) {
            const totalCards = document.querySelectorAll('#output-panel .result-card').length;
            const show = totalCards > 1;
            toolbar.classList.toggle('hidden', !show);
            try { toolbar.style.display = show ? 'flex' : 'none'; } catch(_) {}
        }
    } catch (_) {}

    // Update best-of-all tag setelah semua kartu ada
    try { updateGlobalBestBadge(); } catch (e) {}

    // Fallback recheck (DOM settled)
    setTimeout(() => {
        try {
            const toolbar = document.getElementById('results-toolbar');
            if (!toolbar) return;
            const totalCards = document.querySelectorAll('#output-panel .result-card').length;
            const show = totalCards > 1;
            toolbar.classList.toggle('hidden', !show);
            try { toolbar.style.display = show ? 'flex' : 'none'; } catch(_) {}
        } catch(_) {}
        try { updateGlobalBestBadge(); } catch(e) {}
    }, 50);
}

export function renderError(message) {
                elements.outputPanel.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center text-red-400"><div class="text-6xl mb-4">:(</div><h3 class="text-xl font-semibold">${t('notification_script_generation_error_title') || 'Oops!'}</h3><p class="max-w-sm mt-2">${message}</p></div>`;
}

export async function createResultCard(script, index) {
    // 1. Dapatkan template
    const template = document.getElementById('result-card-template');
    // 2. Kloning konten template
    const card = template.content.cloneNode(true).firstElementChild;

    if (!script.id) script.id = `script-${Date.now()}-${index}`;
    card.id = `card-${script.id}`;

    // 3. Isi data dinamis
    card.querySelector('.result-title').textContent = t('script_option_title', { index: index + 1, title: script.title });
    try {
      // Calculate best scores safely (handle async scoring functions)
      const hv = Array.isArray(script.hook_variants) ? script.hook_variants : [];
      const hookScores = await Promise.all([
        ...hv.map(v => scoreHook(v)),
        scoreHook(script.hook?.text || script.hook || '')
      ]);
      const hookBest = Math.max(...(hookScores.map(Number).filter(Number.isFinite)), 0);

      const cv = Array.isArray(script.cta_variants) ? script.cta_variants : [];
      const ctaScores = [
        ...cv.map(v => scoreCTA(v)),
        scoreCTA(script.cta?.text || script.cta || '')
      ];
      const ctaBest = Math.max(...(ctaScores.map(Number).filter(Number.isFinite)), 0);

      const bodyFirst = (script.body?.text || script.body || '').toString().split('\n')[0] || '';
      const bv = Array.isArray(script.body_variants) ? script.body_variants : [];
      const bodyScores = await Promise.all([
        ...bv.map(v => scoreBodyIntro(v)),
        scoreBodyIntro(bodyFirst)
      ]);
      const bodyBest = Math.max(...(bodyScores.map(Number).filter(Number.isFinite)), 0);

      // Komputasi skor global yang lebih sehat (60-98) dan bervariasi berdasar konten
      const global = computeGlobalScoreFromArrays([hookBest], [bodyBest], [ctaBest], script);
      card.dataset.globalScore = String(global);
      const badge = document.createElement('span');
      const theme = localStorage.getItem('aethera_theme') || 'dark';
      badge.textContent = `Score ${global}`;
      badge.style.marginLeft = '6px';
      badge.style.padding = '2px 8px';
      badge.style.borderRadius = '9999px';
      badge.style.fontSize = '12px';
      badge.style.lineHeight = '1';
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.fontWeight = '600';
      if (theme === 'light') {
        badge.style.backgroundColor = '#d1fae5';
        badge.style.border = '1px solid #6ee7b7';
        badge.style.color = '#065f46';
      } else {
        badge.style.backgroundColor = 'rgba(16,185,129,0.15)';
        badge.style.border = '1px solid rgba(16,185,129,0.25)';
        badge.style.color = '#a7f3d0';
      }
      const titleEl = card.querySelector('.result-title');
      if (titleEl) {
        const currentText = titleEl.textContent;
        titleEl.textContent = '';
        const textSpan = document.createElement('span');
        textSpan.textContent = currentText;
        titleEl.style.display = 'flex';
        titleEl.style.alignItems = 'center';
        titleEl.style.gap = '8px';
        titleEl.style.whiteSpace = 'normal';
        titleEl.style.flex = '1 1 auto';
        badge.style.whiteSpace = 'nowrap';
        titleEl.appendChild(textSpan);
        titleEl.appendChild(badge);
      }
    } catch(e) { console.warn('Scoring badge failed:', e); }

    
    // Perbarui judul tombol (tooltip) berdasarkan bahasa
    card.querySelector('.edit-btn').title = t('edit_button') || 'Edit';
    card.querySelector('.copy-btn').title = t('copy_full_script') || 'Copy Full Script';

    updateCardContent(card, script); // Fungsi ini akan mengisi .card-content
    // Ringkas isi kartu agar ringan (detail lengkap di modal viewer)
    try {
      const content = card.querySelector('.card-content');
      if (content) {
        const firstLine = (script.hook?.text || script.hook || '').toString().split('\n')[0] || '';
        const summary = document.createElement('p');
        summary.className = 'text-sm text-gray-400';
        summary.textContent = firstLine.slice(0, 120) + (firstLine.length > 120 ? '…' : '');
        content.innerHTML = '';
        // Sembunyikan summary di list: hanya judul + badge saja sesuai permintaan
        // content.appendChild(summary);
        content.style.display = 'none';
      }
    } catch(_){}

    // Sembunyikan tombol aksi pada tampilan list
    try {
      card.querySelectorAll('.edit-btn, .copy-btn, .view-btn').forEach(el=>{ el.style.display='none'; });
    } catch(_){}

    // Pada tampilan list, jangan render A/B variants; hanya akan ditampilkan di overlay viewer

    // 4. Tambahkan event listener dengan loading states
    card.querySelector('.copy-btn').addEventListener('click', () => {
        const button = card.querySelector('.copy-btn');
        setLoadingState(true, button);
        
        try {
            copyToClipboard(getFullScriptText(card), button);
        } finally {
            // Remove loading state after a short delay to show feedback
            setTimeout(() => {
                setLoadingState(false, button);
            }, 500);
        }
    });
    card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(card));
    const viewBtn = card.querySelector('.view-btn');
    if (viewBtn) viewBtn.addEventListener('click', (e) => { e.stopPropagation(); openScriptViewer(card, JSON.parse(card.dataset.script)); });
    // Open viewer when clicking the card body (but ignore clicks on controls)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.export-dropdown') || e.target.closest('.edit-btn') || e.target.closest('.copy-btn') || e.target.closest('.view-btn')) return;
      openScriptViewer(card, JSON.parse(card.dataset.script));
    });
    
    // Export dropdown listeners
    attachExportListeners(card);
    
    // Tidak menambahkan listeners A/B pada tampilan list

    setTimeout(()=>{ try{ updateGlobalBestBadge(); }catch(e){} }, 0);
    return card;
}

// A/B Variants HTML Generation
export async function createABVariantsHTML(script) {
    if (!script.hook_variants && !script.body_variants && !script.cta_variants) {
        return ''; // Tidak ada variants
    }
    
    const theme = localStorage.getItem('aethera_theme') || 'dark';
    const bestWrapClass = theme === 'light' ? 'bg-emerald-50 border border-emerald-200' : 'bg-green-900/20 border border-green-700/30';
    const normalWrapClass = theme === 'light' ? 'bg-gray-100/80 border border-gray-200' : 'bg-gray-800/30';

    let html = `
        <div class="ab-variants p-4 rounded-lg bg-gray-900/40 border border-gray-800/40">
            <h4 class="text-lg font-semibold text-blue-300 mb-2">A/B Variants - Pilih Copy Terbaik</h4>
    `;
    
    // Hook Variants
    if (script.hook_variants && script.hook_variants.length > 0) {
        html += await createVariantSection('Hook', script.hook_variants, scoreHook, 'hook');
    }
    
    // Body Intro (jika ada)
    if (script.body_intro) {
        html += await createVariantSection('Body Intro', [script.body_intro], scoreBodyIntro, 'body_intro');
    }
    
    // Body Variants
    if (script.body_variants && script.body_variants.length > 0) {
        html += await createVariantSection('Body', script.body_variants, scoreBodyIntro, 'body');
    }
    
    // CTA Variants
    if (script.cta_variants && script.cta_variants.length > 0) {
        html += await createVariantSection('CTA', script.cta_variants, scoreCTA, 'cta');
    }
    
    html += '</div>';
    return html;
}

export async function createVariantSection(sectionName, variants, scoreFunction, sectionType) {
    const scoredVariants = await Promise.all(variants.map(async (variant, index) => ({
        text: variant,
        score: await scoreFunction(variant),
        index
    })));
    scoredVariants.sort((a, b) => b.score - a.score);
    
    const bestVariant = scoredVariants[0];
    
    let html = `
        <div class="variant-section mb-4">
            <h6 class="text-xs font-semibold text-blue-200 mb-2 light-mode:text-blue-600">${sectionName} (${variants.length} ${t('options') || 'opsi'})</h6>
            <div class="space-y-2">
    `;
    
    scoredVariants.forEach((variant, displayIndex) => {
        const isBest = displayIndex === 0;
        const badgeColor = isBest ? 'bg-green-600' : (variant.score >= 50 ? 'bg-blue-600' : 'bg-gray-600');
        const badgeText = isBest ? (t('best') || 'TERBAIK') : `${variant.score}pts`;
        
        html += `
            <div class="variant-item flex items-start space-x-3 p-2 rounded ${isBest ? 'bg-green-900/20 border border-green-700/30' : 'bg-gray-800/30'}">
                <span class="${badgeColor} text-white text-xs px-2 py-1 rounded font-bold flex-shrink-0">${badgeText}</span>
                <p class="text-sm text-gray-300 flex-1">${variant.text}</p>
                <div class="flex space-x-1 flex-shrink-0">
                    ${sectionType === 'hook' ? `<button class="shorten-btn text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded" data-section="${sectionType}" data-index="${variant.index}" title="${t('shorten_tooltip') || 'Pendekkan (≤7 kata)'}">${t('shorten_button') || 'Pendek'}</button>` : ''}
                    <button class="use-variant-btn text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded" data-section="${sectionType}" data-index="${variant.index}">${t('use_button') || 'Gunakan'}</button>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
            <div class="mt-2 flex space-x-2">
                <button class="use-best-btn text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded font-semibold" data-section="${sectionType}">✓ ${t('use_best_button') || 'Pakai Terbaik'}</button>
            </div>
        </div>
    `;
    
    return html;
}

// Event handlers untuk A/B Variants
export function attachABVariantsListeners(card) {
    const script = JSON.parse(card.dataset.script);
    
    // Use Best buttons
    card.querySelectorAll('.use-best-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            useBestVariant(card, script, section);
        });
    });
    
    // Use Variant buttons
    card.querySelectorAll('.use-variant-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            const index = parseInt(e.target.dataset.index);
            useSpecificVariant(card, script, section, index);
        });
    });
    
    // Shorten buttons (khusus Hook)
    card.querySelectorAll('.shorten-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            const index = parseInt(e.target.dataset.index);
            useShortenedVariant(card, script, section, index);
        });
    });
}

export async function useBestVariant(card, script, section) {
    let variants, scoreFunction;
    
    switch(section) {
        case 'hook':
            variants = script.hook_variants;
            scoreFunction = scoreHook;
            break;
        case 'body':
            variants = script.body_variants;
            scoreFunction = scoreBodyIntro;
            break;
        case 'body_intro':
            variants = [script.body_intro];
            scoreFunction = scoreBodyIntro;
            break;
        case 'cta':
            variants = script.cta_variants;
            scoreFunction = scoreCTA;
            break;
        default:
            return;
    }
    
    if (!variants || variants.length === 0) return;
    
    // Score all variants (support both async and sync functions)
    const scores = await Promise.all(variants.map(v => Promise.resolve(scoreFunction(v))));
    let bestIdx = 0; let bestScore = Number.NEGATIVE_INFINITY;
    scores.forEach((s, i) => { const n = Number(s); if (Number.isFinite(n) && n > bestScore) { bestScore = n; bestIdx = i; } });
    
    await applyVariantToScript(card, script, section, variants[bestIdx]);
}

export async function useSpecificVariant(card, script, section, index) {
    let variants;
    
    switch(section) {
        case 'hook':
            variants = script.hook_variants;
            break;
        case 'body':
            variants = script.body_variants;
            break;
        case 'body_intro':
            variants = [script.body_intro];
            break;
        case 'cta':
            variants = script.cta_variants;
            break;
        default:
            return;
    }
    
    if (!variants || !variants[index]) return;
    
    await applyVariantToScript(card, script, section, variants[index]);
}

export async function useShortenedVariant(card, script, section, index) {
    let variants;
    
    switch(section) {
        case 'hook':
            variants = script.hook_variants;
            break;
        default:
            return; // Shorten hanya untuk hook
    }
    
    if (!variants || !variants[index]) return;
    
    const shortenedText = shorten(variants[index], 7);
    await applyVariantToScript(card, script, section, shortenedText);
}

// Function to regenerate visual prompts based on new variant text
export async function regenerateVisualPrompts(script, section, newText) {
    try {
        // Get current settings for prompt generation
        const productName = localStorage.getItem('productName') || script.title || 'Product';
        const productDescription = localStorage.getItem('productDescription') || 'Product description';
        const visualStrategy = localStorage.getItem('visualStrategy') || 'standard';
        const aspectRatio = localStorage.getItem('aspectRatio') || '9:16';
        const currentLanguage = localStorage.getItem('aethera_language') || 'id';
        
        // Use the current system prompt (which should be updated based on language)
        const systemPrompt = localStorage.getItem('aethera_system_prompt') || '';
        // Context karakter untuk menjaga konsistensi
        const characterSheetJson = JSON.stringify(script.character_sheet || [], null, 2);
        const originalDescs = Array.isArray(script.original_character_descriptions) ? script.original_character_descriptions.join('; ') : '';
        const characterContext = `Characters (character_sheet): ${characterSheetJson}\nOriginal character physical descriptions: ${originalDescs}`;
        
        // Construct prompt for visual regeneration using system prompt context
        const visualPrompt = `${systemPrompt}

${currentLanguage === 'en' ? 
`Based on the new ${section.toUpperCase()} text: "${newText}"

Product: ${productName}
Description: ${productDescription}
Visual Strategy: ${visualStrategy}
Aspect Ratio: ${aspectRatio}
${characterContext}

IMPORTANT LANGUAGE RULES (override any previous instructions):
- visual_idea MUST be in English only.
- text_to_image_prompt MUST be in English only.
- image_to_video_prompt MUST be in English only.
- DO NOT mix any other language.

CHARACTER CONSTRAINTS:
- Use ONLY the characters provided in character_sheet above. Keep names and personalities consistent.
- DO NOT invent, change, or swap characters.
- In text_to_image_prompt, put physical descriptions ONLY inside <char-desc>...</char-desc> tags.
- NEVER include <char-desc> in image_to_video_prompt.

Return strictly JSON with structure:
{
  "shots": [
    {
      "visual_idea": "concise cinematic description in English",
      "text_to_image_prompt": "very detailed T2I prompt in English (use <char-desc> for physical details only)",
      "image_to_video_prompt": "I2V prompt in English (movement only, no physical descriptions)",
      "negative_prompt": "negative prompt for image quality"
    }
  ]
}`
:
`Berdasarkan teks ${section.toUpperCase()} yang baru: "${newText}"

Produk: ${productName}
Deskripsi: ${productDescription}
Strategi Visual: ${visualStrategy}
Rasio: ${aspectRatio}
${characterContext}

ATURAN BAHASA (menimpa instruksi sebelumnya):
- visual_idea WAJIB dalam Bahasa Indonesia saja.
- text_to_image_prompt (T2I) WAJIB dalam Bahasa Inggris saja.
- image_to_video_prompt (I2V) WAJIB dalam Bahasa Inggris saja.
- JANGAN campur bahasa dalam setiap field.

KONSTR A KARAKTER:
- Gunakan HANYA karakter dari character_sheet di atas. Nama dan kepribadian harus konsisten.
- JANGAN menciptakan/mengubah karakter.
- Di text_to_image_prompt, taruh deskripsi fisik HANYA di dalam tag <char-desc>...</char-desc>.
- JANGAN pernah menaruh <char-desc> pada image_to_video_prompt.

Kembalikan JSON murni dengan struktur:
{
  "shots": [
    {
      "visual_idea": "deskripsi sinematik singkat dalam Bahasa Indonesia",
      "text_to_image_prompt": "prompt T2I sangat detail dalam Bahasa Inggris (gunakan <char-desc> hanya untuk deskripsi fisik)",
      "image_to_video_prompt": "prompt I2V dalam Bahasa Inggris (khusus pergerakan, tanpa deskripsi fisik)",
      "negative_prompt": "negative prompt untuk kualitas gambar"
    }
  ]
}`}`;

        // Get API key from localStorage
        const apiKey = localStorage.getItem('aethera_user_api_key');
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['x-user-api-key'] = apiKey;
        }

        const response = await fetch('/api/generateScript', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                prompt: visualPrompt,
                scriptCount: 1,
                mode: 'visual_regeneration'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to regenerate visual prompts');
        }

        const result = await response.json();
        return result.shots || [];
    } catch (error) {
        console.error('Error regenerating visual prompts:', error);
        return null;
    }
}

export async function applyVariantToScript(card, script, section, newText) {
    // Show loading state
    const loadingNotification = import('./utils.js').then(({ showNotification }) => {
        showNotification(t('regenerating_visual_prompts') || 'Meregenerasi prompt visual...', 'info');
    });
    
    // Update script object
    switch(section) {
        case 'hook':
            if (script.hook) {
                script.hook.text = newText;
                // Regenerate visual prompts for hook
                const hookShots = await regenerateVisualPrompts(script, 'hook', newText);
                if (hookShots && hookShots.length > 0) {
                    script.hook.shots = hookShots;
                }
            }
            break;
        case 'body':
            if (script.body) {
                script.body.text = newText;
                // Regenerate visual prompts for body
                const bodyShots = await regenerateVisualPrompts(script, 'body', newText);
                if (bodyShots && bodyShots.length > 0) {
                    script.body.shots = bodyShots;
                }
            }
            break;
        case 'body_intro':
            if (script.body) {
                // Update body intro dan selaraskan dengan body.text
                script.body_intro = newText;
                if (script.body.text) {
                    // Gabungkan intro dengan sisa body text
                    const bodyParts = script.body.text.split('. ');
                    bodyParts[0] = newText;
                    script.body.text = bodyParts.join('. ');
                }
                // Regenerate visual prompts for body with new intro
                const bodyShots = await regenerateVisualPrompts(script, 'body', script.body.text);
                if (bodyShots && bodyShots.length > 0) {
                    script.body.shots = bodyShots;
                }
            }
            break;
        case 'cta':
            if (script.cta) {
                script.cta.text = newText;
                // Regenerate visual prompts for cta
                const ctaShots = await regenerateVisualPrompts(script, 'cta', newText);
                if (ctaShots && ctaShots.length > 0) {
                    script.cta.shots = ctaShots;
                }
            }
            break;
    }
    
    // Update card dataset
    card.dataset.script = JSON.stringify(script);
    
    // Update state tanpa membuat duplikat riwayat
    updateSingleScript(script);
    
    // Re-render card content
    updateCardContent(card, script);
    
    // Show success notification
    import('./utils.js').then(({ showNotification }) => {
        const translatedMessage = t('variant_applied_with_visuals') || `${section.toUpperCase()} dan prompt visual berhasil diperbarui!`;
        showNotification(translatedMessage, 'success');
    });
}

// Export dropdown functions
export function attachExportListeners(card) {
    const exportBtn = card.querySelector('.export-btn');
    const exportMenu = card.querySelector('.export-menu');
    const script = JSON.parse(card.dataset.script);
    function mkBtn(label, cls = 'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.textContent = label;
        return b;
    }
    const sepVO = document.createElement('div');
    sepVO.className = 'border-t border-gray-100 my-1';
    const btnCopyGem  = mkBtn('🎙️ Copy VO — Gemini Text');
    const btnCopySSML = mkBtn('🔊 Copy VO — ElevenLabs SSML');
    const btnDlVO     = mkBtn('💾 Download VO Files');
    const btnPrevGem  = mkBtn('▶️ Preview Gemini (API)');
    const btnStop     = mkBtn('⏹ Stop Audio');
    exportMenu.append(sepVO, btnCopyGem, btnCopySSML, btnDlVO, btnPrevGem, btnStop);

    // siapkan voState + voInput dari script card:
    const platformMap={ tiktok:'tiktok_video', shopee:'shopee_video', instagram:'igreels', threads:'threads', shorts:'shorts' };
    const pf=(document.getElementById('platform-target')?.value||'tiktok').toLowerCase();
    const voState={ platform: platformMap[pf]||'tiktok_video', lang:(languageState?.current==='en')?'en':'id' };
    const toVO = sc => ({ hook: sc?.hook?.text || sc?.hook || '', scenes:[ sc?.body?.text || sc?.body || '' ], cta: sc?.cta?.text || sc?.cta || '' });
    const voInput = toVO(script);
    const cacheKey = script?.id ? `script:${script.id}` : undefined;

    btnCopyGem.addEventListener('click', async ()=>{ await copyGeminiText(voInput, voState); exportMenu.classList.add('hidden'); });
    btnCopySSML.addEventListener('click', async ()=>{ await copyElevenSSML(voInput, voState); exportMenu.classList.add('hidden'); });
    btnDlVO.addEventListener('click', ()=>{ downloadVOFiles(voInput, voState); exportMenu.classList.add('hidden'); });
    btnPrevGem.addEventListener('click', ()=>{ previewGeminiAPI(voInput, voState, 'Kore', { button: btnPrevGem, cacheKey }); exportMenu.classList.add('hidden'); });
    btnStop.addEventListener('click',       ()=>{ stopGeminiPreview(); exportMenu.classList.add('hidden'); });
    
    // Toggle dropdown
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close other open dropdowns
        document.querySelectorAll('.export-menu').forEach(menu => {
            if (menu !== exportMenu) {
                menu.classList.add('hidden');
            }
        });
        
        // Toggle current dropdown
        exportMenu.classList.toggle('hidden');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!card.contains(e.target)) {
            exportMenu.classList.add('hidden');
        }
    });
    
    // Export button listeners with loading states
    card.querySelector('.export-prompt-json').addEventListener('click', async () => {
        const button = card.querySelector('.export-prompt-json');
        button.disabled = true; button.classList.add('opacity-50');
        try {
            await exportPromptPackJSON(script);
        } finally {
            button.disabled = false; button.classList.remove('opacity-50');
            exportMenu.classList.add('hidden');
        }
    });
    
    card.querySelector('.export-prompt-csv').addEventListener('click', async () => {
        const button = card.querySelector('.export-prompt-csv');
        button.disabled = true; button.classList.add('opacity-50');
        try {
            await exportPromptPackCSV(script);
        } finally {
            button.disabled = false; button.classList.remove('opacity-50');
            exportMenu.classList.add('hidden');
        }
    });
    
    card.querySelector('.export-capcut-srt').addEventListener('click', async () => {
        const button = card.querySelector('.export-capcut-srt');
        button.disabled = true; button.classList.add('opacity-50');
        try {
            await exportCapCutSRT(script);
        } finally {
            button.disabled = false; button.classList.remove('opacity-50');
            exportMenu.classList.add('hidden');
        }
    });
    
    card.querySelector('.export-capcut-csv').addEventListener('click', async () => {
        const button = card.querySelector('.export-capcut-csv');
        button.disabled = true; button.classList.add('opacity-50');
        try {
            await exportCapCutCSV(script);
        } finally {
            button.disabled = false; button.classList.remove('opacity-50');
            exportMenu.classList.add('hidden');
        }
    });

    // Export this card as ZIP (single)
    const singleZipBtn = card.querySelector('.export-all-zip-item');
    if (singleZipBtn) {
        singleZipBtn.addEventListener('click', async () => {
            singleZipBtn.disabled = true; singleZipBtn.classList.add('opacity-50');
            try {
                const { exportZipForScripts } = await import('./ux/exportZip.js');
                await exportZipForScripts([script], false);
            } catch (e) {}
            finally {
                singleZipBtn.disabled = false; singleZipBtn.classList.remove('opacity-50');
                exportMenu.classList.add('hidden');
            }
        });
    }
}


export function updateGlobalBestBadge(){
  try{
    const cards=[...document.querySelectorAll('.result-card')];
    if (cards.length < 2) { cards.forEach(c=>c.querySelector('.best-of-all')?.remove()); return; }
    let best=null,b=-Infinity;
    cards.forEach(c=>{
      const raw=c.dataset.globalScore;
      const s = Number(raw);
      if (Number.isFinite(s) && s>b) { b=s; best=c; }
    });
    cards.forEach(c=>c.querySelector('.best-of-all')?.remove());
    if(best){
      const tag=document.createElement('span');
      const theme = localStorage.getItem('aethera_theme') || 'dark';
      tag.textContent = t('best_of_all') || 'Best of All';
      tag.className = 'best-of-all';
      tag.style.marginLeft = '6px';
      tag.style.padding = '2px 8px';
      tag.style.borderRadius = '9999px';
      tag.style.fontSize = '12px';
      tag.style.lineHeight = '1';
      tag.style.display = 'inline-flex';
      tag.style.alignItems = 'center';
      tag.style.fontWeight = '700';
      if (theme === 'light') {
        tag.style.backgroundColor = '#fef3c7';
        tag.style.border = '1px solid #fde68a';
        tag.style.color = '#92400e';
      } else {
        tag.style.backgroundColor = 'rgba(234,179,8,0.20)';
        tag.style.border = '1px solid rgba(234,179,8,0.35)';
        tag.style.color = '#fde68a';
      }
      const title = best.querySelector('.result-title');
      if (title) {
        const textSpan = title.firstChild && title.firstChild.nodeType===Node.ELEMENT_NODE ? title.firstChild : null;
        title.style.display = 'inline-flex';
        title.style.alignItems = 'baseline';
        title.style.flexWrap = 'wrap';
        title.style.gap = '8px';
        if (textSpan) title.insertBefore(tag, textSpan.nextSibling);
        else title.appendChild(tag);
      }
    }
  }catch(e){}
}

try{ document.getElementById('rank-all-btn')?.addEventListener('click', ()=>{ try{ updateGlobalBestBadge(); }catch(e){} }); }catch(e){}

export async function openScriptViewer(sourceCard, script){
  const modal=document.getElementById('script-viewer-modal');
  const content=document.getElementById('script-viewer-content');
  if(!modal||!content) return;
  try {
    // Rehydrate script dari state agar perubahan terbaru (assets/varian) ikut tampil
    const byId = (getScripts && typeof getScripts === 'function') ? getScripts().find(s => s.id === script?.id) : null;
    if (byId) script = byId;
  } catch(_) {}
  const safe=(v)=> (v||'').toString();
  // Hitung score global untuk ditampilkan di overlay
  let globalScore=0;
  try{
    const hookScores = await Promise.all([...(script.hook_variants||[]).map(v=>scoreHook(v)), scoreHook(script.hook?.text||script.hook||'')]);
    const ctaScores  = [...(script.cta_variants||[]).map(v=>scoreCTA(v)), scoreCTA(script.cta?.text||script.cta||'')];
    const bodyFirst = (script.body?.text||script.body||'').toString().split('\n')[0]||'';
    const bodyScores = await Promise.all([...(script.body_variants||[]).map(v=>scoreBodyIntro(v)), scoreBodyIntro(bodyFirst)]);
    globalScore = computeGlobalScoreFromArrays(hookScores, bodyScores, ctaScores, script);
  }catch(_){globalScore=65;}

  const isLight = (localStorage.getItem('aethera_theme')||'dark')==='light';
  const scoreClass = isLight
    ? 'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300'
    : 'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-200 text-emerald-900 border border-emerald-300';
  let html=`<div class=\"mb-4 flex items-center justify-between\">`+
           `<h3 class=\"text-xl font-bold\">${safe(script.title)}</h3>`+
           `<span class=\"${scoreClass}\" data-tooltip><span>Score ${globalScore}</span><span class=\"tooltip-hint\">${t('score_tooltip') || 'Skor gabungan dari Hook/Body/CTA'}</span></span>`+
           `</div>`;
  // Toolbar aksi overlay: Copy, Export (dropdown), Edit
  html += `
  <div class="mb-4 flex items-center gap-2">
    <button class="overlay-copy-btn px-3 py-1.5 text-xs rounded bg-gray-700 text-white hover:bg-gray-600" data-tooltip><span>${t('copy_full_script') || 'Copy Full Script'}</span><span class="tooltip-hint">${t('copy_tooltip') || 'Salin semua teks skrip'}</span></button>
    <div class="relative">
      <button class="overlay-export-btn px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700" data-tooltip><span>${t('export_button') || 'Export'}</span><span class="tooltip-hint">${t('export_tooltip') || 'Export ke berbagai format'}</span></button>
      <div class="overlay-export-menu hidden absolute right-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded shadow-lg z-10">
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="prompt-json">Prompt Pack (JSON)</button>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="prompt-csv">Prompt Pack (CSV)</button>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="capcut-srt">CapCut (SRT)</button>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="capcut-csv">CapCut (CSV)</button>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="zip-single">Export This (ZIP)</button>
        <div class="border-t border-gray-800 my-1"></div>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="vo-copy-gemini">🎙️ Copy VO — Gemini Text</button>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="vo-copy-ssml">🔊 Copy VO — ElevenLabs SSML</button>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="vo-download">💾 Download VO Files</button>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="vo-prev-gemini">▶️ Preview Gemini (API)</button>
        <button class="overlay-export-item block w-full text-left px-3 py-2 text-xs hover:bg-gray-800" data-type="vo-stop">⏹ Stop Audio</button>
      </div>
    </div>
    <button class="overlay-edit-btn px-3 py-1.5 text-xs rounded bg-yellow-600 text-white hover:bg-yellow-700" data-tooltip><span>${t('edit_button') || 'Edit'}</span><span class="tooltip-hint">${t('edit_tooltip') || 'Edit teks skrip & regenerasi visual'}</span></button>
  </div>`;
  const renderPartWithCopy=(sectionKey, label, part)=>{
    if(!part) return '';
    let s=`<div class=\"mb-4\">`+
          `<div class=\"flex items-center justify-between mb-2\">`+
          `<h4 class=\"font-semibold\">${label}</h4>`+
          `<button class=\"overlay-section-copy-btn px-2 py-1 text-xs rounded bg-gray-700 text-white hover:bg-gray-600\" data-section=\"${sectionKey}\">${t('copy_button')||'Copy'}</button>`+
          `</div>`;
    s+=`<p class=\"mb-2 whitespace-pre-wrap\">${safe(part.text||part)}</p>`;
    const shots=part.shots||[];
    if(Array.isArray(shots) && shots.length){
      s+=`<div class=\"space-y-2\">`;
      shots.forEach((shot,i)=>{
        s+=`<div class=\"p-3 rounded bg-gray-900/40 border border-gray-700/40\">`+
            `<div class=\"text-xs text-gray-300\"><strong>${t('visual_idea_label')||'Ide Visual'} ${i+1}:</strong> ${safe(shot.visual_idea)}</div>`+
            `<div class=\"text-xs text-gray-400 mt-1 flex items-center gap-2\"><strong>${t('t2i_prompt_label')||'T2I'}:</strong> <span class=\"prompt-t2i-display\">${safe(shot.text_to_image_prompt)}</span> <button class=\"prompt-copy-btn flex-shrink-0\" data-prompt=\"${safe(shot.text_to_image_prompt).replace(/\\/g,'\\\\').replace(/"/g,'&quot;')}\"><div class=\"icon icon-sm icon-copy text-gray-500 hover:text-white\"></div></button></div>`+
            `<div class=\"text-xs text-gray-400 mt-1 flex items-center gap-2\"><strong>${t('i2v_prompt_label')||'I2V'}:</strong> <span class=\"prompt-i2v-display\">${safe(shot.image_to_video_prompt)}</span> <button class=\"prompt-copy-btn flex-shrink-0\" data-prompt=\"${safe(shot.image_to_video_prompt).replace(/\\/g,'\\\\').replace(/"/g,'&quot;')}\"><div class=\"icon icon-sm icon-copy text-gray-500 hover:text-white\"></div></button></div>`+
            `</div>`;
      });
      s+=`</div>`;
    }
    s+=`</div>`;
    return s;
  };
  if(script.character_sheet && script.character_sheet.length){
    html+=`<div class=\"mb-4\"><h4 class=\"font-semibold mb-2\">${t('character_sheet_title')||'Character Sheet'}</h4>`;
    script.character_sheet.forEach((cs,idx)=>{
      html+=`<div class=\"text-xs text-gray-300 mb-1\">${t('character_label')||'Karakter'} ${idx+1}: ${safe((cs.name||'')+' '+(cs.age||''))}</div>`;
    });
    html+=`</div>`;
  }
  // Mode Single (hook/body/cta)
  if (!script.slides) {
    html += renderPartWithCopy('hook', t('hook_title')||'Hook', script.hook);
    html += renderPartWithCopy('body', t('body_title')||'Body', script.body);
    html += renderPartWithCopy('cta', t('cta_title')||'CTA', script.cta);
  } else {
    // Mode Carousel: render slides dalam swiper
    const slidesHTML = (script.slides || []).map((slide, idx) => createCarouselSlideHTML(slide, idx)).join('');
    html += `
      <div class="mb-4">
        <h4 class="font-semibold mb-2">${t('slides_title') || 'Slides'}</h4>
        <div class="swiper carousel-swiper-container bg-gray-900/40 p-4 rounded-lg border border-gray-800/40">
          <div class="swiper-wrapper">${slidesHTML}</div>
          <div class="swiper-pagination !bottom-2"></div>
          <div class="swiper-button-prev"></div>
          <div class="swiper-button-next"></div>
        </div>
      </div>`;
  }
  // Render ke overlay lalu aktifkan event delegation
  content.innerHTML=html;
  // Set script pada dataset overlay agar fitur tambahan (assets) bisa baca data
  try{ content.dataset.script = JSON.stringify(script); }catch(_){ }
  try{
    const ab = await createABVariantsHTML(script);
    if (ab) content.insertAdjacentHTML('beforeend', ab);
  }catch(_){ }
  // Sisipkan tombol & container "Buat aset tambahan" di overlay
  try{ content.insertAdjacentHTML('beforeend', createAssetsHTML(script)); 
    try {
        if (script.additional_assets_html) {
          const assetsContainer = content.querySelector('.additional-assets-container');
          const loader = content.querySelector('.asset-loader');
          const body = content.querySelector('.asset-content');
          assetsContainer?.classList.remove('hidden');
          loader?.classList.add('hidden');
          if (body) { body.classList.remove('hidden'); body.innerHTML = script.additional_assets_html; }
        }
      } catch(_) {} }catch(_){ }
  // Delegasi: tombol copy & A/B actions
  content.onclick = async (e) => {
    // Overlay export dropdown toggle
    const exportBtn = e.target.closest('.overlay-export-btn');
    if (exportBtn) {
      const menu = exportBtn.parentElement.querySelector('.overlay-export-menu');
      if (menu) menu.classList.toggle('hidden');
      // Sembunyikan tooltip agar tidak menutupi menu
      try { const hint = exportBtn.querySelector('.tooltip-hint'); if (hint) hint.style.display = 'none'; } catch(_) {}
      return;
    }
    const exportItem = e.target.closest('.overlay-export-item');
    if (exportItem) {
      try {
        const type = exportItem.dataset.type;
        if (type === 'prompt-json') {
          await exportPromptPackJSON(script);
        } else if (type === 'prompt-csv') {
          await exportPromptPackCSV(script);
        } else if (type === 'capcut-srt') {
          await exportCapCutSRT(script);
        } else if (type === 'capcut-csv') {
          await exportCapCutCSV(script);
        } else if (type === 'zip-single') {
          const { exportZipForScripts } = await import('./ux/exportZip.js');
          await exportZipForScripts([script], false);
        } else if (type === 'vo-copy-gemini' || type === 'vo-copy-ssml' || type === 'vo-download' || type === 'vo-prev-gemini' || type === 'vo-stop') {
          // siapkan state & input VO
          const platformMap = { tiktok:'tiktok_video', shopee:'shopee_video', instagram:'igreels', threads:'threads', shorts:'shorts' };
          const pf = (document.getElementById('platform-target')?.value || 'tiktok').toLowerCase();
          const voState = { platform: platformMap[pf] || 'tiktok_video', lang: (languageState?.current === 'en') ? 'en' : 'id' };
          const toVO = sc => ({ hook: sc?.hook?.text || sc?.hook || '', scenes:[ sc?.body?.text || sc?.body || '' ], cta: sc?.cta?.text || sc?.cta || '' });
          const voInput = toVO(script);
          const cacheKey = script?.id ? `script:${script.id}` : undefined;
          if (type === 'vo-copy-gemini')      await copyGeminiText(voInput, voState);
          else if (type === 'vo-copy-ssml')   await copyElevenSSML(voInput, voState);
          else if (type === 'vo-download')    downloadVOFiles(voInput, voState);
          else if (type === 'vo-prev-gemini') await previewGeminiAPI(voInput, voState, 'Kore', { button: exportItem,cacheKey });
          else if (type === 'vo-stop')        stopGeminiPreview();
        }
      } catch (_) {}
      const parentMenu = e.target.closest('.overlay-export-menu');
      parentMenu?.classList.add('hidden');
      return;
    }
    // Auto-hide dropdown jika klik di luar menu/export button
    const openMenu = content.querySelector('.overlay-export-menu:not(.hidden)');
    if (openMenu && !e.target.closest('.overlay-export-menu') && !e.target.closest('.overlay-export-btn')) {
      openMenu.classList.add('hidden');
    }
    // Overlay Copy & Edit
    const overlayCopy = e.target.closest('.overlay-copy-btn');
    if (overlayCopy) { try { copyToClipboard(getFullScriptText(script), overlayCopy); } catch(_){} return; }
    const overlayEdit = e.target.closest('.overlay-edit-btn');
    if (overlayEdit) {
      try {
        openEditModal(sourceCard);
        // Pastikan edit modal di atas overlay viewer
        const em = document.getElementById('edit-modal');
        const viewer = document.getElementById('script-viewer-modal');
        if (em) em.style.zIndex = '1001';
        if (viewer) viewer.style.zIndex = '1000';
      } catch(_){}
      return;
    }
    const sectionCopyBtn = e.target.closest('.overlay-section-copy-btn');
    if (sectionCopyBtn) {
      try {
        const sec = sectionCopyBtn.dataset.section;
        let textToCopy = '';
        if (sec === 'hook') textToCopy = (script.hook?.text || script.hook || '').toString();
        else if (sec === 'body') textToCopy = (script.body?.text || script.body || '').toString();
        else if (sec === 'cta') textToCopy = (script.cta?.text || script.cta || '').toString();
        copyToClipboard(textToCopy, sectionCopyBtn);
      } catch(_) {}
      return;
    }
    const copyBtn = e.target.closest('.prompt-copy-btn');
    if (copyBtn) {
      const raw = copyBtn.dataset.prompt || '';
      const cleaned = raw.replace(/<\/?char-desc>/gi, '');
      try { copyToClipboard(cleaned, copyBtn); } catch(_){ }
      return;
    }
    const howtoBtn = e.target.closest('.prompt-howto-btn');
    if (howtoBtn) {
      openHowToModal(howtoBtn.dataset.type === 'i2v' ? 'i2v' : 't2i');
      return;
    }
    const genBtn = e.target.closest('.generate-assets-btn');
    if (genBtn) {
      try { const { handleGenerateAssets } = await import('./generator.js'); await handleGenerateAssets(content.closest('.result-card') || content); } catch(_){ }
      return;
    }
    const btnUseBest = e.target.closest('.use-best-btn');
    const btnUse = e.target.closest('.use-variant-btn');
    const btnShort = e.target.closest('.shorten-btn');
    if (btnUseBest) { await useBestVariant(sourceCard, script, btnUseBest.dataset.section); openScriptViewer(sourceCard, script); return; }
    if (btnUse) { await useSpecificVariant(sourceCard, script, btnUse.dataset.section, parseInt(btnUse.dataset.index)); openScriptViewer(sourceCard, script); return; }
    if (btnShort) { await useShortenedVariant(sourceCard, script, btnShort.dataset.section, parseInt(btnShort.dataset.index)); openScriptViewer(sourceCard, script); return; }
  };
  // Inisialisasi swiper untuk carousel di overlay (jika ada)
  try {
    if (script.slides) initSwiper('#script-viewer-content .carousel-swiper-container');
  } catch(_) {}
  modal.classList.remove('opacity-0','pointer-events-none');
  const closeBtn=document.getElementById('script-viewer-close');
  if(!modal.__bound){
    modal.__bound=true;
    closeBtn?.addEventListener('click',()=>{ modal.classList.add('opacity-0','pointer-events-none'); });
    modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.classList.add('opacity-0','pointer-events-none'); });
    window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') modal.classList.add('opacity-0','pointer-events-none'); });
  }
}

function openHowToModal(mode) {
  try {
    const modal = document.getElementById('howto-modal');
    const body = document.getElementById('howto-body');
    if (!modal || !body) return;
    const isT2I = mode !== 'i2v';
    const chips = (labels) => `<div class="flex flex-wrap gap-2 mt-2">${labels.map(l=>`<span class=\"px-2 py-0.5 text-xs rounded bg-gray-700 text-white border border-gray-600\">${l}</span>`).join('')}</div>`;
    const chipLabels = isT2I ? ['Leonardo','Flux','Imagen','Gemini'] : ['Pika','Runway','Veo'];
    const step = (title, desc, extra='') => `
      <div class=\"mb-4\">
        <div class=\"text-sm font-semibold text-blue-300\">${title}</div>
        <div class=\"text-sm text-gray-300\">${desc}</div>
        ${extra}
      </div>`;
    const html = [
      step(t('howto_step1_title')||'Open the App', isT2I ? (t('howto_step1_desc_t2i')||'Open Leonardo, Flux, Imagen, or Gemini Image.') : (t('howto_step1_desc_i2v')||'Open Pika, Runway, or Google Veo.'), chips(chipLabels)),
      step(t('howto_step2_title')||'Paste the Prompt', isT2I ? (t('howto_step2_desc_t2i')||'Paste the Image Prompt. Keep <char-desc> tags for physical details.') : (t('howto_step2_desc_i2v')||'Paste the Video Prompt. Do NOT include <char-desc> tags.')),
      step(t('howto_step3_title')||'Set Parameters', isT2I ? (t('howto_params_t2i')||'Steps 28–40, CFG 6–9, 9:16, DPM++, random seed.') : (t('howto_params_i2v')||'Duration 3–5s, FPS 24–30, Motion medium, 9:16.'))
    ].join('');
    body.innerHTML = `
      <div class=\"mb-3 text-sm font-semibold\">${isT2I ? (t('howto_t2i')||'Use the Image Prompt') : (t('howto_i2v')||'Use the Video Prompt')}</div>
      ${html}`;
    modal.classList.remove('opacity-0','pointer-events-none');
    if (!modal.__bound) {
      modal.__bound = true;
      const closeBtn = document.getElementById('howto-close');
      closeBtn?.addEventListener('click',()=>{ modal.classList.add('opacity-0','pointer-events-none'); });
      modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.classList.add('opacity-0','pointer-events-none'); });
      window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') modal.classList.add('opacity-0','pointer-events-none'); });
    }
  } catch(_) {}
}
