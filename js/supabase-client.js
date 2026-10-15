/**
 * js/supabase-client.js
 * ─────────────────────────────────────────────────────────────
 * Inicialização do cliente Supabase.
 * ─────────────────────────────────────────────────────────────
 */
'use strict';

// TODO: Substitua pelas suas chaves reais do painel do Supabase (Settings > API)
const SUPABASE_URL = 'https://bwehngthflzpqzwowxym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZWhuZ3RoZmx6cHF6d293eHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1OTgyNTQsImV4cCI6MjEwNjE3NDI1NH0.MrC1azMmti_XOt7ETm2vbcWC4mswUQ9CpLtkM1-aHbg';

// Inicializa o cliente globalmente para ser usado pelos outros módulos (auth.js, storage.js)
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase Client inicializado com sucesso.');