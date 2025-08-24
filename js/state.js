// js/state.js

/**
 * Modul ini berfungsi sebagai satu-satunya sumber kebenaran (Single Source of Truth)
 * untuk data skrip yang dihasilkan (lastGeneratedScripts).
 * Semua operasi baca dan tulis ke state ini harus melalui fungsi yang disediakan.
 */

import { saveToHistory as saveHistoryEntry } from './history.js';

// State internal, tidak untuk diakses langsung dari luar modul ini.
let _lastGeneratedScripts = [];

/**
 * Mengambil skrip yang terakhir kali di-generate.
 * Jika state di memori kosong, fungsi ini akan mencoba memuat dari localStorage.
 * @returns {Array} Array dari objek skrip.
 */
export function getScripts() {
    if (_lastGeneratedScripts.length === 0) {
        const stored = localStorage.getItem('aethera_lastGeneratedScripts');
        if (stored) {
            try {
                _lastGeneratedScripts = JSON.parse(stored);
            } catch (e) {
                console.error("Gagal mem-parsing skrip dari localStorage:", e);
                _lastGeneratedScripts = [];
            }
        }
    }
    return _lastGeneratedScripts;
}

/**
 * Menyimpan sekumpulan skrip baru ke dalam state dan localStorage.
 * Fungsi ini juga akan secara otomatis memicu penyimpanan ke riwayat.
 * @param {Array} scripts - Array objek skrip yang akan disimpan.
 * @param {string} productName - Nama produk untuk entri riwayat.
 * @param {string} mode - Mode skrip ('single' atau 'carousel'), opsional.
 */
export function setScripts(scripts, productName, mode) {
    _lastGeneratedScripts = scripts;
    localStorage.setItem('aethera_lastGeneratedScripts', JSON.stringify(scripts));
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_scripts_last_modified', new Date().toISOString());
    
    // Panggil fungsi untuk menyimpan ke riwayat dari sini agar terpusat
    if (scripts && scripts.length > 0) {
        // Determine mode if not provided
        const actualMode = mode || localStorage.getItem('currentMode') || 'single';
        saveHistoryEntry(scripts, productName, actualMode);
    }
}

/**
 * Memperbarui satu skrip spesifik di dalam state dan localStorage.
 * Berguna setelah melakukan revisi atau perubahan pada satu kartu.
 * @param {object} updatedScript - Objek skrip yang sudah diperbarui.
 */
export function updateSingleScript(updatedScript) {
    const scripts = getScripts();
    const index = scripts.findIndex(s => s.id === updatedScript.id);
    if (index > -1) {
        scripts[index] = updatedScript;
        // Update localStorage directly without triggering history save
        _lastGeneratedScripts = scripts;
        localStorage.setItem('aethera_lastGeneratedScripts', JSON.stringify(scripts));
        localStorage.setItem('aethera_scripts_last_modified', new Date().toISOString());
    }
}

/**
 * Membersihkan state skrip dari memori dan localStorage.
 * Berguna saat memulai sesi baru atau menghapus hasil.
 */
export function clearScripts() {
    _lastGeneratedScripts = [];
    localStorage.removeItem('aethera_lastGeneratedScripts');
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_scripts_last_modified', new Date().toISOString());
}
