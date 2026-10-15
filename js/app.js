/* ============================================================
   app.js :: Lista de Compras Inteligente (v3.0)
   Força login antes do acesso.
   ============================================================ */

class ShoppingList {
  constructor() {
    this.supabase = window.supabaseClient?.Auth || null;
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
    this.priceHistoryCache  = {};
    this.monthlyBudget      = 0;
    this.filter             = 'all';
    this.savedListsMeta     = [];
    this.activeListId       = null;
    this.suggestionManager  = null;
    this.user               = null;

    // Guards para evitar inicialização/duplicação de listeners
    this._elementsBound = false;
    this._eventsBound   = false;
    this._initialized   = false;
  }

  // ─────────────── INICIALIZAÇÃO ───────────────
  async initApp() {
    // 1. Força autenticação (se não logado, não continua)
    const user = await this._checkAuth();
    if (!user) {
      this._forceAuth();
      return;
    }

    // 2. Captura referências DOM (apenas uma vez)
    if (!this._elementsBound) {
      this._bindElements();
      this._elementsBound = true;
    }

    // 3. Carrega dados do Supabase / localStorage
    this.customCategories  = await Storage.getCustomCategories(this.user.id);
    this.priceHistoryCache = await Storage.getPriceHistory(this.user.id);
    this.monthlyBudget     = await Storage.getBudget(this.user.id);
    await this._loadFromStorage();

    // 4. Aplica tema
    const theme = localStorage.getItem('theme') || 'light';
    UI.applyTheme(theme);

    // 5. Inicializa eventos e renderiza (apenas uma vez)
    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
    this._updateMenuProfile();

    if (this.items.length === 0) {
      UI.showListTypeSelection(this.listTypes, type => {
        this.currentListType = type;
        this._updateCategories();
        this.render();
      });
    } else {
      this._updateCategories();
      this.render();
    }

    // 6. Atualiza mini dashboard
    this._updateMiniDash();

    this._initialized = true;
  }

  // ─────────────── AUTENTICAÇÃO FORÇADA ───────────────
  async _checkAuth() {
    try {
      const { data: { user } } = await Auth.getUser();
      this.user = user;
      return user;
    } catch {
      return null;
    }
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

  // ─────────────── CARGA / SALVAMENTO ───────────────
  async _loadFromStorage() {
    if (!this.user) return;
    const items = await Storage.getItems(this.user.id, this.currentListType);
    this.items = items || [];
    this.savedListsMeta = await Storage.getLists(this.user.id);
  }

  async _saveToStorage() {
    if (!this.user) return;
    await Storage.saveItems(this.user.id, this.items, this.currentListType);
  }

  // ─────────────── BIND DE ELEMENTOS ───────────────
  _bindElements() {
    // Formulário
    this.itemForm     = document.getElementById('itemForm');
    this.itemInput    = document.getElementById('itemInput');
    this.catSelect    = document.getElementById('categorySelect');
    this.unitSelect   = document.getElementById('unitSelect');
    this.qtyInput     = document.getElementById('quantityInput');
    this.wsPriceInput = document.getElementById('priceWholesaleInput');
    this.rtPriceInput = document.getElementById('priceRetailInput');
    this.addButton    = document.getElementById('addButton');

    // Lista
    this.itemListEl   = document.getElementById('itemList');
    this.emptyState   = document.getElementById('emptyState');

    // Totais
    this.totalItems   = document.getElementById('totalItems');
    this.totalGeneral = document.getElementById('totalGeneral');
    this.totalEconomy = document.getElementById('totalEconomy');

    // Ações principais
    this.clearAllBtn  = document.getElementById('clearAllButton');
    this.shareBtn     = document.getElementById('shareButton');
    this.filterBtns   = document.querySelectorAll('.filter-btn');

    // Mini dash
    this.miniDashContainer = document.getElementById('miniDashContainer');
    this.miniDashBudget    = document.getElementById('miniDashBudget');
    this.miniDashSpent     = document.getElementById('miniDashSpent');
    this.miniDashSpentCard = document.getElementById('miniDashSpentCard');

    // Salvar lista
    this.listNameInput   = document.getElementById('listNameInput');
    this.listDateInput   = document.getElementById('listDateInput');
    this.marketInput     = document.getElementById('marketInput');
    this.pmRows          = document.getElementById('pmRows');

    // Histórico / comparar
    this.historyListEl   = document.getElementById('historyList');
    this.compareList1    = document.getElementById('compareList1');
    this.compareList2    = document.getElementById('compareList2');
    this.compareResults  = document.getElementById('compareResults');

    // Sugestões
    this.suggestTypeTabs = document.getElementById('suggestTypeTabs');
    this.suggestList     = document.getElementById('suggestList');
    this.suggestSummary  = document.getElementById('suggestSummary');

    // Configurações
    this.profileName           = document.getElementById('profileName');
    this.profilePhotoUrl       = document.getElementById('profilePhotoUrl');
    this.profileNewPassword    = document.getElementById('profileNewPassword');
    this.customCategoriesList  = document.getElementById('customCategoriesList');
    this.currentListTypeDisplay= document.getElementById('currentListTypeDisplay');
    this.monthlyBudgetInput    = document.getElementById('monthlyBudgetInput');
  }

  // ─────────────── BIND DE EVENTOS ───────────────
  _bindEvents() {
    // --- Formulário de item ---
    if (this.itemForm) {
      this.itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addItem();
      });
    }

    // --- Menu Principal (Modal) ---
    const menuBtn   = document.getElementById('mainMenuBtn');
    const menuModal = document.getElementById('mainMenuModal');
    const menuClose = document.getElementById('mainMenuClose');

    const closeMenu = () => {
      if (menuModal) {
        menuModal.classList.remove('show', 'active', 'visible');
        menuModal.style.display = 'none';
      }
    };

    if (menuBtn && menuModal) {
      menuBtn.addEventListener('click', () => {
        menuModal.classList.add('show', 'active', 'visible');
        menuModal.style.display = 'flex';
      });
    }
    if (menuClose) menuClose.addEventListener('click', closeMenu);

    // Fecha menu ao clicar em ações
    ['historyButton', 'compareListsButton', 'configButton', 'btnOpenLogin'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', closeMenu);
    });

    // --- Botão "Entrar / Cadastrar" ---
    document.getElementById('btnOpenLogin')?.addEventListener('click', () => {
      const authModal = document.getElementById('authModal');
      if (authModal) {
        authModal.classList.add('show', 'active', 'visible');
        authModal.style.display = 'flex';
        const closeBtn = document.getElementById('authClose');
        if (closeBtn) closeBtn.style.display = '';
        authModal.removeAttribute('data-force');
      }
    });

    // --- Botão "Sair" ---
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
      await Auth.signOut();
      this.items = [];
      this.render();
      this._updateMenuProfile();
      this._forceAuth();
    });

    // --- Limpar tudo ---
    this.clearAllBtn?.addEventListener('click', () => {
      UI.showConfirm('Tem certeza que deseja limpar a lista?', () => {
        this.items = [];
        this._saveToStorage();
        this.render();
        UI.showToast('Lista limpa 🧹');
      });
    });

    // --- Compartilhar ---
    this.shareBtn?.addEventListener('click', () => {
      const text = this.items.map(i => `${i.name} (${i.quantity}${i.unit})`).join('\n');
      if (navigator.share) {
        navigator.share({ title: 'Lista de Compras', text });
      } else {
        navigator.clipboard.writeText(text).then(() => UI.showToast('Lista copiada!'));
      }
    });

    // --- Filtros ---
    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filter = btn.dataset.filter;
        this.render();
      });
    });

    // --- Exportação ---
    document.getElementById('exportTxt')?.addEventListener('click', () => Export.exportTXT(this.items));
    document.getElementById('exportPdf')?.addEventListener('click', () => Export.exportPDF(this.items));
    document.getElementById('exportExcel')?.addEventListener('click', () => Export.exportCSV(this.items));

    // --- Histórico de listas ---
    document.getElementById('historyButton')?.addEventListener('click', () => this._openHistory());
    document.getElementById('historyClose')?.addEventListener('click', () => UI.hideModal('historyModal'));
    document.getElementById('compareListsButton')?.addEventListener('click', () => this._openCompare());
    document.getElementById('compareClose')?.addEventListener('click', () => UI.hideModal('compareModal'));
    document.getElementById('compareExecute')?.addEventListener('click', () => this._executeCompare());

    // --- Salvar lista ---
    document.getElementById('saveListButton')?.addEventListener('click', () => this._openSaveList());
    document.getElementById('saveConfirm')?.addEventListener('click', () => this._confirmSaveList());
    document.getElementById('saveCancel')?.addEventListener('click', () => UI.hideModal('saveListModal'));

    // --- Nova lista ---
    document.getElementById('newListButton')?.addEventListener('click', () => {
      UI.showConfirm('Deseja iniciar uma nova lista? (a atual será salva automaticamente)', async () => {
        await this._saveToStorage();
        this.items = [];
        this.activeListId = null;
        this.currentListType = 'Supermercado';
        this._updateCategories();
        this.render();
        UI.showToast('Nova lista iniciada 📄');
      });
    });

    // --- Configurações ---
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
      alert('Versão 3.0 – melhorias na sincronização, novo menu e autenticação obrigatória.');
    });

    // --- Sugestões ---
    document.getElementById('suggestButton')?.addEventListener('click', () => this._openSuggestions());
    document.getElementById('suggestClose')?.addEventListener('click', () => UI.hideModal('suggestModal'));
    document.getElementById('suggestCreate')?.addEventListener('click', () => this._createFromSuggestions());

    // --- Meta mensal ---
    document.getElementById('saveBudgetBtn')?.addEventListener('click', () => this._saveBudget());

    // --- Pagamento dividido: add + remove (delegação) ---
    document.getElementById('pmAddBtn')?.addEventListener('click', () => this._addPaymentRow());
    this.pmRows?.addEventListener('click', (e) => {
      if (e.target.classList.contains('pay-remove')) {
        const rows = document.querySelectorAll('.pay-row');
        if (rows.length > 1) e.target.closest('.pay-row')?.remove();
      }
    });
  }

  // ─────────────── PERFIL NO MENU ───────────────
  _updateMenuProfile() {
    const nameEl     = document.getElementById('menuUserName');
    const emailEl    = document.getElementById('menuUserEmail');
    const initialsEl = document.getElementById('menuUserInitials');
    const photoEl    = document.getElementById('menuUserPhoto');
    const loginBtn   = document.getElementById('btnOpenLogin');
    const logoutBtn  = document.getElementById('btnLogout');

    if (this.user) {
      const meta = this.user.user_metadata || {};
      const nome = meta.nome || meta.apelido || 'Usuário';
      if (nameEl)  nameEl.textContent  = nome;
      if (emailEl) emailEl.textContent = this.user.email;
      if (initialsEl) initialsEl.textContent = nome.charAt(0).toUpperCase();
      if (photoEl && meta.photo_url) {
        photoEl.src = meta.photo_url;
        photoEl.style.display = 'block';
        if (initialsEl) initialsEl.style.display = 'none';
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

  // ─────────────── CATEGORIAS ───────────────
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

  // ─────────────── ADICIONAR ITEM ───────────────
  addItem() {
    const name = this.itemInput?.value.trim();
    if (!name) return;

    const cat  = this.catSelect?.value  || 'Outros';
    const unit = this.unitSelect?.value || 'unidade';
    const qty  = parseFloat(this.qtyInput?.value)     || 1;
    const ws   = parseFloat(this.wsPriceInput?.value) || 0;
    const rt   = parseFloat(this.rtPriceInput?.value) || 0;

    this.items.push({
      id: Date.now().toString(),
      name,
      category: cat,
      unit,
      quantity: qty,
      priceWholesale: ws,
      priceRetail: rt,
      completed: false
    });

    // Histórico de preços — guarda categoria para o SuggestionManager
    if (ws || rt) {
      if (!this.priceHistoryCache[name]) this.priceHistoryCache[name] = [];
      this.priceHistoryCache[name].push({
        ws, rt, category: cat, date: new Date().toISOString()
      });
      Storage.savePriceHistory(this.user.id, this.priceHistoryCache);
    }

    this._saveToStorage();
    this.render();
    this.itemInput.value = '';
    this.itemInput.focus();
  }

  // ─────────────── REMOVER / TOGGLE ───────────────
  removeItem(id) {
    this.items = this.items.filter(i => i.id !== id);
    this._saveToStorage();
    this.render();
  }

  toggleItem(id) {
    const item = this.items.find(i => i.id === id);
    if (item) item.completed = !item.completed;
    this._saveToStorage();
    this.render();
  }

  // ─────────────── RENDERIZAÇÃO ───────────────
  render() {
    let filtered = this.items;
    if (this.filter === 'pending')        filtered = filtered.filter(i => !i.completed);
    else if (this.filter === 'completed') filtered = filtered.filter(i => i.completed);

    const groups = {};
    filtered.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });

    if (this.itemListEl) {
      this.itemListEl.innerHTML = Object.keys(groups).map(cat => {
        const items = groups[cat].map(i => {
          const total = i.quantity * (i.priceRetail || i.priceWholesale || 0);
          return `
            <li class="item ${i.completed ? 'completed' : ''}" data-id="${i.id}">
              <input type="checkbox" ${i.completed ? 'checked' : ''} class="item-check">
              <span class="item-name">${i.name}</span>
              <span class="item-qty">${i.quantity} ${i.unit}</span>
              <span class="item-price">R$ ${total.toFixed(2)}</span>
              <button class="item-remove">🗑️</button>
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

  _updateStats() {
    const totalItems = this.items.length;
    const totalGeral = this.items.reduce(
      (sum, i) => sum + (i.quantity * (i.priceRetail || i.priceWholesale || 0)), 0
    );
    const economia = this.items.reduce((s, i) => {
      if (i.priceWholesale && i.priceRetail) return s + i.quantity * (i.priceRetail - i.priceWholesale);
      return s;
    }, 0);

    if (this.totalItems)   this.totalItems.textContent   = totalItems;
    if (this.totalGeneral) this.totalGeneral.textContent = `R$ ${totalGeral.toFixed(2)}`;
    if (this.totalEconomy) this.totalEconomy.textContent =
      economia > 0 ? `R$ ${economia.toFixed(2)}` : 'R$ 0,00';
  }

  // ────────────── MINI DASHBOARD ──────────────
  _updateMiniDash() {
    const container = document.getElementById('miniDashContainer');
    const budgetEl  = document.getElementById('miniDashBudget');
    const spentEl   = document.getElementById('miniDashSpent');

    if (!container || !budgetEl || !spentEl) return;

    if (this.monthlyBudget > 0) {
      container.style.display = 'flex';

      const budgetValue = this.monthlyBudget;
      const spentValue  = this._currentMonthSpent();

      budgetEl.textContent = `R$ ${budgetValue.toFixed(2)}`;
      spentEl.textContent  = `R$ ${spentValue.toFixed(2)}`;

      const card = document.getElementById('miniDashSpentCard');
      if (card && spentValue > budgetValue) {
        card.style.color = 'var(--danger)';
      } else if (card) {
        card.style.color = 'var(--txt-1)';
      }
    } else {
      container.style.display = 'none';
    }
  }

  _currentMonthSpent() {
    const now = new Date();
    return this.savedListsMeta
      .filter(l =>
        new Date(l.date).getMonth()    === now.getMonth() &&
        new Date(l.date).getFullYear() === now.getFullYear()
      )
      .reduce((s, l) => s + (l.total || 0), 0);
  }

  // ─────────────── SALVAR LISTA ───────────────
  async _openSaveList() {
    const go = confirm('Deseja salvar a lista atual?');
    if (!go) return;

    const dateInput = document.getElementById('listDateInput');
    if (dateInput) dateInput.valueAsDate = new Date();

    const marketInput = document.getElementById('marketInput');
    if (marketInput) marketInput.value = '';

    this._resetPaymentRows();
    UI.showModal('saveListModal');
  }

  async _confirmSaveList() {
    const listName = document.getElementById('listNameInput')?.value.trim()
      || `Lista ${new Date().toLocaleDateString()}`;

    const rawDate  = document.getElementById('listDateInput')?.value
      || new Date().toISOString().split('T')[0];

    const market   = document.getElementById('marketInput')?.value || '';
    const total    = this.items.reduce(
      (sum, i) => sum + i.quantity * (i.priceRetail || i.priceWholesale || 0), 0
    );
    const payments = this._getPaymentValues();

    const listMeta = {
      id:   this.activeListId || Date.now().toString(),
      name: listName,
      date: rawDate,
      market,
      total,
      payments,
      type: this.currentListType,
      items: this.items,
    };

    const index = this.savedListsMeta.findIndex(m => m.id === listMeta.id);
    const metaOnly = {
      id: listMeta.id, name: listName, date: rawDate,
      market, total, type: listMeta.type
    };
    if (index >= 0) this.savedListsMeta[index] = metaOnly;
    else            this.savedListsMeta.unshift(metaOnly);

    await Storage.saveItems(this.user.id, this.items, this.currentListType);
    await Storage.saveLists(this.user.id, this.savedListsMeta);
    UI.hideModal('saveListModal');
    UI.showToast(`Lista "${listName}" salva! 💾`);
  }

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
      method: r.querySelector('.pay-method')?.value || '',
      value:  parseFloat(r.querySelector('.pay-value')?.value) || 0
    }));
  }

  // ─────────────── HISTÓRICO ───────────────
  async _openHistory() {
    this.savedListsMeta = await Storage.getLists(this.user.id);
    const container = document.getElementById('historyList');
    if (!container) return;

    if (this.savedListsMeta.length === 0) {
      container.innerHTML = '<p style="color:var(--txt-2);text-align:center;">Nenhuma lista salva ainda.</p>';
    } else {
      container.innerHTML = this.savedListsMeta.map(l => `
        <div class="history-item">
          <span>${l.name}</span>
          <span>${l.date}</span>
          <span>R$ ${(l.total || 0).toFixed(2)}</span>
          <span>${l.market || ''}</span>
          <button data-id="${l.id}" class="btn btn-secondary btn-sm history-load">Carregar</button>
          <button data-id="${l.id}" class="btn btn-danger btn-sm history-delete">🗑️</button>
        </div>`).join('');
    }

    container.querySelectorAll('.history-load').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        UI.hideModal('historyModal');
        await this._loadListById(id);
      });
    });

    container.querySelectorAll('.history-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        UI.showConfirm('Excluir esta lista?', async () => {
          this.savedListsMeta = this.savedListsMeta.filter(m => m.id !== id);
          await Storage.saveLists(this.user.id, this.savedListsMeta);
          this._openHistory();
          UI.showToast('Lista excluída');
        });
      });
    });

    UI.showModal('historyModal');
  }

  async _loadListById(id) {
    const saved = await Storage.getListById(this.user.id, id);
    if (saved) {
      this.items = saved.items;
      this.activeListId = id;
      this.currentListType = saved.type || this._detectTypeFromItems(this.items);
      this._updateCategories();
      this.render();
      UI.showToast('Lista carregada!');
    }
  }

  _detectTypeFromItems(/* items */) {
    return 'Supermercado';
  }

  // ─────────────── COMPARAÇÃO ───────────────
  async _openCompare() {
    this.savedListsMeta = await Storage.getLists(this.user.id);
    const sel1 = document.getElementById('compareList1');
    const sel2 = document.getElementById('compareList2');

    if (sel1 && sel2) {
      const opts = this.savedListsMeta
        .map(l => `<option value="${l.id}">${l.name} (${l.date})</option>`)
        .join('');
      sel1.innerHTML = `<option value="">Selecione...</option>` + opts;
      sel2.innerHTML = `<option value="">Selecione...</option>` + opts;
    }
    UI.showModal('compareModal');
  }

  async _executeCompare() {
    const id1 = document.getElementById('compareList1')?.value;
    const id2 = document.getElementById('compareList2')?.value;
    if (!id1 || !id2) return;

    const lista1 = await Storage.getListById(this.user.id, id1);
    const lista2 = await Storage.getListById(this.user.id, id2);
    const resDiv = document.getElementById('compareResults');
    if (!resDiv) return;

    if (!lista1 || !lista2) {
      resDiv.innerHTML = '<p>Uma das listas não foi encontrada.</p>';
      return;
    }

    const names1 = lista1.items.map(i => i.name);
    const names2 = lista2.items.map(i => i.name);
    const added   = names2.filter(n => !names1.includes(n));
    const removed = names1.filter(n => !names2.includes(n));
    const common  = names1.filter(n =>  names2.includes(n));

    resDiv.innerHTML = `
      <p><strong>Adicionados:</strong> ${added.join(', ')   || 'nenhum'}</p>
      <p><strong>Removidos:</strong>   ${removed.join(', ') || 'nenhum'}</p>
      <p><strong>Em comum:</strong> ${common.length} itens</p>
    `;
  }

  // ─────────────── SUGESTÕES ───────────────
  _openSuggestions() {
    if (!this.suggestionManager) {
      this.suggestionManager = new SuggestionManager(this.priceHistoryCache, this.items);
    }

    const suggestions = this.suggestionManager.generate(this.currentListType);
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
      summaryEl.innerHTML = `<p>🔁 Baseado nos seus últimos <strong>${Object.keys(this.priceHistoryCache).length}</strong> produtos.</p>`;
    }

    this._renderSuggestionItems(suggestions[this.currentListType] || []);

    tabsEl.querySelectorAll('.suggest-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsEl.querySelectorAll('.suggest-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const type = tab.dataset.type;
        this._renderSuggestionItems(suggestions[type] || []);
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

    listEl.innerHTML = items.map(item => `
      <div class="suggest-item" data-name="${item.name}" data-category="${item.category}">
        <span class="suggest-emoji">${this._catEmoji(item.category)}</span>
        <span class="suggest-name">${item.name}</span>
        <span class="suggest-price">R$ ${item.price.toFixed(2)}</span>
      </div>`).join('');

    listEl.querySelectorAll('.suggest-item').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('selected'));
    });
  }

  _createFromSuggestions() {
    const selected = document.querySelectorAll('#suggestList .suggest-item.selected');
    if (selected.length === 0) {
      UI.showToast('Selecione pelo menos um item.');
      return;
    }

    const newItems = Array.from(selected).map(el => ({
      id: Date.now().toString() + Math.random(),
      name: el.dataset.name,
      category: el.dataset.category,
      unit: 'unidade',
      quantity: 1,
      priceWholesale: 0,
      priceRetail: parseFloat(
        el.querySelector('.suggest-price')?.textContent.replace('R$', '').trim()
      ) || 0,
      completed: false
    }));

    this.items = [...this.items, ...newItems];
    this._saveToStorage();
    UI.hideModal('suggestModal');
    this.render();
    UI.showToast(`${newItems.length} itens adicionados!`);
  }

  // ─────────────── CONFIGURAÇÕES ───────────────
  _openConfig() {
    if (this.user) {
      const meta = this.user.user_metadata || {};
      const nameEl  = document.getElementById('profileName');
      const photoEl = document.getElementById('profilePhotoUrl');
      if (nameEl)  nameEl.value  = meta.nome || meta.apelido || '';
      if (photoEl) photoEl.value = meta.photo_url || '';
    }

    this._renderCustomCategories();

    const display = document.getElementById('currentListTypeDisplay');
    if (display) display.textContent = this.currentListType;

    const budgetInput = document.getElementById('monthlyBudgetInput');
    if (budgetInput) budgetInput.value = this.monthlyBudget || '';

    UI.showModal('configModal');
  }

  async _saveProfile() {
    const nome        = document.getElementById('profileName')?.value.trim();
    const photoUrl    = document.getElementById('profilePhotoUrl')?.value.trim();
    const newPassword = document.getElementById('profileNewPassword')?.value;

    if (nome) {
      await Auth.updateProfile({ nome, photo_url: photoUrl || null });
    }

    if (newPassword) {
      await Auth.updatePassword(newPassword);
      UI.showToast('Senha atualizada! 🔐');
    }

    UI.showToast('Perfil salvo!');
    this._updateMenuProfile();
  }

  async _deleteAccount() {
    UI.showConfirm(
      'Tem certeza que deseja deletar sua conta? Essa ação não pode ser desfeita.',
      async () => {
        await Auth.deleteAccount();
        await Auth.signOut();
        this.items = [];
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
    UI.showListTypeSelection(this.listTypes, type => {
      this.currentListType = type;
      this._updateCategories();
      this._saveToStorage();
      this.render();
      const display = document.getElementById('currentListTypeDisplay');
      if (display) display.textContent = type;
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

    this.customCategories.push({ name, emoji });
    await Storage.saveCustomCategories(this.user.id, this.customCategories);
    this._updateCategories();
    this._renderCustomCategories();

    if (nameInput)  nameInput.value  = '';
    if (emojiInput) emojiInput.value = '';
    UI.showToast(`Categoria ${emoji} ${name} adicionada!`);
  }

  _renderCustomCategories() {
    const container = document.getElementById('customCategoriesList');
    if (!container) return;

    container.innerHTML = this.customCategories.map(c => `
      <div class="custom-cat-item">
        <span>${c.emoji} ${c.name}</span>
        <button class="cat-remove" data-name="${c.name}">✕</button>
      </div>`).join('');

    container.querySelectorAll('.cat-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        this.customCategories = this.customCategories.filter(c => c.name !== name);
        await Storage.saveCustomCategories(this.user.id, this.customCategories);
        this._updateCategories();
        this._renderCustomCategories();
        UI.showToast('Categoria removida.');
      });
    });
  }

  _downloadBackup() {
    const data = {
      items: this.items,
      customCategories: this.customCategories,
      priceHistoryCache: this.priceHistoryCache,
      savedListsMeta: this.savedListsMeta,
      version: '3.0',
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
          this.items             = data.items;
          this.customCategories  = data.customCategories  || [];
          this.priceHistoryCache = data.priceHistoryCache || {};
          this.savedListsMeta    = data.savedListsMeta    || [];

          await this._saveToStorage();
          await Storage.saveCustomCategories(this.user.id, this.customCategories);
          await Storage.savePriceHistory(this.user.id, this.priceHistoryCache);
          await Storage.saveLists(this.user.id, this.savedListsMeta);

          this._updateCategories();
          this.render();
          UI.showToast('Backup restaurado com sucesso! ✅');
        });
      } catch (err) {
        UI.showToast('Erro ao restaurar: arquivo inválido.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  _inviteFriends() {
    const link = 'https://listadecompras.app';
    if (navigator.share) {
      navigator.share({
        title: 'Lista de Compras Inteligente',
        text:  'Organize suas compras de forma inteligente!',
        url:   link,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(link).then(() => UI.showToast('Link copiado!'));
    }
  }

  async _saveBudget() {
    const input = document.getElementById('monthlyBudgetInput');
    const value = parseFloat(input?.value) || 0;

    this.monthlyBudget = value;
    await Storage.saveBudget(this.user.id, value);
    this._updateMiniDash();
    UI.showToast(`Meta mensal de R$ ${value.toFixed(2)} salva!`);
  }
} // FIM DA CLASSE ShoppingList


/* ============================================================
   SuggestionManager
   ============================================================ */

class SuggestionManager {
  constructor(priceHistoryCache = {}, currentItems = []) {
    this.history      = priceHistoryCache;
    this.currentItems = currentItems;
    this.cycleDays    = 7;
  }

  generate(/* currentListType */) {
    const suggestions = {};
    const allTypes = ['Supermercado', 'Feira livre', 'Farmácia', 'Petshop', 'Material escolar'];
    allTypes.forEach(type => { suggestions[type] = []; });

    const currentNames = new Set(this.currentItems.map(i => i.name.toLowerCase()));

    const categoryToType = {
      'Alimentos':  'Supermercado',
      'Hortifruti': 'Feira livre',
      'Carnes':     'Supermercado',
      'Limpeza':    'Supermercado',
      'Higiene':    'Farmácia',
      'Bebidas':    'Supermercado',
      'Papelaria':  'Material escolar',
      'Outros':     'Supermercado'
    };

    for (const [itemName, entries] of Object.entries(this.history)) {
      if (currentNames.has(itemName.toLowerCase())) continue;
      if (!entries || entries.length === 0) continue;

      const lastEntry    = entries[entries.length - 1];
      const lastDate     = new Date(lastEntry.date);
      const daysSinceLast = (Date.now() - lastDate) / (1000 * 60 * 60 * 24);

      if (daysSinceLast < this.cycleDays && entries.length < 3) continue;

      const category = lastEntry.category || 'Outros';
      const type     = categoryToType[category] || 'Supermercado';
      const price    = lastEntry.ws || lastEntry.rt || 0;

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
}


/* ═══════════════════════════════════════════════════════
   INICIALIZAÇÃO DO APP (Autenticação obrigatória)
   ═══════════════════════════════════════════════════════ */

const app = new ShoppingList();

document.addEventListener('DOMContentLoaded', async () => {
  // Guarda uma referência ao container principal
  const container = document.querySelector('.container');

  // Esconde a UI principal até sabermos se o usuário está logado
  if (container) container.style.visibility = 'hidden';

  // ─────────────────────────────────────────────
  // 1. Verifica se já existe sessão ativa
  // ─────────────────────────────────────────────
  let user = null;
  try {
    const { data } = await Auth.getUser();
    user = data?.user || null;
  } catch (e) {
    user = null;
  }

  if (user) {
    // ✅ Usuário logado → esconde auth, mostra app, inicializa
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
    // 🔒 Não logado → força auth, container continua oculto
    app._forceAuth();
    // O container será revelado no evento SIGNED_IN abaixo
  }

  // ─────────────────────────────────────────────
  // 2. Escuta mudanças de autenticação
  // ─────────────────────────────────────────────
  if (!window.supabaseClient) {
    console.error(
      '[app.js] window.supabaseClient não definido. ' +
      'Verifique se js/supabase-client.js foi carregado antes de js/app.js.'
    );
    return;
  }

  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      // Login (ou recuperação de sessão) bem-sucedido
      app.user = session.user;
      app._hideForceAuth();
      if (container) container.style.visibility = 'visible';
      await app.initApp();
    } else if (event === 'SIGNED_OUT') {
      // Logout: limpa tudo e volta para a tela de login
      app.user = null;
      app.items = [];
      app.priceHistoryCache = {};
      app.customCategories  = [];
      app.savedListsMeta    = [];

      // Zera flags para permitir rebind de elementos/eventos caso necessário
      app._initialized = false;

      app.render();
      if (container) container.style.visibility = 'hidden';
      app._forceAuth();
    }
  });
});