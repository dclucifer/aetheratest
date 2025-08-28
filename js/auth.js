import { supabaseClient } from './supabase.js';
import { elements, showNotification, languageState} from './utils.js';
import { t } from './i18n.js';
import { showPage } from './ui.router.js';
import { loadSettings } from './settings.js';
import { populatePersonaSelector, renderPersonas, renderDefaultPersonas } from './persona.js';
import { checkAndShowMigrationPrompt } from './cloud-migration.js';
import { cloudStorage } from './cloud-storage.js';
import { populatePresetSelector } from './presets.js';
import { populateCharacterPresetSelector } from './characterPresets.js';

let __singleSessionTimer = null;

async function generateSessionId() {
    try {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        return String(Date.now()) + Math.random().toString(36).slice(2);
    }
}

async function ensureSingleSessionGuard() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.user) return;
        const userId = session.user.id;
        let localId = localStorage.getItem('aethera_session_id');
        if (!localId) {
            localId = await generateSessionId();
            localStorage.setItem('aethera_session_id', localId);
        }
        // Set as the current active session on login/refresh
        await supabaseClient.from('profiles').upsert({ id: userId, last_session_id: localId, email: session.user.email });

        // Verification function
        const verify = async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('last_session_id')
                    .eq('id', userId)
                    .single();
                if (!error && data && data.last_session_id && data.last_session_id !== localId) {
                    showNotification(t('session_conflict') || 'Akun Anda digunakan di perangkat lain. Anda akan keluar.', 'error');
                    await handleLogout();
                }
            } catch (_) {}
        };

        // Clear previous timer and set a new one
        if (__singleSessionTimer) { clearInterval(__singleSessionTimer); __singleSessionTimer = null; }
        __singleSessionTimer = setInterval(verify, 20000);
        window.addEventListener('focus', verify, { passive: true });
    } catch (_) {}
}

export async function checkLogin() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        elements.loginOverlay.classList.add('hidden');
        elements.appContainer.classList.remove('hidden');
        loadSettings();
        showPage('generator');
        renderPersonas();
        renderDefaultPersonas();
        populatePersonaSelector();
        // Activate single-session guard
        ensureSingleSessionGuard();
        
        // Sync data from cloud and populate UI
        try {
            await cloudStorage.syncAll();
            // Force refresh preset selectors after sync
            setTimeout(() => {
                try {
                    populatePresetSelector();
                    populateCharacterPresetSelector();
                } catch (error) {
                    console.warn('Failed to populate selectors after sync:', error.message);
                }
            }, 500);
            cloudStorage.startAutoSync();
        } catch (error) {
            console.warn('Failed to sync data after login:', error.message);
            // Still populate selectors with local data
            try {
                populatePresetSelector();
                populateCharacterPresetSelector();
            } catch (selectorError) {
                console.warn('Failed to populate selectors with local data:', selectorError.message);
            }
            // Show migration prompt only if sync fails
            checkAndShowMigrationPrompt();
        }
    } else {
        elements.loginOverlay.classList.remove('hidden');
        elements.appContainer.classList.add('hidden');
    }
}

export async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        if (error.message.includes("Invalid login credentials")) {
            showNotification(t('notification_login_invalid'), 'error');
        } else {
            showNotification(`${t('notification_login_failed')} ${error.message}`, 'error');
        }
    } else {
        const key = 'notification_login_success';
        const translated = t(key);
        showNotification((translated && translated !== key) ? translated : (localStorage.getItem('aethera_language') === 'en' ? 'Login successful' : 'Berhasil masuk'));
        // Create & store local session id, and push to profiles
        try {
            let localId = await generateSessionId();
            localStorage.setItem('aethera_session_id', localId);
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session?.user?.id) {
                await supabaseClient.from('profiles').upsert({ id: session.user.id, last_session_id: localId, email: session.user.email });
            }
        } catch(_) {}
        await checkLogin();
    }
}

// Forgot password: send reset link to entered email
export async function handleForgotPassword() {
    try {
        const email = document.getElementById('login-email')?.value?.trim();
        if (!email) { showNotification(t('email_label') || 'Email', 'warning'); return; }
        const redirectTo = window.location.origin;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        showNotification(t('password_reset_sent') || 'Password reset link sent to your email.', 'success');
    } catch (e) {
        showNotification(e.message || 'Failed to send reset link', 'error');
    }
}

export async function handleLogout() {
    try {
        // Try to sign out from Supabase, but don't wait for network response
        supabaseClient.auth.signOut({ scope: 'local' }).catch(error => {
            // Ignore network errors during logout
            console.warn('Network error during logout (ignored):', error.message);
        });
        
        // Immediately clear localStorage and proceed with logout
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('aethera_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Also clear Supabase session from localStorage
        const supabaseKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-')) {
                supabaseKeys.push(key);
            }
        }
        supabaseKeys.forEach(key => localStorage.removeItem(key));
        
        // Show logout notification
        showNotification(t('notification_logout_success'), 'success');
        
        // Reload the page to reset the app state
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        console.warn('Logout error:', error.message);
        // Force logout by clearing all data and reloading
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }
}

