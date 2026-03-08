/**
 * js/storage.js
 * ─────────────────────────────────────────────────────────────
* Centraliza todas as operações de leitura/gravação do localStorage.
* Também é responsável pelo backup JSON (exportação/importação) e pelo histórico de preços por produto.
*
* Esquema do localStorage (chave: 'shoppingListData'):
* {
* tema: 'light' | 'dark',
* listaAtual: { itens[], nome, tipoDaLista },
* listasSalvas: [{ nome, itens[], tipoDaLista, data }],
* categoriasPersonalizadas: { [tipoDaLista]: { [nome]: emoji } },
* históricoDePreços: { [chaveNorma]: [{ data, atacado, varejo }] },
* feedbacks: [{ texto, data, usuário }]
 * }
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const Storage = (() => {

  const DATA_KEY  = 'shoppingListData';
  const THEME_KEY = 'theme';
  const MAX_HIST  = 30;   // price-history entries kept per product

  // ── Low-level ─────────────────────────────────────────────────
  function _read() {
    try   { return JSON.parse(localStorage.getItem(DATA_KEY)) || {}; }
    catch { return {}; }
  }
  function _write(data) {
    try   { localStorage.setItem(DATA_KEY, JSON.stringify(data)); return true; }
    catch (e) { console.error('[Storage] write failed:', e); return false; }
  }

  // ── Theme ──────────────────────────────────────────────────────
  function getTheme()    { return localStorage.getItem(THEME_KEY) || 'light'; }
  function setTheme(t)   {
    localStorage.setItem(THEME_KEY, t);
    const d = _read(); d.theme = t; _write(d);
  }

  // ── Working list ───────────────────────────────────────────────
  function saveCurrentList(items, name, listType) {
    const d = _read(); d.currentList = { items, name, listType }; _write(d);
  }
  function loadCurrentList() { return _read().currentList || null; }

  // ── Saved (named) lists ────────────────────────────────────────
  function getSavedLists() { return _read().savedLists || []; }

  function saveNamedList(name, items, listType, date) {
    const d     = _read();
    d.savedLists = d.savedLists || [];
    const entry  = { name, items: [...items], listType, date: date || new Date().toISOString() };
    const idx    = d.savedLists.findIndex(l => l.name === name);
    if (idx >= 0) d.savedLists[idx] = entry; else d.savedLists.push(entry);
    return _write(d);
  }

  function deleteNamedList(index) {
    const d = _read();
    const lists = d.savedLists || [];
    if (!lists[index]) return false;
    lists.splice(index, 1);
    d.savedLists = lists;
    return _write(d);
  }

  // ── Custom categories ──────────────────────────────────────────
  function getCustomCategories(listType) {
    return (_read().customCategories || {})[listType] || {};
  }
  function addCustomCategory(listType, name, emoji) {
    const d = _read();
    d.customCategories = d.customCategories || {};
    d.customCategories[listType] = d.customCategories[listType] || {};
    d.customCategories[listType][name] = emoji;
    return _write(d);
  }
  function removeCustomCategory(listType, name) {
    const d = _read();
    if (d.customCategories?.[listType]) {
      delete d.customCategories[listType][name];
      return _write(d);
    }
    return false;
  }

  // ── Price history ──────────────────────────────────────────────
  function _normKey(name) {
    return String(name).toLowerCase().trim().replace(/\s+/g, '_');
  }

  /**
   * Records a price snapshot for a product.
   * Call whenever an item with a price is added or edited.
   */
  function recordPrice(itemName, wholesale, retail) {
    if (!itemName || (wholesale <= 0 && retail <= 0)) return;
    const d = _read();
    d.priceHistory = d.priceHistory || {};
    const key = _normKey(itemName);
    const hist = d.priceHistory[key] || [];
    hist.push({ date: new Date().toISOString(), wholesale, retail });
    if (hist.length > MAX_HIST) hist.splice(0, hist.length - MAX_HIST);
    d.priceHistory[key] = hist;
    _write(d);
  }

  /** Returns the full price history for a product (oldest → newest). */
  function getPriceHistory(itemName) {
    return (_read().priceHistory || {})[_normKey(itemName)] || [];
  }

  // ── JSON Backup ────────────────────────────────────────────────

  /** Triggers a browser-download of the full data store as .json */
  function exportBackup() {
    const json = JSON.stringify(_read(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lista-compras-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Reads a .json backup File, merges it with existing data.
   * Merge strategy:
   *   • savedLists:       incoming lists with new names are appended
   *   • priceHistory:     entries merged & de-duped per product key
   *   • customCategories: merged (incoming wins on name conflict)
   *   • currentList/theme: kept from local (not overwritten)
   *
   * @returns {Promise<{ok:boolean, message:string}>}
   */
  function importBackup(file) {
    return new Promise(resolve => {
      if (!file || !file.name.endsWith('.json')) {
        return resolve({ ok: false, message: 'Arquivo inválido. Use um .json de backup.' });
      }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const incoming = JSON.parse(e.target.result);
          const current  = _read();

          // Merge savedLists by name
          const existingNames = new Set((current.savedLists || []).map(l => l.name));
          const newLists = (incoming.savedLists || []).filter(l => !existingNames.has(l.name));
          current.savedLists = [...(current.savedLists || []), ...newLists];

          // Merge priceHistory
          const inHist = incoming.priceHistory || {};
          current.priceHistory = current.priceHistory || {};
          Object.keys(inHist).forEach(key => {
            const merged  = [...(current.priceHistory[key] || []), ...(inHist[key] || [])];
            const seen    = new Set();
            const deduped = merged.filter(e => { if (seen.has(e.date)) return false; seen.add(e.date); return true; });
            current.priceHistory[key] = deduped.slice(-MAX_HIST);
          });

          // Merge customCategories
          const inCats = incoming.customCategories || {};
          current.customCategories = current.customCategories || {};
          Object.keys(inCats).forEach(lt => {
            current.customCategories[lt] = { ...(current.customCategories[lt] || {}), ...(inCats[lt] || {}) };
          });

          _write(current);
          resolve({ ok: true, message: `Backup restaurado! ${newLists.length} lista(s) nova(s) importada(s).` });
        } catch {
          resolve({ ok: false, message: 'Falha ao ler o arquivo — JSON inválido.' });
        }
      };
      reader.onerror = () => resolve({ ok: false, message: 'Erro ao ler o arquivo.' });
      reader.readAsText(file);
    });
  }

  // ── Raw access (for legacy global functions) ───────────────────
  function getRaw()      { return _read();   }
  function saveRaw(data) { return _write(data); }

  return {
    getTheme, setTheme,
    saveCurrentList, loadCurrentList,
    getSavedLists, saveNamedList, deleteNamedList,
    getCustomCategories, addCustomCategory, removeCustomCategory,
    recordPrice, getPriceHistory,
    exportBackup, importBackup,
    getRaw, saveRaw,
  };
})();
