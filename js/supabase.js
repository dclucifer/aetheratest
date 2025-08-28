// js/supabase.js

// Untuk vanilla JS di Vercel, aman untuk meletakkan kunci publik ini langsung di sini.
// Keamanan diatur oleh Row Level Security (RLS) di dashboard Supabase Anda.
const SUPABASE_URL = 'https://afrqqsjdarffcpimdwvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmcnFxc2pkYXJmZmNwaW1kd3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMjc2NDcsImV4cCI6MjA3MDkwMzY0N30.Stlhcf_qgWsV1u5RUxSH5_Ocr1iJd_d04yv-rtKT1xQ';

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Hindari auto-refresh di background yang memicu error "Failed to fetch" saat offline
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce'
    },
    global: {
        headers: {
            'X-Client-Info': 'aethera-studio@1.0.0'
        }
    }
});
