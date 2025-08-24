/**
 * Migration script to rename localStorage keys from 'kontenkilat_*' to 'aethera_*'
 * This ensures user data is preserved when updating the application name
 */

const MIGRATION_KEY = 'aethera_migration_completed';

// Mapping of old keys to new keys
const KEY_MIGRATIONS = {
    'kontenkilat_theme': 'aethera_theme',
    'kontenkilat_language': 'aethera_language', 
    'kontenkilat_system_prompt': 'aethera_system_prompt',
    'kontenkilat_user_api_key': 'aethera_user_api_key',
    'kontenkilat_history': 'aethera_history',
    'kontenkilat_lastGeneratedScripts': 'aethera_lastGeneratedScripts',
    'kontenkilat_personas': 'aethera_personas'
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
                // Set new key with the same value
                localStorage.setItem(newKey, value);
                // Remove old key
                localStorage.removeItem(oldKey);
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