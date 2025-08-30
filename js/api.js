import { supabaseClient } from './supabase.js';
import { languageState } from './utils.js';
import { t } from './i18n.js';

// Safe JSON parser that tolerates empty/non-JSON responses
async function parseJsonSafe(response) {
    try {
        // Try fast path
        return await response.clone().json();
    } catch (_) {
        try {
            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch {
            return null;
        }
    }
}

// AbortController global untuk analisis gambar
let imageAnalysisController = null;

export async function analyzeImageWithAI(base64Data, mimeType, focusLabel = '') {
    try {
        // Batalkan request sebelumnya jika masih berjalan
        try { imageAnalysisController?.abort(); } catch(_) {}
        imageAnalysisController = new AbortController();
        const { signal } = imageAnalysisController;

        // Cek apakah ada API key dari user di localStorage
        const userApiKey = localStorage.getItem('direktiva_user_api_key');
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Tambahkan user API key jika ada
        if (userApiKey) {
            headers['x-user-api-key'] = userApiKey;
        }

        // --- TAHAP 1: Gambar -> Deskripsi & Palet Warna ---
        const descriptionResponse = await fetch('/api/analyzeImage', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ base64Data, mimeType, mode: 'fullDescription', focusLabel }),
            signal
        });

        if (!descriptionResponse.ok) {
            const errorData = await parseJsonSafe(descriptionResponse);
            const msg = errorData?.error || descriptionResponse.statusText || 'Terjadi kesalahan';
            throw new Error(`Tahap 1 Gagal: ${msg}`);
        }

        const descData = await parseJsonSafe(descriptionResponse);
        if (!descData || !descData.description) {
            throw new Error(t('notification_image_analysis_error') || 'Image analysis error');
        }
        const { description, palette, brand_guess, model_guess, ocr_text, distinctive_features } = descData;

        // --- TAHAP 2: Deskripsi -> Keywords ---
        const keywordsResponse = await fetch('/api/analyzeImage', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ textData: { description, palette, brand_guess, model_guess, ocr_text, distinctive_features, focusLabel }, mode: 'extractKeywords', focusLabel }),
            signal
        });

        if (!keywordsResponse.ok) {
            const errorData = await parseJsonSafe(keywordsResponse);
            const msg = errorData?.error || keywordsResponse.statusText || 'Terjadi kesalahan';
            throw new Error(`Tahap 2 Gagal: ${msg}`);
        }

        const kwData = await parseJsonSafe(keywordsResponse);
        if (!kwData || !kwData.keywords) {
            throw new Error(t('notification_image_analysis_error') || 'Image analysis error');
        }
        const { keywords } = kwData;

        // --- KEMBALIKAN HASIL GABUNGAN ---
        return { description, palette, brand_guess, model_guess, ocr_text, distinctive_features, keywords };

    } catch (error) {
        if (error?.name === 'AbortError') {
            // Dibatalkan karena user pilih gambar baru; jangan tampilkan error
            throw error;
        }
        console.error("Error dalam proses analisis gambar 2 tahap:", error);
        throw error;
    }
}

const DEFAULT_TIMEOUT_MS = Number(localStorage.getItem('direktiva_timeout_ms')) || 120000;
export async function callGeminiAPI(prompt, schema, temperature, timeoutMs = DEFAULT_TIMEOUT_MS) {
    // Helper notify tanpa hard dependency
    let _notify;
    const notify = async (msg, type = 'warning', dur = 4000) => {
        try {
            if (!_notify) { const m = await import('./utils.js'); _notify = m.showNotification; }
            _notify(msg, type, dur);
        } catch (_) {}
    };
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // Siapkan headers dasar
    const headers = { 'Content-Type': 'application/json' };

    // Sertakan token Supabase jika tersedia, namun jangan blokir jika tidak ada
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    } catch (_) {}

    // Sertakan API key pengguna jika disetel di Settings
    const userApiKey = localStorage.getItem('direktiva_user_api_key');
    if (userApiKey) headers['x-user-api-key'] = userApiKey;

    const maxAttempts = Math.max(1, Number(localStorage.getItem('direktiva_retry_max')) || 3);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const controller = new AbortController();
            const to = setTimeout(() => controller.abort(new DOMException('timeout','AbortError')), timeoutMs);
            const response = await fetch('/api/generateScript', {
                method: 'POST',
                headers,
                body: JSON.stringify({ prompt, schema, temperature }),
                signal: controller.signal
            });
            clearTimeout(to);

            if (!response.ok) {
                let message = t('notification_api_error') || 'Terjadi kesalahan pada server.';
                let retriable = false;
                try {
                    const errorData = await response.json();
                    if (errorData?.error) message = errorData.error;
                } catch (_) {}
                const msgLower = String(message || '').toLowerCase();
                retriable = response.status === 429 || response.status === 503 || /overloaded|exhausted|busy|quota|temporar/i.test(msgLower);
                if (retriable && attempt < maxAttempts) {
                    const backoffMs = Math.min(15000, 1500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500));
                    await notify((t('model_overloaded_retry') || 'Model penuh, mencoba lagi...') + ` (${attempt}/${maxAttempts})`);
                    await delay(backoffMs);
                    continue;
                }
                throw new Error(message);
            }
            return await response.json();
        } catch (error) {
            if (error?.name === 'AbortError') {
                const secs = Math.round((timeoutMs||DEFAULT_TIMEOUT_MS)/1000);
                const e = new Error(`Request timeout after ${secs}s. Server lambat atau antrian penuh—coba lagi atau naikkan timeout.`);
                e.code = 'TIMEOUT';
                throw e;
            }
            const msgLower = String(error?.message || '').toLowerCase();
            const retriable = /overloaded|exhausted|busy|temporar|network|fetch/i.test(msgLower) && attempt < maxAttempts;
            if (retriable) {
                const backoffMs = Math.min(15000, 1500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500));
                await notify((t('model_overloaded_retry') || 'Model penuh, mencoba lagi...') + ` (${attempt}/${maxAttempts})`);
                await delay(backoffMs);
                continue;
            }
            console.error('Error calling backend function:', error);
            throw error;
        }
    }
}
