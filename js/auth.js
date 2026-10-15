/**
 * js/auth.js
 * ─────────────────────────────────────────────────────────────
 * Gerencia a autenticação de usuários utilizando o Supabase.
 * ─────────────────────────────────────────────────────────────
 */
'use strict';

const Auth = (() => {
  let currentUser = null;
  const supabase = window.supabaseClient;

  async function init() {
    if (!supabase) {
      console.error('Supabase client não encontrado.');
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      _handleSession(session);

      supabase.auth.onAuthStateChange((_event, session) => {
        _handleSession(session);
      });

      _setupListeners();
    } catch (error) {
      console.error('Erro ao inicializar autenticação:', error.message);
    }
  }

  function _handleSession(session) {
    currentUser = session?.user || null;

    const modal = document.getElementById('authModal');
    const btnOpenLogin = document.getElementById('btnOpenLogin');
    const btnLogout = document.getElementById('btnLogout');

    const menuUserName = document.getElementById('menuUserName');
    const menuUserEmail = document.getElementById('menuUserEmail');
    const menuUserInitials = document.getElementById('menuUserInitials');
    const menuUserPhoto = document.getElementById('menuUserPhoto');

    if (currentUser) {
      // USUÁRIO LOGADO
      if (modal) {
        modal.classList.remove('show', 'active', 'visible');
        modal.style.display = 'none';
      }

      if (btnOpenLogin) btnOpenLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = 'block';

      // Pega o Apelido ou Nome dos metadados, se não tiver usa o email
      const nickname = currentUser.user_metadata?.apelido || currentUser.user_metadata?.nome || currentUser.email.split('@')[0];
      const photoUrl = currentUser.user_metadata?.avatar_url;

      if (menuUserName) menuUserName.textContent = nickname;
      if (menuUserEmail) menuUserEmail.textContent = currentUser.email;

      if (menuUserPhoto && menuUserInitials) {
        if (photoUrl) {
          menuUserPhoto.src = photoUrl;
          menuUserPhoto.style.display = 'block';
          menuUserInitials.style.display = 'none';
        } else {
          menuUserInitials.textContent = nickname.charAt(0).toUpperCase();
          menuUserPhoto.style.display = 'none';
          menuUserInitials.style.display = 'flex';
        }
      }
    } else {
      // USUÁRIO DESLOGADO
      if (btnOpenLogin) btnOpenLogin.style.display = 'block';
      if (btnLogout) btnLogout.style.display = 'none';

      if (menuUserName) menuUserName.textContent = 'Visitante';
      if (menuUserEmail) menuUserEmail.textContent = 'Faça login para sincronizar';

      if (menuUserPhoto && menuUserInitials) {
        menuUserPhoto.style.display = 'none';
        menuUserPhoto.src = '';
        menuUserInitials.textContent = '👤';
        menuUserInitials.style.display = 'flex';
      }
    }
  }

  function _setupListeners() {
    const msgEl = document.getElementById('authMessage');
    const authModal = document.getElementById('authModal');
    const btnOpenLogin = document.getElementById('btnOpenLogin');
    const btnLogout = document.getElementById('btnLogout');

    const showMsg = (text, isError = true) => {
      if (!msgEl) return;
      msgEl.textContent = text;
      msgEl.style.color = isError ? 'var(--danger, #ff4444)' : 'var(--success, #4caf50)';
    };

    // Abrir modal de login
    btnOpenLogin?.addEventListener('click', () => {
      if (authModal) {
        authModal.style.display = 'flex';
        authModal.classList.add('visible');
        // Garante que abra na tela de login
        if(typeof switchAuthView === 'function') switchAuthView('loginView');
      }
      if (msgEl) msgEl.textContent = '';
    });

    // --- AÇÃO DE LOGIN ---
    document.getElementById('btnLoginSubmit')?.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) return showMsg('Preencha e-mail e senha.');

      showMsg('Entrando...', false);
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        showMsg('Erro: ' + (error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message));
      }
    });

    // --- AÇÃO DE CADASTRO ---
    document.getElementById('btnSignupSubmit')?.addEventListener('click', async () => {
      const nome = document.getElementById('signupNome').value.trim();
      const sobrenome = document.getElementById('signupSobrenome').value.trim();
      const apelido = document.getElementById('signupApelido').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('signupConfirmPassword').value;
      const terms = document.getElementById('signupTerms').checked;

      if (!nome || !sobrenome || !apelido || !email || !password) {
        return showMsg('Preencha todos os campos obrigatórios.');
      }
      if (password !== confirmPassword) {
        return showMsg('As senhas não coincidem.');
      }
      if (password.length < 6) {
        return showMsg('A senha deve ter no mínimo 6 caracteres.');
      }
      if (!terms) {
        return showMsg('Você precisa aceitar os Termos de Uso.');
      }

      showMsg('Criando conta...', false);

      // Envia os dados extras (nome, sobrenome, apelido) para os metadados do Supabase
      const { error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            nome: nome,
            sobrenome: sobrenome,
            apelido: apelido
          }
        }
      });

      if (error) {
        showMsg('Erro: ' + error.message);
      } else {
        showMsg('Conta criada com sucesso! Redirecionando...', false);
        // Como o confirm email está desativado, ele loga sozinho, mas por garantia:
        setTimeout(() => {
          if(typeof switchAuthView === 'function') switchAuthView('loginView');
          document.getElementById('loginEmail').value = email;
          document.getElementById('loginPassword').value = password;
          showMsg('Faça login com sua nova conta.', false);
        }, 1500);
      }
    });

    // --- AÇÃO DE RECUPERAR SENHA ---
    document.getElementById('btnForgotSubmit')?.addEventListener('click', async () => {
      const email = document.getElementById('forgotEmail').value;
      if (!email) return showMsg('Digite seu e-mail cadastrado.');

      showMsg('Enviando link...', false);
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        showMsg('Erro: ' + error.message);
      } else {
        showMsg('Link de recuperação enviado para seu e-mail!', false);
      }
    });

    // --- AÇÃO DE LOGOUT ---
    btnLogout?.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Erro ao sair:', error.message);

      const mainMenuModal = document.getElementById('mainMenuModal');
      if (mainMenuModal) {
        mainMenuModal.classList.remove('show', 'active', 'visible');
        mainMenuModal.style.display = 'none';
      }
    });
  }

  function getUser() {
    return currentUser;
  }

  window.addEventListener('DOMContentLoaded', init);

  return { init, getUser };
})();