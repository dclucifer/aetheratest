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

export async function analyzeImageWithAI(base64Data, mimeType) {
    try {
        // Batalkan request sebelumnya jika masih berjalan
        try { imageAnalysisController?.abort(); } catch(_) {}
        imageAnalysisController = new AbortController();
        const { signal } = imageAnalysisController;

        // Cek apakah ada API key dari user di localStorage
        const userApiKey = localStorage.getItem('aethera_user_api_key');
        
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
            body: JSON.stringify({ base64Data, mimeType, mode: 'fullDescription' }),
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
        const { description, palette } = descData;

        // --- TAHAP 2: Deskripsi -> Keywords ---
        const keywordsResponse = await fetch('/api/analyzeImage', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ textData: description, mode: 'extractKeywords' }),
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
        return { description, palette, keywords };

    } catch (error) {
        if (error?.name === 'AbortError') {
            // Dibatalkan karena user pilih gambar baru; jangan tampilkan error
            throw error;
        }
        console.error("Error dalam proses analisis gambar 2 tahap:", error);
        throw error;
    }
}

const DEFAULT_TIMEOUT_MS = Number(localStorage.getItem('aethera_timeout_ms')) || 120000;
export async function callGeminiAPI(prompt, schema, temperature, timeoutMs = DEFAULT_TIMEOUT_MS) {
    try {
        // Siapkan headers dasar
        const headers = { 'Content-Type': 'application/json' };

        // Sertakan token Supabase jika tersedia, namun jangan blokir jika tidak ada
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        } catch (_) {
            // Abaikan jika Supabase tidak tersedia atau belum login (mode lokal)
        }

        // Sertakan API key pengguna jika disetel di Settings
        const userApiKey = localStorage.getItem('aethera_user_api_key');
        if (userApiKey) {
            headers['x-user-api-key'] = userApiKey;
        }

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
            // Coba parsing JSON error, fallback ke pesan default/i18n
            let message = t('notification_api_error') || 'Terjadi kesalahan pada server.';
            try {
                const errorData = await response.json();
                if (errorData?.error) message = errorData.error;
            } catch (_) { /* ignore parse error */ }
            throw new Error(message);
        }

        return await response.json();
    } catch (error) {
        console.error("Error calling backend function:", error);
        if (error?.name === 'AbortError') {
        const secs = Math.round((timeoutMs||DEFAULT_TIMEOUT_MS)/1000);
        const e = new Error(`Request timeout after ${secs}s. Server lambat atau antrian penuh—coba lagi atau naikkan timeout.`);
        e.code = 'TIMEOUT';
        throw e;
        }
        throw error;
    }
}
