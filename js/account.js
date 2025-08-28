// js/account.js
import { supabaseClient } from './supabase.js';
import { showNotification, setLoadingState, elements } from './utils.js';
import { t } from './i18n.js';

export async function loadAccountPage() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) {
      showNotification(t('notification_login_required') || 'Silakan login terlebih dahulu', 'warning');
      return;
    }
    const user = session.user;
    // Prefill Email
    const emailEl = document.getElementById('acc-email');
    if (emailEl) emailEl.value = user.email || '';

    // Load profile from table profiles
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      const fn = document.getElementById('acc-fullname');
      const un = document.getElementById('acc-username');
      const bio = document.getElementById('acc-bio');
      if (fn) fn.value = profile.full_name || '';
      if (un) un.value = profile.username || '';
      if (bio) bio.value = profile.bio || '';
    }
  } catch (_) {}
}

export function initAccountHandlers() {
  const saveBtn = document.getElementById('acc-save-profile');
  const updPass = document.getElementById('acc-update-password');
  const sendReset = document.getElementById('acc-send-reset');

  saveBtn?.addEventListener('click', async () => {
    setLoadingState(true, saveBtn);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');
      const payload = {
        id: session.user.id,
        full_name: (document.getElementById('acc-fullname')?.value || '').trim(),
        username: (document.getElementById('acc-username')?.value || '').trim(),
        bio: (document.getElementById('acc-bio')?.value || '').trim(),
        updated_at: new Date().toISOString()
      };
      const { error } = await supabaseClient.from('profiles').upsert(payload);
      if (error) {
        if (String(error.code) === '23505') {
          showNotification(t('username_taken') || 'Username sudah dipakai', 'error');
        } else {
          showNotification(error.message || 'Gagal menyimpan profil', 'error');
        }
      } else {
        showNotification(t('profile_saved') || 'Profil disimpan', 'success');
      }
    } catch (e) {
      showNotification(e.message || 'Gagal menyimpan', 'error');
    } finally { setLoadingState(false, saveBtn); }
  });

  updPass?.addEventListener('click', async () => {
    setLoadingState(true, updPass);
    try {
      const pwd = (document.getElementById('acc-password')?.value || '').trim();
      if (!pwd || pwd.length < 6) { showNotification(t('password_too_short')||'Password minimal 6 karakter', 'warning'); return; }
      const { error } = await supabaseClient.auth.updateUser({ password: pwd });
      if (error) throw error;
      showNotification(t('password_updated') || 'Password diperbarui', 'success');
      document.getElementById('acc-password').value='';
    } catch (e) {
      showNotification(e.message || 'Gagal update password', 'error');
    } finally { setLoadingState(false, updPass); }
  });

  // Send password reset link to current email
  sendReset?.addEventListener('click', async () => {
    setLoadingState(true, sendReset);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.user?.email) throw new Error('Not authenticated');
      const redirectTo = window.location.origin;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(session.user.email, { redirectTo });
      if (error) throw error;
      showNotification(t('password_reset_sent') || 'Link reset password dikirim ke email Anda.', 'success');
    } catch (e) {
      showNotification(e.message || 'Gagal mengirim link reset', 'error');
    } finally { setLoadingState(false, sendReset); }
  });
}


