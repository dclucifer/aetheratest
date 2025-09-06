/**
 * Cloud Storage Service for Direktiva Studio
 * Handles synchronization between localStorage and Supabase
 * Implements offline-first strategy with automatic sync
 */

import { supabaseClient } from './supabase.js';
import { showNotification } from './utils.js';
import { t } from './i18n.js';

// Sync status constants
export const SYNC_STATUS = {
    SYNCED: 'synced',
    SYNCING: 'syncing',
    OFFLINE: 'offline',
    ERROR: 'error'
};

// Auto-sync interval (in milliseconds)
const AUTO_SYNC_INTERVAL = 10000; // 10 seconds
let autoSyncTimer = null;
let isAutoSyncEnabled = true;

// Local storage keys
const STORAGE_KEYS = {
    SYNC_STATUS: 'direktiva_sync_status',
    LAST_SYNC: 'direktiva_last_sync',
    PENDING_SYNC: 'direktiva_pending_sync',
    OFFLINE_CHANGES: 'direktiva_offline_changes'
};

class CloudStorageService {
    constructor() {
        this.syncStatus = SYNC_STATUS.OFFLINE;
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.pendingOperations = [];
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Initialize sync status
        this.updateSyncStatus();
    }

    /**
     * Initialize cloud storage service
     */
    async init() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && this.isOnline) {
                await this.syncAll();
            } else {
                // Set offline status if no session
                this.setSyncStatus(SYNC_STATUS.OFFLINE);
            }
        } catch (error) {
            console.warn('Cloud storage not available, running in offline mode:', error.message);
            this.setSyncStatus(SYNC_STATUS.OFFLINE);
        }
    }

    /**
     * Handle online event
     */
    async handleOnline() {
        this.isOnline = true;
        console.log('Device is online, attempting to sync...');
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await this.syncAll();
        }
    }

    /**
     * Handle offline event
     */
    handleOffline() {
        this.isOnline = false;
        this.setSyncStatus(SYNC_STATUS.OFFLINE);
        console.log('Device is offline, storing changes locally');
    }

    /**
     * Set sync status and update UI
     */
    setSyncStatus(status) {
        this.syncStatus = status;
        localStorage.setItem(STORAGE_KEYS.SYNC_STATUS, status);
        this.updateSyncIndicator(status);
    }

    /**
     * Update sync status based on current conditions
     */
    updateSyncStatus() {
        if (!this.isOnline) {
            this.setSyncStatus(SYNC_STATUS.OFFLINE);
        } else if (this.syncInProgress) {
            this.setSyncStatus(SYNC_STATUS.SYNCING);
        } else {
            this.setSyncStatus(SYNC_STATUS.SYNCED);
        }
    }

    /**
     * Update sync indicator in UI
     */
    updateSyncIndicator(status) {
        const indicator = document.getElementById('sync-indicator');
        if (!indicator) return;

        indicator.className = `sync-indicator sync-${status}`;
        
        const statusText = {
            [SYNC_STATUS.SYNCED]: t('sync_status_synced') || 'Synced',
            [SYNC_STATUS.SYNCING]: t('sync_status_syncing') || 'Syncing...',
            [SYNC_STATUS.OFFLINE]: t('sync_status_offline') || 'Offline',
            [SYNC_STATUS.ERROR]: t('sync_status_error') || 'Sync Error'
        };
        
        indicator.textContent = statusText[status];
        indicator.title = statusText[status];
    }

    /**
     * Sync all data types
     */
    async syncAll() {
        if (this.syncInProgress || !this.isOnline) return;
        
        this.syncInProgress = true;
        this.setSyncStatus(SYNC_STATUS.SYNCING);
        
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                console.warn('No active session, switching to offline mode');
                this.setSyncStatus(SYNC_STATUS.OFFLINE);
                return;
            }

            // Process any pending offline operations first
            await this.processPendingOperations();
            
            // Sync in order: settings, presets, personas, history
            await this.syncSettings();
            await this.syncGeneratorPresets();
            await this.syncCharacterPresets();
            await this.syncPersonas();
            await this.syncHistory();
            
            // Force refresh all preset selectors after complete sync
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    try {
                        if (window.populatePresetSelector) window.populatePresetSelector();
                        if (window.populateCharacterPresetSelector) window.populateCharacterPresetSelector();
                    } catch (error) {
                        console.warn('Failed to populate selectors after sync:', error.message);
                    }
                }, 200);
            }
            
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
            this.setSyncStatus(SYNC_STATUS.SYNCED);
            
            console.log('All data synced successfully');
        } catch (error) {
            console.warn('Sync failed, switching to offline mode:', error.message);
            this.setSyncStatus(SYNC_STATUS.OFFLINE);
            // Don't throw error to prevent disrupting app functionality
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync user settings
     */
    async syncSettings() {
        try {
            // Get current session and user
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            
            if (sessionError) {
                throw new Error('Failed to get session: ' + sessionError.message);
            }
            
            if (!session || !session.user) {
                throw new Error('User not authenticated');
            }
            
            const user = session.user;

            const localSettings = {
                theme: localStorage.getItem('direktiva_theme') || localStorage.getItem('aethera_theme') || 'dark',
                language: localStorage.getItem('direktiva_language') || localStorage.getItem('aethera_language') || 'id',
                system_prompt: localStorage.getItem('direktiva_system_prompt') || localStorage.getItem('aethera_system_prompt'),
            };

            // Get cloud settings
            const { data: cloudSettings, error } = await supabaseClient
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }

            if (!cloudSettings) {
                // Create new settings in cloud
                const { error: insertError } = await supabaseClient
                    .from('user_settings')
                    .insert([{
                        user_id: user.id,
                        theme: localSettings.theme,
                        language: localSettings.language,
                        system_prompt: localSettings.system_prompt
                    }]);
                
                if (insertError) throw insertError;
            } else {
                // Resolve conflicts: if local changes are newer than cloud, prefer local; otherwise prefer cloud
                let mergedSettings;
                const localIsNewer = this.hasLocalChanges('settings', cloudSettings.updated_at);
                if (localIsNewer) {
                    mergedSettings = {
                        theme: localSettings.theme,
                        language: localSettings.language,
                        system_prompt: localSettings.system_prompt
                    };
                } else {
                    // Cloud takes precedence when local is not newer
                    mergedSettings = this.mergeSettings(localSettings, cloudSettings);
                }
                
                // Update localStorage with merged settings
                localStorage.setItem('aethera_theme', mergedSettings.theme);
                localStorage.setItem('aethera_language', mergedSettings.language);
                if (mergedSettings.system_prompt) {
                    localStorage.setItem('aethera_system_prompt', mergedSettings.system_prompt);
                }
                
                // Apply merged settings to UI after sync
                try { document.documentElement.lang = mergedSettings.language; } catch {}
                if (typeof window !== 'undefined' && window.updateLanguageButtons) {
                    try { window.updateLanguageButtons(); } catch {}
                }
                
                // Update cloud if local has newer changes
                if (localIsNewer) {
                    const { error: updateError } = await supabaseClient
                        .from('user_settings')
                        .update({
                            theme: mergedSettings.theme,
                            language: mergedSettings.language,
                            system_prompt: mergedSettings.system_prompt
                        })
                        .eq('user_id', cloudSettings.user_id);
                    
                    if (updateError) throw updateError;
                }
            }
        } catch (error) {
            console.warn('Failed to sync settings, continuing in offline mode:', error.message);
            // Don't throw error to prevent disrupting app functionality
        }
    }



    /**
     * Sync generator presets
     */
    async syncGeneratorPresets() {
        const localPresets = JSON.parse(localStorage.getItem('aethera_settings_presets') || '[]');
        const localPresetsObj = {};
        localPresets.forEach(preset => {
            localPresetsObj[preset.name] = preset.settings;
        });
        
        const { data: cloudPresets, error } = await supabaseClient
            .from('user_presets')
            .select('*')
            .eq('type', 'generator')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Check if cloud has newer presets than local (normalize timestamp format)
        const localTsRaw = localStorage.getItem('aethera_presets_last_modified');
        const localTimestamp = localTsRaw ? (isNaN(Number(localTsRaw)) ? Date.parse(localTsRaw) : Number(localTsRaw)) : 0;
        const cloudTimestamp = cloudPresets && cloudPresets.length > 0 ? Math.max(...cloudPresets.map(p => new Date(p.created_at).getTime())) : 0;
        
        // Force sync if cloud has newer data or if local timestamp is missing
        const shouldForceSync = !localTimestamp || cloudTimestamp > parseInt(localTimestamp);
        
        await this.syncGeneratorPresetsInternal(localPresetsObj, cloudPresets || [], shouldForceSync);
        
        // Update local timestamp
        if (cloudTimestamp > 0) {
            localStorage.setItem('aethera_presets_last_modified', String(cloudTimestamp));
        }
    }

    /**
     * Internal method to sync generator presets
     */
    async syncGeneratorPresetsInternal(localPresets, cloudPresets, shouldForceSync = false) {
        // Get current session and user
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session || !session.user) throw new Error('User not authenticated');
        
        const user = session.user;

        const existingNames = new Set(cloudPresets.map(p => p.name));
        const presetsToUpload = [];
        const cloudByName = new Map();
        cloudPresets.forEach(p => {
            cloudByName.set(p.name, p);
        });
        
        // Check for new local presets
        Object.entries(localPresets).forEach(([name, settings]) => {
            if (!existingNames.has(name)) {
                presetsToUpload.push({
                    user_id: user.id,
                    name,
                    type: 'generator',
                    settings
                });
            }
        });
        
        // Upload new presets
        if (presetsToUpload.length > 0) {
            const { error } = await supabaseClient
                .from('user_presets')
                .insert(presetsToUpload);
            
            if (error) throw error;
        }

        // Update existing cloud presets when local differs (prefer local when not forcing)
        if (!shouldForceSync) {
            const updatesToCloud = [];
            for (const [name, settings] of Object.entries(localPresets)) {
                if (cloudByName.has(name)) {
                    const cloudRow = cloudByName.get(name);
                    const cloudSettings = cloudRow.settings || {};
                    try {
                        const localStr = JSON.stringify(settings || {});
                        const cloudStr = JSON.stringify(cloudSettings);
                        if (localStr !== cloudStr) {
                            updatesToCloud.push({ id: cloudRow.id, settings });
                        }
                    } catch (_) {
                        // Fallback: attempt update to be safe
                        updatesToCloud.push({ id: cloudRow.id, settings });
                    }
                }
            }
            for (const upd of updatesToCloud) {
                const { error } = await supabaseClient
                    .from('user_presets')
                    .update({ settings: upd.settings })
                    .eq('id', upd.id);
                if (error) throw error;
            }
        }
        
        // Update localStorage with cloud presets (force sync if needed)
        const mergedPresetsObj = shouldForceSync ? {} : { ...localPresets };
        
        // Get list of locally deleted presets to avoid re-adding them
        const localPresetNames = Object.keys(localPresets);
        const existingLocalArray = JSON.parse(localStorage.getItem('aethera_settings_presets') || '[]');
        const existingLocalNames = existingLocalArray.map(p => p.name);
        
        cloudPresets.forEach(preset => {
            if (preset.settings) {
                // Only add cloud preset if it does NOT currently exist locally or if we're force syncing
                // This prevents deleted presets from being re-added and preserves local edits
                if (shouldForceSync || !localPresets.hasOwnProperty(preset.name)) {
                    mergedPresetsObj[preset.name] = preset.settings;
                }
            }
        });
        
        // Convert back to array format for localStorage with consistent IDs
        const currentLocalArray = JSON.parse(localStorage.getItem('aethera_settings_presets') || '[]');
        const mergedPresetsArray = Object.entries(mergedPresetsObj).map(([name, settings]) => {
            // Try to find existing preset with same name to preserve ID
            const existingLocalPreset = currentLocalArray.find(p => p.name === name);
            const existingCloudPreset = cloudPresets.find(p => p.name === name);
            
            return {
                id: existingLocalPreset?.id || existingCloudPreset?.id || `preset_${name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
                name,
                settings
            };
        });
        
        localStorage.setItem('aethera_settings_presets', JSON.stringify(mergedPresetsArray));
        
        // Force refresh preset selector after sync
        if (typeof window !== 'undefined' && window.populatePresetSelector) {
            setTimeout(() => window.populatePresetSelector(), 100);
        }
    }

    /**
     * Sync character presets
     */
    async syncCharacterPresets() {
        try {
            const localCharacterPresets = JSON.parse(localStorage.getItem('aethera_character_presets') || '[]');
            
            // Get cloud presets
            const { data: cloudPresets, error } = await supabaseClient
                .from('user_presets')
                .select('*')
                .eq('type', 'character')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Check if cloud has newer presets than local (normalize timestamp)
            const localTsRaw = localStorage.getItem('aethera_character_presets_last_modified');
            const localTimestamp = localTsRaw ? (isNaN(Number(localTsRaw)) ? Date.parse(localTsRaw) : Number(localTsRaw)) : 0;
            const cloudTimestamp = cloudPresets && cloudPresets.length > 0 ? Math.max(...cloudPresets.map(p => new Date(p.created_at).getTime())) : 0;
            
            // Force sync if cloud has newer data or if local timestamp is missing
            const shouldForceSync = !localTimestamp || cloudTimestamp > parseInt(localTimestamp);
            
            await this.syncCharacterPresetsInternal(localCharacterPresets, cloudPresets || [], shouldForceSync);
            
            // Update local timestamp
            if (cloudTimestamp > 0) {
                localStorage.setItem('aethera_character_presets_last_modified', String(cloudTimestamp));
            }
        } catch (error) {
            console.warn('Failed to sync character presets, continuing in offline mode:', error.message);
            // Don't throw error to prevent disrupting app functionality
        }
    }

    /**
     * Internal method to sync character presets
     */
    async syncCharacterPresetsInternal(localPresets, cloudPresets, shouldForceSync = false) {
        // Get current session and user
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session || !session.user) throw new Error('User not authenticated');
        
        const user = session.user;

        // Build fast lookups for conflict resolution
        const existingNames = new Set(cloudPresets.map(p => p.name));
        const cloudById = new Map();
        cloudPresets.forEach(p => {
            const sid = p?.settings?.id;
            if (sid) cloudById.set(String(sid), p);
        });

        const presetsToUpload = [];
        const renameUpdates = [];
        for (const lp of localPresets) {
            const localId = lp?.id ? String(lp.id) : '';
            if (localId && cloudById.has(localId)) {
                // Already exists in cloud by id; if name changed, update cloud name
                const cloudRow = cloudById.get(localId);
                if (cloudRow.name !== lp.name) {
                    renameUpdates.push({ id: cloudRow.id, name: lp.name });
                }
                continue;
            }
            // If name already exists in cloud, treat as existing (avoid insert)
            if (existingNames.has(lp.name)) {
                continue;
            }
            // Otherwise upload as new preset
            presetsToUpload.push(lp);
        }
        
        // Upload new presets
        if (presetsToUpload.length > 0) {
            const { error } = await supabaseClient
                .from('user_presets')
                .insert(presetsToUpload.map(preset => ({
                    user_id: user.id,
                    name: preset.name,
                    type: 'character',
                    settings: preset
                })));
            
            if (error) throw error;
        }

        // Apply rename updates detected by id match
        if (renameUpdates.length > 0) {
            for (const upd of renameUpdates) {
                const { error } = await supabaseClient
                    .from('user_presets')
                    .update({ name: upd.name })
                    .eq('id', upd.id);
                if (error) throw error;
            }
        }
        
        // Update localStorage with merged presets (force sync if needed)
        const mergedPresets = shouldForceSync ? [] : [...localPresets];
        
        // Get list of existing local preset names to avoid re-adding deleted presets
        const existingCharacterArray = JSON.parse(localStorage.getItem('aethera_character_presets') || '[]');
        const existingLocalNames = existingCharacterArray.map(p => p.name);
        
        cloudPresets.forEach(cloudPreset => {
            const existingIndex = mergedPresets.findIndex(p => p.name === cloudPreset.name);
            if (existingIndex === -1) {
                // Only add cloud preset if it currently exists locally or if we're force syncing
                // This prevents deleted presets from being re-added
                const currentLocalPreset = localPresets.find(p => p.name === cloudPreset.name);
                if (shouldForceSync || currentLocalPreset) {
                    // Ensure cloud preset has consistent ID structure
                    const presetToAdd = cloudPreset.settings;
                    if (!presetToAdd.id) {
                        presetToAdd.id = `preset_${cloudPreset.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
                    }
                    mergedPresets.push(presetToAdd);
                }
            } else {
                // Update existing preset but preserve ID
                const existingId = mergedPresets[existingIndex].id;
                mergedPresets[existingIndex] = { ...cloudPreset.settings, id: existingId };
            }
        });
        
        localStorage.setItem('aethera_character_presets', JSON.stringify(mergedPresets));
        
        // Force refresh character preset selector after sync
        if (typeof window !== 'undefined' && window.populateCharacterPresetSelector) {
            setTimeout(() => {
                try {
                    window.populateCharacterPresetSelector();
                } catch (error) {
                    console.warn('Failed to populate character preset selector after sync:', error.message);
                }
            }, 100);
        }
    }

    /**
     * Sync user personas
     */
    async syncPersonas() {
        try {
            // Get current session and user
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) throw new Error('User not authenticated');
            
            const user = session.user;

            // Get local personas
            const localPersonas = JSON.parse(localStorage.getItem('aethera_personas') || '[]');
            
            // Get cloud personas
            const { data: cloudPersonas, error } = await supabaseClient
                .from('user_personas')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Merge personas
            const mergedPersonas = this.mergePersonas(localPersonas, cloudPersonas || []);
            
            // Update localStorage
            localStorage.setItem('aethera_personas', JSON.stringify(mergedPersonas.local));
            
            // Update cloud with any new/modified local personas
            for (const persona of mergedPersonas.toUpload) {
                if (persona.id && persona.id.toString().length < 10) {
                    // Local ID, insert as new
                    const { error: insertError } = await supabaseClient
                        .from('user_personas')
                        .insert([{
                            user_id: user.id,
                            name: persona.name,
                            description: persona.description,
                            avatar: persona.avatar,
                            personality: persona.personality || {}
                        }]);
                    
                    if (insertError) throw insertError;
                } else {
                    // Update existing
                    const { error: updateError } = await supabaseClient
                        .from('user_personas')
                        .update({
                            name: persona.name,
                            description: persona.description,
                            avatar: persona.avatar,
                            personality: persona.personality || {}
                        })
                        .eq('id', persona.id);
                    
                    if (updateError) throw updateError;
                }
            }
        } catch (error) {
            console.warn('Failed to sync personas, continuing in offline mode:', error.message);
            // Don't throw error to prevent disrupting app functionality
        }
    }

    /**
     * Sync user history
     */
    async syncHistory() {
        try {
            // Get current session and user
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) throw new Error('User not authenticated');
            
            const user = session.user;

            // Get local history
            const localHistory = JSON.parse(localStorage.getItem('aethera_history') || '[]');
            
            // Get cloud history (last 100 entries)
            const { data: cloudHistory, error } = await supabaseClient
                .from('user_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            // Merge history
            const mergedHistory = this.mergeHistory(localHistory, cloudHistory || []);
            
            // Update localStorage (keep only recent entries)
            localStorage.setItem('aethera_history', JSON.stringify(mergedHistory.local.slice(0, 50)));
            
            // Upload new local entries to cloud
            for (const entry of mergedHistory.toUpload) {
                // Validate timestamp before creating Date object
                const timestamp = entry.timestamp || Date.now();
                const validTimestamp = isNaN(timestamp) ? Date.now() : timestamp;
                
                // Ensure product_name is never null or undefined
                const productName = entry.productName || entry.product_name || 'Untitled Script';
                
                const { error: insertError } = await supabaseClient
                    .from('user_history')
                    .insert([{
                        user_id: user.id,
                        product_name: productName,
                        scripts: entry.scripts || [],
                        post_type: entry.postType || entry.post_type || 'single',
                        image_url: entry.imageUrl || entry.image_url || null,
                        created_at: new Date(validTimestamp).toISOString()
                    }]);
                
                if (insertError) throw insertError;
            }
        } catch (error) {
            console.warn('Failed to sync history, continuing in offline mode:', error.message);
            // Don't throw error to prevent disrupting app functionality
        }
    }

    /**
     * Upsert history entry (local -> Supabase)
     */
    async upsertHistory(entry){
        try{
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return false;
            const payload = [{
                user_id: session.user.id,
                product_name: entry.productName || 'Untitled',
                post_type: entry.mode || 'single',
                scripts: entry.scripts || [],
            }];
            const { error } = await supabaseClient
                .from('user_history')
                .insert(payload);
            if (error) { console.warn('Supabase insert user_history failed:', error.message||error); throw error; }
            return true;
        }catch(e){ console.warn('upsertHistory failed:', e.message); return false; }
    }

    /**
     * Process pending offline operations
     */
    async processPendingOperations() {
        const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '[]');
        
        for (const operation of pending) {
            try {
                await this.executeOperation(operation);
            } catch (error) {
                console.error('Failed to execute pending operation:', operation, error);
            }
        }
        
        // Clear pending operations
        localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
    }

    /**
     * Execute a sync operation
     */
    async executeOperation(operation) {
        const { type, action, data } = operation;
        
        switch (type) {
            case 'presets':
                if (action === 'create') {
                    await supabaseClient.from('user_presets').insert([data]);
                } else if (action === 'update') {
                    const updatePayload = { name: data.name };
                    if (Object.prototype.hasOwnProperty.call(data, 'settings')) {
                        updatePayload.settings = data.settings;
                    }
                    if (data.id) {
                        await supabaseClient.from('user_presets').update(updatePayload).eq('id', data.id);
                    } else if (data.previous_name && data.type) {
                        // Fallback: update by previous_name and type under current user
                        const { data: { session } } = await supabaseClient.auth.getSession();
                        if (session?.user) {
                            await supabaseClient
                                .from('user_presets')
                                .update(updatePayload)
                                .eq('user_id', session.user.id)
                                .eq('type', data.type)
                                .eq('name', data.previous_name);
                        }
                    }
                } else if (action === 'delete') {
                    if (data.id) {
                        await supabaseClient.from('user_presets').delete().eq('id', data.id);
                    } else if (data.name && data.type) {
                        // Fallback: delete by name and type if ID not available
                        await supabaseClient.from('user_presets').delete()
                            .eq('name', data.name)
                            .eq('type', data.type);
                    }
                }
                break;
                
            case 'personas':
                if (action === 'create') {
                    await supabaseClient.from('user_personas').insert([data]);
                } else if (action === 'update') {
                    await supabaseClient.from('user_personas').update(data).eq('id', data.id);
                } else if (action === 'delete') {
                    await supabaseClient.from('user_personas').delete().eq('id', data.id);
                }
                break;
                
            case 'history':
                if (action === 'create') {
                    // Ensure product_name is never null or undefined
                    const validatedData = {
                        ...data,
                        product_name: data.product_name || data.productName || 'Untitled Script',
                        scripts: data.scripts || [],
                        post_type: data.post_type || data.postType || 'single',
                        image_url: data.image_url || data.imageUrl || null
                    };
                    await supabaseClient.from('user_history').insert([validatedData]);
                } else if (action === 'delete') {
                    await supabaseClient.from('user_history').delete().eq('id', data.id);
                }
                break;
        }
    }

    /**
     * Delete all user history from cloud storage
     */
    async deleteAllHistory() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) {
                console.warn('User not authenticated, cannot delete cloud history');
                return;
            }

            const { error } = await supabaseClient
                .from('user_history')
                .delete()
                .eq('user_id', session.user.id);

            if (error) throw error;
            console.log('All user history deleted from cloud storage');
        } catch (error) {
            console.warn('Failed to delete history from cloud storage:', error.message);
            // Don't throw error to prevent disrupting app functionality
        }
    }

    /**
     * Add operation to pending queue for offline execution
     */
    addPendingOperation(type, action, data) {
        const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '[]');
        pending.push({ type, action, data, timestamp: Date.now() });
        localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
    }

    /**
     * Merge settings with conflict resolution
     */
    mergeSettings(local, cloud) {
        // Cloud settings take precedence for conflicts
        return {
            theme: cloud.theme || local.theme,
            language: cloud.language || local.language,
            system_prompt: cloud.system_prompt || local.system_prompt
        };
    }

    /**
     * Merge personas with conflict resolution
     */
    mergePersonas(localPersonas, cloudPersonas) {
        const merged = [...cloudPersonas];
        const toUpload = [];
        
        // Add local personas that don't exist in cloud
        for (const localPersona of localPersonas) {
            const existsInCloud = cloudPersonas.find(cp => 
                cp.name === localPersona.name && cp.description === localPersona.description
            );
            
            if (!existsInCloud) {
                merged.push(localPersona);
                toUpload.push(localPersona);
            }
        }
        
        return {
            local: merged,
            toUpload
        };
    }

    /**
     * Merge history with conflict resolution
     */
    mergeHistory(localHistory, cloudHistory) {
        // Convert cloud history to local format first
        const normalizedCloudHistory = cloudHistory.map(ch => ({
            id: ch.created_at ? new Date(ch.created_at).getTime() : Date.now(),
            productName: ch.product_name || 'Untitled Script',
            mode: ch.post_type || 'single',
            scripts: ch.scripts || [],
            timestamp: ch.created_at ? new Date(ch.created_at).getTime() : Date.now()
        }));
        
        const merged = [...normalizedCloudHistory];
        const toUpload = [];
        
        // Add local history entries that don't exist in cloud
        for (const localEntry of localHistory) {
            // Validate timestamp before comparison
            const localTimestamp = localEntry.timestamp || localEntry.id || Date.now();
            const validLocalTimestamp = isNaN(localTimestamp) ? Date.now() : localTimestamp;
            
            // Ensure productName is never null or undefined
            const productName = localEntry.productName || localEntry.product_name || 'Untitled Script';
            
            // More robust duplicate detection using multiple criteria
            const existsInCloud = normalizedCloudHistory.find(ch => {
                const cloudTimestamp = ch.timestamp || Date.now();
                const timeDiff = Math.abs(cloudTimestamp - validLocalTimestamp);
                
                // Check if it's the same entry based on:
                // 1. Same product name
                // 2. Same timestamp (within 5 minutes to account for sync delays)
                // 3. Same script content (first script's hook/body as identifier)
                const sameProductName = ch.productName === productName;
                const similarTime = timeDiff < 300000; // 5 minutes
                
                let sameContent = false;
                if (localEntry.scripts && localEntry.scripts.length > 0 && ch.scripts && ch.scripts.length > 0) {
                    const localFirstScript = localEntry.scripts[0];
                    const cloudFirstScript = ch.scripts[0];
                    
                    // Compare hook and body content for single posts
                    if (localFirstScript.hook && cloudFirstScript.hook) {
                        sameContent = localFirstScript.hook === cloudFirstScript.hook && 
                                    localFirstScript.body === cloudFirstScript.body;
                    }
                    // Compare first slide content for carousel posts
                    else if (localFirstScript.slides && cloudFirstScript.slides && 
                           localFirstScript.slides.length > 0 && cloudFirstScript.slides.length > 0) {
                        sameContent = localFirstScript.slides[0].slide_text === cloudFirstScript.slides[0].slide_text;
                    }
                }
                
                return sameProductName && (similarTime || sameContent);
            });
            
            if (!existsInCloud) {
                // Only add valid local entries that have actual script content
                if (localEntry.scripts && localEntry.scripts.length > 0) {
                    const normalizedEntry = {
                        id: localEntry.id,
                        productName: productName,
                        mode: localEntry.mode || 'single',
                        scripts: localEntry.scripts,
                        timestamp: validLocalTimestamp
                    };
                    merged.push(normalizedEntry);
                    toUpload.push({
                        ...localEntry,
                        productName: productName,
                        scripts: localEntry.scripts,
                        postType: localEntry.mode || 'single',
                        imageUrl: localEntry.imageUrl || null
                    });
                }
            }
        }
        
        // Sort by timestamp (newest first)
        merged.sort((a, b) => {
            const aTime = a.timestamp || Date.now();
            const bTime = b.timestamp || Date.now();
            return bTime - aTime;
        });
        
        return {
            local: merged,
            toUpload
        };
    }

    /**
     * Check if local data has changes newer than cloud
     */
    hasLocalChanges(type, cloudUpdatedAt) {
        const lastLocalChange = localStorage.getItem(`aethera_${type}_last_modified`);
        if (!lastLocalChange) return false;
        
        try {
            const localDate = new Date(lastLocalChange);
            const cloudDate = new Date(cloudUpdatedAt);
            
            // Check if dates are valid
            if (isNaN(localDate.getTime()) || isNaN(cloudDate.getTime())) {
                return false;
            }
            
            return localDate > cloudDate;
        } catch (error) {
            console.warn('Invalid date values in hasLocalChanges:', { lastLocalChange, cloudUpdatedAt });
            return false;
        }
    }

    /**
     * Manual backup export
     */
    async exportBackup() {
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {
                settings: {
                    theme: localStorage.getItem('aethera_theme'),
                    language: localStorage.getItem('aethera_language'),
                    system_prompt: localStorage.getItem('aethera_system_prompt')
                },
                personas: JSON.parse(localStorage.getItem('aethera_personas') || '[]'),
                history: JSON.parse(localStorage.getItem('aethera_history') || '[]'),
                presets: JSON.parse(localStorage.getItem('aethera_last_settings') || '{}')
            }
        };
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `aethera-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        showNotification(t('notification_backup_exported') || 'Backup exported successfully');
    }

    /**
     * Manual backup restore
     */
    async restoreBackup(file) {
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            
            if (!backup.version || !backup.data) {
                throw new Error('Invalid backup file format');
            }
            
            // Restore settings
            if (backup.data.settings) {
                Object.entries(backup.data.settings).forEach(([key, value]) => {
                    if (value) localStorage.setItem(`aethera_${key}`, value);
                });
            }
            
            // Restore other data
            if (backup.data.personas) {
                localStorage.setItem('aethera_personas', JSON.stringify(backup.data.personas));
            }
            if (backup.data.history) {
                localStorage.setItem('aethera_history', JSON.stringify(backup.data.history));
            }
            if (backup.data.presets) {
                localStorage.setItem('aethera_last_settings', JSON.stringify(backup.data.presets));
            }
            
            showNotification(t('notification_backup_restored') || 'Backup restored successfully');
            
            // Trigger sync if online
            if (this.isOnline) {
                await this.syncAll();
            }
        } catch (error) {
            console.error('Failed to restore backup:', error);
            showNotification(t('notification_backup_restore_failed') || 'Failed to restore backup', 'error');
        }
    }

    /**
     * Fetch history tags from cloud storage
     */
    async fetchHistoryTags() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return {};
            const { data, error } = await supabaseClient
                .from('user_history_tags')
                .select('history_id, tags')
                .eq('user_id', session.user.id);
            if (error) throw error;
            const map = {};
            (data || []).forEach(r => { map[r.history_id] = r.tags || []; });
            return map;
        } catch (e) {
            console.warn('fetchHistoryTags failed:', e.message);
            return {};
        }
    }

    /**
     * Update/insert history tags in cloud storage
     */
    async upsertHistoryTags(historyId, tags) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return false;
            const payload = [{ user_id: session.user.id, history_id: String(historyId), tags: tags || [] }];
            const { error } = await supabaseClient
                .from('user_history_tags')
                .upsert(payload, { onConflict: 'user_id,history_id' });
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('upsertHistoryTags failed:', e.message);
            return false;
        }
    }
}

// Auto sync functionality
function startAutoSync() {
    if (!isAutoSyncEnabled || autoSyncTimer) return;
    
    autoSyncTimer = setInterval(async () => {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && cloudStorage.isOnline) {
                await cloudStorage.syncAll();
            }
        } catch (error) {
            console.warn('Auto sync failed:', error.message);
        }
    }, AUTO_SYNC_INTERVAL);
}

function stopAutoSync() {
    if (autoSyncTimer) {
        clearInterval(autoSyncTimer);
        autoSyncTimer = null;
    }
}

// Create singleton instance
export const cloudStorage = new CloudStorageService();

// Add auto sync methods to cloudStorage
cloudStorage.startAutoSync = startAutoSync;
cloudStorage.stopAutoSync = stopAutoSync;