/**
 * js/app.js
 * ─────────────────────────────────────────────────────────────
* Orquestrador de aplicativos.
* Este arquivo apenas conecta eventos → delega TODO o trabalho aos módulos:

* Calculadora, Armazenamento, Interface do Usuário, Exportador
*
* Ordem de carregamento necessária (consulte index.html):
* calculator.js → storage.js → ui.js → export.js → app.js
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

// ── Category map (pure data — lives here so it's easy to extend) ──
const LIST_CATEGORIES = {
  'Supermercado': { 'Alimentos':'🍎','Hortifruti':'🥦','Ovo':'🥚','Carnes':'🍖','Limpeza':'🧽','Higiene':'🧴','Bebidas':'🥤','Outros':'📦' },
  'Feira Livre':  { 'Alimentos':'🍎','Hortifruti':'🥦','Ovo':'🥚','Carnes':'🍖','Limpeza':'🧽','Higiene':'🧴','Bebidas':'🥤','Outros':'📦' },
  'Açougue':      { 'Carne Bovina':'🐄','Carne Frango':'🐔','Carne Suína':'🐖','Carne Peixe':'🐟','Carne Javali':'🐗','Ovo':'🥚','Outros':'📦' },
  'Roupas':       { 'Camisetas':'👕','Calças':'👖','Sapatos':'👟','Acessórios':'👜','Íntimas':'🩲','Outros':'📦' },
  'Farmácia':     { 'Medicamentos':'💊','Higiene':'🧴','Cosméticos':'💄','Vitaminas':'🍯','Primeiros Socorros':'🩹','Outros':'📦' },
  'Eletrônicos':  { 'Smartphones':'📱','Computadores':'💻','Acessórios':'🔌','Games':'🎮','Audio/Video':'🎧','Outros':'📦' },
  'Casa e Jardim':{ 'Móveis':'🪑','Decoração':'🖼️','Ferramentas':'🔧','Jardim':'🌱','Limpeza':'🧽','Outros':'📦' },
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

// ── Main class ────────────────────────────────────────────────────
class ShoppingList {

  constructor() {
    this.items           = [];
    this.currentFilter   = 'all';
    this.currentListName = 'Lista Atual';
    this.currentListType = 'Supermercado';
    this.editingIndex    = -1;
    this.listTypes       = Object.fromEntries(Object.entries(LIST_CATEGORIES).map(([k]) => [k, {
      'Supermercado':'🛒','Feira Livre':'🥕','Açougue':'🍖','Roupas':'👕',
      'Farmácia':'💊','Eletrônicos':'📱','Casa e Jardim':'🏠',
    }[k] || '📋']));
    this._init();
  }

  // ── Boot ───────────────────────────────────────────────────────
  _init() {
    this._bindElements();
    this._loadFromStorage();
    UI.applyTheme(Storage.getTheme());
    this._bindEvents();
    // Show type-selection overlay on every fresh load
    UI.showListTypeSelection(this.listTypes, type => {
      this.currentListType = type;
      this._updateCategories();
      this.render();
    });
  }

  // ── DOM refs ───────────────────────────────────────────────────
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

    // Modals
    this.confirmModal  = $('confirmModal');
    this.confirmMsg    = $('confirmMessage');
    this.confirmOk     = $('confirmOk');
    this.confirmCancel = $('confirmCancel');
    this.historyModal  = $('historyModal');
    this.historyClose  = $('historyClose');
    this.saveModal     = $('saveListModal');
    this.listNameInput = $('listNameInput');
    this.saveCancel    = $('saveCancel');
    this.saveConfirm   = $('saveConfirm');
    this.listDateInput = $('listDateInput');
    this.compareModal  = $('compareModal');
    this.compareList1  = $('compareList1');
    this.compareList2  = $('compareList2');
    this.compareExec   = $('compareExecute');
    this.compareClose  = $('compareClose');
  }

  // ── Events ─────────────────────────────────────────────────────
  _bindEvents() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    this.form.addEventListener('submit', e => this._handleSubmit(e));

    on('clearAllButton',     'click', () => this._confirmClearAll());
    on('shareButton',        'click', () => this._shareList());
    on('darkModeToggle',     'click', () => this._toggleTheme());
    on('historyButton',      'click', () => this._showHistory());
    on('saveListButton',     'click', () => this._showSaveDialog());
    on('newListButton',      'click', () => this._createNewList());
    on('compareListsButton', 'click', () => this._showCompareDialog());
    on('versionButton',      'click', () => window.open('versao.html', '_blank'));

    // Export
    on('exportTxt',   'click', () => {
      Exporter.toTxt(this.items, this.currentListName, this.currentListType,
        this.listTypes[this.currentListType], cat => this._getCatEmoji(cat));
      UI.showToast('Lista exportada para TXT!');
    });
    on('exportPdf',   'click', () => {
      const ok = Exporter.toPdf(this.items, this.currentListName, this.currentListType,
        cat => this._getCatEmoji(cat));
      UI.showToast(ok ? 'Lista exportada para PDF!' : 'Adicione itens antes de exportar!');
    });
    on('exportExcel', 'click', () => {
      Exporter.toCsv(this.items, this.currentListName);
      UI.showToast('Lista exportada para CSV!');
    });

    // Backup
    on('backupDownload', 'click', () => {
      Storage.exportBackup();
      UI.showToast('Backup baixado com sucesso!');
    });
    on('backupUpload', 'click', () => document.getElementById('backupFileInput').click());
    document.getElementById('backupFileInput')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const result = await Storage.importBackup(file);
      UI.showToast(result.message);
      e.target.value = '';
      if (result.ok) { this._loadFromStorage(); this.render(); }
    });

    // Filters
    this.filterButtons.forEach(btn =>
      btn.addEventListener('click', e => this._setFilter(e.target.dataset.filter))
    );

    // Modal buttons
    this.confirmCancel.addEventListener('click',  () => UI.hideModal(this.confirmModal));
    this.historyClose.addEventListener('click',   () => UI.hideModal(this.historyModal));
    this.saveCancel.addEventListener('click',     () => UI.hideModal(this.saveModal));
    this.saveConfirm.addEventListener('click',    () => this._saveCurrentList());
    this.compareClose.addEventListener('click',   () => UI.hideModal(this.compareModal));
    this.compareExec.addEventListener('click',    () => this._executeComparison());
    document.getElementById('priceHistoryClose')?.addEventListener('click',
      () => UI.hideModal(document.getElementById('priceHistoryModal')));

    // Config
    this._bindConfigEvents();

    // Backdrop click → close modal
    document.querySelectorAll('.modal').forEach(m =>
      m.addEventListener('click', e => { if (e.target === m) UI.hideModal(m); })
    );

    // Escape key
    document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.hideAllModals(); });
  }

  _bindConfigEvents() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);
    const configModal = document.getElementById('configModal');

    on('configButton', 'click', () => {
      const disp = document.getElementById('currentListTypeDisplay');
      if (disp) disp.textContent = this.currentListType;
      this._refreshCustomCategoryList();
      UI.showModal(configModal);
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
    on('addCustomCategory', 'click', () => {
      const nameInput  = document.getElementById('newCategoryName');
      const emojiInput = document.getElementById('newCategoryEmoji');
      const name  = nameInput.value.trim();
      const emoji = emojiInput.value.trim();
      if (!name || !emoji) { UI.showToast('Preencha nome e emoji!'); return; }
      Storage.addCustomCategory(this.currentListType, name, emoji);
      this._updateCategories();
      nameInput.value = ''; emojiInput.value = '';
      this._refreshCustomCategoryList();
      UI.showToast('Categoria adicionada!');
    });
  }

  _refreshCustomCategoryList() {
    UI.renderCustomCategories(
      Storage.getCustomCategories(this.currentListType),
      name => {
        Storage.removeCustomCategory(this.currentListType, name);
        this._updateCategories();
        this._refreshCustomCategoryList();
        UI.showToast('Categoria removida!');
      }
    );
  }

  // ── Form submit ────────────────────────────────────────────────
  _handleSubmit(e) {
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
      item.id = this.items[this.editingIndex].id;      // preserve original UUID
      this.items[this.editingIndex] = item;
      this.editingIndex = -1;
      this.addButton.textContent = '➕ Adicionar Item';
    } else {
      this.items.push(item);
    }

    // Record price snapshot for BI history
    if (wholesale > 0 || retail > 0) Storage.recordPrice(name, wholesale, retail);

    this._resetForm();
    this._saveToStorage();
    this.render();
    UI.showToast('Item adicionado!');
  }

  _resetForm() {
    this.form.reset();
    this.quantityInput.value = '1';
    this.itemInput.focus();
  }

  // ── Theme ──────────────────────────────────────────────────────
  _toggleTheme() {
    const next = Storage.getTheme() === 'dark' ? 'light' : 'dark';
    Storage.setTheme(next);
    UI.applyTheme(next);
  }

  // ── Filter ─────────────────────────────────────────────────────
  _setFilter(filter) {
    this.currentFilter = filter;
    this.filterButtons.forEach(btn =>
      btn.classList.toggle('active', btn.dataset.filter === filter)
    );
    this.render();
  }

  _getFiltered() {
    if (this.currentFilter === 'completed') return this.items.filter(i =>  i.completed);
    if (this.currentFilter === 'pending')   return this.items.filter(i => !i.completed);
    return this.items;
  }

  // ── Item actions (called from ui.js via handlers) ──────────────
  toggleItem(index) {
    this.items[index].completed = !this.items[index].completed;
    this._saveToStorage();
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
    this.confirmOk.onclick = () => {
      this.items.splice(index, 1);
      this._saveToStorage();
      this.render();
      UI.hideModal(this.confirmModal);
      UI.showToast('Item excluído!');
    };
  }

  showPriceHistory(index) {
    const item    = this.items[index];
    const history = Storage.getPriceHistory(item.name);
    UI.renderPriceHistoryModal(item.name, history);
  }

  // ── Clear list ─────────────────────────────────────────────────
  _confirmClearAll() {
    if (!this.items.length) { UI.showToast('A lista já está vazia!'); return; }
    UI.setText(this.confirmMsg, 'Deseja limpar toda a lista?');
    UI.showModal(this.confirmModal);
    this.confirmOk.onclick = () => {
      this.items = [];
      this._saveToStorage();
      this.render();
      UI.hideModal(this.confirmModal);
      UI.showToast('Lista limpa!');
    };
  }

  // ── Share ──────────────────────────────────────────────────────
  _shareList() {
    if (!this.items.length) { UI.showToast('Adicione itens primeiro!'); return; }
    const text = this.items.map(i =>
      `${i.completed ? '✅' : '⬜'} ${i.quantity} ${i.unit} de ${i.name}`
    ).join('\n');
    const body = `📝 ${this.currentListName}\n\n${text}`;
    if (navigator.share) navigator.share({ title: this.currentListName, text: body });
    else navigator.clipboard.writeText(body).then(() => UI.showToast('Lista copiada!'));
  }

  // ── History / Save / Load ──────────────────────────────────────
  _showHistory() {
    UI.renderHistory(Storage.getSavedLists(), {
      onLoad:     idx => this.loadList(idx),
      onDelete:   idx => this.deleteList(idx),
      onEditDate: idx => this._editListDate(idx),
    });
    UI.showModal(this.historyModal);
  }

  _editListDate(index) {
    const lists = Storage.getSavedLists();
    const list  = lists[index];
    if (!list) return;

    // Build a lightweight inline date picker prompt
    const currentDate = list.date
      ? new Date(list.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const newDateStr = window.prompt(
      `Alterar data da lista "${list.name}"

Formato: AAAA-MM-DD`,
      currentDate
    );

    if (!newDateStr) return;
    const parsed = new Date(newDateStr + 'T12:00:00');
    if (isNaN(parsed)) { UI.showToast('Data inválida!'); return; }

    Storage.saveNamedList(list.name, list.items, list.listType, parsed.toISOString());
    this._showHistory();   // refresh
    UI.showToast(`Data atualizada para ${parsed.toLocaleDateString('pt-BR')}!`);
  }

  loadList(index) {
    const lists = Storage.getSavedLists();
    if (!lists[index]) return;
    const l = lists[index];
    this.items           = [...l.items];
    this.currentListName = l.name;
    this.currentListType = l.listType || 'Supermercado';
    this.currentListNameEl.textContent = this.currentListName;
    this._updateCategories();
    this._saveToStorage();
    this.render();
    UI.hideModal(this.historyModal);
    UI.showToast(`Lista "${l.name}" carregada!`);
  }

  deleteList(index) {
    const name = (Storage.getSavedLists()[index] || {}).name;
    Storage.deleteNamedList(index);
    this._showHistory();
    UI.showToast(`Lista "${name}" excluída!`);
  }

  _showSaveDialog() {
    this.listNameInput.value = this.currentListName;
    // Pre-fill with today's date (or keep existing date if this list was already saved)
    const saved = Storage.getSavedLists().find(l => l.name === this.currentListName);
    const dateVal = saved?.date
      ? new Date(saved.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    if (this.listDateInput) this.listDateInput.value = dateVal;
    UI.showModal(this.saveModal);
    this.listNameInput.focus();
  }

  _saveCurrentList() {
    const name = this.listNameInput.value.trim();
    if (!name) { UI.showToast('Digite um nome!'); return; }
    // Use the user-selected date; fall back to now if field is empty
    const dateStr = this.listDateInput?.value;
    const date = dateStr
      ? new Date(dateStr + 'T12:00:00').toISOString()   // noon to avoid timezone drift
      : new Date().toISOString();
    Storage.saveNamedList(name, this.items, this.currentListType, date);
    this.currentListName = name;
    this.currentListNameEl.textContent = name;
    UI.hideModal(this.saveModal);
    UI.showToast('Lista salva!');
  }

  _createNewList() {
    const proceed = () => {
      this.items           = [];
      this.currentListName = 'Lista Atual';
      this.currentListNameEl.textContent = 'Lista Atual';
      this._saveToStorage();
      this.render();
      UI.showListTypeSelection(this.listTypes, type => {
        this.currentListType = type;
        this._updateCategories();
        this.render();
      });
    };
    if (this.items.length > 0) {
      UI.setText(this.confirmMsg, 'Criar nova lista? A lista atual será perdida se não for salva.');
      UI.showModal(this.confirmModal);
      this.confirmOk.onclick = () => { UI.hideModal(this.confirmModal); proceed(); UI.showToast('Nova lista criada!'); };
    } else { proceed(); }
  }

  // ── Compare ────────────────────────────────────────────────────
  _showCompareDialog() {
    const lists = Storage.getSavedLists();
    if (lists.length < 2) { UI.showToast('Você precisa de pelo menos 2 listas salvas!'); return; }
    this.compareList1.innerHTML = '<option value="">Selecione...</option>';
    this.compareList2.innerHTML = '<option value="">Selecione...</option>';
    lists.forEach((l, i) => {
      this.compareList1.add(new Option(l.name, i));
      this.compareList2.add(new Option(l.name, i));
    });
    document.getElementById('compareResults').innerHTML =
      '<p style="color:var(--txt-3);font-size:.75rem;">Selecione duas listas para comparar.</p>';
    UI.showModal(this.compareModal);
  }

  _executeComparison() {
    const i1 = this.compareList1.value, i2 = this.compareList2.value;
    if (!i1 || !i2 || i1 === i2) { UI.showToast('Selecione duas listas diferentes!'); return; }
    const lists = Storage.getSavedLists();
    UI.renderComparisonResults(_compareLists(lists[i1].items, lists[i2].items), lists[i1].name, lists[i2].name);
  }

  // ── Render ─────────────────────────────────────────────────────
  render() {
    const filtered = this._getFiltered();
    UI.renderItems(
      this.items, filtered,
      {
        onToggle:  idx => this.toggleItem(idx),
        onEdit:    idx => this.editItem(idx),
        onDelete:  idx => this.deleteItem(idx),
        onHistory: idx => this.showPriceHistory(idx),
      },
      Calculator.formatPrice,
      Calculator.calculateUnitPrice,
      item => this._getTrend(item),
      cat  => this._getCatEmoji(cat)
    );
    UI.renderStats(this.items, Calculator.calculateTotals(this.items), Calculator.formatPrice);
    UI.renderEmptyState(filtered);
  }

  _getTrend(item) {
    const price = item.priceWholesale > 0 ? item.priceWholesale : item.priceRetail;
    if (!price) return null;
    const history = Storage.getPriceHistory(item.name);
    // Exclude the most-recent snapshot (which is the current price just recorded)
    return Calculator.priceTrend(price, history.slice(0, -1));
  }

  // ── Categories ─────────────────────────────────────────────────
  _updateCategories() {
    const all = { ..._getCategoriesForType(this.currentListType), ...Storage.getCustomCategories(this.currentListType) };
    this.categorySelect.innerHTML = '';
    Object.entries(all).forEach(([name, emoji]) => {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = `${emoji} ${name}`;
      this.categorySelect.appendChild(opt);
    });
  }

  _getCatEmoji(category) {
    const all = { ..._getCategoriesForType(this.currentListType), ...Storage.getCustomCategories(this.currentListType) };
    return all[category] || '📦';
  }

  // ── Storage delegates ──────────────────────────────────────────
  _saveToStorage() { Storage.saveCurrentList(this.items, this.currentListName, this.currentListType); }
  _loadFromStorage() {
    const saved = Storage.loadCurrentList();
    if (!saved) return;
    this.items           = saved.items    || [];
    this.currentListName = saved.name     || 'Lista Atual';
    this.currentListType = saved.listType || 'Supermercado';
    if (this.currentListNameEl) this.currentListNameEl.textContent = this.currentListName;
    this._updateCategories?.();
  }

  // ── Legacy shims (older global onclick= calls) ─────────────────
  getStorageData()    { return Storage.getRaw();    }
  saveStorageData(d)  { Storage.saveRaw(d);         }
  showToast(msg)      { UI.showToast(msg);           }
  showModal(m)        { UI.showModal(m);             }
  hideModal(m)        { UI.hideModal(m);             }
}

// ── Bootstrap ──────────────────────────────────────────────────────
const app = new ShoppingList();

// Global helpers used by inline onclick= attributes in HTML
function showModal(id) { const m = document.getElementById(id); if (m) UI.showModal(m); }
function hideModal(id) { const m = document.getElementById(id); if (m) UI.hideModal(m); }
function sendFeedback() {
  const inp = document.getElementById('feedbackInput');
  if (!inp?.value.trim()) { app.showToast('Digite seu feedback!'); return; }
  const d = Storage.getRaw();
  (d.feedbacks = d.feedbacks || []).push({
    text: inp.value.trim(), date: new Date().toISOString(), user: d.currentUser || 'Anônimo',
  });
  Storage.saveRaw(d);
  inp.value = '';
  hideModal('feedbackForm');
  app.showToast('Feedback enviado!');
}
