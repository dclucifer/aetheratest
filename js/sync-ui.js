/**
 * Sync UI Components for Aethera Studio
 * Handles sync indicator and related UI elements
 */

import { cloudStorage, SYNC_STATUS } from './cloud-storage.js';
import { supabaseClient } from './supabase.js';
import { t } from './i18n.js';
import { showNotification } from './utils.js';

/**
 * Create and initialize sync indicator
 */
export function initSyncIndicator() {
    // Check if sync indicator should be shown
    const showSyncIndicator = localStorage.getItem('aethera_show_sync_indicator') !== 'false';
    
    if (showSyncIndicator) {
        // Create sync indicator element
        const syncIndicator = createSyncIndicator();
        
        // Add to body (positioned fixed)
        document.body.appendChild(syncIndicator);
    }
    
    // Add sync controls to settings
    addSyncControls();
}

/**
 * Create sync indicator element
 */
function createSyncIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'sync-indicator';
    indicator.className = 'sync-indicator sync-offline';
    indicator.innerHTML = `
        <svg class="sync-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        <span class="sync-text">${t('sync_status_offline') || 'Offline'}</span>
    `;
    
    // Add click handler for manual sync
    indicator.addEventListener('click', handleSyncClick);
    
    // Add double-click handler to hide/show
    indicator.addEventListener('dblclick', toggleSyncIndicator);
    
    return indicator;
}

/**
 * Toggle sync indicator visibility
 */
function toggleSyncIndicator() {
    const indicator = document.getElementById('sync-indicator');
    if (!indicator) return;
    
    const isHidden = indicator.style.display === 'none';
    
    if (isHidden) {
        indicator.style.display = '';
        localStorage.setItem('aethera_show_sync_indicator', 'true');
        const translatedMessage = t('sync_indicator_shown') || 'Indikator sinkronisasi ditampilkan';
        showNotification(translatedMessage, 'info');
    } else {
        indicator.style.display = 'none';
        localStorage.setItem('aethera_show_sync_indicator', 'false');
        const translatedMessage = t('sync_indicator_hidden') || 'Indikator sinkronisasi disembunyikan. Double-click di area kosong untuk menampilkan kembali.';
        showNotification(translatedMessage, 'info');
        
        // Add temporary body click listener to show indicator again
        addBodyClickListener();
    }
}

/**
 * Add body click listener to show hidden sync indicator
 */
function addBodyClickListener() {
    // Remove existing listener if any
    document.body.removeEventListener('dblclick', showHiddenSyncIndicator);
    
    // Add new listener
    document.body.addEventListener('dblclick', showHiddenSyncIndicator);
}

/**
 * Show hidden sync indicator when double-clicking on empty area
 */
function showHiddenSyncIndicator(event) {
    // Only show if clicking on body or empty area (not on other elements)
    if (event.target === document.body || event.target.tagName === 'HTML') {
        const indicator = document.getElementById('sync-indicator');
        if (indicator && indicator.style.display === 'none') {
            indicator.style.display = '';
            localStorage.setItem('aethera_show_sync_indicator', 'true');
            const translatedMessage = t('sync_indicator_shown') || 'Indikator sinkronisasi ditampilkan';
            showNotification(translatedMessage, 'info');
            
            // Remove the body click listener
            document.body.removeEventListener('dblclick', showHiddenSyncIndicator);
        }
    }
}

/**
 * Handle sync indicator click
 */
async function handleSyncClick() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        showNotification(t('notification_login_required') || 'Please login to sync data', 'warning');
        return;
    }
    
    if (!navigator.onLine) {
        showNotification(t('notification_offline') || 'You are offline. Data will sync when connection is restored.', 'info');
        return;
    }
    
    try {
        await cloudStorage.syncAll();
        showNotification(t('notification_sync_success') || 'Data synced successfully');
    } catch (error) {
        console.error('Manual sync failed:', error);
        showNotification(t('notification_sync_failed') || 'Sync failed. Please try again.', 'error');
    }
}

/**
 * Add sync controls to settings panel
 */
function addSyncControls() {
    const settingsPanel = document.getElementById('settings-panel');
    if (!settingsPanel) return;
    
    // Create sync section
    const syncSection = document.createElement('div');
    syncSection.className = 'settings-section sync-section';
    syncSection.innerHTML = `
        <h3>${t('settings_sync_title') || 'Cloud Sync'}</h3>
        <div class="sync-controls">
            <div class="sync-status-display">
                <div class="sync-status-item">
                    <span class="sync-label">${t('sync_last_sync') || 'Last Sync'}:</span>
                    <span id="last-sync-time" class="sync-value">-</span>
                </div>
                <div class="sync-status-item">
                    <span class="sync-label">${t('sync_status') || 'Status'}:</span>
                    <span id="sync-status-text" class="sync-value">-</span>
                </div>
            </div>
            
            <div class="sync-buttons">
                <button id="manual-sync-btn" class="btn btn-primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 4v6h-6"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    ${t('sync_manual_sync') || 'Sync Now'}
                </button>
                
                <button id="export-backup-btn" class="btn btn-secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    ${t('sync_export_backup') || 'Export Backup'}
                </button>
                
                <button id="import-backup-btn" class="btn btn-secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17,8 12,3 7,8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    ${t('sync_import_backup') || 'Import Backup'}
                </button>
            </div>
            
            <div class="sync-info">
                <p class="sync-description">
                    ${t('sync_description') || 'Your data is automatically synced when you\'re online and logged in. You can also manually export/import backups.'}
                </p>
            </div>
        </div>
        
        <input type="file" id="backup-file-input" accept=".json" style="display: none;">
    `;
    
    // Add to settings panel
    settingsPanel.appendChild(syncSection);
    
    // Initialize sync controls
    initSyncControls();
}

/**
 * Initialize sync control event listeners
 */
function initSyncControls() {
    // Manual sync button
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', handleManualSync);
    }
    
    // Export backup button
    const exportBtn = document.getElementById('export-backup-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportBackup);
    }
    
    // Import backup button
    const importBtn = document.getElementById('import-backup-btn');
    if (importBtn) {
        importBtn.addEventListener('click', handleImportBackup);
    }
    
    // File input for backup import
    const fileInput = document.getElementById('backup-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleBackupFileSelect);
    }
    
    // Update sync status display
    updateSyncStatusDisplay();
    
    // Update every 30 seconds
    setInterval(updateSyncStatusDisplay, 30000);
}

/**
 * Handle manual sync
 */
async function handleManualSync() {
    const btn = document.getElementById('manual-sync-btn');
    const originalText = btn.innerHTML;
    
    try {
        // Show loading state
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            ${t('sync_syncing') || 'Syncing...'}
        `;
        
        await cloudStorage.syncAll();
        showNotification(t('notification_sync_success') || 'Data synced successfully');
        updateSyncStatusDisplay();
    } catch (error) {
        console.error('Manual sync failed:', error);
        showNotification(t('notification_sync_failed') || 'Sync failed. Please try again.', 'error');
    } finally {
        // Restore button state
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Handle export backup
 */
async function handleExportBackup() {
    try {
        await cloudStorage.exportBackup();
    } catch (error) {
        console.error('Export backup failed:', error);
        showNotification(t('notification_export_failed') || 'Failed to export backup', 'error');
    }
}

/**
 * Handle import backup button click
 */
function handleImportBackup() {
    const fileInput = document.getElementById('backup-file-input');
    if (fileInput) {
        fileInput.click();
    }
}

/**
 * Handle backup file selection
 */
async function handleBackupFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        await cloudStorage.restoreBackup(file);
        updateSyncStatusDisplay();
        
        // Refresh the page to apply restored settings
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    } catch (error) {
        console.error('Import backup failed:', error);
        showNotification(t('notification_import_failed') || 'Failed to import backup', 'error');
    }
    
    // Clear file input
    event.target.value = '';
}

/**
 * Update sync status display
 */
function updateSyncStatusDisplay() {
    const lastSyncElement = document.getElementById('last-sync-time');
    const statusElement = document.getElementById('sync-status-text');
    
    if (lastSyncElement) {
        const lastSync = localStorage.getItem('aethera_last_sync');
        if (lastSync) {
            try {
                const date = new Date(lastSync);
                if (isNaN(date.getTime())) {
                    lastSyncElement.textContent = t('sync_never') || 'Never';
                } else {
                    lastSyncElement.textContent = date.toLocaleString();
                }
            } catch (error) {
                console.warn('Invalid last sync date:', lastSync);
                lastSyncElement.textContent = t('sync_never') || 'Never';
            }
        } else {
            lastSyncElement.textContent = t('sync_never') || 'Never';
        }
    }
    
    if (statusElement) {
        const status = localStorage.getItem('aethera_sync_status') || SYNC_STATUS.OFFLINE;
        const statusText = {
            [SYNC_STATUS.SYNCED]: t('sync_status_synced') || 'Synced',
            [SYNC_STATUS.SYNCING]: t('sync_status_syncing') || 'Syncing...',
            [SYNC_STATUS.OFFLINE]: t('sync_status_offline') || 'Offline',
            [SYNC_STATUS.ERROR]: t('sync_status_error') || 'Error'
        };
        
        statusElement.textContent = statusText[status];
        statusElement.className = `sync-value sync-${status}`;
    }
}

/**
 * Show sync notification
 */
export function showSyncNotification(message, type = 'info') {
    showNotification(message, type);
}

/**
 * Update sync progress
 */
export function updateSyncProgress(progress, message) {
    const indicator = document.getElementById('sync-indicator');
    if (!indicator) return;
    
    if (progress < 100) {
        indicator.classList.add('sync-syncing');
        indicator.title = `${message} (${progress}%)`;
    } else {
        indicator.classList.remove('sync-syncing');
        indicator.title = message;
    }
}

/**
 * Add CSS styles for sync components
 */
export function addSyncStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Sync Indicator */
        .sync-indicator {
            position: fixed;
            top: 10px;
            right: 10px;
            display: none !important;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
            background-color: var(--bg-primary);
            border: 1px solid var(--border-color);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            opacity: 0.8;
        }
        
        .sync-indicator:hover {
            opacity: 1;
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .sync-indicator.hidden {
            display: none;
        }
        
        .sync-indicator.sync-synced {
            color: var(--success-color, #10b981);
        }
        
        .sync-indicator.sync-syncing {
            color: var(--warning-color, #f59e0b);
        }
        
        .sync-indicator.sync-offline {
            color: var(--text-secondary);
        }
        
        .sync-indicator.sync-error {
            color: var(--error-color, #ef4444);
        }
        
        .sync-icon {
            width: 14px;
            height: 14px;
        }
        
        .sync-indicator.sync-syncing .sync-icon {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        /* Sync Section in Settings */
        .sync-section {
            margin-top: 20px;
            padding: 20px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background-color: var(--bg-secondary);
        }
        
        .sync-section h3 {
            margin: 0 0 16px 0;
            color: var(--text-primary);
            font-size: 16px;
            font-weight: 600;
        }
        
        .sync-status-display {
            margin-bottom: 16px;
        }
        
        .sync-status-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--border-color);
        }
        
        .sync-status-item:last-child {
            border-bottom: none;
        }
        
        .sync-label {
            color: var(--text-secondary);
            font-size: 14px;
        }
        
        .sync-value {
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 500;
        }
        
        .sync-value.sync-synced {
            color: var(--success-color, #10b981);
        }
        
        .sync-value.sync-syncing {
            color: var(--warning-color, #f59e0b);
        }
        
        .sync-value.sync-offline {
            color: var(--text-secondary);
        }
        
        .sync-value.sync-error {
            color: var(--error-color, #ef4444);
        }
        
        .sync-buttons {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }
        
        .sync-buttons .btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            font-size: 13px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
            background-color: var(--bg-primary);
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .sync-buttons .btn:hover {
            background-color: var(--bg-secondary);
        }
        
        .sync-buttons .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .sync-buttons .btn-primary {
            background-color: var(--primary-color, #3b82f6);
            color: white;
            border-color: var(--primary-color, #3b82f6);
        }
        
        .sync-buttons .btn-primary:hover {
            background-color: var(--primary-hover, #2563eb);
        }
        
        .sync-info {
            padding-top: 12px;
            border-top: 1px solid var(--border-color);
        }
        
        .sync-description {
            margin: 0;
            color: var(--text-secondary);
            font-size: 13px;
            line-height: 1.4;
        }
        
        /* Migration Modal */
        .migration-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .migration-modal.show {
            opacity: 1;
        }
        
        .migration-modal .modal-content {
            background-color: var(--bg-primary);
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        
        .migration-modal .modal-header {
            padding: 20px 20px 0 20px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .migration-modal .modal-header h3 {
            margin: 0 0 16px 0;
            color: var(--text-primary);
            font-size: 18px;
            font-weight: 600;
        }
        
        .migration-modal .modal-body {
            padding: 20px;
        }
        
        .migration-modal .modal-body p {
            margin: 0 0 16px 0;
            color: var(--text-primary);
            line-height: 1.5;
        }
        
        .migration-modal .modal-body ul {
            margin: 0 0 16px 0;
            padding-left: 20px;
            color: var(--text-primary);
        }
        
        .migration-modal .modal-body li {
            margin-bottom: 8px;
            line-height: 1.4;
        }
        
        .migration-note {
            background-color: var(--bg-secondary);
            padding: 12px;
            border-radius: 6px;
            border-left: 3px solid var(--primary-color, #3b82f6);
        }
        
        .migration-modal .modal-footer {
            padding: 0 20px 20px 20px;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }
        
        .migration-modal .modal-footer .btn {
            padding: 10px 16px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
            background-color: var(--bg-primary);
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 14px;
        }
        
        .migration-modal .modal-footer .btn:hover {
            background-color: var(--bg-secondary);
        }
        
        .migration-modal .modal-footer .btn-primary {
            background-color: var(--primary-color, #3b82f6);
            color: white;
            border-color: var(--primary-color, #3b82f6);
        }
        
        .migration-modal .modal-footer .btn-primary:hover {
            background-color: var(--primary-hover, #2563eb);
        }
        
        .migration-modal .modal-footer .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .sync-buttons {
                flex-direction: column;
            }
            
            .sync-buttons .btn {
                justify-content: center;
            }
            
            .migration-modal .modal-content {
                width: 95%;
                margin: 20px;
            }
            
            .migration-modal .modal-footer {
                flex-direction: column;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Initialize sync UI when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        addSyncStyles();
        initSyncIndicator();
    });
} else {
    addSyncStyles();
    initSyncIndicator();
}