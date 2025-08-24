/**
 * Cloud Migration Service for Aethera Studio
 * Handles migration of existing localStorage data to Supabase cloud storage
 */

import { supabaseClient } from './supabase.js';
import { showNotification } from './utils.js';
import { t } from './i18n.js';

// Migration status constants
export const MIGRATION_STATUS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// Migration storage keys
const MIGRATION_KEYS = {
    STATUS: 'aethera_migration_status',
    COMPLETED_AT: 'aethera_migration_completed_at',
    VERSION: 'aethera_migration_version'
};

class CloudMigrationService {
    constructor() {
        this.migrationVersion = '1.0';
        this.migrationStatus = this.getMigrationStatus();
    }

    /**
     * Get current migration status
     */
    getMigrationStatus() {
        return localStorage.getItem(MIGRATION_KEYS.STATUS) || MIGRATION_STATUS.NOT_STARTED;
    }

    /**
     * Set migration status
     */
    setMigrationStatus(status) {
        this.migrationStatus = status;
        localStorage.setItem(MIGRATION_KEYS.STATUS, status);
        
        if (status === MIGRATION_STATUS.COMPLETED) {
            localStorage.setItem(MIGRATION_KEYS.COMPLETED_AT, new Date().toISOString());
            localStorage.setItem(MIGRATION_KEYS.VERSION, this.migrationVersion);
        }
    }

    /**
     * Check if migration is needed
     */
    needsMigration() {
        const status = this.getMigrationStatus();
        const version = localStorage.getItem(MIGRATION_KEYS.VERSION);
        
        return status !== MIGRATION_STATUS.COMPLETED || version !== this.migrationVersion;
    }

    /**
     * Check if user has data to migrate
     */
    hasDataToMigrate() {
        const dataKeys = [
            'aethera_personas',
            'aethera_history',
            'aethera_settings_presets',
            'aethera_character_presets',
            'aethera_system_prompt'
        ];
        
        return dataKeys.some(key => {
            const data = localStorage.getItem(key);
            if (!data) return false;
            
            try {
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0;
            } catch {
                return data.length > 0;
            }
        });
    }

    /**
     * Start migration process
     */
    async startMigration() {
        if (!this.needsMigration()) {
            console.log('Migration not needed');
            return { success: true, message: 'Migration not needed' };
        }

        // Check if user is logged in
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            console.log('User not logged in, skipping migration');
            return { success: false, message: 'User not logged in' };
        }

        // Check if user has data to migrate
        if (!this.hasDataToMigrate()) {
            console.log('No data to migrate');
            this.setMigrationStatus(MIGRATION_STATUS.COMPLETED);
            return { success: true, message: 'No data to migrate' };
        }

        this.setMigrationStatus(MIGRATION_STATUS.IN_PROGRESS);
        
        try {
            console.log('Starting cloud migration...');
            
            // Migrate data in order
            await this.migrateSettings();
            await this.migratePersonas();
            await this.migratePresets();
            await this.migrateHistory();
            
            this.setMigrationStatus(MIGRATION_STATUS.COMPLETED);
            
            showNotification(
                t('notification_migration_success') || 'Data successfully migrated to cloud!',
                'success'
            );
            
            console.log('Cloud migration completed successfully');
            return { success: true, message: 'Migration completed successfully' };
            
        } catch (error) {
            console.error('Migration failed:', error);
            this.setMigrationStatus(MIGRATION_STATUS.FAILED);
            
            showNotification(
                t('notification_migration_failed') || 'Failed to migrate data to cloud. Your local data is safe.',
                'error'
            );
            
            return { success: false, message: error.message };
        }
    }

    /**
     * Migrate user settings
     */
    async migrateSettings() {
        console.log('Migrating settings...');
        
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const settings = {
            theme: localStorage.getItem('aethera_theme') || 'dark',
            language: localStorage.getItem('aethera_language') || 'id',
            system_prompt: localStorage.getItem('aethera_system_prompt')
        };

        // Check if settings already exist in cloud
        const { data: existingSettings, error: fetchError } = await supabaseClient
            .from('user_settings')
            .select('*')
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }

        if (!existingSettings) {
            // Insert new settings
            const { error: insertError } = await supabaseClient
                .from('user_settings')
                .insert([{
                    user_id: user.id,
                    theme: settings.theme,
                    language: settings.language,
                    system_prompt: settings.system_prompt
                }]);
            
            if (insertError) throw insertError;
            console.log('Settings migrated successfully');
        } else {
            console.log('Settings already exist in cloud, skipping');
        }
    }

    /**
     * Migrate user personas
     */
    async migratePersonas() {
        console.log('Migrating personas...');
        
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const localPersonas = JSON.parse(localStorage.getItem('aethera_personas') || '[]');
        if (localPersonas.length === 0) {
            console.log('No personas to migrate');
            return;
        }

        // Get existing cloud personas
        const { data: cloudPersonas, error: fetchError } = await supabaseClient
            .from('user_personas')
            .select('*');

        if (fetchError) throw fetchError;

        const existingNames = new Set((cloudPersonas || []).map(p => p.name));
        const personasToMigrate = localPersonas.filter(persona => !existingNames.has(persona.name));

        if (personasToMigrate.length === 0) {
            console.log('All personas already exist in cloud');
            return;
        }

        // Insert new personas
        const { error: insertError } = await supabaseClient
            .from('user_personas')
            .insert(personasToMigrate.map(persona => ({
                user_id: user.id,
                name: persona.name,
                description: persona.description,
                avatar: persona.avatar,
                personality: persona.personality || {}
            })));

        if (insertError) throw insertError;
        console.log(`${personasToMigrate.length} personas migrated successfully`);
    }

    /**
     * Migrate user presets
     */
    async migratePresets() {
        console.log('Migrating presets...');
        
        const localSettingsPresets = JSON.parse(localStorage.getItem('aethera_settings_presets') || '[]');
        const localPresets = {};
        localSettingsPresets.forEach(preset => {
            localPresets[preset.name] = preset.settings;
        });
        const localCharacterPresets = JSON.parse(localStorage.getItem('aethera_character_presets') || '[]');
        
        // Migrate generator presets
        if (Object.keys(localPresets).length > 0) {
            await this.migrateGeneratorPresets(localPresets);
        }
        
        // Migrate character presets
        if (localCharacterPresets.length > 0) {
            await this.migrateCharacterPresets(localCharacterPresets);
        }
    }

    /**
     * Migrate generator presets
     */
    async migrateGeneratorPresets(localPresets) {
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get existing cloud presets
        const { data: cloudPresets, error: fetchError } = await supabaseClient
            .from('user_presets')
            .select('*')
            .eq('type', 'generator');

        if (fetchError) throw fetchError;

        const existingNames = new Set((cloudPresets || []).map(p => p.name));
        const presetsToMigrate = [];

        // Convert local presets to cloud format
        Object.entries(localPresets).forEach(([key, preset]) => {
            if (!existingNames.has(key)) {
                presetsToMigrate.push({
                    user_id: user.id,
                    name: key,
                    type: 'generator',
                    settings: preset
                });
            }
        });

        if (presetsToMigrate.length === 0) {
            console.log('All generator presets already exist in cloud');
            return;
        }

        // Insert new presets
        const { error: insertError } = await supabaseClient
            .from('user_presets')
            .insert(presetsToMigrate);

        if (insertError) throw insertError;
        console.log(`${presetsToMigrate.length} generator presets migrated successfully`);
    }

    /**
     * Migrate character presets
     */
    async migrateCharacterPresets(localPresets) {
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get existing cloud presets
        const { data: cloudPresets, error: fetchError } = await supabaseClient
            .from('user_presets')
            .select('*')
            .eq('type', 'character');

        if (fetchError) throw fetchError;

        const existingNames = new Set((cloudPresets || []).map(p => p.name));
        const presetsToMigrate = localPresets
            .filter(preset => !existingNames.has(preset.name))
            .map(preset => ({
                user_id: user.id,
                name: preset.name,
                type: 'character',
                settings: preset
            }));

        if (presetsToMigrate.length === 0) {
            console.log('All character presets already exist in cloud');
            return;
        }

        // Insert new presets
        const { error: insertError } = await supabaseClient
            .from('user_presets')
            .insert(presetsToMigrate);

        if (insertError) throw insertError;
        console.log(`${presetsToMigrate.length} character presets migrated successfully`);
    }

    /**
     * Migrate user history
     */
    async migrateHistory() {
        try {
            console.log('Migrating history...');
            
            // Get current user
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const localHistory = JSON.parse(localStorage.getItem('aethera_history') || '[]');
            if (localHistory.length === 0) {
                console.log('No history to migrate');
                return;
            }

            // Get existing cloud history
            const { data: cloudHistory, error: fetchError } = await supabaseClient
                .from('user_history')
                .select('product_name, created_at')
                .order('created_at', { ascending: false })
                .limit(100);

            if (fetchError) throw fetchError;

            // Create a set of existing entries (product_name + approximate timestamp)
            const existingEntries = new Set();
            (cloudHistory || []).forEach(entry => {
                try {
                    const createdAt = entry.created_at ? new Date(entry.created_at) : new Date();
                    const key = `${entry.product_name}_${createdAt.toDateString()}`;
                    existingEntries.add(key);
                } catch (error) {
                    console.warn('Invalid created_at date in cloud history:', entry.created_at);
                }
            });

            // Filter out entries that already exist
            const historyToMigrate = localHistory
                .filter(entry => {
                    // Validate timestamp before creating Date object
                    const timestamp = entry.timestamp || Date.now();
                    const validTimestamp = isNaN(timestamp) ? Date.now() : timestamp;
                    // Ensure productName is never null or undefined
                    const productName = entry.productName || entry.product_name || 'Untitled Script';
                    const key = `${productName}_${new Date(validTimestamp).toDateString()}`;
                    return !existingEntries.has(key);
                })
                .slice(0, 50) // Limit to 50 most recent entries
                .map(entry => {
                    // Validate timestamp before creating Date object
                    const timestamp = entry.timestamp || Date.now();
                    const validTimestamp = isNaN(timestamp) ? Date.now() : timestamp;
                    // Ensure product_name is never null or undefined
                    const productName = entry.productName || entry.product_name || 'Untitled Script';
                    
                    return {
                        user_id: user.id,
                        product_name: productName,
                        scripts: entry.scripts || [],
                        post_type: entry.postType || entry.post_type || 'single',
                        image_url: entry.imageUrl || entry.image_url || null,
                        created_at: new Date(validTimestamp).toISOString()
                    };
                });

            if (historyToMigrate.length === 0) {
                console.log('All history entries already exist in cloud');
                return;
            }

            // Insert new history entries in batches
            const batchSize = 10;
            for (let i = 0; i < historyToMigrate.length; i += batchSize) {
                const batch = historyToMigrate.slice(i, i + batchSize);
                const { error: insertError } = await supabaseClient
                    .from('user_history')
                    .insert(batch);

                if (insertError) throw insertError;
            }

            console.log(`${historyToMigrate.length} history entries migrated successfully`);
        } catch (error) {
            console.warn('Failed to migrate history, continuing with other data:', error.message);
            // Don't throw error to prevent disrupting the entire migration process
        }
    }

    /**
     * Show migration prompt to user
     */
    async showMigrationPrompt() {
        if (!this.needsMigration() || !this.hasDataToMigrate()) {
            return;
        }

        // Wait a bit to ensure translations are loaded
        await new Promise(resolve => setTimeout(resolve, 500));

        const modal = document.createElement('div');
        modal.className = 'modal migration-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${t('migration_title') || 'Migrate Your Data to Cloud'}</h3>
                </div>
                <div class="modal-body">
                    <p>${t('migration_description') || 'We found existing data on your device. Would you like to migrate it to the cloud for backup and sync across devices?'}</p>
                    <ul>
                        <li>${t('migration_benefit_1') || 'Automatic backup of your data'}</li>
                        <li>${t('migration_benefit_2') || 'Sync across multiple devices'}</li>
                        <li>${t('migration_benefit_3') || 'Never lose your presets and history'}</li>
                    </ul>
                    <p class="migration-note">
                        <strong>${t('migration_note') || 'Note:'}</strong> 
                        ${t('migration_note_text') || 'Your local data will remain safe. This process only copies data to the cloud.'}
                    </p>
                </div>
                <div class="modal-footer">
                    <button id="migration-later-btn" class="btn btn-secondary">
                        ${t('migration_later') || 'Maybe Later'}
                    </button>
                    <button id="migration-start-btn" class="btn btn-primary">
                        ${t('migration_start') || 'Start Migration'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const laterBtn = modal.querySelector('#migration-later-btn');
        const startBtn = modal.querySelector('#migration-start-btn');

        laterBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        startBtn.addEventListener('click', async () => {
            startBtn.disabled = true;
            startBtn.textContent = t('migration_in_progress') || 'Migrating...';
            
            const result = await this.startMigration();
            
            if (result.success) {
                document.body.removeChild(modal);
            } else {
                startBtn.disabled = false;
                startBtn.textContent = t('migration_start') || 'Start Migration';
            }
        });

        // Show modal
        setTimeout(() => modal.classList.add('show'), 100);
    }

    /**
     * Reset migration status (for testing)
     */
    resetMigration() {
        localStorage.removeItem(MIGRATION_KEYS.STATUS);
        localStorage.removeItem(MIGRATION_KEYS.COMPLETED_AT);
        localStorage.removeItem(MIGRATION_KEYS.VERSION);
        this.migrationStatus = MIGRATION_STATUS.NOT_STARTED;
    }
}

// Create singleton instance
export const cloudMigration = new CloudMigrationService();

/**
 * Check if migration is needed and show prompt
 */
export async function checkAndShowMigrationPrompt() {
    // Wait a bit to let UI settle and ensure translations are loaded
    setTimeout(async () => {
        await cloudMigration.showMigrationPrompt();
    }, 2000);
}