// js/generator.js
import { elements, setLoadingState, showNotification, fileToBase64, getCharacterDescriptionString, getFullScriptText, closeEditModal, showBeforeAfter, languageState, showNotification } from './utils.js';
import { t } from './i18n.js';
import { analyzeImageWithAI, callGeminiAPI } from './api.js';
import { getPersonas } from './persona.js';
import { renderResults, renderError } from './ui.results.js';
import { DEFAULT_SYSTEM_PROMPT, ENGLISH_SYSTEM_PROMPT } from './settings.js';
import { setScripts } from './state.js';
import { getAdditionalAssetsResponseSchema } from './generator.schema.js';

export let visualStrategy = localStorage.getItem('visualStrategy') || 'default';
export let aspectRatio = localStorage.getItem('aspectRatio') || '9:16';

// Guard untuk mencegah race kondisi saat analisis gambar beruntun
let imageAnalysisRunId = 0;

// Hook Strategy Functions
export function getHookInstructions(hookType) {
    const isEnglish = languageState.current === 'en';
    
    const hookStrategies = {
        'hook_problem': isEnglish ? 
            'Start by identifying specific problems your target audience faces. Use relatable and emotional language. Examples: "Are you tired of..." or "Have you ever experienced..."' :
            'Mulai dengan mengidentifikasi masalah spesifik yang dialami target audiens. Gunakan bahasa yang relatable dan emosional. Contoh: "Capek gak sih kalau..." atau "Pernah nggak ngalamin..."',
        'hook_target_call': isEnglish ?
            'Call out your target audience directly and specifically. Make them feel personally addressed. Examples: "For those of you who often..." or "Specifically for..."' :
            'Panggil target audiens secara langsung dan spesifik. Buat mereka merasa dipanggil secara personal. Contoh: "Buat kamu yang sering..." atau "Khusus untuk para..."',
        'hook_bold_claim': isEnglish ?
            'Make bold and surprising claims about your product. Must be provable and not exaggerated. Examples: "This is the only product that..." or "Guaranteed 100%..."' :
            'Buat klaim yang berani dan mengejutkan tentang produk. Harus bisa dibuktikan dan tidak berlebihan. Contoh: "Ini satu-satunya produk yang..." atau "Dijamin 100%..."',
        'hook_curiosity': isEnglish ?
            'Spark curiosity with incomplete information. Make the audience want to know more. Examples: "The secret that was never told..." or "It turns out all this time..."' :
            'Bangkitkan rasa penasaran dengan informasi yang tidak lengkap. Buat audiens ingin tahu lebih. Contoh: "Rahasia yang gak pernah diceritain..." atau "Ternyata selama ini..."',
        'hook_social_proof': isEnglish ?
            'Use testimonials, numbers, or strong social proof. Show that many people have experienced the benefits. Examples: "Over 10,000+ people have..." or "Viral on TikTok because..."' :
            'Gunakan testimoni, angka, atau bukti sosial yang kuat. Tunjukkan bahwa banyak orang sudah merasakan manfaatnya. Contoh: "Udah 10.000+ orang yang..." atau "Viral di TikTok karena..."',
        'hook_negativity_bias': isEnglish ?
            'Focus on negative consequences of not using the product. Use fear of missing out. Examples: "Don\'t regret not..." or "It\'s dangerous if you don\'t..."' :
            'Fokus pada konsekuensi negatif jika tidak menggunakan produk. Gunakan fear of missing out. Contoh: "Jangan sampai nyesal karena..." atau "Bahaya kalau kamu gak..."',
        'hook_future_pacing': isEnglish ?
            'Invite audience to imagine the future with AI technology and sustainability. Use strong visualization about 2025 trends. Examples: "Imagine if AI could help you..." or "What would zero waste life feel like in 2025..."' :
            'Ajak audiens membayangkan masa depan dengan teknologi AI dan sustainability. Gunakan visualisasi yang kuat tentang tren 2025. Contoh: "Bayangin kalau AI bisa bantu kamu..." atau "Gimana rasanya hidup zero waste di 2025..."',
        'hook_question': isEnglish ?
            'Start with questions about 2025 digital trends, mental health, or sustainability. Must be relevant to current issues. Examples: "Why does Gen Alpha prefer sustainable products?" or "Do you know why AI can now...?"' :
            'Mulai dengan pertanyaan tentang tren digital 2025, mental health, atau sustainability. Harus relevan dengan isu terkini. Contoh: "Kenapa Gen Alpha lebih pilih produk sustainable?" atau "Tau gak kenapa AI sekarang bisa...?"',
        'hook_solution': isEnglish ?
            'Offer solutions for modern 2025 problems: burnout, digital detox, climate anxiety, or AI integration. Examples: "The easiest way to digital detox..." or "Anti-burnout solution that went viral in 2025..."' :
            'Tawarkan solusi untuk masalah modern 2025: burnout, digital detox, climate anxiety, atau AI integration. Contoh: "Cara termudah untuk digital detox..." atau "Solusi anti-burnout yang viral di 2025..."',
        'hook_statistic': isEnglish ?
            'Use latest 2025 data about AI adoption, sustainability, mental health awareness, or Gen Alpha behavior. Examples: "Turns out 95% of Gen Alpha care more about environment..." or "2025 research proves AI can..."' :
            'Gunakan data terbaru 2025 tentang AI adoption, sustainability, mental health awareness, atau Gen Alpha behavior. Contoh: "Ternyata 95% Gen Alpha lebih peduli lingkungan..." atau "Penelitian 2025 buktikan AI bisa..."',
        'hook_experimental': isEnglish ?
            'Invite audience to join viral 2025 challenges: sustainability challenge, AI productivity test, or mindfulness experiment. Examples: "Try this 30-day sustainability challenge..." or "Test how productive you are with AI..."' :
            'Ajak audiens ikut challenge viral 2025: sustainability challenge, AI productivity test, atau mindfulness experiment. Contoh: "Coba deh 30-day sustainability challenge..." atau "Test seberapa produktif kamu dengan AI..."',
        'hook_tension': isEnglish ?
            'Build tension about 2025 issues: climate crisis, AI replacement anxiety, or digital overwhelm. Examples: "Almost lost my job because of AI..." or "Tense moments during climate change..."' :
            'Bangun ketegangan tentang isu 2025: climate crisis, AI replacement anxiety, atau digital overwhelm. Contoh: "Hampir aja kehilangan pekerjaan karena AI..." atau "Detik-detik menegangkan saat climate change..."',
        'hook_surprise': isEnglish ?
            'Plot twist about 2025 misconceptions: AI myths, sustainability facts, or Gen Alpha behavior. Examples: "What you think is dangerous about AI, turns out..." or "Plot twist: Gen Alpha is actually wiser..."' :
            'Plot twist tentang misconception 2025: AI myths, sustainability facts, atau Gen Alpha behavior. Contoh: "Yang kamu pikir AI berbahaya, ternyata..." atau "Plot twist: Gen Alpha ternyata lebih wise..."',
        'hook_list': isEnglish ?
            'Use list format about 2025 trends, AI tools, sustainable living, or mental health tips. Examples: "5 AI tools you must try in 2025..." or "3 sustainable habits that went viral..."' :
            'Gunakan format daftar tentang tren 2025, AI tools, sustainable living, atau mental health tips. Contoh: "5 AI tools yang wajib kamu coba 2025..." atau "3 sustainable habits yang viral..."',
        'hook_story': isEnglish ?
            'Start with personal story about 2025 technology adaptation, mental health journey, or sustainable lifestyle. Examples: "I used to be skeptical about AI, but..." or "My burnout story in the digital era..."' :
            'Mulai dengan cerita personal tentang adaptasi teknologi 2025, mental health journey, atau sustainable lifestyle. Contoh: "Dulu aku skeptis sama AI, tapi..." atau "Cerita burnout aku di era digital..."',
        'hook_comparison': isEnglish ?
            'Compare pre-AI vs post-AI life, traditional vs sustainable living, or Gen Z vs Gen Alpha mindset. Examples: "The difference between life before and after AI..." or "Gen Z vs Gen Alpha: who is wiser?"' :
            'Bandingkan life pre-AI vs post-AI, traditional vs sustainable living, atau Gen Z vs Gen Alpha mindset. Contoh: "Bedanya hidup sebelum dan sesudah AI..." atau "Gen Z vs Gen Alpha: siapa yang lebih wise?"',
        'hook_mistake': isEnglish ?
            'Admit mistakes in technology adoption, sustainability journey, or mental health. Examples: "Fatal mistake when first using AI..." or "Don\'t be like me: burnout because..."' :
            'Akui kesalahan dalam adopsi teknologi, sustainability journey, atau mental health. Contoh: "Kesalahan fatal saat pertama pakai AI..." atau "Jangan sampai kayak aku dulu: burnout karena..."',
        'hook_secret': isEnglish ?
            'Reveal insider knowledge about AI industry, sustainability tips, or Gen Alpha insights. Examples: "AI secrets only known by tech insiders..." or "Sustainability hacks never shared..."' :
            'Reveal insider knowledge tentang AI industry, sustainability tips, atau Gen Alpha insights. Contoh: "Rahasia AI yang cuma diketahui tech insider..." atau "Sustainability hacks yang gak pernah dibagi..."',
        'hook_transformation': isEnglish ?
            'Show transformation with AI tools, sustainable living, or mental health improvement. Examples: "From tech-phobic to AI expert..." or "Mental health transformation in 30 days..."' :
            'Tunjukkan transformasi dengan AI tools, sustainable living, atau mental health improvement. Contoh: "Dari tech-phobic jadi AI expert..." atau "Transformasi mental health dalam 30 hari..."',
        'hook_pattern_interrupt': isEnglish ?
            'Use a pattern interrupt in the first 1-2 seconds: unexpected motion, jump cut, visual glitch, or bold text overlay to force attention. Immediately tie it to the core benefit.' :
            'Gunakan pattern interrupt di 1-2 detik pertama: gerakan tak terduga, jump cut, visual glitch, atau teks tebal untuk memaksa perhatian. Segera hubungkan ke manfaat utama.',
        'hook_unpopular_opinion': isEnglish ?
            'Start with a bold, polarizing statement (unpopular opinion) that challenges common beliefs; keep it respectful and data-backed.' :
            'Mulai dengan pernyataan tegas yang memicu perdebatan (unpopular opinion) yang menantang keyakinan umum; tetap hormat dan didukung data.',
        'hook_myth_busting': isEnglish ?
            'Bust a common myth with a surprising fact or demo. Lead with the myth, then immediately reveal the truth.' :
            'Bongkar mitos umum dengan fakta atau demo mengejutkan. Mulai dari mitos, lalu segera ungkap kebenarannya.',
        'hook_before_after': isEnglish ?
            'Show an eye-catching BEFORE vs AFTER in the first frame. Make the transformation obvious and high-contrast.' :
            'Tampilkan BEFORE vs AFTER yang mencolok pada frame pertama. Buat transformasinya jelas dan kontras tinggi.',
        'hook_speedrun_demo': isEnglish ?
            'Do a speedrun demo: “Watch me do X in 10 seconds”. Use fast pacing and timers to build retention.' :
            'Lakukan speedrun demo: “Lihat aku lakukan X dalam 10 detik”. Gunakan pacing cepat dan timer untuk menjaga retensi.',
        'hook_stitch_duet_react': isEnglish ?
            'Open by reacting to a trending clip (stitch/duet). Provide a punchy take in 1 sentence, then add your unique angle.' :
            'Buka dengan reaksi ke klip trending (stitch/duet). Berikan opini tajam dalam 1 kalimat, lalu tambahkan sudut pandang unik Anda.',
        'hook_no_face_asmr': isEnglish ?
            'Use faceless/ASMR-style visuals with satisfying sounds; overlay a concise voice/text hook to anchor the benefit.' :
            'Gunakan visual faceless/ASMR dengan suara memuaskan; tambahkan voice/text hook singkat untuk menambatkan manfaat.',
        'hook_testing_for_you': isEnglish ?
            '“I tested X so you don’t have to” format. Summarize the result upfront, then micro-proof in 2-3 beats.' :
            'Format “Aku sudah mencoba X jadi kamu tidak perlu”. Ringkas hasil di depan, lalu bukti singkat 2-3 poin.',
        'hook_price_anchor': isEnglish ?
            'Lead with a price/value anchor: “People pay $299 for this… here’s a $29 alternative”. Keep comparisons fair and honest.' :
            'Mulai dengan anchor harga/nilai: “Orang bayar Rp4,5jt untuk ini… ini alternatif Rp450rb”. Jaga perbandingan tetap adil dan jujur.'
    };
    
    const defaultInstruction = isEnglish ? 
        'Create an engaging hook that captures attention in the first 3 seconds.' :
        'Buat hook yang menarik perhatian dalam 3 detik pertama.';
        
    return hookStrategies[hookType] || defaultInstruction;
}

export function getCTAInstructions(ctaType) {
    const isEnglish = languageState.current === 'en';
    
    const ctaStrategies = {
        'cta_general': isEnglish ?
            'Use clear and direct CTA. Focus on the action you want them to take. Examples: "Order now" or "Get it now"' :
            'Gunakan CTA yang jelas dan direct. Fokus pada action yang ingin dilakukan. Contoh: "Pesan sekarang" atau "Dapatkan sekarang"',
        'cta_tiktok': isEnglish ?
            'Use Gen Alpha language and 2025 trending terms. Focus on sustainability and AI features. Examples: "Check yellow cart for eco-friendly products!" or "AI-powered solution link in bio!"' :
            'Gunakan bahasa Gen Alpha dan trending 2025. Fokus pada sustainability dan AI features. Contoh: "Cek keranjang kuning untuk produk eco-friendly!" atau "Link AI-powered solution di bio!"',
        'cta_shopee': isEnglish ?
            'Highlight eco-friendly shipping and AI recommendations. Mention carbon-neutral delivery. Examples: "Shopee now offers carbon-neutral delivery!" or "AI recommends the best products for you!"' :
            'Highlight eco-friendly shipping dan AI recommendations. Mention carbon-neutral delivery. Contoh: "Shopee sekarang carbon-neutral delivery!" atau "AI rekomendasiin produk terbaik buat kamu!"',
        'cta_instagram': isEnglish ?
            'Direct to sustainable content and AI tools. Use mindful language. Examples: "Sustainable living tips in bio!" or "AI productivity hacks, swipe up!"' :
            'Arahkan ke sustainable content dan AI tools. Gunakan mindful language. Contoh: "Sustainable living tips di bio!" atau "AI productivity hacks, swipe up!"',
        'cta_youtube': isEnglish ?
            'Invite to subscribe for AI tutorials and sustainability content. Examples: "Subscribe for latest AI tips!" or "Turn on notifications for sustainable living hacks!"' :
            'Ajak subscribe untuk AI tutorials dan sustainability content. Contoh: "Subscribe untuk AI tips terbaru!" atau "Nyalakan notif untuk sustainable living hacks!"',
        'cta_comment': isEnglish ?
            'Invite discussion about AI, sustainability, or mental health. Examples: "Share your AI experience in comments!" or "Tag a friend who needs digital detox!"' :
            'Ajak diskusi tentang AI, sustainability, atau mental health. Contoh: "Share pengalaman AI kamu di komen!" atau "Tag teman yang butuh digital detox!"',
        'cta_urgency': isEnglish ?
            'Create urgency about climate action or AI adoption. Examples: "Before it\'s too late for our planet!" or "Before AI replaces your skills!"' :
            'Urgency tentang climate action atau AI adoption. Contoh: "Sebelum terlambat untuk planet kita!" atau "Sebelum AI gantikan skill kamu!"',
        'cta_scarcity': isEnglish ?
            'Emphasize limited edition sustainable products or early access AI tools. Examples: "Limited edition eco-friendly!" or "Early access AI beta for only 100 people!"' :
            'Tekankan limited edition sustainable products atau early access AI tools. Contoh: "Limited edition eco-friendly!" atau "Early access AI beta cuma 100 orang!"',
        'cta_social_proof_cta': isEnglish ?
            'Use AI adoption data or sustainability movement statistics. Examples: "Join 1M+ who went green!" or "Like 500K+ AI early adopters..."' :
            'Gunakan data adopsi AI atau sustainability movement. Contoh: "Join 1M+ yang udah go green!" atau "Seperti 500K+ AI early adopters..."',
        'cta_benefit_focused': isEnglish ?
            'Focus on AI productivity or sustainable living benefits. Examples: "10x productivity with AI!" or "Save 70% carbon footprint!"' :
            'Fokus pada benefit AI productivity atau sustainable living. Contoh: "10x produktivitas dengan AI!" atau "Hemat 70% carbon footprint!"',
        'cta_risk_reversal': isEnglish ?
            'Guarantee for AI tools or eco products. Examples: "AI doesn\'t work? 100% refund!" or "Not satisfied with eco-product? Free exchange!"' :
            'Garansi untuk AI tools atau eco products. Contoh: "AI gak cocok? Refund 100%!" atau "Gak puas dengan eco-product? Tukar gratis!"',
        'cta_curiosity_gap': isEnglish ?
            'Create curiosity about AI secrets or sustainability hacks. Examples: "AI secret never shared before..." or "Sustainability hack that went viral..."' :
            'Buat penasaran tentang AI secrets atau sustainability hacks. Contoh: "AI secret yang gak pernah dibagi..." atau "Sustainability hack yang viral..."',
        'cta_exclusive': isEnglish ?
            'Exclusive access to AI community or sustainability program. Examples: "Exclusive AI mastermind!" or "VIP sustainable living program!"' :
            'Akses eksklusif ke AI community atau sustainability program. Contoh: "Exclusive AI mastermind!" atau "VIP sustainable living program!"',
        'cta_interactive': isEnglish ?
            'Invite to participate in AI experiment or eco challenge. Examples: "Test AI with us!" or "Join 30-day sustainability challenge!"' :
            'Ajak participate dalam AI experiment atau eco challenge. Contoh: "Test AI bareng kita!" atau "Join 30-day sustainability challenge!"',
        'cta_storytelling': isEnglish ?
            'Continue AI journey or sustainability transformation story. Examples: "AI journey continuation at..." or "Complete transformation story at..."' :
            'Lanjutkan AI journey atau sustainability transformation story. Contoh: "Kelanjutan AI journey di..." atau "Transformation story lengkap di..."',
        'cta_challenge': isEnglish ?
            'Challenge related to AI skills or sustainable habits. Examples: "7-day AI productivity challenge!" or "#SustainableLifestyle challenge!"' :
            'Challenge terkait AI skills atau sustainable habits. Contoh: "Challenge AI productivity 7 hari!" atau "#SustainableLifestyle challenge!"',
        'cta_add_to_cart': isEnglish ?
            'Direct add-to-cart CTA tailored to commerce flows. Examples: "Tap the cart now" / "Add to cart, checkout later".' :
            'CTA langsung tambah ke keranjang yang sesuai alur commerce. Contoh: "Tap keranjang sekarang" / "Tambah ke keranjang, checkout nanti".',
        'cta_claim_voucher': isEnglish ?
            'Claim time-bound voucher/coupon. Examples: "Claim 20% voucher today" / "Claim coins before midnight".' :
            'Klaim voucher/kupon berbatas waktu. Contoh: "Klaim voucher 20% hari ini" / "Klaim koin sebelum tengah malam".',
        'cta_chat_seller': isEnglish ?
            'Prompt to chat seller for bundle, sizing, or custom deals. Examples: "Chat seller for bundle price".' :
            'Ajak chat penjual untuk bundling, ukuran, atau deal khusus. Contoh: "Chat penjual untuk harga bundling".',
        'cta_follow_shop': isEnglish ?
            'Ask to follow the shop/brand for exclusive drops and vouchers.' :
            'Ajak follow toko/brand untuk eksklusif drop dan voucher.',
        'cta_join_live': isEnglish ?
            'Invite to join live shopping/AMA session. Examples: "Join our live at 7PM for extra voucher".' :
            'Ajak bergabung ke live shopping/AMA. Contoh: "Join live jam 19.00 untuk voucher ekstra".',
        'cta_reply_keyword': isEnglish ?
            'Comment a keyword to get link/template. Examples: "Comment LINK to get it" / "Reply: GUIDE".' :
            'Komentar keyword untuk dapat link/template. Contoh: "Komen LINK untuk dapat" / "Reply: PANDUAN".',
        'cta_pinned_comment': isEnglish ?
            'Point to pinned comment (Shorts/Reels). Example: "Link in pinned comment".' :
            'Arahkan ke komentar tersemat (Shorts/Reels). Contoh: "Link di komentar teratas".',
        'cta_save_share': isEnglish ?
            'Ask to save and share for algorithm lift. Example: "Save and share to help more people".' :
            'Ajak simpan dan bagikan untuk dorong algoritma. Contoh: "Simpan & share biar lebih banyak yang kebantu".',
        'cta_dm_keyword': isEnglish ?
            'DM a keyword to receive a resource. Example: "DM ‘CHECKLIST’ to get the PDF".' :
            'DM keyword untuk menerima resource. Contoh: "DM ‘CHECKLIST’ untuk terima PDF".',
        'cta_join_broadcast': isEnglish ?
            'Invite to join IG broadcast channel for drops and codes.' :
            'Ajak join broadcast channel IG untuk drop dan kode.'
    };
    
    const defaultInstruction = isEnglish ?
        'Create clear and actionable CTA.' :
        'Buat CTA yang jelas dan actionable.';
        
    return ctaStrategies[ctaType] || defaultInstruction;
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
    try { elements.generateBtn.disabled = true; } catch(_){ }

    try {
        const reader = new FileReader();
        reader.onload = (e) => {
            elements.imagePreview.src = e.target.result;
            elements.imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        const base64Data = await fileToBase64(file);
        
        // Panggil fungsi orkestrasi yang baru
        const analysisResult = await analyzeImageWithAI(base64Data, file.type);

        // Jika bukan run terbaru, abaikan hasil ini
        if (runId !== imageAnalysisRunId) return;

        // Simpan hasil ke tempat yang benar (hanya untuk run terbaru)
        elements.visualDnaStorage.textContent = analysisResult.keywords;
        localStorage.setItem('productColorPalette', JSON.stringify(analysisResult.palette));

        showNotification(t('notification_image_analysis_success') || 'Image analysis successful');
        elements.imageHelper.textContent = `${file.name} ${t('analysis_complete') || 'analysis complete'}`;

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
        // Hanya run terbaru yang boleh mengubah state UI tombol dan loader
        if (runId === imageAnalysisRunId) {
            elements.imageLoader.classList.add('hidden');
            try { elements.generateBtn.disabled = false; } catch(_){ }
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
        
        const results = await callGeminiAPI(prompt, getResponseSchema(), temperature);
        
        // Update progress: 80% - Processing results
        if (progressFill) progressFill.style.width = '80%';

        if (!results || results.length === 0) {
            throw new Error(t('notification_script_generation_error') || 'Error generating script');
        }

        // PERUBAHAN UTAMA DI SINI
        const generatedScripts = results.map((script, index) => ({ ...script, visual_dna: elements.visualDnaStorage.textContent, id: `script-${Date.now()}-${index}` }));
        
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
        properties: { "visual_idea": { "type": "STRING" }, "text_to_image_prompt": { "type": "STRING" }, "negative_prompt": { "type": "STRING", "description": "Sebutkan hal-hal yang TIDAK BOLEH muncul di gambar, misal: blurry, text, watermark, ugly, deformed hands." }, "image_to_video_prompt": { "type": "STRING" } },
        required: ["visual_idea", "text_to_image_prompt", "image_to_video_prompt"]
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
                "engagement_idea": { "type": "STRING" }
            },
            required: ["slide_text", "text_to_image_prompt"]
        };
        scriptObject.properties.slides = { type: "ARRAY", items: slideObject };
        scriptObject.required.push("slides");
    }

    return { type: "ARRAY", items: scriptObject, minItems: scriptCount, maxItems: scriptCount };
}

function getLanguageSpecificSystemPrompt() {
    const currentLanguage = languageState.current;
    const storedPrompt = localStorage.getItem('aethera_system_prompt');
    
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
    const systemPrompt = getLanguageSpecificSystemPrompt();
    const scriptCount = currentMode === 'single' ? elements.inputs.scriptCount.value : 1;
    const selectedPersonaId = elements.personaSelector.value;
    const colorPaletteJSON = localStorage.getItem('productColorPalette');
    
    // Prompt Injection: Model & Platform Target
    const modelTarget = localStorage.getItem('model_target') || 'auto';
    const platformTarget = localStorage.getItem('platform_target') || localStorage.getItem('targetPlatform') || 'tiktok';
    
    // Generate negative prompts based on model target
    let negativePromptInstruction = '';
    const currentLanguage = languageState.current;
    if (modelTarget === 'flux') {
        negativePromptInstruction = currentLanguage === 'en' 
            ? `\n- **NEGATIVE PROMPT (REQUIRED):** blurry, watermark, text artifacts, lowres, pixelated, deformed, extra fingers`
            : `\n- **NEGATIVE PROMPT (WAJIB):** blurry, watermark, text artifacts, lowres, pixelated, deformed, extra fingers`;
    } else if (modelTarget === 'leonardo') {
        negativePromptInstruction = currentLanguage === 'en'
            ? `\n- **NEGATIVE PROMPT (REQUIRED):** blurry, watermark, text artifacts, lowres, pixelated, deformed, extra fingers, bad proportions`
            : `\n- **NEGATIVE PROMPT (WAJIB):** blurry, watermark, text artifacts, lowres, pixelated, deformed, extra fingers, bad proportions`;
    }
    
    // A/B Variants instruction
    const AB_VARIANT_COUNT = parseInt(localStorage.getItem('ab_variant_count') || '3', 10);
    const abVariantsInstruction = currentLanguage === 'en'
        ? `\n- **A/B VARIANTS (MUST BE RETURNED):** Besides the main Hook/Body/CTA/shots structure, also return:\n  - hook_variants: array containing EXACTLY ${AB_VARIANT_COUNT} alternative hook variations\n  - body_intro: short intro string for body (optional)\n  - body_variants: array containing 2-3 alternative body variations\n  - cta_variants: array containing EXACTLY ${AB_VARIANT_COUNT} alternative CTA variations`
        : `\n- **A/B VARIANTS (WAJIB DIKEMBALIKAN):** Selain struktur utama Hook/Body/CTA/shots, kembalikan juga:\n  - hook_variants: array berisi TEPAT ${AB_VARIANT_COUNT} variasi hook alternatif\n  - body_intro: string intro singkat untuk body (opsional)\n  - body_variants: array berisi 2-3 variasi body alternatif\n  - cta_variants: array berisi TEPAT ${AB_VARIANT_COUNT} variasi CTA alternatif`;
    
    // Platform-specific optimizations
    let platformOptimization = '';
    if (platformTarget === 'tiktok') {
        platformOptimization = currentLanguage === 'en'
            ? `\n- **TIKTOK OPTIMIZATION:** Use Gen Alpha language, trending keywords 2025, focus on sustainability and AI features. Hook must be catchy in the first 3 seconds.`
            : `\n- **OPTIMASI TIKTOK:** Gunakan bahasa Gen Alpha, trending keywords 2025, fokus sustainability dan AI features. Hook harus catchy dalam 3 detik pertama.`;
    } else if (platformTarget === 'shopee') {
        platformOptimization = currentLanguage === 'en'
            ? `\n- **SHOPEE OPTIMIZATION:** Highlight eco-friendly shipping, AI recommendations, carbon-neutral delivery. Focus on value proposition and urgency.`
            : `\n- **OPTIMASI SHOPEE:** Highlight eco-friendly shipping, AI recommendations, carbon-neutral delivery. Fokus pada value proposition dan urgency.`;
    } else if (platformTarget === 'instagram') {
        platformOptimization = currentLanguage === 'en'
            ? `\n- **INSTAGRAM OPTIMIZATION:** Direct to sustainable content and AI tools. Use mindful language and aesthetic appeal.`
            : `\n- **OPTIMASI INSTAGRAM:** Arahkan ke sustainable content dan AI tools. Gunakan mindful language dan aesthetic appeal.`;
    } else if (platformTarget === 'threads') {
        platformOptimization = currentLanguage === 'en'
            ? `\n- **THREADS OPTIMIZATION:** Focus on conversational tone, community building, and authentic storytelling.`
            : `\n- **OPTIMASI THREADS:** Fokus pada conversational tone, community building, dan authentic storytelling.`;
    } else if (platformTarget === 'shorts') {
        platformOptimization = currentLanguage === 'en'
            ? `\n- **YOUTUBE SHORTS OPTIMIZATION:** Quick pacing, clear value delivery, strong retention hooks every 3-5 seconds.`
            : `\n- **OPTIMASI YOUTUBE SHORTS:** Quick pacing, clear value delivery, strong retention hooks setiap 3-5 detik.`;
    }
    
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
        characterSheetInstruction = currentLanguage === 'en'
            ? `\n- **CHARACTER SHEET(S) (MUST BE USED):** ${JSON.stringify(characterSheets)}`
            : `\n- **CHARACTER SHEET(S) (WAJIB DIGUNAKAN):** ${JSON.stringify(characterSheets)}`;
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
    
    const visualDna = elements.visualDnaStorage.textContent;
    if (visualDna) {
        base += currentLanguage === 'en'
            ? `\n- **PRODUCT VISUAL KEYWORDS (MUST BE USED):**\n${visualDna}`
            : `\n- **VISUAL KEYWORDS PRODUK (WAJIB DIGUNAKAN):**\n${visualDna}`;
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

    const finalInstruction = currentLanguage === 'en'
        ? `${base}\n**Additional Instructions:** Create a script consisting of "hook", "body", and "cta". Each section must have script text and an array containing 2-3 'shots' (micro-shots). If the visual strategy is 'Character Sheet', define one or more characters in 'character_sheet'.`
        : `${base}\n**Instruksi Tambahan:** Buat skrip yang terdiri dari "hook", "body", dan "cta". Setiap bagian harus memiliki teks skrip dan sebuah array berisi 2-3 'shots' (micro-shots). Jika strategi visual adalah 'Character Sheet', definisikan satu atau lebih karakter di 'character_sheet'.`;
    
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
        const assets = await callGeminiAPI(prompt, getAdditionalAssetsResponseSchema());

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

    } catch (error) {
        console.error("Error generating assets:", error);
        contentDiv.innerHTML = `<p class="text-red-400 text-xs">${t('failed_to_generate_assets') || 'Failed to generate assets:'} ${error.message}</p>`;
    } 
    // persist assets ke script agar tidak hilang saat overlay ditutup
    try {
    const script = JSON.parse(card.dataset.script);
    script.additional_assets = assets;              // data mentah
    script.additional_assets_html = assetsHTML;     // HTML siap render
    card.dataset.script = JSON.stringify(script);
  
    const { updateSingleScript } = await import('./state.js');
    updateSingleScript(script);
  } catch(_) {}
      finally {
        loader.classList.add('hidden');
        contentDiv.classList.remove('hidden');
    }
}
