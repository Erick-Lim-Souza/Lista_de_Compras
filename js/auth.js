/**
 * js/auth.js — v3.2
 * ─────────────────────────────────────────────────────────────
 * Gerencia a autenticação de usuários utilizando o Supabase.
 *
 * Novidades v3.2 (compatíveis com app.js v3.4 e storage.js v3.2):
 *   • ready        → Promise que resolve quando init() termina
 *   • getSession() → sessão fresca (assíncrono)
 *   • signOut()    → logout
 *   • updateProfile({ nome, sobrenome, apelido, avatar_url })
 *   • updatePassword(newPassword)
 *   • deleteAccount() → RPC delete_my_account (se existir) + signOut
 *
 * getUser() permanece SÍNCRONO (retorna cache) para compatibilidade.
 * ─────────────────────────────────────────────────────────────
 */
'use strict';

const Auth = (() => {

  // ═══════════════════════════════════════════════════════════
  // ESTADO
  // ═══════════════════════════════════════════════════════════
  let currentUser = null;
  let supabase = null;

  // Promise que resolve quando init() termina (sucesso OU erro).
  // O app.js faz `await Auth.ready` antes de decidir se abre
  // a tela de login ou entra direto — isso evita a race condition
  // em que o app.js rodava antes do auth.js ler a sessão.
  let _resolveReady;
  const ready = new Promise(resolve => { _resolveReady = resolve; });

  // ═══════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════
  async function init() {
    supabase = window.supabaseClient;

    if (!supabase) {
      console.error('[auth] window.supabaseClient não encontrado. ' +
                    'Verifique se js/supabase-client.js foi carregado antes.');
      _resolveReady?.();
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      // Atualiza estado + UI do menu
      _handleSession(session);

      // Reage a login/logout em qualquer aba
      supabase.auth.onAuthStateChange((_event, session) => {
        _handleSession(session);
      });

      // Registra listeners de UI (formulários de login/cadastro/etc.)
      _setupListeners();

    } catch (error) {
      console.error('[auth] Erro ao inicializar:', error.message);
    } finally {
      // Libera o await do app.js independente de sucesso ou falha
      _resolveReady?.();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // UI DO MENU (perfil)
  // ═══════════════════════════════════════════════════════════
  function _handleSession(session) {
    currentUser = session?.user || null;

    const modal            = document.getElementById('authModal');
    const btnOpenLogin     = document.getElementById('btnOpenLogin');
    const btnLogout        = document.getElementById('btnLogout');
    const menuUserName     = document.getElementById('menuUserName');
    const menuUserEmail    = document.getElementById('menuUserEmail');
    const menuUserInitials = document.getElementById('menuUserInitials');
    const menuUserPhoto    = document.getElementById('menuUserPhoto');

    if (currentUser) {
      // ── LOGADO ──────────────────────────────────────────────
      if (modal) {
        modal.classList.remove('show', 'active', 'visible');
        modal.style.display = 'none';
      }

      if (btnOpenLogin) btnOpenLogin.style.display = 'none';
      if (btnLogout)    btnLogout.style.display    = 'block';

      const meta     = currentUser.user_metadata || {};
      const nickname = meta.apelido
                    || meta.nome
                    || (currentUser.email || '').split('@')[0]
                    || 'Usuário';

      // Aceita tanto avatar_url quanto photo_url (compatibilidade)
      const photoUrl = meta.avatar_url || meta.photo_url || '';

      if (menuUserName)  menuUserName.textContent  = nickname;
      if (menuUserEmail) menuUserEmail.textContent = currentUser.email || '';

      if (menuUserPhoto && menuUserInitials) {
        if (photoUrl) {
          menuUserPhoto.src = photoUrl;
          menuUserPhoto.style.display    = 'block';
          menuUserInitials.style.display = 'none';
        } else {
          menuUserInitials.textContent   = nickname.charAt(0).toUpperCase();
          menuUserPhoto.style.display    = 'none';
          menuUserInitials.style.display = 'flex';
        }
      }
    } else {
      // ── DESLOGADO ───────────────────────────────────────────
      if (btnOpenLogin) btnOpenLogin.style.display = 'block';
      if (btnLogout)    btnLogout.style.display    = 'none';

      if (menuUserName)  menuUserName.textContent  = 'Visitante';
      if (menuUserEmail) menuUserEmail.textContent = 'Faça login para sincronizar';

      if (menuUserPhoto && menuUserInitials) {
        menuUserPhoto.style.display    = 'none';
        menuUserPhoto.src              = '';
        menuUserInitials.textContent   = '👤';
        menuUserInitials.style.display = 'flex';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LISTENERS DE UI (login, cadastro, recuperação, logout)
  // ═══════════════════════════════════════════════════════════
  function _setupListeners() {
    const msgEl       = document.getElementById('authMessage');
    const authModal   = document.getElementById('authModal');
    const btnOpenLogin = document.getElementById('btnOpenLogin');
    const btnLogout   = document.getElementById('btnLogout');

    const showMsg = (text, isError = true) => {
      if (!msgEl) return;
      msgEl.textContent = text;
      msgEl.style.color = isError
        ? 'var(--danger, #ff4444)'
        : 'var(--success, #4caf50)';
    };

    // ── Abrir modal de login ────────────────────────────────
    btnOpenLogin?.addEventListener('click', () => {
      if (authModal) {
        authModal.classList.add('show', 'active', 'visible');
        authModal.style.display = 'flex';
        authModal.removeAttribute('data-force');
      }
      if (typeof window.switchAuthView === 'function') {
        window.switchAuthView('loginView');
      }
      if (msgEl) msgEl.textContent = '';
    });

    // ── AÇÃO DE LOGIN ───────────────────────────────────────
    document.getElementById('btnLoginSubmit')?.addEventListener('click', async () => {
      const email    = document.getElementById('loginEmail')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;

      if (!email || !password) return showMsg('Preencha e-mail e senha.');

      showMsg('Entrando...', false);
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        showMsg('Erro: ' + (
          error.message.includes('Invalid login')
            ? 'E-mail ou senha incorretos.'
            : error.message
        ));
      }
      // Sucesso: onAuthStateChange dispara SIGNED_IN → app.js entra
    });

    // ── AÇÃO DE CADASTRO ────────────────────────────────────
    document.getElementById('btnSignupSubmit')?.addEventListener('click', async () => {
      const nome            = document.getElementById('signupNome')?.value.trim();
      const sobrenome       = document.getElementById('signupSobrenome')?.value.trim();
      const apelido         = document.getElementById('signupApelido')?.value.trim();
      const email           = document.getElementById('signupEmail')?.value.trim();
      const password        = document.getElementById('signupPassword')?.value;
      const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
      const terms           = document.getElementById('signupTerms')?.checked;

      if (!nome || !sobrenome || !apelido || !email || !password) {
        return showMsg('Preencha todos os campos obrigatórios.');
      }
      if (password !== confirmPassword) return showMsg('As senhas não coincidem.');
      if (password.length < 6)          return showMsg('A senha deve ter no mínimo 6 caracteres.');
      if (!terms)                       return showMsg('Você precisa aceitar os Termos de Uso.');

      showMsg('Criando conta...', false);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome, sobrenome, apelido }
        }
      });

      if (error) {
        showMsg('Erro: ' + error.message);
      } else {
        showMsg('Conta criada com sucesso! Redirecionando...', false);
        setTimeout(() => {
          if (typeof window.switchAuthView === 'function') {
            window.switchAuthView('loginView');
          }
          const emailEl = document.getElementById('loginEmail');
          const passEl  = document.getElementById('loginPassword');
          if (emailEl) emailEl.value = email;
          if (passEl)  passEl.value  = password;
          showMsg('Faça login com sua nova conta.', false);
        }, 1500);
      }
    });

    // ── AÇÃO DE RECUPERAR SENHA ─────────────────────────────
    document.getElementById('btnForgotSubmit')?.addEventListener('click', async () => {
      const email = document.getElementById('forgotEmail')?.value.trim();
      if (!email) return showMsg('Digite seu e-mail cadastrado.');

      showMsg('Enviando link...', false);
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        showMsg('Erro: ' + error.message);
      } else {
        showMsg('Link de recuperação enviado para seu e-mail!', false);
      }
    });

    // ── AÇÃO DE LOGOUT ──────────────────────────────────────
    btnLogout?.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('[auth] Erro ao sair:', error.message);

      const mainMenuModal = document.getElementById('mainMenuModal');
      if (mainMenuModal) {
        mainMenuModal.classList.remove('show', 'active', 'visible');
        mainMenuModal.style.display = 'none';
      }
      // O app.js reage via onAuthStateChange('SIGNED_OUT') no final do arquivo
    });
  }

  // ═══════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════

  /**
   * Retorna o usuário atual (SÍNCRONO, do cache).
   * null se deslogado.
   *
   * Compatível com app.js e storage.js v3.2 — ambos esperam
   * um objeto com `.id` ou null.
   */
  function getUser() {
    return currentUser;
  }

  /**
   * Retorna a sessão fresca do Supabase (ASSÍNCRONO).
   * Sempre busca da fonte, não usa cache.
   * null em caso de erro ou sessão inexistente.
   */
  async function getSession() {
    if (!supabase) supabase = window.supabaseClient;
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data?.session || null;
    } catch {
      return null;
    }
  }

  /** Faz logout. Retorna true em sucesso, false em erro. */
  async function signOut() {
    if (!supabase) supabase = window.supabaseClient;
    if (!supabase) return false;

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[auth] signOut:', error);
      return false;
    }
    return true;
  }

  /**
   * Atualiza metadados do perfil do usuário.
   *
   * @param {Object} data
   *   { nome?, sobrenome?, apelido?, avatar_url?, photo_url? }
   *
   * `photo_url` é convertido para `avatar_url` internamente
   * (compatibilidade com chamadas antigas do app.js).
   */
  async function updateProfile(data = {}) {
    if (!supabase) supabase = window.supabaseClient;
    if (!supabase) return false;

    const meta = {};
    if (data.nome       !== undefined) meta.nome       = data.nome;
    if (data.sobrenome  !== undefined) meta.sobrenome  = data.sobrenome;
    if (data.apelido    !== undefined) meta.apelido    = data.apelido;
    if (data.avatar_url !== undefined) meta.avatar_url = data.avatar_url;
    if (data.photo_url  !== undefined) meta.avatar_url = data.photo_url;

    try {
      const { error } = await supabase.auth.updateUser({ data: meta });
      if (error) throw error;

      // Re-sincroniza o usuário atual com o que voltou do servidor
      const session = await getSession();
      currentUser = session?.user || currentUser;
      _handleSession({ user: currentUser });

      return true;
    } catch (error) {
      console.error('[auth] updateProfile:', error);
      return false;
    }
  }

  /**
   * Atualiza a senha do usuário.
   * Retorna false se a senha for inválida (< 6 chars).
   */
  async function updatePassword(newPassword) {
    if (!supabase) supabase = window.supabaseClient;
    if (!supabase) return false;
    if (!newPassword || newPassword.length < 6) return false;

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[auth] updatePassword:', error);
      return false;
    }
  }

  /**
   * Exclui a conta do usuário.
   *
   * Estratégia:
   *   1. Tenta chamar a RPC `delete_my_account` (se existir no Supabase)
   *      — apaga os dados e o registro em auth.users
   *   2. Em qualquer caso, faz signOut para limpar a sessão local
   *
   * Se a RPC não existir, o método NÃO falha — só faz signOut.
   * Nesse caso, o usuário precisa pedir a exclusão em outro lugar.
   */
  async function deleteAccount() {
    if (!supabase) supabase = window.supabaseClient;
    if (!supabase) return false;

    try {
      const { error: rpcError } = await supabase.rpc('delete_my_account');
      if (rpcError) {
        console.warn('[auth] RPC delete_my_account indisponível:', rpcError.message);
      }
    } catch (e) {
      console.warn('[auth] deleteAccount RPC:', e);
    }

    try {
      await supabase.auth.signOut();
    } catch {}

    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════
  // Se o DOM já passou de "loading", chama init direto.
  // Senão, espera o evento.
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    // Em casos raros de carregamento tardio, agenda com microtask
    setTimeout(init, 0);
  }

  // ═══════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════
  return {
    // Estado / ciclo de vida
    init,
    ready,       // Promise — aguarda init() terminar

    // Usuário / sessão
    getUser,     // SÍNCRONO  → cache
    getSession,  // ASSÍNCRONO → fresh do Supabase

    // Ações
    signOut,
    updateProfile,
    updatePassword,
    deleteAccount
  };

})();