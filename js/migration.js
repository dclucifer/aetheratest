/**
 * Migration script to rename localStorage keys for rebrands.
 * - Legacy: 'kontenkilat_*'  -> 'aethera_*'
 * - Current: 'aethera_*'     -> 'direktiva_*'
 */

const MIGRATION_KEY = 'direktiva_migration_completed';

// Mapping of old keys to new keys (combined)
const KEY_MIGRATIONS = {
    // Legacy → Aethera
    'kontenkilat_theme': 'aethera_theme',
    'kontenkilat_language': 'aethera_language',
    'kontenkilat_system_prompt': 'aethera_system_prompt',
    'kontenkilat_user_api_key': 'aethera_user_api_key',
    'kontenkilat_history': 'aethera_history',
    'kontenkilat_lastGeneratedScripts': 'aethera_lastGeneratedScripts',
    'kontenkilat_personas': 'aethera_personas',

    // Aethera → Direktiva (primary migration)
    'aethera_theme': 'direktiva_theme',
    'aethera_language': 'direktiva_language',
    'aethera_system_prompt': 'direktiva_system_prompt',
    'aethera_user_api_key': 'direktiva_user_api_key',
    'aethera_settings_last_modified': 'direktiva_settings_last_modified',
    'aethera_timeout_ms': 'direktiva_timeout_ms',
    'aethera_session_id': 'direktiva_session_id',
    // History & tags
    'aethera_history': 'direktiva_history',
    'aethera_history_last_modified': 'direktiva_history_last_modified',
    'aethera_history_tags': 'direktiva_history_tags',
    // Presets & last settings
    'aethera_last_settings': 'direktiva_last_settings',
    'aethera_settings_presets': 'direktiva_settings_presets',
    'aethera_presets_last_modified': 'direktiva_presets_last_modified',
    // Character presets & usage
    'aethera_character_presets': 'direktiva_character_presets',
    'aethera_character_presets_last_modified': 'direktiva_character_presets_last_modified',
    'aethera_pinned_characters': 'direktiva_pinned_characters',
    'aethera_character_usage': 'direktiva_character_usage',
    // Personas & generated cache
    'aethera_personas': 'direktiva_personas',
    'aethera_lastGeneratedScripts': 'direktiva_lastGeneratedScripts',
    // Cloud sync helper keys
    'aethera_sync_status': 'direktiva_sync_status',
    'aethera_last_sync': 'direktiva_last_sync',
    'aethera_pending_sync': 'direktiva_pending_sync',
    'aethera_offline_changes': 'direktiva_offline_changes'
};

/**
 * Migrate localStorage keys from old naming to new naming
 */
function migrateLocalStorageKeys() {
    // Check if migration has already been completed
    if (localStorage.getItem(MIGRATION_KEY)) {
        console.log('Migration already completed');
        return;
    }

    console.log('Starting localStorage key migration...');
    let migratedCount = 0;

    // Migrate each key
    Object.entries(KEY_MIGRATIONS).forEach(([oldKey, newKey]) => {
        const value = localStorage.getItem(oldKey);
        if (value !== null) {
            try {
                // Only set if new key not already present to avoid overwriting newer data
                if (localStorage.getItem(newKey) === null) {
                    localStorage.setItem(newKey, value);
                }
                // Remove old key to avoid ambiguity
                try { localStorage.removeItem(oldKey); } catch(_) {}
                migratedCount++;
                console.log(`Migrated: ${oldKey} -> ${newKey}`);
            } catch (error) {
                console.error(`Failed to migrate ${oldKey}:`, error);
            }
        }
    });

    // Mark migration as completed
    localStorage.setItem(MIGRATION_KEY, 'true');
    console.log(`Migration completed. ${migratedCount} keys migrated.`);
}

/**
 * Initialize migration on page load
 */
function initMigration() {
    try {
        migrateLocalStorageKeys();
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

// Export for use in other modules
export { migrateLocalStorageKeys, initMigration };

// Auto-run migration if this script is loaded directly
if (typeof window !== 'undefined') {
    // Run migration when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMigration);
    } else {
        initMigration();
    }
}