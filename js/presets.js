// js/presets.js

import { elements, showNotification, openConfirmModal } from './utils.js';
import { t } from './i18n.js';
import { supabaseClient } from './supabase.js';
import { cloudStorage } from './cloud-storage.js';
import { openInputModal } from './utils.js';

const PRESETS_KEY = 'aethera_settings_presets';

// Daftar semua ID elemen select yang ingin kita simpan dalam preset
const PRESET_FIELDS = [
    'writing-style',
    'tone-vibe',
    'persona-selector',
    'target-audience',
    'hook-type',
    'cta-type'
];

/**
 * Mengambil semua preset yang tersimpan dari localStorage.
 * @returns {Array} Array dari objek preset.
 */
export function getPresets() {
    return JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
}

/**
 * Menyimpan array preset ke localStorage.
 * @param {Array} presets - Array preset yang akan disimpan.
 */
function savePresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_presets_last_modified', new Date().toISOString());
}

/**
 * Menampilkan preset ke dalam dropdown di UI.
 */
export function populatePresetSelector() {
    const presets = getPresets();
    const selector = elements.settingsPresetSelector;
    
    // Simpan value yang sedang terpilih (jika ada)
    const selectedValue = selector.value;
    
    selector.innerHTML = '<option value="" data-lang-key="load_preset_option">-- Load Preset --</option>'; // Reset
    
    presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        selector.appendChild(option);
    });

    // Kembalikan ke value yang terpilih sebelumnya
    selector.value = selectedValue;
}

/**
 * Menyimpan pengaturan formulir saat ini sebagai preset baru.
 */
export function handleSavePreset() {
    openInputModal(
        t('save_preset_title') || 'Simpan Preset',
        t('enter_preset_name') || 'Masukkan nama untuk preset ini:',
        t('preset_name_placeholder') || 'Nama preset...',
        async (presetName) => {
            if (!presetName || !presetName.trim()) {
                showNotification(t('preset_name_empty') || "Nama preset tidak boleh kosong.", 'warning');
                return;
            }
            
            await savePresetWithName(presetName.trim());
        }
    );
}

/**
 * Menyimpan preset dengan nama yang diberikan.
 */
async function savePresetWithName(presetName) {
    // Check for duplicate names in both generator and character presets
    const existingGeneratorPresets = getPresets();
    const isDuplicateInGenerator = existingGeneratorPresets.some(preset => preset.name.toLowerCase() === presetName.toLowerCase());
    
    if (isDuplicateInGenerator) {
        showNotification(t('preset_name_duplicate', { name: presetName }) || `Nama preset "${presetName}" sudah digunakan. Silakan pilih nama lain.`, 'warning');
        return;
    }
    
    // Check for duplicate names in character presets
    try {
        const { getCharacterPresets } = await import('./characterPresets.js');
        const existingCharacterPresets = getCharacterPresets();
        const isDuplicateInCharacter = existingCharacterPresets.some(preset => preset.name.toLowerCase() === presetName.toLowerCase());
        
        if (isDuplicateInCharacter) {
            showNotification(t('preset_name_duplicate', { name: presetName }) || `Nama preset "${presetName}" sudah digunakan untuk preset karakter. Silakan pilih nama lain.`, 'warning');
            return;
        }
    } catch (error) {
        console.warn('Could not check character presets for duplicates:', error);
    }

    const newPreset = {
        id: `preset_${Date.now()}`,
        name: presetName,
        settings: {}
    };

    PRESET_FIELDS.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            newPreset.settings[fieldId] = element.value;
        }
    });

    const presets = getPresets();
    presets.push(newPreset);
    savePresets(presets);
    populatePresetSelector();
    const translatedMessage = t('preset_saved_success', { name: newPreset.name }) || `Preset "${newPreset.name}" berhasil disimpan!`;
    showNotification(translatedMessage, 'success');
}

/**
 * Memuat pengaturan dari preset yang dipilih ke formulir.
 */
export function handleLoadPreset() {
    const selector = elements.settingsPresetSelector;
    const selectedId = selector.value;
    if (!selectedId) return;

    const presets = getPresets();
    const selectedPreset = presets.find(p => p.id === selectedId);

    if (selectedPreset) {
        PRESET_FIELDS.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && selectedPreset.settings[fieldId] !== undefined) {
                element.value = selectedPreset.settings[fieldId];

                // Memicu event 'change' secara manual agar UI lain (seperti deskripsi persona) ikut update
                element.dispatchEvent(new Event('change'));
            }
        });
        const translatedMessage = t('preset_loaded_success', { name: selectedPreset.name }) || `Preset "${selectedPreset.name}" dimuat.`;
        showNotification(translatedMessage, 'success');
    }
}

/**
 * Menyimpan pengaturan terakhir yang digunakan ke localStorage.
 */
export function saveLastSettings() {
    const lastSettings = {};
    PRESET_FIELDS.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            lastSettings[fieldId] = element.value;
        }
    });
    localStorage.setItem('aethera_last_settings', JSON.stringify(lastSettings));
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_presets_last_modified', new Date().toISOString());
}

/**
 * Memuat pengaturan terakhir ke formulir saat aplikasi dibuka.
 */
export function loadLastSettings() {
    const lastSettings = JSON.parse(localStorage.getItem('aethera_last_settings'));
    if (lastSettings) {
        PRESET_FIELDS.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && lastSettings[fieldId] !== undefined) {
                element.value = lastSettings[fieldId];
                element.dispatchEvent(new Event('change'));
            }
        });
    }
}

function renderPresetList() {
    const presets = getPresets();
    const container = document.getElementById('preset-list-container');
    const template = document.getElementById('preset-item-template');
    container.innerHTML = ''; // Kosongkan daftar

    if (presets.length === 0) {
        container.innerHTML = `<p class="text-sm text-center text-gray-500 p-4">${t('no_presets_yet') || 'Anda belum memiliki preset.'}</p>`;
        return;
    }

    presets.forEach(preset => {
        const clone = template.content.cloneNode(true);
        const presetItem = clone.querySelector('.preset-item');
        presetItem.dataset.presetId = preset.id;
        
        const nameInput = clone.querySelector('.preset-name-input');
        nameInput.value = preset.name;
        // Tambah tombol edit
        const btnBar = presetItem.querySelector('.flex');
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-preset-btn p-2 text-gray-400 hover:text-blue-400';
        editBtn.title = t('edit_button') || 'Edit';
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z"/><path d="M11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.828-2.828z"/></svg>';
        btnBar.prepend(editBtn);
        editBtn.addEventListener('click', () => openEditPresetOverlay(preset));

        container.appendChild(clone);
    });
}

function openEditPresetOverlay(preset){
    try{
        closeManagePresetsModal();
        const modal = document.getElementById('edit-settings-preset-modal');
        const content = document.getElementById('edit-settings-preset-content');
        content.innerHTML = '';
        const fields = PRESET_FIELDS.map(fid => {
            const el = document.getElementById(fid);
            const label = document.querySelector(`label[for="${fid}"]`);
            const wrapper = document.createElement('div');
            wrapper.className = 'space-y-1';
            const title = document.createElement('div');
            title.className = 'text-xs text-gray-400';
            title.textContent = (label && label.textContent) || fid;
            const clone = el ? el.cloneNode(true) : null;
            if (clone) {
                clone.id = `edit-${fid}`; clone.classList.add('w-full');
                clone.value = (preset.settings||{})[fid] ?? el.value;
            }
            wrapper.appendChild(title);
            if (clone) wrapper.appendChild(clone);
            return wrapper;
        });
        fields.forEach(w => content.appendChild(w));
        modal.classList.remove('hidden'); modal.classList.add('flex');
        const close = ()=>{ modal.classList.add('hidden'); modal.classList.remove('flex'); };
        document.getElementById('edit-settings-preset-close').onclick = close;
        document.getElementById('edit-settings-preset-cancel').onclick = close;
        document.getElementById('edit-settings-preset-save').onclick = async ()=>{
            await overwritePresetFromOverlay(preset.id);
            close();
        };
        document.getElementById('edit-settings-preset-save-as-new').onclick = async ()=>{
            await savePresetWithName((preset.name||'') + ' Copy');
            close();
        };
    }catch(e){ console.warn('openEditPresetOverlay failed', e); }
}

async function overwritePresetFromOverlay(presetId){
    const presets = getPresets();
    const idx = presets.findIndex(p=>p.id===presetId);
    if (idx<0) return;
    const updated = { ...presets[idx], settings: {} };
    PRESET_FIELDS.forEach(fid=>{ const el=document.getElementById(`edit-${fid}`); if(el) updated.settings[fid]=el.value; });
    presets[idx]=updated; savePresets(presets); populatePresetSelector();
    showNotification(t('preset_saved_success', { name: updated.name }) || 'Preset saved', 'success');
}

/**
 * Membuka modal manajemen preset.
 */
export function openManagePresetsModal() {
    renderPresetList();
    const modal = document.getElementById('manage-presets-modal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.querySelector('.modal-content').classList.remove('scale-95');
}

/**
 * Menutup modal manajemen preset.
 */
export function closeManagePresetsModal() {
    const modal = document.getElementById('manage-presets-modal');
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.querySelector('.modal-content').classList.add('scale-95');
}

/**
 * Menghapus preset berdasarkan ID.
 * @param {string} presetId - ID dari preset yang akan dihapus.
 */
async function deletePreset(presetId) {
    let presets = getPresets();
    const presetToDelete = presets.find(p => p.id === presetId);
    
    presets = presets.filter(p => p.id !== presetId);
    savePresets(presets);
    renderPresetList(); // Perbarui tampilan di modal
    populatePresetSelector(); // Perbarui dropdown utama
    
    // Sync with cloud storage if available
    try {
        const { cloudStorage } = await import('./cloud-storage.js');
        if (presetToDelete) {
            // Find the cloud preset ID by name and type
            const { data: cloudPresets } = await supabaseClient
                .from('user_presets')
                .select('id')
                .eq('name', presetToDelete.name)
                .eq('type', 'generator')
                .single();
            
            if (cloudPresets) {
                await cloudStorage.addPendingOperation('presets', 'delete', {
                    id: cloudPresets.id,
                    name: presetToDelete.name,
                    type: 'generator'
                });
            }
        }
    } catch (error) {
        console.warn('Failed to sync preset deletion with cloud:', error.message);
    }
    
    const translatedMessage = t('preset_deleted_success') || 'Preset deleted successfully.';
    showNotification(translatedMessage, 'success');
}

/**
 * Mengganti nama preset berdasarkan ID.
 * @param {string} presetId - ID dari preset yang akan diubah namanya.
 * @param {string} newName - Nama baru untuk preset.
 */
function renamePreset(presetId, newName) {
    if (!newName || !newName.trim()) {
        showNotification(t('preset_name_empty') || 'Nama preset tidak boleh kosong.', 'warning');
        return;
    }
    // Prevent duplicate names with other presets (case-insensitive)
    const trimmed = newName.trim();
    const presetsAll = getPresets();
    const duplicate = presetsAll.some(p => p.id !== presetId && String(p.name || '').toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
        showNotification(t('preset_name_duplicate', { name: trimmed }) || `Nama preset "${trimmed}" sudah digunakan. Silakan pilih nama lain.`, 'warning');
        return;
    }
    let presets = getPresets();
    const presetIndex = presets.findIndex(p => p.id === presetId);
    if (presetIndex > -1) {
        const previousName = presets[presetIndex].name;
        presets[presetIndex].name = trimmed;
        savePresets(presets);
        renderPresetList(); // Perbarui tampilan di modal
        populatePresetSelector(); // Perbarui dropdown utama
        showNotification(t('preset_name_updated') || 'Nama preset berhasil diperbarui.', 'success');

        // Update Supabase immediately by previous name (prevents duplicate insert on next sync)
        (async () => {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session?.user) {
                    // Try update by matching current cloud row and send latest settings too
                    const currentSettings = presets[presetIndex].settings || {};
                    const { data: found } = await supabaseClient
                        .from('user_presets')
                        .select('id, settings')
                        .eq('user_id', session.user.id)
                        .eq('type', 'generator')
                        .eq('name', previousName)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (found?.id) {
                        await supabaseClient
                            .from('user_presets')
                            .update({ name: trimmed, settings: currentSettings })
                            .eq('id', found.id);
                    } else {
                        // Fallback update by previous name under user/type
                        await supabaseClient
                            .from('user_presets')
                            .update({ name: trimmed, settings: currentSettings })
                            .eq('user_id', session.user.id)
                            .eq('type', 'generator')
                            .eq('name', previousName);
                    }
                    // Bantu penentuan versi lokal lebih baru
                    localStorage.setItem('aethera_presets_last_modified', new Date().toISOString());
                    // Pull fresh state to avoid UI drift
                    try { await cloudStorage.syncGeneratorPresets(); } catch(_){}
                } else {
                    // Fallback: antrekan operasi update untuk dieksekusi saat online
                    try { cloudStorage.addPendingOperation('presets', 'update', { name: trimmed, type: 'generator', previous_name: previousName, settings: presets[presetIndex].settings || {} }); } catch (_) {}
                }
            } catch (_) {
                try { cloudStorage.addPendingOperation('presets', 'update', { name: trimmed, type: 'generator', previous_name: previousName, settings: presets[presetIndex].settings || {} }); } catch (__) {}
            }
        })();
    }
}

/**
 * Menangani semua klik di dalam modal manajemen.
 * @param {Event} e - Event object dari klik.
 */
export function handlePresetManagement(e) {
    const target = e.target;
    const presetItem = target.closest('.preset-item');
    if (!presetItem) return;

    const presetId = presetItem.dataset.presetId;

    // Logika untuk tombol hapus
    if (target.closest('.delete-preset-btn')) {
        const presetName = presetItem.querySelector('.preset-name-input').value;
        const confirmMessage = t('confirm_delete_preset', { name: presetName }) || `Anda yakin ingin menghapus preset "${presetName}"?`;
        
        openConfirmModal(confirmMessage, () => {
            deletePreset(presetId).catch(error => {
                console.error('Error deleting preset:', error);
                showNotification('Gagal menghapus preset', 'error');
            });
        });
    }

    // Logika untuk tombol simpan nama baru
    if (target.closest('.save-preset-name-btn')) {
        const newName = presetItem.querySelector('.preset-name-input').value;
        renamePreset(presetId, newName);
    }
}
