// js/generator.js
import { PLATFORM_CONFIG, buildPlatformPlan } from './platform.config.js';
import { elements, setLoadingState, showNotification, fileToBase64, getCharacterDescriptionString, getFullScriptText, closeEditModal, showBeforeAfter, languageState, createCharacterEssence, chooseShotFeatures, shouldAttachProductId, createCharacterTokens, isCharacterVisible } from './utils.js';
import { t } from './i18n.js';
import { analyzeImageWithAI, callGeminiAPI, translateToEnglishBatch } from './api.js';
import { getPersonas } from './persona.js';
import { renderResults, renderError } from './ui.results.js';
import { DEFAULT_SYSTEM_PROMPT, ENGLISH_SYSTEM_PROMPT } from './settings.js';
import { setScripts } from './state.js';
import { getAdditionalAssetsResponseSchema } from './generator.schema.js';
import { HooksCtaRegistry } from './hooks-cta-loader.js';

export let visualStrategy = localStorage.getItem('visualStrategy') || 'default';
export let aspectRatio = localStorage.getItem('aspectRatio') || '9:16';

// Guard untuk mencegah race kondisi saat analisis gambar beruntun
let imageAnalysisRunId = 0;

// Hook Strategy Functions
export function getHookInstructions(hookType) {
    const lang = (languageState.current === 'en') ? 'en' : 'id';
  const txt  = HooksCtaRegistry.getHookInstruction(hookType, lang);
  if (txt) return txt;
  console.warn('[HookInstructions] Missing for:', hookType);
  return lang === 'en'
    ? 'Create a strong scrol-stopping hook in the first 3 seconds. Keep it concrete and audience-specific.'
    : 'Buat hook kuat yang menghentikan scroll dalam 3 detik pertama. Harus konkret dan spesifik untuk audiens.';
}

export function getCTAInstructions(ctaType) {
    const lang = (languageState.current === 'en') ? 'en' : 'id';
  const txt  = HooksCtaRegistry.getCtaInstruction(ctaType, lang);
  if (txt) return txt;
  console.warn('[CTAInstructions] Missing for:', ctaType);
  return lang === 'en'
    ? 'Use a clear, actionable CTA that tells exactly what to do next.'
    : 'Gunakan CTA yang jelas dan langsung mengarahkan langkah berikutnya.';
}

export function validateInputs() {
    const { productName, productDesc } = elements.inputs;

    if (!productName.value.trim()) {
        return t('notification_product_name_empty') || "Nama produk tidak boleh kosong!";
    }
    if (!productDesc.value.trim()) {
        return t('notification_product_desc_empty') || "Deskripsi produk tidak boleh kosong!";
    }
    // Anda bisa menambahkan validasi lain di sini di masa depan
    // Contoh:
    // if (parseInt(elements.inputs.scriptCount.value, 10) > 5) {
    //     return "Jumlah opsi skrip tidak boleh lebih dari 5.";
    // }

    return null; // Tidak ada error
}

export async function handleImageUpload(event) {
    const runId = ++imageAnalysisRunId;
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showNotification(t('notification_image_size_error') || 'Image size too large', 'error');
        return;
    }
    // Set state UI hanya jika ini run yang terbaru
    elements.imageLoader.classList.remove('hidden');
    elements.imageHelper.textContent = t('analyzing_image') || 'Analyzing image...';
    elements.visualDnaStorage.textContent = '';
    elements.imagePreviewContainer.classList.add('hidden');
    try { elements.generateBtn.disabled = true; } catch(_) { }

    let usedBlob = file;
    let objectUrl = '';
    let cropper = null;
    let firstCropDataUrl = null;
    let multiMode = false;
    const multiAreas = [];

    try {
        // Tampilkan modal cropper agar user bisa pilih area produk (opsional)
        const modal = document.getElementById('image-cropper-modal');
        const imgEl = document.getElementById('cropper-target');
        const useBtn = document.getElementById('cropper-use-btn');
        const skipBtn = document.getElementById('cropper-skip-btn');

        if (modal && imgEl && window.Cropper) {
            // Siapkan image untuk cropper
            objectUrl = URL.createObjectURL(file);
            imgEl.src = objectUrl;
            modal.classList.remove('opacity-0', 'pointer-events-none');
            modal.querySelector('.modal-content')?.classList.remove('scale-95');

            // LANGKAH BARU: Pilih mode Single atau Multi sebelum cropping
            const chooser = document.createElement('div');
            chooser.style.display = 'flex';
            chooser.style.gap = '8px';
            chooser.style.margin = '8px 0';
            chooser.style.flexWrap = 'wrap';
            const chooseText = document.createElement('div');
            chooseText.className = 'text-xs text-gray-300';
            chooseText.textContent = (languageState.current==='en')
              ? 'Crop mode: choose Single product or Multi areas'
              : 'Mode crop: pilih Satu produk atau Multi area';
            const btnSingle = document.createElement('button');
            btnSingle.type = 'button';
            btnSingle.className = 'px-2 py-1 rounded bg-blue-600 text-white text-xs';
            btnSingle.textContent = (languageState.current==='en') ? 'Single Crop' : 'Satu Produk';
            const btnMulti = document.createElement('button');
            btnMulti.type = 'button';
            btnMulti.className = 'px-2 py-1 rounded bg-emerald-600 text-white text-xs';
            btnMulti.textContent = (languageState.current==='en') ? 'Multi Crop' : 'Multi Crop';
            chooser.append(chooseText, btnSingle, btnMulti);
            const contentNode = modal.querySelector('.modal-content') || modal;
            contentNode.insertBefore(chooser, contentNode.firstChild);

            await new Promise((resolve) => {
                const pick = (isMulti) => { multiMode = !!isMulti; btnSingle.removeEventListener('click', onSingle); btnMulti.removeEventListener('click', onMulti); chooser.remove(); resolve(); };
                const onSingle = ()=> pick(false);
                const onMulti = ()=> pick(true);
                btnSingle.addEventListener('click', onSingle, { once:true });
                btnMulti.addEventListener('click', onMulti, { once:true });
            });

            await new Promise((resolve) => setTimeout(resolve, 50));
            try { cropper?.destroy(); } catch(_) {}
            cropper = new window.Cropper(imgEl, {
                viewMode: 1,
                movable: true,
                zoomable: true,
                dragMode: 'move',
                autoCropArea: 0.88,
                background: false,
                responsive: true
            });

            // Sesuaikan label tombol untuk mode
            try {
                if (multiMode) {
                    useBtn.textContent = (languageState.current==='en') ? 'Add Area' : 'Tambah Area';
                    skipBtn.textContent = (languageState.current==='en') ? 'Done' : 'Selesai';
                } else {
                    useBtn.textContent = (languageState.current==='en') ? 'Use Crop' : 'Gunakan Crop';
                    skipBtn.textContent = (languageState.current==='en') ? 'Continue without Crop' : 'Lanjut tanpa crop';
                }
            } catch(_) {}

            const closeModal = () => {
                try { cropper?.destroy(); } catch(_) {}
                cropper = null;
                modal.classList.add('opacity-0', 'pointer-events-none');
                try { modal.querySelector('.modal-content').classList.add('scale-95'); } catch(_) {}
            };

            await new Promise((resolve) => {
                const onUse = async () => {
                    if (!cropper) return;
                    const canvas = cropper.getCroppedCanvas({ imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
                    const blob = await new Promise((res) => canvas.toBlob(res, file.type || 'image/jpeg', 0.92));
                    if (blob) {
                        const dataUrl = canvas.toDataURL(file.type || 'image/jpeg', 0.92);
                        if (!firstCropDataUrl) firstCropDataUrl = dataUrl;
                        if (multiMode) {
                            multiAreas.push(dataUrl);
                            // Tanda kecil sukses
                            try { showNotification((languageState.current==='en')?'Area added':'Area ditambahkan','success',1500); } catch(_){}
                            return; // tetap di modal untuk area berikutnya
                        } else {
                            usedBlob = new File([blob], file.name, { type: file.type || 'image/jpeg' });
                            useBtn.removeEventListener('click', onUse);
                            skipBtn.removeEventListener('click', onSkip);
                            closeModal();
                            resolve();
                        }
                    }
                };
                const onSkip = async () => {
                    // Selesai (multi) atau lanjut tanpa crop (single)
                    useBtn.removeEventListener('click', onUse);
                    skipBtn.removeEventListener('click', onSkip);
                    closeModal();
                    resolve();
                };
                if (useBtn) useBtn.addEventListener('click', onUse);
                if (skipBtn) skipBtn.addEventListener('click', onSkip);
            });
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            elements.imagePreview.src = e.target.result;
            elements.imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(usedBlob);

        // Siapkan analisis: single crop (usedBlob) atau multi crop (multiAreas)
        let analysisResult = null;
        const focusLabel = (elements.inputs.productName.value || '').trim();
        if (multiMode && multiAreas.length > 0) {
            // analisis area pertama
            const first = multiAreas[0].split(',')[1];
            analysisResult = await analyzeImageWithAI(first, file.type || 'image/jpeg', focusLabel);
            // analisis area tambahan dan merge
            for (let i = 1; i < multiAreas.length; i++) {
                const bx = multiAreas[i].split(',')[1];
                const a2 = await analyzeImageWithAI(bx, file.type || 'image/jpeg', focusLabel);
                const mergedPalette = Array.from(new Set([...(analysisResult.palette||[]), ...(a2.palette||[])] )).slice(0,6);
                const mergedKw = [analysisResult.keywords, a2.keywords].filter(Boolean).join(', ');
                const mergedFeatures = Array.from(new Set([...(analysisResult.distinctive_features||[]), ...(a2.distinctive_features||[])] ));
                const mergedBrand = analysisResult.brand_guess || a2.brand_guess || '';
                const mergedModel = analysisResult.model_guess || a2.model_guess || '';
                analysisResult = { ...analysisResult, palette: mergedPalette, keywords: mergedKw, distinctive_features: mergedFeatures, brand_guess: mergedBrand, model_guess: mergedModel };
            }
            // perlihatkan preview area pertama
            elements.imagePreview.src = multiAreas[0];
            elements.imagePreviewContainer.classList.remove('hidden');
        } else {
            const base64Data = await fileToBase64(usedBlob);
            analysisResult = await analyzeImageWithAI(base64Data, usedBlob.type, focusLabel);
        }

        // Hapus confirm lama (multi-crop ditangani di atas)

        // Jika bukan run terbaru, abaikan hasil ini
        if (runId !== imageAnalysisRunId) return;

        // Compose ultra-specific identity tokens to lock product identity in prompts
        // Persist canonical DNA tokens for consistent injection across shots
        try {
            const canonicalTokens = {
                brand: analysisResult.brand_guess || '',
                model: analysisResult.model_guess || '',
                colors: Array.isArray(analysisResult.palette) ? analysisResult.palette.slice(0,3) : []
            };
            localStorage.setItem('direktiva_visual_dna_tokens', JSON.stringify(canonicalTokens));
            if (Array.isArray(analysisResult.distinctive_features)) {
                localStorage.setItem('direktiva_visual_features', JSON.stringify(analysisResult.distinctive_features.slice(0,12)));
            }
        } catch(_) {}

        const identityPrefix = [
            analysisResult.brand_guess ? `brand=${analysisResult.brand_guess}` : '',
            analysisResult.model_guess ? `model=${analysisResult.model_guess}` : '',
            Array.isArray(analysisResult.palette) && analysisResult.palette.length ? `must_keep_colors=${analysisResult.palette.slice(0,3).join('|')}` : ''
        ].filter(Boolean).join(', ');
        const distinctive = Array.isArray(analysisResult.distinctive_features) ? analysisResult.distinctive_features.join(', ') : '';
        const ocr = Array.isArray(analysisResult.ocr_text) ? analysisResult.ocr_text.join(' ') : '';
        const enrichedKeywords = [identityPrefix, analysisResult.keywords, distinctive, ocr].filter(Boolean).join(', ');
        elements.visualDnaStorage.textContent = enrichedKeywords;
        localStorage.setItem('productColorPalette', JSON.stringify(analysisResult.palette));

        showNotification(t('notification_image_analysis_success') || 'Image analysis successful');
        elements.imageHelper.textContent = `${usedBlob.name} ${t('analysis_complete') || 'analysis complete'}`;

    } catch (error) {
        if (error?.name !== 'AbortError') {
        console.error("Error during image analysis:", error);
            // Reset UI hanya jika ini run terbaru
            if (runId === imageAnalysisRunId) {
        showNotification(`${t('notification_image_analysis_error') || 'Image analysis error'} ${error.message}`, 'error');
        handleRemoveImage();
            }
        }
    } finally {
        if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch(_) {} }
        // Hanya run terbaru yang boleh mengubah state UI tombol dan loader
        if (runId === imageAnalysisRunId) {
        elements.imageLoader.classList.add('hidden');
            try { elements.generateBtn.disabled = false; } catch(_) { }
        }
    }
}

export function handleRemoveImage() {
    elements.inputs.productImage.value = '';
    elements.imagePreview.src = '';
    elements.imagePreviewContainer.classList.add('hidden');
    elements.visualDnaStorage.textContent = '';
    localStorage.removeItem('productColorPalette'); // <-- TAMBAHKAN INI
    elements.imageHelper.textContent = t('image_helper_text') || 'Upload product image for better analysis';
    try { elements.generateBtn.disabled = false; } catch(_){ }
}

export async function handleGenerate() {
    const validationError = validateInputs();
    if (validationError) {
        showNotification(validationError, 'error');
        return;
    }

    // Tampilkan/sembunyikan toolbar Rank berdasarkan jumlah skrip yang diminta user
    try {
        const requested = parseInt(document.getElementById('script-count')?.value || '1', 10);
        const toolbar = document.getElementById('results-toolbar');
        if (toolbar) {
            const show = requested > 1;
            toolbar.classList.toggle('hidden', !show);
            try { toolbar.style.display = show ? 'flex' : 'none'; } catch(_) {}
        }
    } catch (_) {}

    // Show progress bar and set loading state
    const progressBar = document.querySelector('.progress-bar');
    const progressFill = document.querySelector('.progress-bar-fill');
    
    if (progressBar) {
        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';
    }
    
    setLoadingState(true, elements.generateBtn);
    elements.downloadAllContainer.classList.add('hidden');
    
    // Show skeleton cards while loading
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        const scriptCount = parseInt(document.getElementById('script-count').value) || 3;
        for (let i = 0; i < scriptCount; i++) {
            const skeletonTemplate = document.getElementById('skeleton-card-template');
            if (skeletonTemplate) {
                const skeletonClone = skeletonTemplate.content.cloneNode(true);
                resultsContainer.appendChild(skeletonClone);
            }
        }
    }
    
    try {
        // Update progress: 20% - Preparing prompt
        if (progressFill) progressFill.style.width = '20%';
        
        const prompt = constructPrompt();
        const creativeSlider = document.getElementById('creative-freedom');
        const temperature = creativeSlider ? parseFloat(creativeSlider.value) : 0.7;
        
        // Update progress: 40% - Sending to AI
        if (progressFill) progressFill.style.width = '40%';
        
        // izinkan override timeout via localStorage, default 180s
        const timeoutMs = Number(localStorage.getItem('direktiva_timeout_ms')) || 180000;
        let results = await callGeminiAPI(prompt, getResponseSchema(), temperature, timeoutMs);
        
        // Update progress: 80% - Processing results
        if (progressFill) progressFill.style.width = '80%';

        if (!results || results.length === 0) {
            throw new Error(t('notification_script_generation_error') || 'Error generating script');
        }

        // Deduplicate hasil dan top-up jika identik
        const requestedCount = parseInt(document.getElementById('script-count')?.value || '1', 10);
        const normalize = (s) => (s||'').toString().toLowerCase().replace(/\s+/g,' ').replace(/[\-–—_,.;:!?"'`~()\[\]{}]/g,'').trim();
        const signatureOf = (sc) => [normalize(sc?.hook?.text||sc?.hook||''), normalize(sc?.body?.text||sc?.body||''), normalize(sc?.cta?.text||sc?.cta||'')].join('|');
        const uniques = new Map();
        results.forEach(r=>{ const sig = signatureOf(r); if (!uniques.has(sig)) uniques.set(sig, r); });
        if (uniques.size < requestedCount) {
          // Minta variasi tambahan yang berbeda jelas
          const avoidHooks = Array.from(uniques.values()).map(u=> (u?.hook?.text||u?.hook||'')).filter(Boolean).slice(0,8);
          const avoidBodies = Array.from(uniques.values()).map(u=> (u?.body?.text||u?.body||'')).filter(Boolean).slice(0,8);
          const avoidCtas   = Array.from(uniques.values()).map(u=> (u?.cta?.text ||u?.cta ||'')).filter(Boolean).slice(0,8);
          const extraInstr = languageState.current==='en'
            ? `\n- DIVERSITY RULE: Each variation MUST be clearly different in angle, wording, and structure.\n- STRICTLY AVOID reusing these exact texts (as-is) for any part:\nHOOK_AVOID: ${avoidHooks.join(' || ')}\nBODY_AVOID: ${avoidBodies.join(' || ')}\nCTA_AVOID: ${avoidCtas.join(' || ')}`
            : `\n- ATURAN KERAGAMAN: Setiap variasi WAJIB jelas berbeda dalam angle, diksi, dan struktur.\n- HINDARI keras mengulang teks persis berikut (apa adanya) pada bagian manapun:\nHOOK_HINDARI: ${avoidHooks.join(' || ')}\nBODY_HINDARI: ${avoidBodies.join(' || ')}\nCTA_HINDARI: ${avoidCtas.join(' || ')}`;
          const topupPrompt = prompt + extraInstr;
          const missing = Math.max(0, requestedCount - uniques.size);
          if (missing > 0) {
            try {
              const more = await callGeminiAPI(topupPrompt, getResponseSchema(missing), Math.min(1, (temperature||0.7)+0.1), timeoutMs);
              if (Array.isArray(more)) {
                more.forEach(r=>{ const sig = signatureOf(r); if (!uniques.has(sig) && uniques.size < requestedCount) uniques.set(sig, r); });
              }
            } catch(_) { /* abaikan jika top-up gagal */ }
          }
        }

        // Finalize hasil sesuai requestedCount, minta top-up kalau kurang
        let finalized = Array.from(uniques.values()).slice(0, requestedCount);
        if (finalized.length < requestedCount) {
            const missing = requestedCount - finalized.length;
            try {
                const more = await callGeminiAPI(prompt + (languageState.current==='en' ? '\nReturn EXACTLY the requested number of scripts.' : '\nKembalikan JUMLAH skrip sesuai yang diminta.'), getResponseSchema(missing), Math.min(1,(temperature||0.7)+0.05), timeoutMs);
                if (Array.isArray(more)) {
                    more.forEach(r=>{ const sig = signatureOf(r); if (!uniques.has(sig) && finalized.length < requestedCount) { uniques.set(sig, r); finalized.push(r); } });
                }
            } catch(_) {}
        }
        // Sanitize and enforce DNA prefix in every T2I prompt
        const visualDnaRaw = elements.visualDnaStorage.textContent || '';
        // Use canonical tokens from localStorage when available to avoid drift
        let canon = null;
        try { canon = JSON.parse(localStorage.getItem('direktiva_visual_dna_tokens')||'null'); } catch(_) {}
        const dna = (() => {
            const brand = (canon?.brand) || (visualDnaRaw.match(/brand\s*=\s*([^,;]+)/i)||[])[1] || '';
            const model = (canon?.model) || (visualDnaRaw.match(/model\s*=\s*([^,;]+)/i)||[])[1] || '';
            const colorsRaw = (canon?.colors?.join('|')) || (visualDnaRaw.match(/must_keep_colors\s*=\s*([^,;]+)/i)||[])[1] || '';
            const colors = (Array.isArray(canon?.colors) ? canon.colors : colorsRaw.split(/[|,\s]+/)).filter(s=>/^#?[0-9A-Fa-f]{3,6}$/.test(s)).slice(0,3);
            const parts = [];
            if (brand) parts.push(`brand=${brand}`);
            if (model) parts.push(`model=${model}`);
            if (colors.length) parts.push(`must_keep_colors=${colors.map(c=>c.startsWith('#')?c:'#'+c).join('|')}`);
            return parts.join(', ');
        })();
        // Build compact identity block for clarity; keep at most 4 features
        let featuresStr = '';
        try {
            const f = JSON.parse(localStorage.getItem('direktiva_visual_features')||'[]');
            if (Array.isArray(f) && f.length) featuresStr = f.slice(0,4).join(', ');
        } catch(_) {}
        const stripTokens = (text) => {
            if (!text) return '';
            let s = String(text);
            // Remove noisy tokens
            s = s.replace(/^\((?:brand|model|must_keep_colors)[^)]*\)\s*/i,'');
            s = s.replace(/\bbrand\s*=\s*[^,;]+[;,]?\s*/gi,'');
            s = s.replace(/\bmodel\s*=\s*[^,;]+[;,]?\s*/gi,'');
            s = s.replace(/\bmust_keep_colors\s*=\s*[^,;]+[;,]?\s*/gi,'');
            s = s.replace(/\bCAM\[[^\]]*\]\s*\|?/gi,'');
            s = s.replace(/\bLIGHT\[[^\]]*\]\s*\|?/gi,'');
            s = s.replace(/\bMOOD\[[^\]]*\]\s*\|?/gi,'');
            s = s.replace(/\bcharid\[[^\]]*\]/gi,'');
            // Remove any pre-existing ID[...] blocks to prevent duplicates
            s = s.replace(/\|?\s*ID\[[^\]]*\]\s*/gi, '');
            return s.trim();
        };
        const withDna = (text, visualIdea = '') => {
            let core = stripTokens(text);
            // Inject <char-desc> for ALL characters when using character strategy
            try {
                if ((localStorage.getItem('visualStrategy') === 'character')) {
                    const list = JSON.parse(localStorage.getItem('direktiva_char_essences') || '[]');
                    const single = localStorage.getItem('direktiva_char_essence') || '';
                    const chunks = (Array.isArray(list) && list.length) ? list.map(e => e && e.essence).filter(Boolean) : (single ? [single] : []);
                    if (chunks.length) {
                        const cleaned = core.replace(/<\/?char-desc>[^]*?<\/char-desc>/gi, '').trim();
                        const blocks = chunks.map(c => `<char-desc>${c}</char-desc>`).join(' ');
                        core = `${blocks} ${cleaned}`.trim();
                    }
                }
            } catch(_) {}
        
            // --- BAGIAN 1: Membangun Blok ID Produk (Logika ini sebagian besar sama) ---
            let productIdBlock = '';
            if (dna) {
                let dyn = '';
                try {
                    const allF = JSON.parse(localStorage.getItem('direktiva_visual_features') || '[]');
                    const chosen = chooseShotFeatures(visualIdea, allF);
                    if (Array.isArray(chosen) && chosen.length) dyn = chosen.slice(0, 4).join(', ');
                } catch (_) {}
                const feats = dyn || featuresStr;
                const tempIdBlock = `ID[${dna}${feats ? `; features=${feats}` : ''}]`;
                const productName = elements.inputs?.productName?.value || '';
        
                // Hanya tambahkan blok ID jika relevan dengan visual
                if (shouldAttachProductId(visualIdea, productName, canon?.brand || '', core)) {
                    productIdBlock = ` | ${tempIdBlock}`;
                }
            }
        
            // --- BAGIAN 2: Tidak lagi menyisipkan charID ke T2I (cukup <char-desc>) ---
            const charBlock = '';
        
            // --- BAGIAN 3: Menggabungkan semuanya ---
            let result = `${core}${productIdBlock}`;
            // Model adaptation for engines that dislike bracket blocks
            try {
                const mt = (localStorage.getItem('model_target') || 'auto').toLowerCase();
                const bracketless = (mt === 'imagen' || mt === 'flux' || mt === 'nano' || mt === 'nanobanana' || mt === 'nano banana');
                if (bracketless) {
                    const brandMatch = (dna.match(/brand=([^,\s]+)/) || [])[1] || '';
                    const modelMatch = (dna.match(/model=([^,\s]+)/) || [])[1] || '';
                    const colorsMatch = (dna.match(/must_keep_colors=([^\s]+)/) || [])[1] || '';
                    const colorList = colorsMatch ? colorsMatch.split('|').filter(Boolean) : [];
                    const feats = (result.match(/ID\[[^\]]*features=([^\]]+)\]/i) || [])[1] || '';
                    let suffixParts = [];
                    if (brandMatch || modelMatch) suffixParts.push(`official ${[brandMatch, modelMatch].filter(Boolean).join(' ')}`.trim());
                    if (colorList.length) suffixParts.push(`exact brand colors ${colorList.join(', ')}`);
                    if (feats) suffixParts.push(`identity features: ${feats}`);
                    const nat = suffixParts.length ? ` — ${suffixParts.join('; ')}` : '';
                    result = result.replace(/\s*\|\s*ID\[[^\]]*\]\s*$/i, '') + nat;
                }
            } catch(_) {}
            return result;
        };
        const ensureDnaInScript = (sc) => {
            try {
                if (sc?.hook?.shots) sc.hook.shots.forEach(sh=>{ if (sh.text_to_image_prompt) sh.text_to_image_prompt = withDna(sh.text_to_image_prompt, sh.visual_idea||''); });
                if (sc?.body?.shots) sc.body.shots.forEach(sh=>{ if (sh.text_to_image_prompt) sh.text_to_image_prompt = withDna(sh.text_to_image_prompt, sh.visual_idea||''); });
                if (sc?.cta?.shots) sc.cta.shots.forEach(sh=>{ if (sh.text_to_image_prompt) sh.text_to_image_prompt = withDna(sh.text_to_image_prompt, sh.visual_idea||''); });
                if (Array.isArray(sc?.slides)) sc.slides.forEach(sl=>{ if (sl.text_to_image_prompt) sl.text_to_image_prompt = withDna(sl.text_to_image_prompt, sl.slide_text||''); });
            } catch(_) {}
            return sc;
        };
        const generatedScripts = finalized.map((script, index) => {
            // Pipeline dinonaktifkan sementara untuk stabilitas runtime
            const sanitized = ensureDnaInScript({ ...script });
            return { ...sanitized, visual_dna: visualDnaRaw, id: `script-${Date.now()}-${index}` };
        });
        
        // Gunakan state manager untuk menyimpan skrip dan riwayat
        const currentMode = localStorage.getItem('currentMode') || 'single';
        setScripts(generatedScripts, elements.inputs.productName.value, currentMode);
        
        // Update progress: 90% - Rendering results
        if (progressFill) progressFill.style.width = '90%';
        
        await renderResults(generatedScripts);
        // Pastikan toolbar rank terlihat sesuai pilihan jumlah skrip yang diminta (re-apply setelah render)
        try {
            const toolbar = document.getElementById('results-toolbar');
            const requested = parseInt(document.getElementById('script-count')?.value || '1', 10);
            if (toolbar) {
                const show = requested > 1;
                toolbar.classList.toggle('hidden', !show);
                try { toolbar.style.display = show ? 'flex' : 'none'; } catch(_) {}
            }
        } catch (_) {}
        
        // Update progress: 100% - Complete
        if (progressFill) progressFill.style.width = '100%';
        
        elements.downloadAllContainer.classList.remove('hidden');
        
        // Hide progress bar after completion
        setTimeout(() => {
            if (progressBar) progressBar.classList.add('hidden');
        }, 1000);

    } catch (error) {
        console.error('Error during generation:', error);
        const errorMessage = error.message || t('notification_api_error') || 'API Error';
        renderError(errorMessage); 
        showNotification(errorMessage, 'error', 5000);
        
        // Hide progress bar on error
        if (progressBar) progressBar.classList.add('hidden');
    } finally {
        setLoadingState(false, elements.generateBtn);
    }
}

export async function handleRegenerate() {
    const instruction = document.getElementById('revision-instruction').value.trim();
    const sectionsToUpdate = Array.from(document.querySelectorAll('.section-checkbox:checked')).map(cb => cb.dataset.section);

    if (sectionsToUpdate.length === 0) {
        showNotification(t('notification_select_section_regenerate') || "Pilih setidaknya satu bagian untuk diregenerasi.", 'warning');
        return;
    }
    if (!instruction) {
        showNotification(t('notification_revision_instruction_empty') || "Instruksi revisi tidak boleh kosong.", 'error');
        return;
    }
    
    setLoadingState(true, elements.editModal.regenerateBtn);
    try {
        const cardBeingEditedId = localStorage.getItem('cardBeingEditedId');
        const cardBeingEdited = document.getElementById(cardBeingEditedId);
        const originalScript = JSON.parse(cardBeingEdited.dataset.script);

        const prompt = constructRevisionPrompt(originalScript, instruction, sectionsToUpdate);
        
        // Dapatkan schema hanya untuk bagian yang diregenerasi
        const responseSchema = {};
        if (sectionsToUpdate.includes('hook')) responseSchema.hook = getResponseSchema(1).items.properties.hook;
        if (sectionsToUpdate.includes('body')) responseSchema.body = getResponseSchema(1).items.properties.body;
        if (sectionsToUpdate.includes('cta')) responseSchema.cta = getResponseSchema(1).items.properties.cta;

        const newPart = await callGeminiAPI(prompt, { type: "OBJECT", properties: responseSchema });

        // Panggil fungsi untuk menampilkan before-after
        showBeforeAfter(originalScript, newPart, sectionsToUpdate);

    } catch (error) {
        console.error('Error during regeneration:', error);
        showNotification(`${t('notification_regeneration_error') || 'Regeneration error'} ${error.message}`, 'error');
    } finally {
        setLoadingState(false, elements.editModal.regenerateBtn);
    }
}

export function getResponseSchema(count) {
    const currentMode = localStorage.getItem('currentMode') || 'single';
    const scriptCount = count || parseInt(elements.inputs.scriptCount.value, 10) || 1;

    const shotObject = {
        type: "OBJECT",
        properties: { "visual_idea": { "type": "STRING" }, "prompt_translation_notes": { "type": "STRING", "description": "Explain step-by-step how the visual_idea is translated into the text_to_image_prompt, ensuring all key elements like framing and subject are identical." }, "text_to_image_prompt": { "type": "STRING" }, "negative_prompt": { "type": "STRING", "description": "Contextual negatives for this shot" }, "suggested_negative_prompt": { "type": "STRING" }, "image_to_video_prompt": { "type": "STRING" }, "camera_directives": { "type": "STRING" }, "lighting_directives": { "type": "STRING" }, "mood_directives": { "type": "STRING" } },
        required: ["visual_idea", "text_to_image_prompt", "image_to_video_prompt", "negative_prompt"]
    };
    const scriptPartObject = {
        type: "OBJECT",
        properties: { "text": { "type": "STRING" }, "shots": { "type": "ARRAY", "items": shotObject } },
        required: ["text", "shots"]
    };
    const reviewInsightObject = {
        type: "OBJECT",
        properties: { "selling_points": { type: "ARRAY", items: { type: "STRING" } } },
        required: ["selling_points"]
    };
    const characterSheetObject = {
        type: "OBJECT",
        properties: {
            "name": { "type": "STRING" }, "age": { "type": "STRING" }, "ethnicity": { "type": "STRING" }, "skin_tone": { "type": "STRING" }, "face_shape": { "type": "STRING" }, "body_shape": { "type": "STRING" }, "hair_style": { "type": "STRING" }, "hair_color": { "type": "STRING" }, "eye_color": { "type": "STRING" }
        },
        required: ["name", "age", "ethnicity", "skin_tone", "face_shape", "body_shape", "hair_style", "hair_color", "eye_color"]
    };

    const scriptObject = {
        type: "OBJECT",
        properties: { "title": { "type": "STRING" }, "review_insights": reviewInsightObject },
        required: ["title", "review_insights"]
    };

    if (currentMode === 'single') {
        scriptObject.properties.character_sheet = { type: "ARRAY", items: characterSheetObject };
        scriptObject.properties.hook = scriptPartObject;
        scriptObject.properties.body = scriptPartObject;
        scriptObject.properties.cta = scriptPartObject;
        // A/B Variants schema
        scriptObject.properties.hook_variants = { type: "ARRAY", items: { type: "STRING" } };
        scriptObject.properties.body_intro = { type: "STRING" };
        scriptObject.properties.body_variants = { type: "ARRAY", items: { type: "STRING" } };
        scriptObject.properties.cta_variants = { type: "ARRAY", items: { type: "STRING" } };
        scriptObject.required.push("hook", "body", "cta", "hook_variants", "body_variants", "cta_variants");
    } else { // Carousel mode
        const slideObject = {
            type: "OBJECT",
            properties: {
                "slide_text": { "type": "STRING" },
                "text_to_image_prompt": { "type": "STRING" },
                "layout_suggestion": { "type": "STRING" },
                "engagement_idea": { "type": "STRING" },
                "camera_directives": { "type": "STRING" },
                "lighting_directives": { "type": "STRING" },
                "mood_directives": { "type": "STRING" }
            },
            required: ["slide_text", "text_to_image_prompt"]
        };
        scriptObject.properties.slides = { type: "ARRAY", items: slideObject };
        scriptObject.required.push("slides");
    }

    return { type: "ARRAY", items: scriptObject };
}

function getLanguageSpecificSystemPrompt() {
    const currentLanguage = languageState.current;
    const storedPrompt = localStorage.getItem('direktiva_system_prompt');
    
    // Always use the stored prompt if it exists (it should be updated by language toggle)
    // If no stored prompt, fallback to language-appropriate default
    if (storedPrompt) {
        return storedPrompt;
    }
    
    // Fallback to appropriate default prompt based on language
    return currentLanguage === 'en' ? ENGLISH_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT;
}

export function constructPrompt() {
    const currentMode = localStorage.getItem('currentMode') || 'single';
    const currentLanguage = languageState.current;

    const scriptCount = currentMode === 'single' ? elements.inputs.scriptCount.value : 1;
    const selectedPersonaId = elements.personaSelector.value;
    const colorPaletteJSON = localStorage.getItem('productColorPalette');
    
    // Prompt Injection: Model & Platform Target
    const modelTarget = localStorage.getItem('model_target') || 'auto';
    const platformTarget = localStorage.getItem('platform_target') || localStorage.getItem('targetPlatform') || 'tiktok';
    // === Platform Smart Plan (config-driven) ===
    const contentMode = (localStorage.getItem('content_mode') || 'post'); // 'post' | 'carousel'
    const plan = buildPlatformPlan(platformTarget, currentLanguage, contentMode);

    // UI overrides
    const uiAspect = (localStorage.getItem('aspectRatio') || '').trim(); // "9:16" | "4:5" | "1:1" | "auto"
    const uiDurationRaw = document.getElementById('script-duration')?.value;
    const uiDuration = Number(uiDurationRaw) > 0 ? Number(uiDurationRaw) : null;
    const uiSlidesRaw = document.getElementById('carousel-slide-count')?.value;
    const uiSlides = Number(uiSlidesRaw) > 0 ? Number(uiSlidesRaw) : null;

    const isCarousel = contentMode === 'carousel';
    const finalAspect = isCarousel
      ? ((uiAspect && uiAspect !== 'auto') ? uiAspect : '4:5')
      : ((uiAspect && uiAspect !== 'auto') ? uiAspect : (plan.cfg.aspect || '9:16'));
    const finalDuration = !isCarousel ? (uiDuration || plan.cfg.maxDuration || 30) : null;
    const finalSlides = isCarousel ? (uiSlides || plan.meta.slides || 7) : null;

    function scaleBeats(beats, from, to) {
      if (!Array.isArray(beats) || !from || !to || from === to) return beats || [];
      const k = to / from;
      return beats.map(b => ({
        ...b,
        t: (typeof b.t === 'number') ? Math.max(0, Math.round(b.t * k)) : b.t
      }));
    }
    const beatsScaled = isCarousel ? [] : scaleBeats(plan.beats, plan.cfg.maxDuration, finalDuration);

    // Strictness based on Creative Freedom slider (if exists)
    const creativeSlider = document.getElementById('creative-freedom');
    const creative = creativeSlider ? parseFloat(creativeSlider.value) : 0.7;
    const strictness = Math.max(0, Math.min(1, 1 - creative));
    const planLineFlex = strictness < 0.5
      ? (currentLanguage === 'en'
          ? '- Treat the structure as advisory; you may deviate if clarity improves.'
          : '- Struktur sebagai panduan; boleh menyimpang bila hasil lebih jelas.')
      : (currentLanguage === 'en'
          ? '- Follow the structure closely.'
          : '- Ikuti struktur secara ketat.');

    const isEnNotes = currentLanguage === 'en';
    const baseNotes = isCarousel
      ? `${isEnNotes ? 'Slides' : 'Jumlah slide'}: ${finalSlides}\n${isEnNotes ? 'Aspect' : 'Rasio'}: ${finalAspect}`
      : `${isEnNotes ? 'Aspect' : 'Rasio'}: ${finalAspect}\n${isEnNotes ? 'Target duration' : 'Durasi target'}: ${finalDuration}s`;

    let platformOptimization = isEnNotes
      ? `\n- **${platformTarget.toUpperCase()} ${isCarousel ? 'CAROUSEL' : 'PLAN'}:**\n- ${baseNotes}${plan.promptNotes}\n${planLineFlex}`
      : `\n- **RANCANGAN ${platformTarget.toUpperCase()} ${isCarousel ? 'CAROUSEL' : ''}:**\n- ${baseNotes}${plan.promptNotes}\n${planLineFlex}`;

    const planPayload = isCarousel
      ? {
          type: 'carousel',
          slides: finalSlides,
          structure: plan.cfg.structure || ['Slide1 HOOK','Slide2-6 value','Slide7 CTA'],
          fontMaxWordsPerSlide: plan.meta.fontMaxWordsPerSlide || 12,
          meta: { aspect: finalAspect }
        }
      : {
          type: 'post',
          beats: beatsScaled,
          cta: plan.cta,
          commentBait: plan.commentBait,
          meta: { ...plan.meta, aspect: finalAspect, targetDuration: finalDuration }
        };
    const platformPlanJson = JSON.stringify(planPayload);

    // === System prompt with placeholders (compute AFTER platform strings are ready) ===
    const _unused_old_system_prompt = getLanguageSpecificSystemPrompt();
    const systemPromptRaw = getLanguageSpecificSystemPrompt();
    const placeholdersUsed = (systemPromptRaw.includes('[[PLATFORM_NOTES]]') || systemPromptRaw.includes('[[PLATFORM_PLAN_JSON]]'));
    // Pastikan placeholder karakter tersedia
    const systemPrompt = systemPromptRaw
      .replace('[[PLATFORM_NOTES]]', platformOptimization)
      .replace('[[PLATFORM_PLAN_JSON]]', platformPlanJson);

    
    // Generate negative prompts based on model target
    const NEGATIVE_BASE = [
        'low quality','blurry','pixelated','watermark','text','logo','signature',
        'overexposed highlights','underexposed shadows',
        'deformed hands','extra fingers','missing fingers','melted skin','asymmetrical eyes',
        'uncanny valley','plastic skin','wax texture','doll-like','mannequin face'
      ];
      
      let negativePromptInstruction = currentLanguage === 'en'
        ? `\n- **NEGATIVE PROMPT (REQUIRED):** ${NEGATIVE_BASE.join(', ')}`
        : `\n- **NEGATIVE PROMPT (WAJIB):** ${NEGATIVE_BASE.join(', ')}`;
    
    const negPromptRule = (currentLanguage === 'en')
        ? `\n- For each shot, analyze the text_to_image_prompt and populate 'suggested_negative_prompt' with specific keywords to avoid potential issues related to that particular shot.`
        : `\n- Untuk setiap shot, analisis text_to_image_prompt dan isi 'suggested_negative_prompt' dengan kata kunci spesifik untuk menghindari potensi masalah yang relevan dengan shot tersebut.`;
    
    // A/B Variants instruction
    const AB_VARIANT_COUNT = parseInt(localStorage.getItem('ab_variant_count') || '3', 10);
    const abVariantsInstruction = currentLanguage === 'en'
        ? `\n- **A/B VARIANTS (MUST BE RETURNED):** Besides the main Hook/Body/CTA/shots structure, also return:\n  - hook_variants: array containing EXACTLY ${AB_VARIANT_COUNT} alternative hook variations\n  - body_intro: short intro string for body (optional)\n  - body_variants: array containing 2-3 alternative body variations\n  - cta_variants: array containing EXACTLY ${AB_VARIANT_COUNT} alternative CTA variations`
        : `\n- **A/B VARIANTS (WAJIB DIKEMBALIKAN):** Selain struktur utama Hook/Body/CTA/shots, kembalikan juga:\n  - hook_variants: array berisi TEPAT ${AB_VARIANT_COUNT} variasi hook alternatif\n  - body_intro: string intro singkat untuk body (opsional)\n  - body_variants: array berisi 2-3 variasi body alternatif\n  - cta_variants: array berisi TEPAT ${AB_VARIANT_COUNT} variasi CTA alternatif`;
    
    let paletteInstruction = '';
    if (colorPaletteJSON && colorPaletteJSON !== 'undefined' && colorPaletteJSON !== 'null') {
        try {
            const colorPalette = JSON.parse(colorPaletteJSON);
            if (Array.isArray(colorPalette) && colorPalette.length > 0) {
                paletteInstruction = currentLanguage === 'en'
                    ? `\n- **MAIN COLOR PALETTE (MUST BE FOLLOWED):** Use the following color combinations dominantly: ${colorPalette.join(', ')}.`
                    : `\n- **PALET WARNA UTAMA (WAJIB DIPATUHI):** Gunakan kombinasi warna berikut secara dominan: ${colorPalette.join(', ')}.`;
            }
        } catch(e) {
            console.error(`${t('failed_parsing_color_palette') || 'Gagal parsing palet warna:'}`, e);
            try { localStorage.removeItem('productColorPalette'); } catch(_) {}
        }
    }

    let personaInstruction = '';
    if (selectedPersonaId) {
        const personas = getPersonas();
        const activePersona = personas.find(p => p.id === selectedPersonaId);
        if (activePersona) {
            personaInstruction = currentLanguage === 'en'
                ? `\n- AI Persona / Brand Voice: Use this persona strictly: "${activePersona.description}"`
                : `\n- Persona AI / Brand Voice: Gunakan persona ini secara ketat: "${activePersona.description}"`;
        }
    }

    // Hook Strategy Instructions
    const hookType = elements.inputs.hookType.value;
    const hookInstructions = getHookInstructions(hookType);
    
    // CTA Strategy Instructions
    const ctaType = elements.inputs.ctaType.value;
    const ctaInstructions = getCTAInstructions(ctaType);

    // (LOGIKA FINAL & LENGKAP) Membaca semua data dari formulir Character Sheet yang dinamis
    let characterSheets = [];
    const visualStrategy = localStorage.getItem('visualStrategy') || 'default';
    if (visualStrategy === 'character') {
        document.querySelectorAll('.character-sheet-instance').forEach(sheet => {
            const character = {};
            // Daftar lengkap semua field sesuai template final
            const allFields = [
                'name', 'gender', 'age', 'ethnicity', 'face_shape', 'eye_color', 
                'eye_shape', 'lip_shape', 'nose_shape', 'eyebrow_style', 'hair_style', 
                'hair_color', 'unique_features', 'makeup_style', 'skin_tone', 
                'body_shape', 'height', 'clothing_style', 'color_palette', 
                'specific_outfit', 'vibe', 'notes'
            ];

            allFields.forEach(field => {
                const input = sheet.querySelector(`[data-field="${field}"]`);
                if (input && input.value.trim() !== '') {
                    character[field] = input.value;
                }
            });

            if (Object.keys(character).length > 0) {
                characterSheets.push(character);
            }
        });
    }

    let characterSheetInstruction = '';
    if (characterSheets.length > 0) {
        // Persist canonical character tokens for consistency and build persona synthesis guidance
        try {
            const cs = characterSheets[0] || {};
            // Ambil esensi lengkap untuk <char-desc> dan ID stabil
            const { stableId } = createCharacterTokens(cs);
            const essenceFull = createCharacterEssence(cs);
            // Simpan ke localStorage untuk injeksi T2I (kompatibilitas lama)
            localStorage.setItem('direktiva_char_essence', essenceFull);
            localStorage.setItem('direktiva_char_id', stableId);
            const charTokens = {
                name: cs.name || '',
                gender: cs.gender || '',
                age: cs.age || '',
                ethnicity: cs.ethnicity || '',
                hair: [cs.hair_style, cs.hair_color].filter(Boolean).join(' '),
                eyes: cs.eye_color || '',
                skin: cs.skin_tone || '',
                vibe: cs.vibe || ''
            };
            localStorage.setItem('direktiva_char_tokens', JSON.stringify(charTokens));
            // Simpan semua essence karakter untuk dukungan multi-karakter
            try {
                const allEssences = characterSheets.map(sheet => ({ name: sheet.name || '', essence: createCharacterEssence(sheet) }));
                localStorage.setItem('direktiva_char_essences', JSON.stringify(allEssences));
            } catch(_) {}

    } catch(e) {
        console.error("Failed to process character sheet tokens:", e);
    }

        const personaGuideEn = `- CHARACTER PERSONA SYNTHESIS: Blend the sheet facts into a living persona with coherent facial proportions (eye distance, nose bridge, lip fullness) and micro-expressions. Maintain these anchor cues consistently across shots. Express mood naturally through eyes and mouth; avoid mannequin faces.`;
        const personaGuideId = `- SINTESIS PERSONA: Gabungkan fakta sheet menjadi sosok hidup dengan proporsi wajah koheren (jarak mata, pangkal hidung, ketebalan bibir) dan micro-expression. Jaga ciri jangkar ini konsisten antar shot. Ekspresikan mood natural; hindari wajah manekin.`;

        characterSheetInstruction = (currentLanguage === 'en')
            ? `\n- **CHARACTER ESSENCE (USE IN <char-desc>):** [[CHAR_ESSENCE]]\n- For multi-character scenes, include ALL of these as separate <char-desc> blocks: [[CHAR_ESSENCE_ALL]]\n${personaGuideEn}\n- IMPORTANT: All text_to_image_prompt and image_to_video_prompt MUST be in English, regardless of sheet input language.`
            : `\n- **ESENSI KARAKTER (PAKAI DI <char-desc>):** [[CHAR_ESSENCE]]\n- Untuk adegan multi-karakter, sertakan SEMUA berikut sebagai blok <char-desc> terpisah: [[CHAR_ESSENCE_ALL]]\n${personaGuideId}\n- PENTING: Semua text_to_image_prompt dan image_to_video_prompt WAJIB Bahasa Inggris, apa pun bahasa input sheet.`;
    }
    
    let interactionInstruction = '';
    const interactionDesc = document.getElementById('interaction-description');
    if (interactionDesc && !interactionDesc.parentElement.classList.contains('hidden') && interactionDesc.value.trim()) {
        interactionInstruction = currentLanguage === 'en'
            ? `\n- **KEY INTERACTION DESCRIPTION (MUST BE USED):** ${interactionDesc.value}`
            : `\n- **DESKRIPSI INTERAKSI KUNCI (WAJIB DIGUNAKAN):** ${interactionDesc.value}`;
    }
    
    let durationInstruction = '';
    if (currentMode === 'single') {
        const duration = document.getElementById('script-duration').value;
        durationInstruction = currentLanguage === 'en'
            ? `\n- Target Video Duration: Around ${duration} seconds.`
            : `\n- Target Durasi Video: Sekitar ${duration} detik.`;
    }

    let base = currentLanguage === 'en'
        ? `${systemPrompt}
                **User Request:**
                - Create ${scriptCount} script variations.
                - Product Name: ${elements.inputs.productName.value}
                - Description: ${elements.inputs.productDesc.value || t('no_description') || 'No description provided.'}
                - Product Category: ${document.getElementById('product-category').value}
                ${paletteInstruction}
                - Visual Strategy: ${visualStrategy}
                ${characterSheetInstruction}
                ${interactionInstruction}
                ${durationInstruction}
                - Aspect Ratio: ${aspectRatio}
                - Writing Style: ${elements.inputs.writingStyle.value}
                - Tone & Vibe: ${elements.inputs.toneVibe.value}
                - Target Audience: ${elements.inputs.targetAudience.value}
                - Hook Type: ${elements.inputs.hookType.value}
                - CTA Type: ${elements.inputs.ctaType.value}
                ${personaInstruction}
                ${negativePromptInstruction}
                ${platformOptimization}
                ${abVariantsInstruction}
                
                **SPECIFIC HOOK STRATEGY:**
                ${hookInstructions}
                
                **SPECIFIC CTA STRATEGY:**
                ${ctaInstructions}`
        : `${systemPrompt}
                **Permintaan Pengguna:**
                - Buat ${scriptCount} variasi skrip.
                - Nama Produk: ${elements.inputs.productName.value}
                - Deskripsi: ${elements.inputs.productDesc.value || t('no_description') || 'Tidak ada deskripsi.'}
                - Kategori Produk: ${document.getElementById('product-category').value}
                ${paletteInstruction}
                - Strategi Visual: ${visualStrategy}
                ${characterSheetInstruction}
                ${interactionInstruction}
                ${durationInstruction}
                - Aspek Rasio: ${aspectRatio}
                - Gaya Penulisan: ${elements.inputs.writingStyle.value}
                - Tone & Vibe: ${elements.inputs.toneVibe.value}
                - Target Penonton: ${elements.inputs.targetAudience.value}
                - Jenis Hook: ${elements.inputs.hookType.value}
                - Jenis CTA: ${elements.inputs.ctaType.value}
                ${personaInstruction}
                ${negativePromptInstruction}
                ${platformOptimization}
                ${abVariantsInstruction}
                
                **STRATEGI HOOK SPESIFIK:**
                ${hookInstructions}
                
                **STRATEGI CTA SPESIFIK:**
                ${ctaInstructions}`;
    
    
    // Fallback: if no placeholders, append plan to the end of base
    if (!placeholdersUsed) {
      base += platformOptimization + `\n\n[[PLATFORM_PLAN_JSON]]\n${platformPlanJson}`;
    }
    const visualDna = elements.visualDnaStorage.textContent;
    if (visualDna) {
        base += currentLanguage === 'en'
            ? `\n- **PRODUCT VISUAL DNA:** ${visualDna}`
            : `\n- **VISUAL DNA PRODUK:** ${visualDna}`;
        // Model-target aware DNA suffix rule (universal-friendly)
        const mt = (localStorage.getItem('model_target') || 'auto').toLowerCase();
        const isBracketless = (mt === 'auto' || mt === 'imagen' || mt === 'gemini' || mt === 'flux' || mt === 'nano' || mt === 'nanobanana' || mt === 'nano banana');
        if (isBracketless) {
            const dnaRule = currentLanguage === 'en'
                ? `\n- DNA SUFFIX (UNIVERSAL, NO TOKENS): Do NOT use any bracket tokens. End each text_to_image_prompt with a short natural-language suffix like: "— official <brand model>; exact brand colors <#HEX, #HEX>; identity features: <key features>" ONLY if the scene clearly shows OUR product (not competitor/before/messy/dirty/greasy/sticky/burnt/old/worn/unbranded).`
                : `\n- DNA SUFFIX (UNIVERSAL, TANPA TOKEN): JANGAN gunakan token kurung. Akhiri tiap text_to_image_prompt dengan akhiran bahasa natural seperti: "— official <brand model>; exact brand colors <#HEX, #HEX>; identity features: <fitur kunci>" HANYA jika adegan jelas memperlihatkan produk KITA (bukan kompetitor/sebelum/kotor/lengket/gosong/lama/usang/tanpa brand).`;
            base += dnaRule;
        } else {
            const dnaRule = currentLanguage === 'en'
                ? `\n- At the END of each text_to_image_prompt, optionally append ID[brand=...; model=...; must_keep_colors=HEX|HEX|HEX; features=...] ONLY if the scene clearly depicts OUR product (not competitor/before/messy/dirty/greasy/sticky/burnt/old/worn/unbranded).`
                : `\n- Di AKHIR tiap text_to_image_prompt, tambahkan ID[brand=...; model=...; must_keep_colors=HEX|HEX|HEX; features=...] HANYA jika adegan jelas memperlihatkan produk KITA (bukan kompetitor/sebelum/kotor/lengket/gosong/lama/usang/tanpa brand).`;
            base += dnaRule;
        }

        // Sinkronisasi visual_idea -> T2I wajib
        const fidelityRule = currentLanguage === 'en'
            ? `\n- FIDELITY (REQUIRED): For each shot, the text_to_image_prompt MUST explicitly reflect the subject + action + framing present in visual_idea. Start the prompt with a short one-line English paraphrase of visual_idea (no new ideas), then continue with details. Keep language strictly English.`
            : `\n- KESESUAIAN (WAJIB): Untuk setiap shot, text_to_image_prompt HARUS secara eksplisit mencerminkan subjek + aksi + framing dari visual_idea. Mulai prompt dengan satu kalimat ringkas berbahasa Inggris yang memparafrasekan visual_idea (tanpa menambah ide baru), lalu lanjutkan detail. Bahasa untuk prompt gambar HARUS Inggris.`;
        base += fidelityRule;

        // Konsistensi karakter (tanpa charID)
        const charRule = currentLanguage === 'en'
            ? `\n- CHARACTER CONSISTENCY: If visual strategy is 'Character Sheet', BEGIN text_to_image_prompt with <char-desc>[[CHAR_ESSENCE]]</char-desc>. Do NOT include <char-desc> in image_to_video_prompt.`
            : `\n- KONSISTENSI KARAKTER: Jika strategi visual 'Character Sheet', AWALI text_to_image_prompt dengan <char-desc>[[CHAR_ESSENCE]]</char-desc>. JANGAN pakai <char-desc> pada image_to_video_prompt.`;
        base += charRule;

        // Hilangkan instruksi blok sinematik agar prompt ringkas dan fokus
    }

    if (currentMode === 'carousel') {
        const slideCount = elements.inputs.slideCount.value;
        const template = elements.inputs.carouselTemplate.value;
        let templateInstruction = '';
        const templateDescriptions = {
            pas: t('pas_template_desc'),
            feature_benefit: t('feature_benefit_template_desc'),
            listicle: t('listicle_template_desc')
        };
        if (template !== 'auto' && templateDescriptions[template]) {
            templateInstruction = currentLanguage === 'en'
                ? `\n- Story Template: ${templateDescriptions[template]}`
                : `\n- Template Cerita: ${templateDescriptions[template]}`;
        }

        const carouselInstruction = currentLanguage === 'en'
            ? `${base}\n- Slide Count: ${slideCount}${templateInstruction}\n**Additional Instructions:** Create one carousel script. Generate a "slides" property containing an ARRAY of ${slideCount} objects. Each object in the array MUST have "slide_text", "text_to_image_prompt" properties, and optional "layout_suggestion" and "engagement_idea" properties.`
            : `${base}\n- Jumlah Slide: ${slideCount}${templateInstruction}\n**Instruksi Tambahan:** Buat satu skrip carousel. Hasilkan sebuah properti "slides" yang berisi sebuah ARRAY berisi ${slideCount} objek. Setiap objek dalam array WAJIB memiliki properti "slide_text", "text_to_image_prompt", dan properti opsional "layout_suggestion" serta "engagement_idea".`;
        
        return carouselInstruction;
    }

    if (colorPaletteJSON) {
        localStorage.removeItem('productColorPalette');
    }

    let finalInstruction = currentLanguage === 'en'
        ? `${base}\n**Additional Instructions:** Create a script consisting of "hook", "body", and "cta". Each section must have script text and an array containing 2-3 'shots' (micro-shots). If the visual strategy is 'Character Sheet', define one or more characters in 'character_sheet'.`
        : `${base}\n**Instruksi Tambahan:** Buat skrip yang terdiri dari "hook", "body", dan "cta". Setiap bagian harus memiliki teks skrip dan sebuah array berisi 2-3 'shots' (micro-shots). Jika strategi visual adalah 'Character Sheet', definisikan satu atau lebih karakter di 'character_sheet'.`;

    // Replace character essence placeholder(s) if present; enforce language
    try {
        const singleEssence = localStorage.getItem('direktiva_char_essence') || '';
        let allEssencesStr = '';
        try {
            const arr = JSON.parse(localStorage.getItem('direktiva_char_essences') || '[]');
            if (Array.isArray(arr) && arr.length) {
                const blocks = arr.map(e => e && e.essence).filter(Boolean).map(s => `<char-desc>${s}</char-desc>`);
                allEssencesStr = blocks.join(' ');
            }
        } catch(_) {}
        finalInstruction = finalInstruction.replaceAll('[[CHAR_ESSENCE]]', singleEssence);
        finalInstruction = finalInstruction.replaceAll('[[CHAR_ESSENCE_ALL]]', allEssencesStr);
    } catch(_) {
        finalInstruction = finalInstruction.replaceAll('[[CHAR_ESSENCE]]', '');
        finalInstruction = finalInstruction.replaceAll('[[CHAR_ESSENCE_ALL]]', '');
    }
    
    return finalInstruction;
}

export function constructRevisionPrompt(originalScript, instruction, sectionsToUpdate) {
    const currentLanguage = languageState.current;
    
    // 1. Kunci bagian yang tidak diubah (logika ini sudah benar)
    const lockedSections = {};
    if (!sectionsToUpdate.includes('hook')) lockedSections.hook = originalScript.hook;
    if (!sectionsToUpdate.includes('body')) lockedSections.body = originalScript.body;
    if (!sectionsToUpdate.includes('cta')) lockedSections.cta = originalScript.cta;

    // 2. (LOGIKA BARU) Kumpulkan kembali semua batasan dari formulir asli
    const originalConstraints = {
        writingStyle: elements.inputs.writingStyle.value,
        toneVibe: elements.inputs.toneVibe.value,
        targetAudience: elements.inputs.targetAudience.value,
        hookType: elements.inputs.hookType.value,
        ctaType: elements.inputs.ctaType.value,
        characterSheets: (() => {
            const sheets = [];
            try {
                document.querySelectorAll('.character-sheet-instance').forEach(sheet => {
                    const data = {};
                    sheet.querySelectorAll('[data-field]').forEach(input => { if (input.value.trim()) data[input.dataset.field] = input.value; });
                    if (Object.keys(data).length) sheets.push(data);
                });
            } catch(_) {}
            return sheets;
        })()
    };

    // 3. Susun prompt baru yang jauh lebih cerdas
    let prompt = '';
    if (currentLanguage === 'en') {
        prompt = `You are an AI revision assistant. A script has been created with the following initial constraints:\n`;
        prompt += `\`\`\`json\n${JSON.stringify(originalConstraints, null, 2)}\n\`\`\`\n\n`;
        
        if (Object.keys(lockedSections).length > 0) {
            prompt += `The following sections of this script are FINAL and MUST NOT BE CHANGED AT ALL:\n`;
            prompt += `\`\`\`json\n${JSON.stringify(lockedSections, null, 2)}\n\`\`\`\n\n`;
        }

        prompt += `Now, your task is to regenerate the following sections: [${sectionsToUpdate.join(', ')}] based on this instruction: "${instruction}".\n`;
        prompt += `STRICT CHARACTER RULES: If characterSheets are provided, you MUST use them for all regenerated parts and visual prompts. Do NOT invent or modify characters. In T2I prompts, place physical descriptions ONLY inside <char-desc>...</char-desc>. NEVER include <char-desc> in I2V prompts.\n`;
        prompt += `IMPORTANT: Ensure your regeneration results still comply with the initial constraints given above (for example, if ctaType is 'TikTok', the result should still be TikTok-style). ALL SCRIPT TEXT OUTPUT MUST BE IN ENGLISH.\n`;
        prompt += `Generate ONLY the sections you regenerate in valid JSON format.`;
    } else {
        prompt = `Anda adalah asisten revisi AI. Sebuah skrip telah dibuat dengan batasan awal sebagai berikut:\n`;
        prompt += `\`\`\`json\n${JSON.stringify(originalConstraints, null, 2)}\n\`\`\`\n\n`;
        
        if (Object.keys(lockedSections).length > 0) {
            prompt += `Bagian berikut dari skrip ini SUDAH FINAL dan TIDAK BOLEH DIUBAH SAMA SEKALI:\n`;
            prompt += `\`\`\`json\n${JSON.stringify(lockedSections, null, 2)}\n\`\`\`\n\n`;
        }

        prompt += `Sekarang, tugas Anda adalah me-regenerasi bagian berikut: [${sectionsToUpdate.join(', ')}] berdasarkan instruksi ini: "${instruction}".\n`;
        prompt += `ATURAN KARAKTER YANG KETAT: Jika characterSheets tersedia, WAJIB digunakan untuk semua bagian yang direvisi dan prompt visual. JANGAN membuat/mengubah karakter baru. Pada T2I, taruh deskripsi fisik HANYA di dalam tag <char-desc>...</char-desc>. JANGAN pernah menaruh <char-desc> pada I2V.\n`;
        prompt += `PENTING: Pastikan hasil regenerasi Anda tetap mematuhi batasan awal yang diberikan di atas (misalnya, jika ctaType adalah 'TikTok', hasilnya harus tetap bergaya TikTok). SEMUA OUTPUT TEKS SKRIP WAJIB DALAM BAHASA INDONESIA.\n`;
        prompt += `Hasilkan HANYA bagian yang Anda regenerasi dalam format JSON yang valid.`;
    }
    
    return prompt;
}

export async function handleGenerateAssets(card) {
    const assetsContainer = card.querySelector('.additional-assets-container');
    const loader = card.querySelector('.asset-loader');
    const contentDiv = card.querySelector('.asset-content');

    assetsContainer.classList.remove('hidden');
    loader.classList.remove('hidden');
    contentDiv.classList.add('hidden');
    contentDiv.innerHTML = '';
    showNotification('Generating assets...', 'info');

    let assets = null;
    let assetsHTML = '';

    try {
        const script = JSON.parse(card.dataset.script);
        const fullScriptText = getFullScriptText(script);
        const platform = (localStorage.getItem('platform_target') || localStorage.getItem('targetPlatform') || 'tiktok').toLowerCase();
        const prompt = `${t('asset_generation_prompt') || 'Berdasarkan skrip berikut, buatlah 3 opsi judul/caption yang menarik, 1 set hashtag yang relevan (gabungan umum dan niche), dan 3 ide teks singkat untuk thumbnail/cover.'}

Tambahkan juga daftar hashtag yang SPESIFIK untuk platform: ${platform}.
Jika platform TikTok, gunakan kombinasi tag FYP dan niche yang relevan (contoh: #fyp, #foryou, #tiktokshop, serta niche spesifik produk/brand). Jika Instagram Reels, prioritaskan tag discoverability dan niche brand (contoh: #reels, #reelitfeelit). Jika YouTube Shorts, gunakan tag discoverability seperti #shorts serta niche.

WAJIB: Selain platform yang dipilih, SELALU sertakan juga daftar khusus untuk Shopee pada field platform_hashtags.shopee (format array of strings) yang relevan untuk konversi marketplace (contoh: #Shopee, #ShopeeHaul, #Voucher, #GratisOngkir, dll).

${t('script_label') || 'Skrip'}:
---
${fullScriptText}
---
`;
        // >>> pakai timeout lebih panjang khusus assets
        const timeoutMs = Number(localStorage.getItem('direktiva_timeout_ms')) || 120000;
        assets = await callGeminiAPI(prompt, getAdditionalAssetsResponseSchema(), /*temperature*/0.7, timeoutMs);

        let assetsHTML = '<div class="space-y-4">';

        assetsHTML += `<div><h5 class="text-sm font-bold text-gray-300 mb-2">${t('asset_titles_label') || 'Judul/Caption'}</h5><ul class="list-disc list-inside text-xs text-gray-400 space-y-1">`;
        assets.titles.forEach(title => {
            assetsHTML += `<li>${title}</li>`;
        });
        assetsHTML += '</ul></div>';

        assetsHTML += `<div><h5 class="text-sm font-bold text-gray-300 mb-2">${t('asset_hashtags_label') || 'Hashtags'}</h5>`;
        const genericTags = (assets.hashtags || []).join(' ');
        const platformTags = assets.platform_hashtags?.[platform] || [];
        const trending = assets.trending_tags || [];
        assetsHTML += `<p class="text-xs text-gray-400 bg-gray-800 p-2 rounded-md">${genericTags}</p>`;
        if (platformTags.length) {
            assetsHTML += `<div class="mt-2"><span class="text-xs font-semibold text-blue-300">${platform} #</span><p class="text-xs text-gray-400 bg-gray-800 p-2 rounded-md">${platformTags.join(' ')}</p></div>`;
        }
        const shopeeTags = assets.platform_hashtags?.shopee || [];
        if (shopeeTags.length) {
            assetsHTML += `<div class="mt-2"><span class="text-xs font-semibold text-orange-300">Shopee #</span><p class="text-xs text-gray-400 bg-gray-800 p-2 rounded-md">${shopeeTags.join(' ')}</p></div>`;
        }
        if (trending.length) {
            assetsHTML += `<div class="mt-2"><span class="text-xs font-semibold text-green-300">Trending</span><p class="text-xs text-gray-400 bg-gray-800 p-2 rounded-md">${trending.join(' ')}</p></div>`;
        }
        assetsHTML += `</div>`;

        assetsHTML += `<div><h5 class="text-sm font-bold text-gray-300 mb-2">${t('asset_thumbnail_label') || 'Ide Thumbnail'}</h5><ul class="list-disc list-inside text-xs text-gray-400 space-y-1">`;
        assets.thumbnail_ideas.forEach(idea => {
            assetsHTML += `<li>${idea}</li>`;
        });
        assetsHTML += '</ul></div>';

        assetsHTML += '</div>';

        contentDiv.innerHTML = assetsHTML;

        showNotification('Assets generated.', 'success');

        // persist supaya tidak hilang saat overlay ditutup
        try {
            const scriptToPersist = JSON.parse(card.dataset.script);
            scriptToPersist.additional_assets = assets;
            scriptToPersist.additional_assets_html = assetsHTML;
            card.dataset.script = JSON.stringify(scriptToPersist);
            const { updateSingleScript } = await import('./state.js');
            updateSingleScript(scriptToPersist);
          } catch(_) {}

    } catch (error) {
        console.error("Error generating assets:", error);
        contentDiv.innerHTML = `<p class="text-red-400 text-xs">${t('failed_to_generate_assets') || 'Failed to generate assets:'} ${error.message}</p>`;
        showNotification(error.message || (t('failed_to_generate_assets') || 'Failed to generate assets'), 'error');
    } finally {
        loader.classList.add('hidden');
        contentDiv.classList.remove('hidden');
    }
}
