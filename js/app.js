/**
 * js/app.js
 * ─────────────────────────────────────────────────────────────
 * Orquestrador da Aplicação (O "Cérebro").
 * Atualizado para trabalhar de forma assíncrona com o Supabase.
 * Conectado ao novo Menu Lateral, Configurações, Submenus e DASHBOARD.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// MAPEAMENTO DE CATEGORIAS
// ═══════════════════════════════════════════════════════════════
const LIST_CATEGORIES = {
  'Supermercado':  { 'Alimentos':'🍎','Hortifruti':'🥦','Ovo':'🥚','Carnes':'🍖','Limpeza':'🧽','Higiene':'🧴','Bebidas':'🥤','Outros':'📦' },
  'Feira Livre':   { 'Alimentos':'🍎','Hortifruti':'🥦','Ovo':'🥚','Carnes':'🍖','Limpeza':'🧽','Higiene':'🧴','Bebidas':'🥤','Outros':'📦' },
  'Açougue':       { 'Carne Bovina':'🐄','Carne Frango':'🐔','Carne Suína':'🐖','Carne Peixe':'🐟','Carne Javali':'🐗','Ovo':'🥚','Outros':'📦' },
  'Roupas':        { 'Camisetas':'👕','Calças':'👖','Sapatos':'👟','Acessórios':'👜','Íntimas':'🩲','Outros':'📦' },
  'Farmácia':      { 'Medicamentos':'💊','Higiene':'🧴','Cosméticos':'💄','Vitaminas':'🍯','Primeiros Socorros':'🩹','Outros':'📦' },
  'Eletrônicos':   { 'Smartphones':'📱','Computadores':'💻','Acessórios':'🔌','Games':'🎮','Audio/Video':'🎧','Outros':'📦' },
  'Casa e Jardim': { 'Móveis':'🪑','Decoração':'🖼️','Ferramentas':'🔧','Jardim':'🌱','Limpeza':'🧽','Outros':'📦' },
};

function _getCategoriesForType(type) {
  return LIST_CATEGORIES[type] || LIST_CATEGORIES['Supermercado'];
}

function _compareLists(items1, items2) {
  const common = [], onlyInList1 = [], onlyInList2 = [];
  items1.forEach(i1 => {
    const found = items2.find(i2 =>
      i1.name.toLowerCase() === i2.name.toLowerCase() && i1.category === i2.category);
    found ? common.push({ item1: i1, item2: found }) : onlyInList1.push(i1);
  });
  items2.forEach(i2 => {
    if (!items1.find(i1 => i1.name.toLowerCase() === i2.name.toLowerCase() && i1.category === i2.category))
      onlyInList2.push(i2);
  });
  return { common, onlyInList1, onlyInList2 };
}

// ═══════════════════════════════════════════════════════════════
// SUGGESTION MANAGER
// ═══════════════════════════════════════════════════════════════
const SuggestionManager = (() => {
  const LIST_TYPE_ICONS = {
    'Supermercado':  '🛒', 'Feira Livre':   '🥕', 'Açougue':       '🍖',
    'Farmácia':      '💊', 'Roupas':        '👕', 'Eletrônicos':   '📱', 'Casa e Jardim': '🏠',
  };
  const URGENCY_LABELS = { overdue: '⚠️ Acabou', soon: '🔔 Acabando', ok: '✅ Ok', unknown: '❓ Novo' };

  let _allProducts = [];
  let _selected    = new Set();
  let _activeType  = 'Todos';

  function _renderTabs() {
    const wrap = document.getElementById('suggestTypeTabs');
    if (!wrap) return;

    const groups = {};
    _allProducts.forEach(p => {
      groups[p.listType] = groups[p.listType] || { overdue: 0, soon: 0, total: 0 };
      groups[p.listType].total++;
      if (p.urgency === 'overdue') groups[p.listType].overdue++;
      else if (p.urgency === 'soon') groups[p.listType].soon++;
    });

    const types = ['Todos', ...Object.keys(groups).sort()];
    const totalUrgent = _allProducts.filter(p => p.urgency === 'overdue' || p.urgency === 'soon').length;

    wrap.innerHTML = types.map(t => {
      const ico = LIST_TYPE_ICONS[t] || '📋';
      const cnt = t === 'Todos' ? totalUrgent : (groups[t]?.overdue || 0) + (groups[t]?.soon || 0);
      const total = t === 'Todos' ? _allProducts.length : (groups[t]?.total || 0);
      return `<button class="stype-tab${t === _activeType ? ' active' : ''}"
        data-type="${t}">
        ${t === 'Todos' ? '📋' : ico} ${t}
        <span class="stab-count">${cnt > 0 ? cnt : total}</span>
      </button>`;
    }).join('');

    wrap.querySelectorAll('.stype-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeType = btn.dataset.type;
        _renderTabs(); _renderSummary(); _renderList();
      });
    });
  }

  function _renderSummary() {
    const el = document.getElementById('suggestSummary');
    if (!el) return;
    const filtered = _filtered();
    const counts = { overdue: 0, soon: 0, ok: 0, unknown: 0 };
    filtered.forEach(p => counts[p.urgency]++);
    const chips = [
      { key: 'overdue', label: `⚠️ ${counts.overdue} vencido${counts.overdue !== 1 ? 's' : ''}` },
      { key: 'soon',    label: `🔔 ${counts.soon} acabando` },
      { key: 'ok',      label: `✅ ${counts.ok} em dia` },
      { key: 'unknown', label: `❓ ${counts.unknown} novo${counts.unknown !== 1 ? 's' : ''}` },
    ].filter(c => counts[c.key] > 0);
    el.innerHTML = chips.map(c => `<span class="ssum-chip ${c.key}">${c.label}</span>`).join('');

    const selAllBtn = document.getElementById('suggestSelectAll');
    if (selAllBtn) {
      const hasUrgent = counts.overdue + counts.soon > 0;
      selAllBtn.textContent = hasUrgent ? '☑ Todos urgentes' : '☑ Selecionar todos';
    }
  }

  function _filtered() {
    if (_activeType === 'Todos') return _allProducts;
    return _allProducts.filter(p => p.listType === _activeType);
  }

  function _confidence(occurrences) {
    if (occurrences >= 7) return { dots: '●●●', label: 'alta',  cls: 'conf-high' };
    if (occurrences >= 4) return { dots: '●●○', label: 'média', cls: 'conf-mid'  };
    if (occurrences >= 2) return { dots: '●○○', label: 'baixa', cls: 'conf-low'  };
    return                        { dots: '○○○', label: 'novo',  cls: 'conf-none' };
  }

  function _renderList() {
    const el = document.getElementById('suggestList');
    if (!el) return;
    const items = _filtered();
    el.innerHTML = '';

    if (!items.length) {
      const nd = document.createElement('div');
      nd.className = 'suggest-nd';
      nd.innerHTML = `<span class="suggest-nd-icon">🔍</span>
        Nenhum produto encontrado para este tipo de lista.<br>
        Salve mais listas para o app aprender seus ciclos.`;
      el.appendChild(nd);
      return;
    }

    items.forEach(p => {
      const sel = _selected.has(p.norm);
      const pctCapped = Math.min((p.pct || 0) * 100, 100);
      const conf = _confidence(p.occurrences);
      const urgency = p.urgency;
      const qtyStr = `${p.lastQty} ${p.lastUnit || 'un'}`;
      const priceStr = p.lastPrice > 0 ? `R$${p.lastPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ` : '';

      const row = document.createElement('div');
      row.className = `sug-item urgency-${urgency}${sel ? ' selected' : ''}`;
      row.dataset.norm = p.norm;

      const checkDiv = document.createElement('div');
      checkDiv.className = 'sug-check';
      checkDiv.textContent = sel ? '✓' : '';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'sug-info';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'sug-name';
      nameDiv.textContent = p.name;

      const confSpan = document.createElement('span');
      confSpan.className = `sug-conf ${conf.cls}`;
      confSpan.title = `Confiança ${conf.label} (${p.occurrences}×)`;
      confSpan.textContent = conf.dots;
      nameDiv.appendChild(confSpan);

      const metaDiv = document.createElement('div');
      metaDiv.className = 'sug-meta';
      metaDiv.textContent = `${LIST_TYPE_ICONS[p.listType] || '📋'} ${p.listType} · ${p.category} · ciclo ~${p.avgDays || '?'}d · ${urgency === 'overdue' ? 'acabou' : urgency === 'soon' ? 'acabando' : 'em dia'}`;

      const detailDiv = document.createElement('div');
      detailDiv.className = 'sug-detail';
      detailDiv.textContent = `${priceStr}${qtyStr} · ${p.occurrences}× comprado`;

      infoDiv.appendChild(nameDiv); infoDiv.appendChild(metaDiv); infoDiv.appendChild(detailDiv);

      const badge = document.createElement('span');
      badge.className = `sug-urgency-badge ${urgency}`;
      badge.textContent = URGENCY_LABELS[urgency];

      const progDiv = document.createElement('div');
      progDiv.className = 'sug-progress';
      const pctSpan = document.createElement('span');
      pctSpan.className = 'sug-pct';
      pctSpan.textContent = p.avgDays ? Math.round(p.pct * 100) + '%' : '?';
      const barBg = document.createElement('div');
      barBg.className = 'sug-bar-bg';
      const barFill = document.createElement('div');
      barFill.className = `sug-bar-fill ${urgency}`;
      barFill.style.width = pctCapped + '%';
      barBg.appendChild(barFill);
      progDiv.appendChild(pctSpan); progDiv.appendChild(barBg);

      row.appendChild(checkDiv); row.appendChild(infoDiv); row.appendChild(badge); row.appendChild(progDiv);
      row.addEventListener('click', () => _toggleItem(p.norm, row));
      el.appendChild(row);
    });
  }

  function _toggleItem(norm, rowEl) {
    if (_selected.has(norm)) {
      _selected.delete(norm);
      rowEl.classList.remove('selected');
      rowEl.querySelector('.sug-check').textContent = '';
    } else {
      _selected.add(norm);
      rowEl.classList.add('selected');
      rowEl.querySelector('.sug-check').textContent = '✓';
    }
    _updateCreateBtn();
  }

  function _updateCreateBtn() {
    const btn  = document.getElementById('suggestCreate');
    const hint = document.getElementById('suggestCreateHint');
    if (!btn) return;
    const n = _selected.size;
    if (n > 0) {
      btn.textContent = `✚ Criar Lista (${n} item${n !== 1 ? 's' : ''})`;
      btn.disabled = false;
      if (hint) hint.style.display = 'none';
    } else {
      btn.textContent = '✚ Criar Lista';
      btn.disabled = true;
      if (hint) hint.style.display = 'block';
    }
  }

  function open(savedLists) {
    _selected.clear();
    _activeType = 'Todos';
    _allProducts = Calculator.analyzeAllProducts(savedLists, { minOccurrences: 1 });
    _renderTabs(); _renderSummary(); _renderList(); _updateCreateBtn();
  }

  function selectAllUrgent() {
    const filtered = _filtered();
    let toSelect = filtered.filter(p => p.urgency === 'overdue' || p.urgency === 'soon');
    if (toSelect.length === 0) toSelect = filtered;
    toSelect.forEach(p => _selected.add(p.norm));
    _renderList(); _updateCreateBtn();
  }

  function clearAll() {
    _selected.clear(); _renderList(); _updateCreateBtn();
  }

  function createList() {
    if (!_selected.size) return null;
    const chosen = _allProducts.filter(p => _selected.has(p.norm));
    const byType = {};
    chosen.forEach(p => { byType[p.listType] = byType[p.listType] || []; byType[p.listType].push(p); });

    const types = Object.keys(byType);
    const buildItems = (products) => products.map(p => ({
      id:             Calculator.generateId(),
      name:           p.name,
      category:       p.category || 'Outros',
      quantity:       p.lastQty  || 1,
      unit:           p.lastUnit || 'un',
      priceWholesale: 0,
      priceRetail:    0,
      completed:      false,
    }));

    if (types.length === 1) return { multi: false, listType: types[0], items: buildItems(byType[types[0]]), byType };

    const listsByType = {};
    types.forEach(t => { listsByType[t] = buildItems(byType[t]); });

    const dominantType = types.sort((a, b) => {
      const urgScore = p => ({ overdue: 3, soon: 2, ok: 1, unknown: 0 }[p.urgency] || 0);
      const scoreA = byType[a].reduce((s, p) => s + urgScore(p), 0);
      const scoreB = byType[b].reduce((s, p) => s + urgScore(p), 0);
      return scoreB - scoreA || byType[b].length - byType[a].length;
    })[0];

    return { multi: true, listType: dominantType, items: buildItems(byType[dominantType]), byType, listsByType };
  }

  function showMultiTypeDialog(result, onChoice) {
    const types = Object.keys(result.byType).sort();
    const modal = document.getElementById('multiTypeModal');
    if (!modal) { onChoice(null); return; }

    const list = document.getElementById('multiTypeList');
    list.innerHTML = '';

    types.forEach(type => {
      const products = result.byType[type];
      const items    = result.listsByType[type];
      const urgentN  = products.filter(p => p.urgency === 'overdue' || p.urgency === 'soon').length;
      const ico      = LIST_TYPE_ICONS[type] || '📋';

      const btn = document.createElement('button');
      btn.className = 'mtype-option';
      btn.innerHTML = `
        <span class="mtype-ico">${ico}</span>
        <span class="mtype-info">
          <span class="mtype-name">${type}</span>
          <span class="mtype-count">${items.length} item${items.length !== 1 ? 's' : ''}${urgentN ? ` · <span class="mtype-urgent">${urgentN} urgente${urgentN !== 1 ? 's' : ''}</span>` : ''}</span>
        </span>
        <span class="mtype-arrow">→</span>`;
      btn.addEventListener('click', () => { UI.hideModal(modal); onChoice({ items, listType: type }); });
      list.appendChild(btn);
    });

    UI.showModal(modal);
    document.getElementById('multiTypeCancel')?.addEventListener('click', () => {
      UI.hideModal(modal); onChoice(null);
    }, { once: true });
  }

  return { open, selectAllUrgent, clearAll, createList, showMultiTypeDialog };
})();

// ═══════════════════════════════════════════════════════════════
// CONTROLES DE PAGAMENTO
// ═══════════════════════════════════════════════════════════════
const PAYMENT_METHODS = {
  dinheiro: '💵 Dinheiro', pix: '⚡ PIX', cartao_credito: '💳 Crédito',
  cartao_debito: '💳 Débito', vale_alimentacao: '🥗 Vale Alimentação',
  vale_refeicao: '🍽️ Vale Refeição', outro: '📌 Outro',
};
function _paymentLabel(method) { return PAYMENT_METHODS[method] || method; }

const PaymentManager = (() => {
  let _rows = [];
  let _total = 0;

  function _fmt(n) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function _buildSelect(selected) {
    const sel = document.createElement('select');
    sel.className = 'pm-method-sel';
    Object.entries(PAYMENT_METHODS).forEach(([k, v]) => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = v;
      if (k === selected) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  function _render() {
    const container = document.getElementById('pmRows');
    if (!container) return;
    container.innerHTML = '';

    _rows.forEach((row, i) => {
      const div = document.createElement('div');
      div.className = 'pm-row';

      const sel = _buildSelect(row.method);
      sel.addEventListener('change', () => { _rows[i].method = sel.value; _updateStatus(); });

      const inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'pm-amount'; inp.step = '0.01'; inp.min = '0';
      inp.placeholder = 'R$ 0,00';
      inp.value = row.amount > 0 ? row.amount.toFixed(2) : '';
      inp.addEventListener('input', () => { _rows[i].amount = parseFloat(inp.value) || 0; _updateStatus(); });

      const del = document.createElement('button');
      del.type = 'button'; del.className = 'pm-del'; del.textContent = '✕';
      del.title = 'Remover';
      del.addEventListener('click', () => {
        if (_rows.length === 1) return;
        _rows.splice(i, 1); _render(); _updateStatus();
      });
      if (_rows.length === 1) del.style.visibility = 'hidden';

      div.appendChild(sel); div.appendChild(inp); div.appendChild(del);
      container.appendChild(div);
    });

    _updateStatus();
    const addBtn = document.getElementById('pmAddBtn');
    if (addBtn) addBtn.textContent = _rows.length === 1 ? '÷ dividir pagamento' : '+ outra forma';
  }

  function _updateStatus() {
    const el = document.getElementById('pmStatus');
    if (!el) return;
    if (_rows.length === 0 || (_rows.length === 1 && _rows[0].amount === 0)) {
      el.textContent = ''; el.className = 'pm-status'; return;
    }
    const sum  = _rows.reduce((s, r) => s + (r.amount || 0), 0);
    const ok   = _total <= 0 || Math.abs(sum - _total) < 0.01;
    const diff = _total - sum;
    if (ok) {
      el.textContent = '✓ fechado'; el.className = 'pm-status ok';
    } else {
      const sign = diff > 0 ? 'faltam' : 'sobram';
      el.textContent = `${sign} R$ ${_fmt(Math.abs(diff))}`; el.className = 'pm-status warn';
    }
  }

  function init(payments, total) {
    _total = parseFloat(total) || 0;
    if (Array.isArray(payments) && payments.length) {
      _rows = payments.map(p => ({ method: p.method || 'pix', amount: parseFloat(p.amount) || 0 }));
    } else {
      _rows = [{ method: 'pix', amount: _total }];
    }
    _render();
  }

  function add() {
    const remaining = _total - _rows.reduce((s, r) => s + (r.amount || 0), 0);
    _rows.push({ method: 'pix', amount: Math.max(0, parseFloat(remaining.toFixed(2))) });
    _render();
  }

  function get() { return _rows.filter(r => r.method && r.amount > 0); }

  function validate() {
    const pmts = get();
    if (!pmts.length) return true;
    if (_total <= 0)  return true;
    const sum = pmts.reduce((s, r) => s + r.amount, 0);
    return Math.abs(sum - _total) < 0.01;
  }

  return { init, add, get, validate };
})();

// ═══════════════════════════════════════════════════════════════
// CLASSE PRINCIPAL (ShoppingList)
// ═══════════════════════════════════════════════════════════════
class ShoppingList {

  constructor() {
    this.items             = [];
    this.customCategories  = [];
    this.priceHistoryCache = [];
    this.currentFilter     = 'all';
    this.currentListName   = 'Lista Atual';
    this.currentListType   = 'Supermercado';
    this.editingIndex      = -1;
    this.listTypes         = Object.fromEntries(Object.entries(LIST_CATEGORIES).map(([k]) => [k, {
      'Supermercado':'🛒','Feira Livre':'🥕','Açougue':'🍖','Roupas':'👕',
      'Farmácia':'💊','Eletrônicos':'📱','Casa e Jardim':'🏠',
    }[k] || '📋']));
  }

  async initApp() {
    this._bindElements();

    this.customCategories  = await Storage.getCustomCategories();
    this.priceHistoryCache = await Storage.getPriceHistory();
    await this._loadFromStorage();

    const theme = localStorage.getItem('theme') || 'light';
    UI.applyTheme(theme);

    this._bindEvents();

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
  }

  _bindElements() {
    const $ = id => document.getElementById(id);
    this.form                = $('itemForm');
    this.itemInput           = $('itemInput');
    this.categorySelect      = $('categorySelect');
    this.quantityInput       = $('quantityInput');
    this.unitSelect          = $('unitSelect');
    this.priceWholesaleInput = $('priceWholesaleInput');
    this.priceRetailInput    = $('priceRetailInput');
    this.addButton           = $('addButton');
    this.currentListNameEl   = $('currentListName');
    this.filterButtons       = document.querySelectorAll('.filter-btn');

    this.confirmModal  = $('confirmModal');
    this.confirmMsg    = $('confirmMessage');
    this.confirmOk     = $('confirmOk');
    this.confirmCancel = $('confirmCancel');
    this.historyModal  = $('historyModal');
    this.historyClose  = $('historyClose');
    this.historyList   = $('historyList');
    this.listNameInput = $('listNameInput');
    this.saveCancel    = $('saveCancel');
    this.saveConfirm   = $('saveConfirm');
    this.listDateInput = $('listDateInput');
    this.compareModal  = $('compareModal');
    this.compareList1  = $('compareList1');
    this.compareList2  = $('compareList2');
    this.compareExec   = $('compareExecute');
    this.compareClose  = $('compareClose');
    this.suggestModal  = $('suggestModal');
    this.saveModal     = $('saveListModal');
  }

  _bindEvents() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    // ── LÓGICA DO MENU LATERAL ──
    const menuToggle = document.getElementById('menuToggle');
    const sideMenu   = document.getElementById('sideMenu');
    const menuOverlay= document.getElementById('menuOverlay');

    const closeMenu = () => {
      sideMenu?.classList.remove('open');
      menuOverlay?.classList.remove('show');
    };

    if (menuToggle && sideMenu && menuOverlay) {
      menuToggle.addEventListener('click', () => {
        sideMenu.classList.add('open');
        menuOverlay.classList.add('show');
      });
      menuOverlay.addEventListener('click', closeMenu);
    }

    // Fechar menu ao clicar em itens normais (mas ignorar botões de submenu)
    document.querySelectorAll('.menu-item:not(.submenu-btn):not([data-toggle="submenu"])').forEach(item => {
      item.addEventListener('click', closeMenu);
    });

    // ── LÓGICA GENÉRICA PARA SUBMENUS (ACCORDION) ──
    document.querySelectorAll('.submenu-btn, .submenu-toggle, [data-toggle="submenu"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        btn.classList.toggle('active');
        const targetId = btn.getAttribute('data-target');
        const submenu = targetId ? document.getElementById(targetId) : btn.nextElementSibling;

        if (submenu) {
          submenu.classList.toggle('show');
          submenu.classList.toggle('open');
          const isHidden = window.getComputedStyle(submenu).display === 'none';
          if (isHidden || submenu.style.display === 'none') {
            submenu.style.display = 'block';
          } else {
            submenu.style.display = 'none';
          }
        }
      });
    });

    this.form?.addEventListener('submit', e => this._handleSubmit(e));

    on('clearAllButton',     'click', () => this._confirmClearAll());
    on('shareButton',        'click', () => this._shareList());
    on('darkModeToggle',     'click', () => this._toggleTheme());

    on('historyButton',      'click', () => this._showHistory());
    on('menuHistory',        'click', () => { closeMenu(); this._showHistory(); });

    on('compareListsButton', 'click', () => this._showCompareDialog());
    on('menuCompare',        'click', () => { closeMenu(); this._showCompareDialog(); });

    on('saveListButton',     'click', () => this._showSaveDialog());
    on('newListButton',      'click', () => this._createNewList());
    on('versionButton',      'click', () => window.open('versao.html', '_blank'));

    // Logout
    on('menuLogout', 'click', async () => {
      if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
        window.location.reload();
      }
    });

    on('exportTxt',   'click', () => {
      Exporter.toTxt(this.items, this.currentListName, this.currentListType,
        this.listTypes[this.currentListType], cat => this._getCatEmoji(cat));
      UI.showToast('Lista exportada para TXT!');
    });
    on('exportPdf',   'click', () => {
      const ok = Exporter.toPdf(this.items, this.currentListName, this.currentListType, cat => this._getCatEmoji(cat));
      UI.showToast(ok ? 'Lista exportada para PDF!' : 'Adicione itens antes de exportar!');
    });
    on('exportExcel', 'click', () => {
      Exporter.toCsv(this.items, this.currentListName);
      UI.showToast('Lista exportada para CSV!');
    });

    on('backupDownload', 'click', () => UI.showToast('O backup agora é automático na nuvem! ☁️'));
    on('backupUpload', 'click', () => UI.showToast('Suas listas já estão sincronizadas! ☁️'));

    this.filterButtons?.forEach(btn => btn.addEventListener('click', e => this._setFilter(e.target.dataset.filter)));

    this.confirmCancel?.addEventListener('click',  () => UI.hideModal(this.confirmModal));
    this.historyClose?.addEventListener('click',   () => UI.hideModal(this.historyModal));
    this.saveCancel?.addEventListener('click',     () => UI.hideModal(this.saveModal));
    this.saveConfirm?.addEventListener('click',    () => this._saveCurrentList());
    this.compareClose?.addEventListener('click',   () => UI.hideModal(this.compareModal));
    this.compareExec?.addEventListener('click',    () => this._executeComparison());

    const pmAddBtn = document.getElementById('pmAddBtn');
    if (pmAddBtn) pmAddBtn.addEventListener('click', () => PaymentManager.add());

    on('suggestButton',  'click', () => this._openSuggest());
    on('suggestClose',   'click', () => UI.hideModal(this.suggestModal));
    on('suggestSelectAll','click', () => SuggestionManager.selectAllUrgent());
    on('suggestClearAll', 'click', () => SuggestionManager.clearAll());
    on('suggestCreate',   'click', () => this._createFromSuggestion());
    on('priceHistoryClose', 'click', () => UI.hideModal(document.getElementById('priceHistoryModal')));

    this._bindConfigEvents();

    document.querySelectorAll('.modal').forEach(m =>
      m.addEventListener('click', e => { if (e.target === m) UI.hideModal(m); })
    );
    document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.hideAllModals(); });
  }

  _bindConfigEvents() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);
    const configModal = document.getElementById('configModal');

    const openConfig = async () => {
      const disp = document.getElementById('currentListTypeDisplay');
      if (disp) disp.textContent = this.currentListType;
      this._refreshCustomCategoryList();

      if (window.supabaseClient) {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user) UI.fillConfigProfile(user);
      }

      UI.showModal(configModal);
    };

    on('configButton', 'click', openConfig);
    on('menuConfig',   'click', () => {
      const sideMenu = document.getElementById('sideMenu');
      const menuOverlay = document.getElementById('menuOverlay');
      if (sideMenu) sideMenu.classList.remove('open');
      if (menuOverlay) menuOverlay.classList.remove('show');
      openConfig();
    });

    on('configClose',  'click', () => UI.hideModal(configModal));

    on('changeListType','click', () => {
      UI.hideModal(configModal);
      UI.showListTypeSelection(this.listTypes, type => {
        this.currentListType = type;
        this._updateCategories();
        this.render();
      });
    });

    on('addCustomCategory', 'click', async () => {
      const nameInput  = document.getElementById('newCategoryName');
      const emojiInput = document.getElementById('newCategoryEmoji');
      const name  = nameInput.value.trim();
      const emoji = emojiInput.value.trim();
      if (!name || !emoji) { UI.showToast('Preencha nome e emoji!'); return; }

      await Storage.saveCustomCategory({ name, emoji, list_type: this.currentListType });
      this.customCategories = await Storage.getCustomCategories();

      this._updateCategories();
      nameInput.value = ''; emojiInput.value = '';
      this._refreshCustomCategoryList();
      UI.showToast('Categoria adicionada!');
    });

    on('profileForm', 'submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const data = UI.getProfileFormData();
      const updates = { data: { apelido: data.name, avatar_url: data.photoUrl } };
      if (data.password) updates.password = data.password;

      try {
        const { error } = await window.supabaseClient.auth.updateUser(updates);
        if (error) throw error;
        UI.showToast('Perfil atualizado com sucesso!');
        UI.clearProfilePassword();

        const menuName = document.getElementById('menuUserName');
        const menuPhoto = document.getElementById('menuUserPhoto');
        if (menuName) menuName.textContent = data.name || 'Usuário';
        if (menuPhoto && data.photoUrl) menuPhoto.src = data.photoUrl;

      } catch (err) {
        UI.showToast('Erro ao atualizar perfil: ' + err.message);
      }
    });

    on('deleteAccountBtn', 'click', () => {
      if (confirm('Tem certeza que deseja deletar sua conta? Esta ação é irreversível e apagará todos os seus dados.')) {
        UI.showToast('Por segurança, a exclusão de conta deve ser solicitada ao suporte no momento.');
      }
    });

    // ── NOVO: SALVAR META MENSAL NO MODAL DE CONFIGURAÇÕES ──
    on('saveBudgetBtn', 'click', async () => {
      const budgetInput = document.getElementById('monthlyBudgetInput');
      if (!budgetInput) return;
      const amount = parseFloat(budgetInput.value) || 0;

      const success = await Storage.saveMonthlyBudget(amount);
      if (success) {
        UI.showToast('Meta mensal atualizada!');
        this.render(); // Atualiza o Dashboard imediatamente
      } else {
        UI.showToast('Erro ao salvar meta.');
      }
    });
  }

  _refreshCustomCategoryList() {
    const currentCats = this.customCategories.filter(c => c.list_type === this.currentListType);
    if(UI.renderCustomCategories) {
      UI.renderCustomCategories(
        currentCats,
        async (name) => {
          UI.showToast('A exclusão de categorias será adicionada em breve!');
        }
      );
    }
  }

  async _handleSubmit(e) {
    e.preventDefault();
    const name      = this.itemInput.value.trim();
    const wholesale = parseFloat(this.priceWholesaleInput.value) || 0;
    const retail    = parseFloat(this.priceRetailInput.value)    || 0;

    const item = {
      id:             Calculator.generateId(),
      name,
      category:       this.categorySelect.value,
      quantity:       parseFloat(this.quantityInput.value) || 1,
      unit:           this.unitSelect.value,
      priceWholesale: wholesale,
      priceRetail:    retail,
      completed:      false,
    };

    if (this.editingIndex >= 0) {
      item.id = this.items[this.editingIndex].id;
      this.items[this.editingIndex] = item;
      this.editingIndex = -1;
      this.addButton.textContent = '➕ Adicionar Item';
    } else {
      this.items.push(item);
    }

    this._resetForm();
    await this._saveToStorage();
    this.render();
    UI.showToast('Item adicionado!');
  }

  _resetForm() {
    if(this.form) this.form.reset();
    if(this.quantityInput) this.quantityInput.value = '1';
    if(this.itemInput) this.itemInput.focus();
  }

  _toggleTheme() {
    const current = localStorage.getItem('theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    UI.applyTheme(next);
  }

  _setFilter(filter) {
    this.currentFilter = filter;
    this.filterButtons?.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
    this.render();
  }

  _getFiltered() {
    if (this.currentFilter === 'completed') return this.items.filter(i =>  i.completed);
    if (this.currentFilter === 'pending')   return this.items.filter(i => !i.completed);
    return this.items;
  }

  async toggleItem(index) {
    const item = this.items[index];
    item.completed = !item.completed;
    if ('vibrate' in navigator) navigator.vibrate(40);
    this.items.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
    await this._saveToStorage();
    this.render();
  }

  editItem(index) {
    const item = this.items[index];
    this.itemInput.value           = item.name;
    this.categorySelect.value      = item.category;
    this.quantityInput.value       = item.quantity;
    this.unitSelect.value          = item.unit;
    this.priceWholesaleInput.value = item.priceWholesale || 0;
    this.priceRetailInput.value    = item.priceRetail    || 0;
    this.editingIndex              = index;
    this.addButton.textContent     = '✏️ Atualizar Item';
    this.itemInput.focus();
    this.itemInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  deleteItem(index) {
    UI.setText(this.confirmMsg, `Excluir "${this.items[index].name}"?`);
    UI.showModal(this.confirmModal);
    this.confirmOk.onclick = async () => {
      this.items.splice(index, 1);
      await this._saveToStorage();
      this.render();
      UI.hideModal(this.confirmModal);
      UI.showToast('Item excluído!');
    };
  }

  showPriceHistory(index) {
    const item    = this.items[index];
    const history = this.priceHistoryCache.filter(h => h.product_name && h.product_name.toLowerCase() === item.name.toLowerCase());
    UI.renderPriceHistoryModal(item.name, history);
  }

  _confirmClearAll() {
    if (!this.items.length) { UI.showToast('A lista já está vazia!'); return; }
    UI.setText(this.confirmMsg, 'Limpar toda a lista?');
    UI.showModal(this.confirmModal);
    this.confirmOk.onclick = async () => {
      this.items = [];
      await this._saveToStorage();
      this.render();
      UI.hideModal(this.confirmModal);
      UI.showToast('Lista limpa!');
    };
  }

  _shareList() {
    if (!this.items.length) { UI.showToast('Adicione itens primeiro!'); return; }
    const text = this.items.map(i => `${i.completed ? '✅' : '⬜'} ${i.quantity} ${i.unit} de ${i.name}`).join('\n');
    const body = `📝 ${this.currentListName}\n\n${text}`;
    if (navigator.share) navigator.share({ title: this.currentListName, text: body });
    else navigator.clipboard.writeText(body).then(() => UI.showToast('Lista copiada!'));
  }

  async _showHistory() {
    const lists = await Storage.getSavedLists();
    UI.renderHistory(lists, {
      onLoad:     idx => this.loadList(lists[idx]),
      onDelete:   idx => this.deleteList(lists[idx].id, lists[idx].name),
      onEditDate: idx => UI.showToast('Edição de data em breve na nuvem!'),
    });
    UI.showModal(this.historyModal);
  }

  async loadList(listObj) {
    if (!listObj) return;
    this.items = listObj.list_items.map(i => ({
      id: i.id,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      unit: i.unit,
      priceWholesale: i.wholesale_price,
      priceRetail: i.retail_price,
      completed: i.completed
    }));
    this.currentListName = listObj.name;
    this.currentListType = listObj.list_type || 'Supermercado';
    if(this.currentListNameEl) this.currentListNameEl.textContent = this.currentListName;
    this._updateCategories();
    await this._saveToStorage();
    this.render();
    UI.hideModal(this.historyModal);
    UI.showToast(`Lista "${listObj.name}" carregada!`);
  }

  async deleteList(id, name) {
    await Storage.deleteList(id);
    this._showHistory();
    UI.showToast(`Lista "${name}" excluída!`);
  }

  async _openSuggest() {
    const lists = await Storage.getSavedLists();
    SuggestionManager.open(lists);
    UI.showModal(this.suggestModal);
  }

  _createFromSuggestion() {
    const result = SuggestionManager.createList();
    if (!result) return;
    UI.hideModal(this.suggestModal);
    if (!result.multi) {
      this._applySuggestedList(result.items, result.listType);
      UI.showToast(`✅ ${result.items.length} itens · ${result.listType}`);
    } else {
      SuggestionManager.showMultiTypeDialog(result, (chosen) => {
        if (!chosen) return;
        this._applySuggestedList(chosen.items, chosen.listType);
        UI.showToast(`✅ ${chosen.items.length} itens · ${chosen.listType}`);
      });
    }
  }

  async _applySuggestedList(items, listType) {
    this.items           = items;
    this.currentListType = listType;
    this.currentListName = 'Lista Sugerida';
    if(this.currentListNameEl) this.currentListNameEl.textContent = this.currentListName;
    this._updateCategories();
    await this._saveToStorage();
    this.render();
  }

  async _showSaveDialog() {
    if(this.listNameInput) this.listNameInput.value = this.currentListName;

    if (this.listDateInput) {
      this.listDateInput.value = new Date().toISOString().slice(0, 10);
    }
    const total = Calculator.calculateTotals(this.items).general;
    PaymentManager.init(null, total);

    UI.showModal(this.saveModal);
    if(this.listNameInput) this.listNameInput.focus();
  }

  // ── CONTINUAÇÃO DO CÓDIGO QUE HAVIA SIDO CORTADO ──

  async _saveCurrentList() {
    const name = this.listNameInput ? this.listNameInput.value.trim() : 'Nova Lista';
    if (!name) { UI.showToast('Digite um nome!'); return; }

    const dateStr = this.listDateInput ? this.listDateInput.value : new Date().toISOString().slice(0, 10);

    if (!PaymentManager.validate()) {
      UI.showToast('Os pagamentos não batem com o total!');
      return;
    }

    const listData = {
      name: name,
      market: '', // Pode ser adicionado futuramente
      date: dateStr,
      totalGeneral: Calculator.calculateTotals(this.items).general
    };

    const payments = PaymentManager.get();

    // Salva a lista como concluída no Supabase
    await Storage.saveNewList(listData, this.items, payments);

    UI.hideModal(this.saveModal);
    UI.showToast('Lista salva com sucesso!');

    // Limpa a lista atual para começar uma nova
    this.items = [];
    this.currentListName = 'Nova Lista';
    if(this.currentListNameEl) this.currentListNameEl.textContent = this.currentListName;

    await this._saveToStorage();
    this.render(); // O Dashboard será atualizado automaticamente aqui
  }

  async _createNewList() {
    if (this.items.length > 0) {
      UI.setText(this.confirmMsg, 'Criar nova lista? Os itens atuais não salvos serão perdidos.');
      UI.showModal(this.confirmModal);
      this.confirmOk.onclick = async () => {
        this.items = [];
        this.currentListName = 'Nova Lista';
        if(this.currentListNameEl) this.currentListNameEl.textContent = this.currentListName;

        await this._saveToStorage();
        this.render();
        UI.hideModal(this.confirmModal);

        UI.showListTypeSelection(this.listTypes, type => {
          this.currentListType = type;
          this._updateCategories();
          this.render();
        });
      };
    } else {
      UI.showListTypeSelection(this.listTypes, type => {
        this.currentListType = type;
        this._updateCategories();
        this.render();
      });
    }
  }

  async _showCompareDialog() {
    const lists = await Storage.getSavedLists();
    if (lists.length < 2) {
      UI.showToast('Você precisa de pelo menos 2 listas salvas para comparar.');
      return;
    }

    if(this.compareList1 && this.compareList2) {
      this.compareList1.innerHTML = lists.map(l => `<option value="${l.id}">${l.name} (${l.purchase_date})</option>`).join('');
      this.compareList2.innerHTML = lists.map(l => `<option value="${l.id}">${l.name} (${l.purchase_date})</option>`).join('');
      this.compareList2.selectedIndex = 1;
    }
    UI.showModal(this.compareModal);
  }

  async _executeComparison() {
    if(!this.compareList1 || !this.compareList2) return;

    const id1 = this.compareList1.value;
    const id2 = this.compareList2.value;

    if (id1 === id2) {
      UI.showToast('Selecione listas diferentes para comparar.');
      return;
    }

    const lists = await Storage.getSavedLists();
    const list1 = lists.find(l => l.id === id1);
    const list2 = lists.find(l => l.id === id2);

    const result = _compareLists(list1.list_items, list2.list_items);
    UI.renderComparisonResult(result, list1.name, list2.name);
    UI.hideModal(this.compareModal);
  }

  _updateCategories() {
    if(!this.categorySelect) return;

    const baseCats = _getCategoriesForType(this.currentListType);
    const customCats = this.customCategories.filter(c => c.list_type === this.currentListType);

    this.categorySelect.innerHTML = '';

    Object.keys(baseCats).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${baseCats[cat]} ${cat}`;


      this.categorySelect.appendChild(opt);
    });

    if (customCats.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Personalizadas';
      customCats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = `${c.emoji} ${c.name}`;
        group.appendChild(opt);
      });
      this.categorySelect.appendChild(group);
    }
  }

  _getCatEmoji(cat) {
    const baseCats = _getCategoriesForType(this.currentListType);
    if (baseCats[cat]) return baseCats[cat];
    const custom = this.customCategories.find(c => c.name === cat && c.list_type === this.currentListType);
    return custom ? custom.emoji : '📦';
  }

  async _saveToStorage() {
    await Storage.saveCurrentList(this.items);
  }

  async _loadFromStorage() {
    const draftItems = await Storage.getCurrentList();
    this.items = draftItems.map(i => ({
      id: i.id,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      unit: i.unit,
      priceWholesale: i.wholesale_price,
      priceRetail: i.retail_price,
      completed: i.completed
    }));
  }

  async render() {
    const filtered = this._getFiltered();
    const totals = Calculator.calculateTotals(this.items);

    UI.renderItems(filtered, {
      onToggle: idx => this.toggleItem(idx),
      onEdit: idx => this.editItem(idx),
      onDelete: idx => this.deleteItem(idx),
      onHistory: idx => this.showPriceHistory(idx),
      getEmoji: cat => this._getCatEmoji(cat)
    });

    UI.updateTotals(totals);
    UI.updateProgress(this.items);

        // ── ATUALIZAÇÃO DO DASHBOARD E MINI CARDS ──
    const dashboardData = await Storage.getDashboardData();
    if (dashboardData) {
      // 1. Atualiza a tela de Dashboard (se estiver aberta)
      const budgetEl = document.getElementById('dashBudget');
      const spentEl = document.getElementById('dashSpent');
      const progressFillEl = document.getElementById('dashProgressFill');
      const progressTextEl = document.getElementById('dashProgressText');

      if (budgetEl) budgetEl.textContent = `R$ ${dashboardData.budget.toFixed(2).replace('.', ',')}`;
      if (spentEl) spentEl.textContent = `R$ ${dashboardData.totalSpent.toFixed(2).replace('.', ',')}`;

      if (progressFillEl) {
        progressFillEl.style.width = `${dashboardData.percentage}%`;
        if (dashboardData.percentage >= 100) progressFillEl.style.backgroundColor = '#ef4444';
        else if (dashboardData.percentage >= 80) progressFillEl.style.backgroundColor = '#f59e0b';
        else progressFillEl.style.backgroundColor = '#10b981';
      }
      if (progressTextEl) progressTextEl.textContent = `${Math.round(dashboardData.percentage)}% da meta`;

      // 2. Atualiza os Mini Cards na tela inicial (Index)
      const miniDashContainer = document.getElementById('miniDashContainer');
      const miniBudgetEl = document.getElementById('miniDashBudget');
      const miniSpentEl = document.getElementById('miniDashSpent');
      const miniSpentCard = document.getElementById('miniDashSpentCard');

      if (miniDashContainer && miniBudgetEl && miniSpentEl && miniSpentCard) {
        // Só exibe os cards se o usuário tiver definido uma meta maior que zero
        if (dashboardData.budget > 0) {
          miniDashContainer.style.display = 'flex';
          miniBudgetEl.textContent = `R$ ${dashboardData.budget.toFixed(2).replace('.', ',')}`;
          miniSpentEl.textContent = `R$ ${dashboardData.totalSpent.toFixed(2).replace('.', ',')}`;

          // Limpa as classes de cor e aplica a nova baseada na porcentagem
          miniSpentCard.classList.remove('status-good', 'status-warning', 'status-danger');

          if (dashboardData.percentage >= 100) {
            miniSpentCard.classList.add('status-danger');
          } else if (dashboardData.percentage >= 80) {
            miniSpentCard.classList.add('status-warning');
          } else {
            miniSpentCard.classList.add('status-good');
          }
        } else {
          miniDashContainer.style.display = 'none';
        }
      }
    }

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO DA APLICAÇÃO
// ═══════════════════════════════════════════════════════════════
const app = new ShoppingList();

// Aguarda o DOM carregar e o Supabase inicializar
document.addEventListener('DOMContentLoaded', () => {
  // Pequeno delay para garantir que o cliente do Supabase esteja pronto
  setTimeout(() => {
    app.initApp();
  }, 500);
});