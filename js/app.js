/* ============================================================
   app.js :: Lista de Compras Inteligente (v3.4)
   ─────────────────────────────────────────────────────────────
   • Força login antes do acesso
   • Aguarda Auth.ready antes de decidir a tela inicial
   • Alinhado com auth.js v3.2, storage.js v3.2 e ui.js v3.2
   • Alinhado com o schema Supabase (lists, list_items, payments,
     custom_categories, price_history, user_settings)
   ─────────────────────────────────────────────────────────────
   ============================================================ */

class ShoppingList {
  constructor() {
    this.items = [];
    this.currentListType = 'Supermercado';
    this.listTypes = {
      Supermercado:        { emoji: '🛒', categories: ['Alimentos','Hortifruti','Carnes','Limpeza','Higiene','Bebidas','Outros'] },
      'Feira livre':       { emoji: '🥦', categories: ['Hortifruti','Carnes','Outros'] },
      Farmácia:            { emoji: '💊', categories: ['Higiene','Outros'] },
      Petshop:             { emoji: '🐾', categories: ['Alimentos','Higiene','Outros'] },
      'Material escolar':  { emoji: '✏️', categories: ['Papelaria','Outros'] },
    };

    this.customCategories   = [];
    this.priceHistoryCache  = {};   // { nome: [{ ws, rt, date }] }
    this.monthlyBudget      = 0;
    this.filter             = 'all';
    this.savedLists         = [];   // listas completas (com items+payments)
    this.activeListId       = null; // id da lista em memória (histórico)
    this.currentDraftId     = null; // id do draft atual no Supabase
    this.suggestionManager  = null;
    this.user               = null;

    // Guards
    this._elementsBound = false;
    this._eventsBound   = false;
    this._initialized   = false;
  }

  // ═══════════════════════════════════════════════════════════
  // AUTENTICAÇÃO
  // ═══════════════════════════════════════════════════════════

  /**
   * Resolve o usuário autenticado — sempre busca do Supabase (fresco).
   *
   * Prefere getSession() (assíncrono, sempre atual) sobre getUser()
   * (síncrono, do cache). Isso evita a race condition onde o app.js
   * roda antes do auth.js terminar de ler a sessão.
   *
   * Aceita retornos:
   *   • { data: { user } }  (Supabase oficial)
   *   • { user }            (wrapper)
   *   • user direto         (wrapper síncrono)
   */
  async _resolveUser() {
    try {
      // 1. Preferir getSession() — assíncrono, sempre fresco
      if (typeof Auth.getSession === 'function') {
        const session = await Auth.getSession();
        const u = session?.user || null;
        if (u && u.id) return u;
      }

      // 2. Fallback: getUser() (síncrono, cache)
      const res = await Auth.getUser();
      const u = res?.data?.user || res?.user || res;
      return (u && u.id) ? u : null;
    } catch {
      return null;
    }
  }

  async _checkAuth() {
    const user = await this._resolveUser();
    this.user = user;
    return user;
  }

  _forceAuth() {
    const authModal = document.getElementById('authModal');
    if (!authModal) return;
    authModal.classList.add('show', 'active', 'visible');
    authModal.style.display = 'flex';
    authModal.setAttribute('data-force', 'true');

    const closeBtn = document.getElementById('authClose');
    if (closeBtn) closeBtn.style.display = 'none';

    const menuModal = document.getElementById('mainMenuModal');
    if (menuModal) {
      menuModal.classList.remove('show', 'active', 'visible');
      menuModal.style.display = 'none';
    }
  }

  _hideForceAuth() {
    const authModal = document.getElementById('authModal');
    if (!authModal) return;
    authModal.classList.remove('show', 'active', 'visible');
    authModal.style.display = 'none';
    const closeBtn = document.getElementById('authClose');
    if (closeBtn) closeBtn.style.display = '';
    authModal.removeAttribute('data-force');
  }

  // ═══════════════════════════════════════════════════════════
  // INICIALIZAÇÃO
  // ═══════════════════════════════════════════════════════════

  async initApp() {
    if (this._initialized) return;

    const user = await this._checkAuth();
    if (!user) { this._forceAuth(); return; }

    if (!this._elementsBound) {
      this._bindElements();
      this._elementsBound = true;
    }

    // Carrega dados
    await this._loadAllData();

    // Tema
    const theme = localStorage.getItem('theme') || 'light';
    UI.applyTheme(theme);

    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }

    this._updateMenuProfile();
    this._updateCategories();
    this.render();
    this._updateMiniDash();

    // Se não há itens, oferece seleção de tipo
    if (this.items.length === 0) {
      UI.showListTypeSelection(this.listTypes, type => {
        this.currentListType = type;
        this._updateCategories();
        this.render();
      });
    }

    this._initialized = true;
  }

  /**
   * Carrega itens, categorias, preços, orçamento e histórico
   * em uma única rodada, tratando cada falha individualmente.
   */
  async _loadAllData() {
    // 1. Itens da lista atual (draft)
    try {
      this.items = await Storage.getCurrentList() || [];
    } catch (e) {
      console.error('[app] getCurrentList:', e);
      this.items = [];
    }

    // 2. Categorias personalizadas
    try {
      const cats = await Storage.getCustomCategories() || [];
      this.customCategories = cats.map(c => ({
        name:  c.name,
        emoji: c.emoji || '📦',
        list_type: c.list_type || 'Supermercado'
      }));
    } catch (e) {
      console.error('[app] getCustomCategories:', e);
      this.customCategories = [];
    }

    // 3. Histórico de preços
    try {
      const raw = await Storage.getPriceHistory() || [];
      this.priceHistoryCache = this._normalizePriceHistory(raw);
    } catch (e) {
      console.error('[app] getPriceHistory:', e);
      this.priceHistoryCache = {};
    }

    // 4. Orçamento mensal
    try {
      const dash = await Storage.getDashboardData();
      this.monthlyBudget = dash?.budget || 0;
    } catch (e) {
      console.error('[app] getDashboardData:', e);
      this.monthlyBudget = 0;
    }

    // 5. Listas salvas (histórico)
    try {
      this.savedLists = await Storage.getSavedLists() || [];
    } catch (e) {
      console.error('[app] getSavedLists:', e);
      this.savedLists = [];
    }
  }

  /**
   * Converte o array cru de price_history (rows) em
   * { productName: [{ ws, rt, date }] } para o SuggestionManager.
   */
  _normalizePriceHistory(rows) {
    const map = {};
    for (const row of rows) {
      const name = row.product_name || row.name;
      if (!name) continue;
      if (!map[name]) map[name] = [];
      map[name].push({
        ws:   parseFloat(row.wholesale_price) || 0,
        rt:   parseFloat(row.retail_price)    || 0,
        date: row.recorded_date || new Date().toISOString()
      });
    }
    for (const k in map) {
      map[k].sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    return map;
  }

  // ═══════════════════════════════════════════════════════════
  // BIND DOM
  // ═══════════════════════════════════════════════════════════

  _bindElements() {
    // Formulário
    this.itemForm     = document.getElementById('itemForm');
    this.itemInput    = document.getElementById('itemInput');
    this.catSelect    = document.getElementById('categorySelect');
    this.unitSelect   = document.getElementById('unitSelect');
    this.qtyInput     = document.getElementById('quantityInput');
    this.wsPriceInput = document.getElementById('priceWholesaleInput');
    this.rtPriceInput = document.getElementById('priceRetailInput');

    // Lista
    this.itemListEl   = document.getElementById('itemList');
    this.emptyState   = document.getElementById('emptyState');

    // Totais
    this.totalItems   = document.getElementById('totalItems');
    this.totalGeneral = document.getElementById('totalGeneral');
    this.totalEconomy = document.getElementById('totalEconomy');

    // Ações
    this.clearAllBtn  = document.getElementById('clearAllButton');
    this.shareBtn     = document.getElementById('shareButton');
    this.filterBtns   = document.querySelectorAll('.filter-btn');

    // Mini dash
    this.miniDashContainer = document.getElementById('miniDashContainer');
    this.miniDashBudget    = document.getElementById('miniDashBudget');
    this.miniDashSpent     = document.getElementById('miniDashSpent');
    this.miniDashSpentCard = document.getElementById('miniDashSpentCard');

    // Salvar
    this.listNameInput = document.getElementById('listNameInput');
    this.listDateInput = document.getElementById('listDateInput');
    this.marketInput   = document.getElementById('marketInput');
    this.pmRows        = document.getElementById('pmRows');

    // Histórico/comparar
    this.historyListEl  = document.getElementById('historyList');
    this.compareList1   = document.getElementById('compareList1');
    this.compareList2   = document.getElementById('compareList2');
    this.compareResults = document.getElementById('compareResults');

    // Sugestões
    this.suggestTypeTabs = document.getElementById('suggestTypeTabs');
    this.suggestList     = document.getElementById('suggestList');
    this.suggestSummary  = document.getElementById('suggestSummary');

    // Config
    this.profileName            = document.getElementById('profileName');
    this.profilePhotoUrl        = document.getElementById('profilePhotoUrl');
    this.profileNewPassword     = document.getElementById('profileNewPassword');
    this.customCategoriesList   = document.getElementById('customCategoriesList');
    this.currentListTypeDisplay = document.getElementById('currentListTypeDisplay');
    this.monthlyBudgetInput     = document.getElementById('monthlyBudgetInput');
  }

  // ═══════════════════════════════════════════════════════════
  // BIND EVENTOS
  // ═══════════════════════════════════════════════════════════

  _bindEvents() {
    // ── Formulário
    this.itemForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addItem();
    });

    // ── Menu Principal
    const menuBtn   = document.getElementById('mainMenuBtn');
    const menuModal = document.getElementById('mainMenuModal');
    const menuClose = document.getElementById('mainMenuClose');

    const closeMenu = () => {
      if (!menuModal) return;
      menuModal.classList.remove('show', 'active', 'visible');
      menuModal.style.display = 'none';
    };

    menuBtn?.addEventListener('click', () => {
      if (!menuModal) return;
      menuModal.classList.add('show', 'active', 'visible');
      menuModal.style.display = 'flex';
    });
    menuClose?.addEventListener('click', closeMenu);

    ['historyButton', 'compareListsButton', 'configButton', 'btnOpenLogin']
      .forEach(id => document.getElementById(id)?.addEventListener('click', closeMenu));

    // ── Botão "Entrar / Cadastrar": gerenciado pelo auth.js v3.2
    //    (não duplicar listener aqui)

    // ── Botão "Sair": gerenciado pelo auth.js v3.2
    //    O app.js reage via onAuthStateChange('SIGNED_OUT') no final

    // ── Limpar lista
    this.clearAllBtn?.addEventListener('click', () => {
      UI.showConfirm('Tem certeza que deseja limpar a lista?', async () => {
        this.items = [];
        await this._persistItems();
        this.render();
        UI.showToast('Lista limpa 🧹');
      });
    });

    // ── Compartilhar
    this.shareBtn?.addEventListener('click', () => {
      const text = this.items.map(i => `${i.name} (${i.quantity}${i.unit})`).join('\n');
      if (navigator.share) {
        navigator.share({ title: 'Lista de Compras', text }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text).then(() => UI.showToast('Lista copiada!'));
      }
    });

    // ── Filtros
    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filter = btn.dataset.filter;
        this.render();
      });
    });

    // ── Exportação
    document.getElementById('exportTxt')?.addEventListener('click', () => Export.exportTXT(this.items));
    document.getElementById('exportPdf')?.addEventListener('click', () => Export.exportPDF(this.items));
    document.getElementById('exportExcel')?.addEventListener('click', () => Export.exportCSV(this.items));

    // ── Histórico / comparar
    document.getElementById('historyButton')?.addEventListener('click', () => this._openHistory());
    document.getElementById('historyClose')?.addEventListener('click', () => UI.hideModal('historyModal'));
    document.getElementById('compareListsButton')?.addEventListener('click', () => this._openCompare());
    document.getElementById('compareClose')?.addEventListener('click', () => UI.hideModal('compareModal'));
    document.getElementById('compareExecute')?.addEventListener('click', () => this._executeCompare());

    // ── Salvar lista
    document.getElementById('saveListButton')?.addEventListener('click', () => this._openSaveList());
    document.getElementById('saveConfirm')?.addEventListener('click', () => this._confirmSaveList());
    document.getElementById('saveCancel')?.addEventListener('click', () => UI.hideModal('saveListModal'));

    // ── Nova lista
    document.getElementById('newListButton')?.addEventListener('click', () => {
      UI.showConfirm('Deseja iniciar uma nova lista? (a atual será salva automaticamente)', async () => {
        await this._persistItems();
        this.items = [];
        this.activeListId = null;
        this.currentListType = 'Supermercado';
        this._updateCategories();
        this.render();
        UI.showToast('Nova lista iniciada 📄');
      });
    });

    // ── Configurações
    document.getElementById('configButton')?.addEventListener('click', () => this._openConfig());
    document.getElementById('configClose')?.addEventListener('click', () => UI.hideModal('configModal'));
    document.getElementById('btnSaveProfile')?.addEventListener('click', () => this._saveProfile());
    document.getElementById('btnDeleteAccount')?.addEventListener('click', () => this._deleteAccount());
    document.getElementById('btnGeneralSettings')?.addEventListener('click', () => this._openGeneralSettings());
    document.getElementById('changeListType')?.addEventListener('click', () => this._changeListType());
    document.getElementById('addCustomCategory')?.addEventListener('click', () => this._addCustomCategory());
    document.getElementById('backupDownload')?.addEventListener('click', () => this._downloadBackup());
    document.getElementById('backupUpload')?.addEventListener('click', () => document.getElementById('backupFileInput').click());
    document.getElementById('backupFileInput')?.addEventListener('change', (e) => this._restoreBackup(e));
    document.getElementById('btnInviteFriends')?.addEventListener('click', () => this._inviteFriends());
    document.getElementById('versionButton')?.addEventListener('click', () => {
      alert('Versão 3.4 – boot sincronizado com auth.js, perfil unificado e histórico de preços normalizado.');
    });

    // ── Sugestões
    document.getElementById('suggestButton')?.addEventListener('click', () => this._openSuggestions());
    document.getElementById('suggestClose')?.addEventListener('click', () => UI.hideModal('suggestModal'));
    document.getElementById('suggestCreate')?.addEventListener('click', () => this._createFromSuggestions());

    // ── Meta mensal
    document.getElementById('saveBudgetBtn')?.addEventListener('click', () => this._saveBudget());

    // ── Pagamentos: adicionar + remover (delegação)
    document.getElementById('pmAddBtn')?.addEventListener('click', () => this._addPaymentRow());
    this.pmRows?.addEventListener('click', (e) => {
      if (e.target.classList.contains('pay-remove')) {
        const rows = document.querySelectorAll('.pay-row');
        if (rows.length > 1) e.target.closest('.pay-row')?.remove();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PERFIL NO MENU
  // ═══════════════════════════════════════════════════════════

  _updateMenuProfile() {
    const nameEl     = document.getElementById('menuUserName');
    const emailEl    = document.getElementById('menuUserEmail');
    const initialsEl = document.getElementById('menuUserInitials');
    const photoEl    = document.getElementById('menuUserPhoto');
    const loginBtn   = document.getElementById('btnOpenLogin');
    const logoutBtn  = document.getElementById('btnLogout');

    if (this.user) {
      const meta = this.user.user_metadata || {};
      const nome = meta.apelido || meta.nome || 'Usuário';
      const photoUrl = meta.avatar_url || meta.photo_url || '';

      if (nameEl)  nameEl.textContent  = nome;
      if (emailEl) emailEl.textContent = this.user.email || '';

      if (photoEl && initialsEl) {
        if (photoUrl) {
          photoEl.src = photoUrl;
          photoEl.style.display = 'block';
          initialsEl.style.display = 'none';
        } else {
          initialsEl.textContent = nome.charAt(0).toUpperCase();
          photoEl.style.display  = 'none';
          initialsEl.style.display = 'flex';
        }
      }

      if (loginBtn)  loginBtn.style.display  = 'none';
      if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
      if (nameEl)  nameEl.textContent  = 'Visitante';
      if (emailEl) emailEl.textContent = 'Faça login para sincronizar';
      if (initialsEl) initialsEl.textContent = '👤';
      if (photoEl) photoEl.style.display = 'none';
      if (loginBtn)  loginBtn.style.display  = 'block';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORIAS
  // ═══════════════════════════════════════════════════════════

  _updateCategories() {
    if (!this.catSelect) return;
    const base   = this.listTypes[this.currentListType]?.categories || [];
    const custom = this.customCategories.map(c => c.name);
    const all    = [...new Set([...base, ...custom])];

    this.catSelect.innerHTML = all.map(cat => {
      const emoji = this._catEmoji(cat);
      return `<option value="${cat}">${emoji} ${cat}</option>`;
    }).join('');
  }

  _catEmoji(cat) {
    const map = {
      'Alimentos':'🍎','Hortifruti':'🥦','Carnes':'🍖','Limpeza':'🧽',
      'Higiene':'🧴','Bebidas':'🥤','Papelaria':'📎','Outros':'📦'
    };
    const custom = this.customCategories.find(c => c.name === cat);
    return custom?.emoji || map[cat] || '📦';
  }

  // ═══════════════════════════════════════════════════════════
  // ITENS — ADICIONAR / REMOVER / TOGGLE
  // ═══════════════════════════════════════════════════════════

  async addItem() {
    const name = this.itemInput?.value.trim();
    if (!name) return;

    const cat  = this.catSelect?.value  || 'Outros';
    const unit = this.unitSelect?.value || 'un';
    const qty  = parseFloat(this.qtyInput?.value)     || 1;
    const ws   = parseFloat(this.wsPriceInput?.value) || 0;
    const rt   = parseFloat(this.rtPriceInput?.value) || 0;

    this.items.push({
      id: this._newId(),
      name,
      category: cat,
      unit,
      quantity: qty,
      priceWholesale: ws,
      priceRetail: rt,
      completed: false
    });

    await this._persistItems();
    this.render();

    if (this.itemInput) {
      this.itemInput.value = '';
      this.itemInput.focus();
    }
    if (this.wsPriceInput) this.wsPriceInput.value = '';
    if (this.rtPriceInput) this.rtPriceInput.value = '';
  }

  async removeItem(id) {
    this.items = this.items.filter(i => i.id !== id);
    await this._persistItems();
    this.render();
  }

  async toggleItem(id) {
    const item = this.items.find(i => i.id === id);
    if (item) item.completed = !item.completed;
    await this._persistItems();
    this.render();
  }

  async _persistItems() {
    try {
      await Storage.saveCurrentList(this.items);
    } catch (e) {
      console.error('[app] saveCurrentList:', e);
      UI.showToast('Erro ao sincronizar lista.');
    }
  }

  _newId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════════

  render() {
    let filtered = this.items;
    if (this.filter === 'pending')        filtered = filtered.filter(i => !i.completed);
    else if (this.filter === 'completed') filtered = filtered.filter(i => i.completed);

    const groups = {};
    filtered.forEach(item => {
      const cat = item.category || 'Outros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    if (this.itemListEl) {
      this.itemListEl.innerHTML = Object.keys(groups).map(cat => {
        const items = groups[cat].map(i => {
          const total = (i.quantity || 0) * (i.priceRetail || i.priceWholesale || 0);
          return `
            <li class="item ${i.completed ? 'completed' : ''}" data-id="${i.id}">
              <input type="checkbox" ${i.completed ? 'checked' : ''} class="item-check">
              <span class="item-name">${this._escape(i.name)}</span>
              <span class="item-qty">${i.quantity} ${i.unit}</span>
              <span class="item-price">R$ ${total.toFixed(2)}</span>
              <button class="item-remove" aria-label="Remover">🗑️</button>
            </li>`;
        }).join('');
        return `<div class="category-group">
          <h4 class="cat-title">${this._catEmoji(cat)} ${cat}</h4>
          <ul>${items}</ul>
        </div>`;
      }).join('');
    }

    if (this.emptyState) {
      this.emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
    }

    document.querySelectorAll('#itemList .item-check').forEach(cb => {
      cb.onchange = (e) => {
        const id = e.target.closest('.item').dataset.id;
        this.toggleItem(id);
      };
    });
    document.querySelectorAll('#itemList .item-remove').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.target.closest('.item').dataset.id;
        this.removeItem(id);
      };
    });

    this._updateStats();
    this._updateMiniDash();
  }

  _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _updateStats() {
    const totalItems = this.items.length;
    const totalGeral = this.items.reduce(
      (sum, i) => sum + (i.quantity * (i.priceRetail || i.priceWholesale || 0)), 0
    );
    const economia = this.items.reduce((s, i) => {
      if (i.priceWholesale && i.priceRetail) {
        return s + i.quantity * (i.priceRetail - i.priceWholesale);
      }
      return s;
    }, 0);

    if (this.totalItems)   this.totalItems.textContent   = totalItems;
    if (this.totalGeneral) this.totalGeneral.textContent = `R$ ${totalGeral.toFixed(2)}`;
    if (this.totalEconomy) this.totalEconomy.textContent =
      economia > 0 ? `R$ ${economia.toFixed(2)}` : 'R$ 0,00';
  }

  // ═══════════════════════════════════════════════════════════
  // MINI DASHBOARD
  // ═══════════════════════════════════════════════════════════

  _updateMiniDash() {
    if (!this.miniDashContainer || !this.miniDashBudget || !this.miniDashSpent) return;

    if (this.monthlyBudget > 0) {
      this.miniDashContainer.style.display = 'flex';

      const budgetValue = this.monthlyBudget;
      const spentValue  = this._currentMonthSpent();

      this.miniDashBudget.textContent = `R$ ${budgetValue.toFixed(2)}`;
      this.miniDashSpent.textContent  = `R$ ${spentValue.toFixed(2)}`;

      if (this.miniDashSpentCard) {
        this.miniDashSpentCard.style.color =
          spentValue > budgetValue ? 'var(--danger)' : 'var(--txt-1)';
      }
    } else {
      this.miniDashContainer.style.display = 'none';
    }
  }

  _currentMonthSpent() {
    const now = new Date();
    return this.savedLists
      .filter(l => {
        const d = new Date(l.purchase_date || l.created_at || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
  }

  // ═══════════════════════════════════════════════════════════
  // SALVAR LISTA (finaliza draft)
  // ═══════════════════════════════════════════════════════════

  async _openSaveList() {
    if (this.items.length === 0) {
      UI.showToast('A lista está vazia.');
      return;
    }

    const go = confirm('Deseja salvar a lista atual?');
    if (!go) return;

    const dateInput = document.getElementById('listDateInput');
    if (dateInput) dateInput.valueAsDate = new Date();

    const marketInput = document.getElementById('marketInput');
    if (marketInput) marketInput.value = '';

    const nameInput = document.getElementById('listNameInput');
    if (nameInput && !nameInput.value) nameInput.value = '';

    this._resetPaymentRows();
    UI.showModal('saveListModal');
  }

  async _confirmSaveList() {
    const listName = document.getElementById('listNameInput')?.value.trim()
      || `Lista ${new Date().toLocaleDateString()}`;

    const rawDate = document.getElementById('listDateInput')?.value
      || new Date().toISOString().split('T')[0];

    const market = document.getElementById('marketInput')?.value || '';

    const totalGeral = this.items.reduce(
      (sum, i) => sum + i.quantity * (i.priceRetail || i.priceWholesale || 0), 0
    );

    const payments = this._getPaymentValues();

    try {
      await Storage.saveNewList(
        {
          name: listName,
          date: rawDate,
          market,
          totalGeneral: totalGeral,
          list_type: this.currentListType
        },
        this.items,
        payments
      );

      UI.hideModal('saveListModal');
      UI.showToast(`Lista "${listName}" salva! 💾`);

      try {
        this.savedLists = await Storage.getSavedLists() || [];
        const dash = await Storage.getDashboardData();
        this.monthlyBudget = dash?.budget || this.monthlyBudget;
      } catch (e) { console.error(e); }

      this.items = [];
      this.activeListId = null;
      await this._loadCurrentDraft();
      this.render();
      this._updateMiniDash();

    } catch (e) {
      console.error('[app] saveNewList:', e);
      UI.showToast('Erro ao salvar lista.');
    }
  }

  async _loadCurrentDraft() {
    try {
      this.items = await Storage.getCurrentList() || [];
    } catch (e) {
      console.error('[app] _loadCurrentDraft:', e);
      this.items = [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PAGAMENTOS — UI
  // ═══════════════════════════════════════════════════════════

  _resetPaymentRows() {
    const container = document.getElementById('pmRows');
    if (!container) return;
    const totalValue = this.items
      .reduce((s, i) => s + i.quantity * (i.priceRetail || i.priceWholesale || 0), 0)
      .toFixed(2);

    container.innerHTML = `
      <div class="pay-row">
        <select class="pay-method">
          <option>Pix</option>
          <option>Dinheiro</option>
          <option>Cartão crédito</option>
          <option>Cartão débito</option>
          <option>VR/VA</option>
        </select>
        <input type="number" class="pay-value" placeholder="Valor" step="0.01" min="0" value="${totalValue}">
        <button type="button" class="pay-remove btn-remove">✕</button>
      </div>`;
  }

  _addPaymentRow() {
    const container = document.getElementById('pmRows');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'pay-row';
    row.innerHTML = `
      <select class="pay-method">
        <option>Pix</option>
        <option>Dinheiro</option>
        <option>Cartão crédito</option>
        <option>Cartão débito</option>
        <option>VR/VA</option>
      </select>
      <input type="number" class="pay-value" placeholder="0.00" step="0.01" min="0">
      <button type="button" class="pay-remove btn-remove">✕</button>
    `;
    container.appendChild(row);
  }

  _getPaymentValues() {
    const rows = document.querySelectorAll('.pay-row');
    return Array.from(rows).map(r => ({
      method: r.querySelector('.pay-method')?.value || 'Pix',
      amount: parseFloat(r.querySelector('.pay-value')?.value) || 0
    })).filter(p => p.amount > 0);
  }

  // ═══════════════════════════════════════════════════════════
  // HISTÓRICO
  // ═══════════════════════════════════════════════════════════

  async _openHistory() {
    try {
      this.savedLists = await Storage.getSavedLists() || [];
    } catch (e) {
      console.error('[app] getSavedLists:', e);
      UI.showToast('Erro ao carregar histórico.');
      return;
    }

    const container = document.getElementById('historyList');
    if (!container) return;

    if (this.savedLists.length === 0) {
      container.innerHTML = '<p style="color:var(--txt-2);text-align:center;">Nenhuma lista salva ainda.</p>';
    } else {
      container.innerHTML = this.savedLists.map(l => `
        <div class="history-item">
          <span>${this._escape(l.name || '—')}</span>
          <span>${l.purchase_date || '—'}</span>
          <span>R$ ${(parseFloat(l.total) || 0).toFixed(2)}</span>
          <span>${this._escape(l.market || '')}</span>
          <button data-id="${l.id}" class="btn btn-secondary btn-sm history-load">Carregar</button>
          <button data-id="${l.id}" class="btn btn-danger btn-sm history-delete">🗑️</button>
        </div>`).join('');
    }

    container.querySelectorAll('.history-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        UI.hideModal('historyModal');
        this._loadListById(id);
      });
    });

    container.querySelectorAll('.history-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        UI.showConfirm('Excluir esta lista?', async () => {
          try {
            await Storage.deleteList(id);
            this.savedLists = this.savedLists.filter(l => l.id !== id);
            UI.showToast('Lista excluída');
            this._openHistory();
            this._updateMiniDash();
          } catch (e) {
            console.error(e);
            UI.showToast('Erro ao excluir.');
          }
        });
      });
    });

    UI.showModal('historyModal');
  }

  _loadListById(id) {
    const saved = this.savedLists.find(l => l.id === id);
    if (!saved) {
      UI.showToast('Lista não encontrada.');
      return;
    }

    const mappedItems = (saved.list_items || []).map(row => ({
      id: row.id || this._newId(),
      name: row.name,
      category: row.category || 'Outros',
      unit: row.unit || 'un',
      quantity: parseFloat(row.quantity) || 1,
      priceWholesale: parseFloat(row.wholesale_price) || 0,
      priceRetail: parseFloat(row.retail_price) || 0,
      completed: !!row.completed
    }));

    this.items = mappedItems;
    this.activeListId = saved.id;
    this.currentListType = saved.list_type || this._detectTypeFromItems(mappedItems);

    this._updateCategories();
    this.render();
    UI.showToast('Lista carregada em memória. Salve para criar uma cópia.');
  }

  _detectTypeFromItems(items) {
    if (!items.length) return 'Supermercado';
    const counts = {};
    for (const it of items) {
      const t = this._typeFromCategory(it.category);
      counts[t] = (counts[t] || 0) + 1;
    }
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return winner ? winner[0] : 'Supermercado';
  }

  _typeFromCategory(cat) {
    const map = {
      'Alimentos':  'Supermercado',
      'Hortifruti': 'Feira livre',
      'Carnes':     'Supermercado',
      'Limpeza':    'Supermercado',
      'Higiene':    'Farmácia',
      'Bebidas':    'Supermercado',
      'Papelaria':  'Material escolar',
      'Outros':     'Supermercado'
    };
    return map[cat] || 'Supermercado';
  }

  // ═══════════════════════════════════════════════════════════
  // COMPARAÇÃO
  // ═══════════════════════════════════════════════════════════

  async _openCompare() {
    try {
      this.savedLists = await Storage.getSavedLists() || [];
    } catch (e) {
      console.error(e);
      return;
    }

    const sel1 = document.getElementById('compareList1');
    const sel2 = document.getElementById('compareList2');

    if (sel1 && sel2) {
      const opts = this.savedLists
        .map(l => `<option value="${l.id}">${this._escape(l.name)} (${l.purchase_date || '—'})</option>`)
        .join('');
      sel1.innerHTML = `<option value="">Selecione...</option>` + opts;
      sel2.innerHTML = `<option value="">Selecione...</option>` + opts;
    }
    UI.showModal('compareModal');
  }

  _executeCompare() {
    const id1 = document.getElementById('compareList1')?.value;
    const id2 = document.getElementById('compareList2')?.value;
    if (!id1 || !id2) return;

    const l1 = this.savedLists.find(l => l.id === id1);
    const l2 = this.savedLists.find(l => l.id === id2);
    const resDiv = document.getElementById('compareResults');
    if (!resDiv) return;

    if (!l1 || !l2) {
      resDiv.innerHTML = '<p>Uma das listas não foi encontrada.</p>';
      return;
    }

    const names1 = (l1.list_items || []).map(i => i.name);
    const names2 = (l2.list_items || []).map(i => i.name);
    const added   = names2.filter(n => !names1.includes(n));
    const removed = names1.filter(n => !names2.includes(n));
    const common  = names1.filter(n =>  names2.includes(n));
    const total1  = parseFloat(l1.total) || 0;
    const total2  = parseFloat(l2.total) || 0;
    const diff    = total2 - total1;

    resDiv.innerHTML = `
      <p><strong>Adicionados:</strong> ${added.map(this._escape).join(', ')   || 'nenhum'}</p>
      <p><strong>Removidos:</strong>   ${removed.map(this._escape).join(', ') || 'nenhum'}</p>
      <p><strong>Em comum:</strong> ${common.length} itens</p>
      <hr>
      <p><strong>Total lista 1:</strong> R$ ${total1.toFixed(2)}</p>
      <p><strong>Total lista 2:</strong> R$ ${total2.toFixed(2)}</p>
      <p><strong>Diferença:</strong>
        <span style="color:${diff > 0 ? 'var(--danger)' : 'var(--primary)'}">
          ${diff >= 0 ? '+' : ''}R$ ${diff.toFixed(2)}
        </span>
      </p>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // SUGESTÕES
  // ═══════════════════════════════════════════════════════════

  _openSuggestions() {
    this.suggestionManager = new SuggestionManager(this.priceHistoryCache, this.items);
    const suggestions = this.suggestionManager.generate();

    const tabsEl    = document.getElementById('suggestTypeTabs');
    const listEl    = document.getElementById('suggestList');
    const summaryEl = document.getElementById('suggestSummary');

    if (!tabsEl || !listEl) return;

    tabsEl.innerHTML = Object.keys(this.listTypes).map(type => {
      const count = suggestions[type]?.length || 0;
      return `<button class="suggest-tab ${type === this.currentListType ? 'active' : ''}" data-type="${type}">
        ${this.listTypes[type].emoji} ${type} (${count})
      </button>`;
    }).join('');

    if (summaryEl) {
      const totalProducts = Object.keys(this.priceHistoryCache).length;
      summaryEl.innerHTML = `<p>🔁 Baseado em <strong>${totalProducts}</strong> produto(s) do seu histórico.</p>`;
    }

    this._renderSuggestionItems(suggestions[this.currentListType] || []);

    tabsEl.querySelectorAll('.suggest-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsEl.querySelectorAll('.suggest-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderSuggestionItems(suggestions[tab.dataset.type] || []);
      });
    });

    document.getElementById('suggestSelectAll')?.addEventListener('click', () => {
      document.querySelectorAll('#suggestList .suggest-item').forEach(el => el.classList.add('selected'));
    });
    document.getElementById('suggestClearAll')?.addEventListener('click', () => {
      document.querySelectorAll('#suggestList .suggest-item').forEach(el => el.classList.remove('selected'));
    });

    UI.showModal('suggestModal');
  }

  _renderSuggestionItems(items) {
    const listEl = document.getElementById('suggestList');
    if (!listEl) return;

    if (!items.length) {
      listEl.innerHTML = '<p style="color:var(--txt-2);text-align:center;padding:20px;">Nenhuma sugestão para este tipo ainda.</p>';
      return;
    }

    listEl.innerHTML = items.map(item => `
      <div class="suggest-item" data-name="${this._escape(item.name)}" data-category="${this._escape(item.category || 'Outros')}">
        <span class="suggest-emoji">${this._catEmoji(item.category || 'Outros')}</span>
        <span class="suggest-name">${this._escape(item.name)}</span>
        <span class="suggest-price">R$ ${(item.price || 0).toFixed(2)}</span>
      </div>`).join('');

    listEl.querySelectorAll('.suggest-item').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('selected'));
    });
  }

  async _createFromSuggestions() {
    const selected = document.querySelectorAll('#suggestList .suggest-item.selected');
    if (selected.length === 0) {
      UI.showToast('Selecione pelo menos um item.');
      return;
    }

    const newItems = Array.from(selected).map(el => ({
      id: this._newId(),
      name: el.dataset.name,
      category: el.dataset.category || 'Outros',
      unit: 'un',
      quantity: 1,
      priceWholesale: 0,
      priceRetail: parseFloat(
        el.querySelector('.suggest-price')?.textContent.replace('R$', '').trim()
      ) || 0,
      completed: false
    }));

    this.items = [...this.items, ...newItems];
    await this._persistItems();
    UI.hideModal('suggestModal');
    this.render();
    UI.showToast(`${newItems.length} itens adicionados!`);
  }

  // ═══════════════════════════════════════════════════════════
  // CONFIGURAÇÕES
  // ═══════════════════════════════════════════════════════════

  _openConfig() {
    if (this.user) {
      const meta = this.user.user_metadata || {};
      if (this.profileName) {
        this.profileName.value = meta.apelido || meta.nome || '';
      }
      if (this.profilePhotoUrl) {
        this.profilePhotoUrl.value = meta.avatar_url || meta.photo_url || '';
      }
    }

    this._renderCustomCategories();

    if (this.currentListTypeDisplay) this.currentListTypeDisplay.textContent = this.currentListType;
    if (this.monthlyBudgetInput)     this.monthlyBudgetInput.value = this.monthlyBudget || '';

    UI.showModal('configModal');
  }

  async _saveProfile() {
    const apelido     = document.getElementById('profileName')?.value.trim();
    const photoUrl    = document.getElementById('profilePhotoUrl')?.value.trim();
    const newPassword = document.getElementById('profileNewPassword')?.value;

    try {
      // Atualiza metadados (usa `apelido` + `avatar_url` conforme auth.js v3.2)
      if (apelido || photoUrl) {
        await Auth.updateProfile({
          apelido:    apelido || undefined,
          avatar_url: photoUrl || undefined
        });
      }

      // Atualiza senha (se preenchida)
      if (newPassword) {
        const ok = await Auth.updatePassword(newPassword);
        if (ok) {
          UI.showToast('Senha atualizada! 🔐');
          const passEl = document.getElementById('profileNewPassword');
          if (passEl) passEl.value = '';
        } else {
          UI.showToast('Erro ao atualizar senha.');
          return;
        }
      }

      UI.showToast('Perfil salvo!');
      this.user = await this._resolveUser();
      this._updateMenuProfile();
    } catch (e) {
      console.error('[app] _saveProfile:', e);
      UI.showToast('Erro ao salvar perfil.');
    }
  }

  async _deleteAccount() {
    UI.showConfirm(
      'Tem certeza que deseja deletar sua conta? Essa ação não pode ser desfeita.',
      async () => {
        try {
          await Auth.deleteAccount();   // já faz signOut internamente
        } catch (e) {
          console.error('[app] deleteAccount:', e);
        }
        this._resetState();
        localStorage.clear();
        this._forceAuth();
        UI.showToast('Conta deletada.');
      }
    );
  }

  _openGeneralSettings() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme     = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    UI.applyTheme(newTheme);
    UI.showToast(`Tema ${newTheme} ativado!`);
  }

  async _changeListType() {
    UI.showListTypeSelection(this.listTypes, async (type) => {
      this.currentListType = type;
      this._updateCategories();
      this.render();
      if (this.currentListTypeDisplay) this.currentListTypeDisplay.textContent = type;
    });
  }

  async _addCustomCategory() {
    const nameInput  = document.getElementById('newCategoryName');
    const emojiInput = document.getElementById('newCategoryEmoji');

    const name  = nameInput?.value.trim();
    const emoji = emojiInput?.value.trim() || '📦';

    if (!name) return UI.showToast('Nome da categoria obrigatório.');

    if (this.customCategories.some(c => c.name === name)) {
      UI.showToast('Essa categoria já existe.');
      return;
    }

    const cat = { name, emoji, list_type: this.currentListType };

    try {
      await Storage.saveCustomCategory(cat);
      this.customCategories.push(cat);
      this._updateCategories();
      this._renderCustomCategories();

      if (nameInput)  nameInput.value  = '';
      if (emojiInput) emojiInput.value = '';
      UI.showToast(`Categoria ${emoji} ${name} adicionada!`);
    } catch (e) {
      console.error(e);
      UI.showToast('Erro ao salvar categoria.');
    }
  }

  _renderCustomCategories() {
    const container = document.getElementById('customCategoriesList');
    if (!container) return;

    if (!this.customCategories.length) {
      container.innerHTML = '<p style="color:var(--txt-2);font-size:.85rem;">Nenhuma categoria personalizada.</p>';
      return;
    }

    container.innerHTML = this.customCategories.map(c => `
      <div class="custom-cat-item">
        <span>${c.emoji || '📦'} ${this._escape(c.name)}</span>
        <button class="cat-remove" data-name="${this._escape(c.name)}">✕</button>
      </div>`).join('');

    container.querySelectorAll('.cat-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;

        // Se o Storage tem deleteCustomCategory, persiste no banco
        try {
          if (typeof Storage.deleteCustomCategory === 'function') {
            await Storage.deleteCustomCategory(name);
          }
        } catch (e) {
          console.warn('[app] deleteCustomCategory:', e);
        }

        this.customCategories = this.customCategories.filter(c => c.name !== name);
        this._updateCategories();
        this._renderCustomCategories();
        UI.showToast('Categoria removida.');
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // BACKUP / RESTORE
  // ═══════════════════════════════════════════════════════════

  _downloadBackup() {
    const data = {
      items: this.items,
      customCategories: this.customCategories,
      priceHistoryCache: this.priceHistoryCache,
      savedLists: this.savedLists,
      version: '3.4',
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `backup-lista-compras-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Backup baixado!');
  }

  async _restoreBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.items) throw new Error('Arquivo inválido.');

        UI.showConfirm('Restaurar backup substituirá os dados atuais. Continuar?', async () => {
          this.items = data.items || [];
          await this._persistItems();

          this.customCategories = data.customCategories || [];
          for (const cat of this.customCategories) {
            try { await Storage.saveCustomCategory(cat); } catch (e) { console.warn(e); }
          }

          this.priceHistoryCache = data.priceHistoryCache || {};

          this._updateCategories();
          this._renderCustomCategories();
          this.render();
          UI.showToast('Backup restaurado com sucesso! ✅');
        });
      } catch (err) {
        console.error(err);
        UI.showToast('Erro ao restaurar: arquivo inválido.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  _inviteFriends() {
    const link = location.origin;
    if (navigator.share) {
      navigator.share({
        title: 'Lista de Compras Inteligente',
        text:  'Organize suas compras de forma inteligente!',
        url:   link
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(link).then(() => UI.showToast('Link copiado!'));
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ORÇAMENTO MENSAL
  // ═══════════════════════════════════════════════════════════

  async _saveBudget() {
    const value = parseFloat(this.monthlyBudgetInput?.value) || 0;

    try {
      const ok = await Storage.saveMonthlyBudget(value);
      if (ok === false) throw new Error('Falha ao salvar');
      this.monthlyBudget = value;
      this._updateMiniDash();
      UI.showToast(`Meta mensal de R$ ${value.toFixed(2)} salva!`);
    } catch (e) {
      console.error(e);
      UI.showToast('Erro ao salvar meta.');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════

  _resetState() {
    this.items = [];
    this.customCategories = [];
    this.priceHistoryCache = {};
    this.savedLists = [];
    this.activeListId = null;
    this.currentDraftId = null;
    this.monthlyBudget = 0;
    this._initialized = false;
  }
}


/* ============================================================
   SuggestionManager
   ─────────────────────────────────────────────────────────────
   Recebe um mapa { productName: [{ ws, rt, date }] } e devolve
   sugestões agrupadas por tipo de lista.
   ============================================================ */

class SuggestionManager {
  constructor(priceHistoryCache = {}, currentItems = []) {
    this.history      = priceHistoryCache;
    this.currentItems = currentItems;
    this.cycleDays    = 7;
  }

  generate() {
    const suggestions = {};
    const allTypes = ['Supermercado', 'Feira livre', 'Farmácia', 'Petshop', 'Material escolar'];
    allTypes.forEach(t => { suggestions[t] = []; });

    const currentNames = new Set(
      this.currentItems.map(i => (i.name || '').toLowerCase())
    );

    for (const [itemName, entries] of Object.entries(this.history)) {
      if (!itemName) continue;
      if (currentNames.has(itemName.toLowerCase())) continue;
      if (!Array.isArray(entries) || entries.length === 0) continue;

      const lastEntry = entries[entries.length - 1];
      const lastDate  = new Date(lastEntry.date);
      const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < this.cycleDays && entries.length < 3) continue;

      const category = this._guessCategory(itemName);
      const type     = this._typeFromCategory(category);
      const price    = lastEntry.rt || lastEntry.ws || 0;

      suggestions[type].push({
        name: itemName,
        category,
        price,
        lastDate: lastEntry.date
      });
    }

    for (const type in suggestions) {
      suggestions[type].sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
    }

    return suggestions;
  }

  _guessCategory(name) {
    const n = name.toLowerCase();
    if (/(banana|maçã|alface|tomate|cebola|batata|cenoura|laranja|limão)/.test(n)) return 'Hortifruti';
    if (/(carne|frango|peixe|linguiça|costela|picanha)/.test(n))                 return 'Carnes';
    if (/(sabão|detergente|amaciante|água sanitária|desinfetante)/.test(n))      return 'Limpeza';
    if (/(shampoo|sabonete|pasta|creme dental|desodorante|papel higiênico)/.test(n)) return 'Higiene';
    if (/(refrigerante|suco|cerveja|água|vinho|energético)/.test(n))             return 'Bebidas';
    if (/(caderno|caneta|lápis|borracha|papel)/.test(n))                          return 'Papelaria';
    return 'Outros';
  }

  _typeFromCategory(cat) {
    const map = {
      'Alimentos':  'Supermercado',
      'Hortifruti': 'Feira livre',
      'Carnes':     'Supermercado',
      'Limpeza':    'Supermercado',
      'Higiene':    'Farmácia',
      'Bebidas':    'Supermercado',
      'Papelaria':  'Material escolar',
      'Outros':     'Supermercado'
    };
    return map[cat] || 'Supermercado';
  }
}


/* ═══════════════════════════════════════════════════════════
   INICIALIZAÇÃO — Autenticação obrigatória
   ────────────────────────────────────────────────────────────
   v3.4: aguarda Auth.ready antes de decidir a tela inicial.
   Isso elimina a race condition onde o app.js rodava antes do
   auth.js terminar de ler a sessão do Supabase — o que forçava
   o usuário a clicar "Entrar" uma segunda vez mesmo já logado.
   ═══════════════════════════════════════════════════════════ */

const app = new ShoppingList();

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.querySelector('.container');

  // Esconde a UI principal até decidirmos o que mostrar
  if (container) container.style.visibility = 'hidden';

  // ⬇️ CORREÇÃO PRINCIPAL: espera o auth.js terminar de ler a sessão
  if (Auth && Auth.ready && typeof Auth.ready.then === 'function') {
    try { await Auth.ready; } catch {}
  }

  // 1. Verifica sessão ativa (com o cache do auth.js já populado)
  let user = null;
  try {
    user = await app._resolveUser();
  } catch (e) {
    user = null;
  }

  if (user) {
    // ✅ Logado → esconde auth, mostra app, inicializa
    const authModal = document.getElementById('authModal');
    if (authModal) {
      authModal.classList.remove('show', 'active', 'visible');
      authModal.style.display = 'none';
      authModal.removeAttribute('data-force');
    }

    app.user = user;
    if (container) container.style.visibility = 'visible';
    await app.initApp();
  } else {
    // 🔒 Não logado → força auth
    app._forceAuth();
  }

  // 2. Escuta mudanças de autenticação
  if (!window.supabaseClient) {
    console.error(
      '[app.js] window.supabaseClient não definido. ' +
      'Verifique se js/supabase-client.js foi carregado antes de js/app.js.'
    );
    return;
  }

  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      app.user = session.user;
      app._hideForceAuth();
      if (container) container.style.visibility = 'visible';

      if (!app._initialized) {
        await app.initApp();
      }
    } else if (event === 'SIGNED_OUT') {
      app._resetState();
      app.render();
      if (container) container.style.visibility = 'hidden';
      app._forceAuth();
    }
  });
});