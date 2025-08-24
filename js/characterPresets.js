// js/characterPresets.js

import { showNotification, openConfirmModal } from './utils.js';
import { renderCharacterSheet, handleCategoryChange } from './ui.character.js';
import { openInputModal } from './utils.js';
import { t } from './i18n.js';
import { supabaseClient } from './supabase.js';
import { cloudStorage } from './cloud-storage.js';

const PRESETS_KEY = 'aethera_character_presets';
const ALL_CHARACTER_FIELDS = [
    'name', 'gender', 'age', 'ethnicity', 'face_shape', 'eye_color', 
    'eye_shape', 'lip_shape', 'nose_shape', 'eyebrow_style', 'hair_style', 
    'hair_color', 'unique_features', 'makeup_style', 'skin_tone', 
    'body_shape', 'height', 'clothing_style', 'color_palette', 
    'specific_outfit', 'vibe', 'notes'
];

/**
 * Mengambil semua preset karakter dari localStorage.
 * @returns {Array} Array dari objek preset karakter.
 */
export function getCharacterPresets() {
    return JSON.parse(localStorage.getItem(PRESETS_KEY)) || [];
}

/**
 * Menyimpan array preset karakter ke localStorage.
 * @param {Array} presets - Array preset yang akan disimpan.
 */
function saveCharacterPresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    // Set timestamp untuk tracking perubahan lokal untuk sinkronisasi
    localStorage.setItem('aethera_character_presets_last_modified', new Date().toISOString());
}

/**
 * Menampilkan preset karakter ke dalam dropdown di UI.
 */
export function populateCharacterPresetSelector() {
    try{ const presets = getAllPresets(); const wrap=document.getElementById('character-quick-picks'); if(wrap){ const pinned=new Set(JSON.parse(localStorage.getItem('aethera_pinned_characters')||'[]')); const usage=JSON.parse(localStorage.getItem('aethera_character_usage')||'{}');
        // Deduplicate quick-pick source by name (keep last)
        const byName = new Map(); presets.forEach(p=>{ if(p?.name) byName.set(p.name, p); }); const unique = Array.from(byName.values());
        const sorted=[...unique].sort((a,b)=>{const ap=pinned.has(String(a.id||a.name||'')), bp=pinned.has(String(b.id||b.name||'')); if(ap!==bp) return ap? -1: 1; const ua=usage[a.id||a.name]||0, ub=usage[b.id||b.name]||0; if(ua!==ub) return ub-ua; return String(a.name||'').localeCompare(String(b.name||''));}); const picks=sorted.slice(0,6); wrap.innerHTML=''; picks.forEach(p=>{ const chip=document.createElement('button'); chip.className='px-2 py-1 text-xs rounded-full bg-yellow-900/40 border border-yellow-800/70 text-yellow-200 hover:bg-yellow-800/60'; chip.textContent=p.name||'Preset'; chip.title=(p.notes||'').slice(0,140); chip.addEventListener('click', async ()=>{ const selector=document.getElementById('character-preset-selector'); if(selector){ selector.value=p.id||''; await handleLoadCharacterPreset(); try{ cloudStorage.incrementCharacterPresetUsage(p.id||p.name,p.name);}catch(e){} } }); const star=document.createElement('button'); star.className='ml-1 text-yellow-400 text-xs hover:opacity-80'; const id=p.id||p.name; const isPinned=pinned.has(String(id)); star.textContent=isPinned?'★':'☆'; star.addEventListener('click',(ev)=>{ev.stopPropagation(); const next=!pinned.has(String(id)); if(next) pinned.add(String(id)); else pinned.delete(String(id)); localStorage.setItem('aethera_pinned_characters', JSON.stringify([...pinned])); try{ cloudStorage.toggleCharacterPin(id,next);}catch(e){}; star.textContent=next?'★':'☆';}); const holder=document.createElement('div'); holder.className='inline-flex items-center'; holder.appendChild(chip); holder.appendChild(star); wrap.appendChild(holder); }); } }catch(e){}

    try {
        // Deduplicate by name for selector
        const rawPresets = getCharacterPresets();
        const nameMap = new Map(); rawPresets.forEach(p=>{ if(p?.name) nameMap.set(p.name, p); });
        const presets = Array.from(nameMap.values());
        const selector = document.getElementById('character-preset-selector');
        if (!selector) return; // Guard against missing element
        
        selector.innerHTML = '<option value="" data-lang-key="load_character_option">-- Load Character --</option>'; // Reset
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            selector.appendChild(option);
        });
    } catch (error) {
        console.warn('Failed to populate character preset selector:', error.message);
        // Continue in offline mode without disrupting app functionality
    }
}

/**
 * Menyimpan semua character sheet yang aktif saat ini sebagai preset baru.
 */
export function handleSaveCharacterPreset() {
    openInputModal(
        'Simpan Preset Karakter',
        'Masukkan nama untuk preset karakter ini:',
        'Contoh: Model Pria Casual, Pasangan Kenji & Luna',
        async (presetName) => {
            if (!presetName || !presetName.trim()) {
                showNotification(t('character_preset_name_empty') || 'Nama preset tidak boleh kosong.', 'warning');
                return;
            }
            
            await saveCharacterPresetWithName(presetName.trim());
        }
    );
}

/**
 * Menyimpan preset karakter dengan nama yang diberikan.
 */
async function saveCharacterPresetWithName(presetName) {
    // Check for duplicate names in both character and generator presets
    const existingCharacterPresets = getCharacterPresets();
    const isDuplicateInCharacter = existingCharacterPresets.some(preset => preset.name.toLowerCase() === presetName.toLowerCase());
    
    if (isDuplicateInCharacter) {
        showNotification(t('preset_name_duplicate', { name: presetName }) || `Nama preset "${presetName}" sudah digunakan. Silakan pilih nama lain.`, 'warning');
        return;
    }
    
    // Check for duplicate names in generator presets
    try {
        const { getPresets } = await import('./presets.js');
        const existingGeneratorPresets = getPresets();
        const isDuplicateInGenerator = existingGeneratorPresets.some(preset => preset.name.toLowerCase() === presetName.toLowerCase());
        
        if (isDuplicateInGenerator) {
            showNotification(t('preset_name_duplicate', { name: presetName }) || `Nama preset "${presetName}" sudah digunakan untuk preset generator. Silakan pilih nama lain.`, 'warning');
            return;
        }
    } catch (error) {
        console.warn('Could not check generator presets for duplicates:', error);
    }

    const characters = [];
    document.querySelectorAll('.character-sheet-instance').forEach(sheet => {
        const characterData = {};
        ALL_CHARACTER_FIELDS.forEach(field => {
            const input = sheet.querySelector(`[data-field="${field}"]`);
            if (input && input.value.trim() !== '') {
                characterData[field] = input.value.trim();
            }
        });
        if (Object.keys(characterData).length > 0) {
            characters.push(characterData);
        }
    });

    if (characters.length === 0) {
        showNotification(t('character_no_data_to_save') || "Tidak ada data karakter untuk disimpan.", 'warning');
        return;
    }

    const newPreset = {
        id: `char_preset_${Date.now()}`,
        name: presetName,
        characters: characters
    };

    const presets = getCharacterPresets();
    presets.push(newPreset);
    saveCharacterPresets(presets);
    try {
        populateCharacterPresetSelector();
    } catch (error) {
        console.warn('Failed to populate character preset selector after save:', error.message);
    }
    const translatedMessage = t('character_preset_saved_success', { name: newPreset.name }) || `Preset karakter "${newPreset.name}" berhasil disimpan!`;
    showNotification(translatedMessage, 'success');
}

/**
 * Memuat data karakter dari preset yang dipilih ke formulir.
 */
export async function handleLoadCharacterPreset() {
    const selector = document.getElementById('character-preset-selector');
    const selectedId = selector.value;
    if (!selectedId) return;

    const presets = getCharacterPresets();
    const selectedPreset = presets.find(p => p.id === selectedId);

    if (selectedPreset) {
        const area = document.getElementById('dynamic-character-sheet-area');
        area.innerHTML = ''; // Kosongkan area

        // 1. Render semua character sheet dari data preset
        selectedPreset.characters.forEach((charData, index) => {
            const newSheet = renderCharacterSheet(index);
            ALL_CHARACTER_FIELDS.forEach(field => {
                const input = newSheet.querySelector(`[data-field="${field}"]`);
                if (input && charData[field]) {
                    input.value = charData[field];
                }
            });
            area.appendChild(newSheet);
        });

        // 2. Terapkan aturan visibilitas (misal: untuk kategori fashion)
        handleCategoryChange();

        // 3. Tambahkan tombol "Tambah Karakter" jika presetnya adalah grup
        if (selectedPreset.characters.length > 1) {
            const characterMode = document.getElementById('character-mode');
            if (characterMode.value === 'group') {
                const addButton = document.createElement('button');
                addButton.id = 'add-character-btn';
                addButton.textContent = '+ Tambah Karakter Lain';
                addButton.type = 'button';
                addButton.className = 'btn-secondary text-sm font-semibold px-3 py-1.5 rounded-md w-full mt-4';
                area.appendChild(addButton);
            }
        }
        
        // 4. SELALU TAMBAHKAN TOMBOL SIMPAN DI AKHIR
        const saveBtnTemplate = document.getElementById('save-character-button-template');
        const saveBtnClone = saveBtnTemplate.content.cloneNode(true);
        area.appendChild(saveBtnClone);
        
        // Apply translations to the newly added save button
        const { t } = await import('./i18n.js');
        const saveButton = area.querySelector('[data-lang-key="save_character_button"]');
        if (saveButton && t('save_character_button')) {
            saveButton.textContent = t('save_character_button');
        }

        // 5. Update dropdown "Mode Karakter"
        const characterModeSelect = document.getElementById('character-mode');
        if (selectedPreset.characters.length === 1) {
            characterModeSelect.value = 'single';
        } else if (selectedPreset.characters.length === 2) {
            characterModeSelect.value = 'couple';
        } else {
            characterModeSelect.value = 'group';
        }

        const translatedMessage = t('character_preset_loaded_success', { name: selectedPreset.name }) || `Preset karakter "${selectedPreset.name}" dimuat.`;
        showNotification(translatedMessage, 'success');
        selector.value = ''; // Reset dropdown setelah selesai
    }
}

/**
 * Menampilkan daftar preset karakter di dalam modal manajemen.
 */
function renderCharacterPresetList() {
    // Deduplicate before rendering list
    const raw = getCharacterPresets();
    const map = new Map(); raw.forEach(p=>{ if(p?.name) map.set(p.name, p); });
    const presets = Array.from(map.values());
    const container = document.getElementById('character-preset-list-container');
    const template = document.getElementById('preset-item-template'); // Kita gunakan template yang sama
    container.innerHTML = ''; // Kosongkan daftar

    if (presets.length === 0) {
        container.innerHTML = `<p class="text-sm text-center text-gray-500 p-4">Anda belum memiliki preset karakter.</p>`;
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
        editBtn.className = 'edit-char-preset-btn p-2 text-gray-400 hover:text-amber-400';
        editBtn.title = t('edit_button') || 'Edit';
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z"/><path d="M11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.828-2.828z"/></svg>';
        btnBar.prepend(editBtn);
        editBtn.addEventListener('click', ()=> openEditCharacterPresetOverlay(preset));

        container.appendChild(clone);
    });
}

function openEditCharacterPresetOverlay(preset){
    try{
        closeManageCharacterPresetsModal();
        const modal = document.getElementById('edit-character-preset-modal');
        const content = document.getElementById('edit-character-preset-content');
        content.innerHTML='';
        // Render semua karakter ke overlay
        preset.characters.forEach((charData, index) => {
            const sheet = renderCharacterSheet(index);
            ALL_CHARACTER_FIELDS.forEach(field=>{ const input=sheet.querySelector(`[data-field="${field}"]`); if(input && charData[field]) input.value = charData[field]; });
            content.appendChild(sheet);
        });
        modal.classList.remove('hidden'); modal.classList.add('flex');
        const close=()=>{ modal.classList.add('hidden'); modal.classList.remove('flex'); };
        document.getElementById('edit-character-preset-close').onclick=close;
        document.getElementById('edit-character-preset-cancel').onclick=close;
        document.getElementById('edit-character-preset-save').onclick=async()=>{ await overwriteCharacterPresetFromOverlay(preset.id); close(); };
        document.getElementById('edit-character-preset-save-as-new').onclick=async()=>{ await saveCharacterPresetWithName((preset.name||'')+' Copy'); close(); };
    }catch(e){ console.warn('openEditCharacterPresetOverlay failed', e); }
}

async function overwriteCharacterPresetFromOverlay(presetId){
    const presets = getCharacterPresets();
    const idx = presets.findIndex(p=>p.id===presetId);
    if (idx<0) return;
    // Rekam karakter dari form
    const characters=[]; document.querySelectorAll('#edit-character-preset-content .character-sheet-instance').forEach(sheet=>{ const data={}; ALL_CHARACTER_FIELDS.forEach(f=>{ const input=sheet.querySelector(`[data-field="${f}"]`); if(input && input.value.trim()) data[f]=input.value.trim(); }); if(Object.keys(data).length) characters.push(data); });
    if (!characters.length) { showNotification(t('character_no_data_to_save') || 'Tidak ada data karakter untuk disimpan.', 'warning'); return; }
    presets[idx] = { ...presets[idx], characters };
    saveCharacterPresets(presets);
    try { populateCharacterPresetSelector(); } catch(_){}
    showNotification(t('character_preset_saved_success', { name: presets[idx].name }) || 'Preset karakter disimpan', 'success');
}

/**
 * Membuka modal manajemen preset karakter.
 */
export function openManageCharacterPresetsModal() {
    renderCharacterPresetList();
    const modal = document.getElementById('manage-character-presets-modal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.querySelector('.modal-content').classList.remove('scale-95');
}

/**
 * Menutup modal manajemen preset karakter.
 */
export function closeManageCharacterPresetsModal() {
    const modal = document.getElementById('manage-character-presets-modal');
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.querySelector('.modal-content').classList.add('scale-95');
}

/**
 * Menghapus preset karakter berdasarkan ID.
 * @param {string} presetId - ID dari preset yang akan dihapus.
 */
async function deleteCharacterPreset(presetId) {
    let presets = getCharacterPresets();
    const presetToDelete = presets.find(p => p.id === presetId);
    
    presets = presets.filter(p => p.id !== presetId);
    saveCharacterPresets(presets);
    renderCharacterPresetList();
    try {
        populateCharacterPresetSelector();
    } catch (error) {
        console.warn('Failed to populate character preset selector after delete:', error.message);
    }
    
    // Sync with cloud storage if available
    try {
        const { cloudStorage } = await import('./cloud-storage.js');
        if (presetToDelete) {
            // Find the cloud preset ID by name and type
            const { data: cloudPresets } = await supabaseClient
                .from('user_presets')
                .select('id')
                .eq('name', presetToDelete.name)
                .eq('type', 'character')
                .single();
            
            if (cloudPresets) {
                await cloudStorage.addPendingOperation('presets', 'delete', {
                    id: cloudPresets.id,
                    name: presetToDelete.name,
                    type: 'character'
                });
            }
        }
    } catch (error) {
        console.warn('Failed to sync character preset deletion with cloud:', error.message);
    }
    
    const translatedMessage = t('character_preset_deleted_success') || 'Preset karakter berhasil dihapus.';
    showNotification(translatedMessage, 'success');
    // Trigger a light resync to pull remaining cloud presets and avoid temporary empty lists
    try { await cloudStorage.syncCharacterPresets(); } catch(_){}
}

/**
 * Mengganti nama preset karakter berdasarkan ID.
 * @param {string} presetId - ID dari preset yang akan diubah namanya.
 * @param {string} newName - Nama baru untuk preset.
 */
function renameCharacterPreset(presetId, newName) {
    if (!newName || !newName.trim()) {
        showNotification(t('character_preset_name_empty') || 'Preset name cannot be empty.', 'warning');
        return;
    }
    // Prevent duplicate character preset names (case-insensitive)
    const trimmed = newName.trim();
    const allPresets = getCharacterPresets();
    const duplicate = allPresets.some(p => p.id !== presetId && String(p.name||'').toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
        showNotification(t('preset_name_duplicate', { name: trimmed }) || `Nama preset "${trimmed}" sudah digunakan. Silakan pilih nama lain.`, 'warning');
        return;
    }
    let presets = getCharacterPresets();
    const presetIndex = presets.findIndex(p => p.id === presetId);
    if (presetIndex > -1) {
        const previousName = presets[presetIndex].name;
        presets[presetIndex].name = trimmed;
        saveCharacterPresets(presets);
        renderCharacterPresetList();
        try {
            populateCharacterPresetSelector();
        } catch (error) {
            console.warn('Failed to populate character preset selector after rename:', error.message);
        }
        showNotification(t('character_preset_name_updated') || 'Nama preset berhasil diperbarui.', 'success');

        // Update Supabase immediately by previous name (avoid insert-as-new)
        (async () => {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session?.user) {
                    const cloudIdCandidate = presets[presetIndex].id;
                    const isLocalId = typeof cloudIdCandidate === 'string' && /^(char_)?preset_/.test(cloudIdCandidate);
                    if (cloudIdCandidate && !isLocalId) {
                        // Fetch current settings then update both name and settings.name
                        const { data: row } = await supabaseClient
                          .from('user_presets')
                          .select('id, settings')
                          .eq('id', cloudIdCandidate)
                          .single();
                        const newSettings = row?.settings ? { ...row.settings, name: trimmed } : { id: cloudIdCandidate, name: trimmed, characters: presets[presetIndex].characters };
                        await supabaseClient.from('user_presets').update({ name: trimmed, settings: newSettings }).eq('id', cloudIdCandidate);
                    } else {
                        // Find the row then update both name and settings.name
                        const { data: row } = await supabaseClient
                          .from('user_presets')
                          .select('id, settings')
                          .eq('user_id', session.user.id)
                          .eq('type', 'character')
                          .eq('name', previousName)
                          .order('created_at', { ascending: false })
                          .limit(1)
                          .maybeSingle();
                        if (row?.id) {
                          const newSettings = row.settings ? { ...row.settings, name: trimmed } : { id: presets[presetIndex].id, name: trimmed, characters: presets[presetIndex].characters };
                          await supabaseClient.from('user_presets').update({ name: trimmed, settings: newSettings }).eq('id', row.id);
                        }
                    }
                    localStorage.setItem('aethera_character_presets_last_modified', new Date().toISOString());
                    // Pull fresh state to avoid UI drift and duplicate inserts
                    try { await cloudStorage.syncCharacterPresets(); } catch(_){}
                } else {
                    try { cloudStorage.addPendingOperation('presets', 'update', { name: trimmed, type: 'character', previous_name: previousName }); } catch (_) {}
                }
            } catch (_) {
                try { cloudStorage.addPendingOperation('presets', 'update', { name: trimmed, type: 'character', previous_name: previousName }); } catch (__) {}
            }
        })();
    }
}

/**
 * Menangani semua klik di dalam modal manajemen karakter.
 * @param {Event} e - Event object dari klik.
 */
export function handleCharacterPresetManagement(e) {
    const target = e.target;
    const presetItem = target.closest('.preset-item');
    if (!presetItem) return;

    const presetId = presetItem.dataset.presetId;

    if (target.closest('.delete-preset-btn')) {
        const presetName = presetItem.querySelector('.preset-name-input').value;
        const confirmMessage = t('confirm_delete_preset', { name: presetName }) || `Are you sure you want to delete preset "${presetName}"?`;
        
        openConfirmModal(confirmMessage, () => {
            deleteCharacterPreset(presetId).catch(error => {
                console.error('Error deleting character preset:', error);
            });
        });
    }

    if (target.closest('.save-preset-name-btn')) {
        const newName = presetItem.querySelector('.preset-name-input').value;
        renameCharacterPreset(presetId, newName);
    }
}
