/**
 * js/storage.js  ·  schema v3
 * ─────────────────────────────────────────────────────────────
 * Schema v3:
 * {
 *   schemaVersion:  3,
 *   theme:          'light' | 'dark',
 *   currentList:    { items[], name, listType },
 *   savedLists:     [{ name, items[], listType,
 *                      createdAt,     ← when saved to app (auto)
 *                      purchaseDate,  ← date of purchase (user-set, or null)
 *                      payments: [{ method, amount }],   ← NEW v3
 *                      market,        ← store/market name (user-set, or null)
 *                      total,         ← cached grand total
 *                      date }],       ← legacy compat
 *   customCategories: { [listType]: { [name]: emoji } },
 *   priceHistory:   { [normKey]: [{ date, wholesale, retail }] },
 *   feedbacks:      [{ text, date, user }]
 * }
 *
 * Payment methods: dinheiro | pix | cartao_credito | cartao_debito |
 *                  vale_alimentacao | vale_refeicao | outro
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const Storage = (() => {

  const DATA_KEY  = 'shoppingListData';
  const THEME_KEY = 'theme';
  const MAX_HIST  = 30;
  const SCHEMA_V  = 3;

  // ── Low-level ──────────────────────────────────────────────────
  function _read() {
    try {
      const raw = JSON.parse(localStorage.getItem(DATA_KEY)) || {};
      return _migrate(raw);
    } catch {
      return { schemaVersion: SCHEMA_V };
    }
  }
  function _write(data) {
    try   { localStorage.setItem(DATA_KEY, JSON.stringify(data)); return true; }
    catch (e) { console.error('[Storage] write failed:', e); return false; }
  }

  // ── Migration ─────────────────────────────────────────────────
  function _migrate(data) {
    const v = data.schemaVersion || 1;
    if (v >= SCHEMA_V) return data;

    if (data.savedLists) {
      data.savedLists = data.savedLists.map(l => normalizeList(l));
    }

    data.schemaVersion = SCHEMA_V;
    try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    console.info('[Storage] migrated to schema v' + SCHEMA_V);
    return data;
  }

  // ── Normalisation ─────────────────────────────────────────────
  /**
   * Ensures every list entry has a consistent, forward-compatible shape.
   * Idempotent — safe to call multiple times on the same object.
   *
   * Migration rules:
   *   v1/v2 had `paymentMethod` (string) → convert to `payments` array
   *   v3 has `payments: [{method, amount}]`
   */
  function normalizeList(list, totalHint) {
    const now = new Date().toISOString();

    // ── purchaseDate ────────────────────────────────────────────
    let purchaseDate = list.purchaseDate || null;
    if (purchaseDate) {
      const d = new Date(purchaseDate);
      purchaseDate = isNaN(d) ? null : d.toISOString();
    }

    // ── payments ────────────────────────────────────────────────
    let payments;
    if (Array.isArray(list.payments) && list.payments.length) {
      // Already in v3 format — validate each entry
      payments = list.payments
        .filter(p => p && p.method)
        .map(p => ({ method: String(p.method), amount: parseFloat(p.amount) || 0 }));
    } else if (list.paymentMethod) {
      // v1/v2 single string → convert to array
      const amount = parseFloat(list.total) || totalHint || 0;
      payments = [{ method: list.paymentMethod, amount }];
    } else {
      payments = [];
    }

    return {
      ...list,
      createdAt:    list.createdAt || list.savedAt || list.date || now,
      purchaseDate,
      payments,
      market:       list.market || null,
      // Keep legacy 'date' for backwards compat
      date:         purchaseDate || list.createdAt || list.savedAt || list.date || now,
    };
  }

  // ── Theme ─────────────────────────────────────────────────────
  function getTheme()  { return localStorage.getItem(THEME_KEY) || 'light'; }
  function setTheme(t) {
    localStorage.setItem(THEME_KEY, t);
    const d = _read(); d.theme = t; _write(d);
  }

  // ── Working list ──────────────────────────────────────────────
  function saveCurrentList(items, name, listType) {
    const d = _read(); d.currentList = { items, name, listType }; _write(d);
  }
  function loadCurrentList() { return _read().currentList || null; }

  // ── Saved (named) lists ───────────────────────────────────────
  function getSavedLists() { return _read().savedLists || []; }

  /**
   * @param {string}      name
   * @param {Array}       items
   * @param {string}      listType
   * @param {string|null} purchaseDate — ISO string or null
   * @param {Array}       payments     — [{method, amount}]
   * @param {number}      total        — list grand total (cached)
   */
  function saveNamedList(name, items, listType, purchaseDate, payments, total, market) {
    const d = _read();
    d.savedLists = d.savedLists || [];

    const existing = d.savedLists.find(l => l.name === name);

    const entry = normalizeList({
      ...(existing || {}),
      name,
      items:        [...items],
      listType,
      createdAt:    existing?.createdAt || new Date().toISOString(),
      purchaseDate: purchaseDate !== undefined ? purchaseDate : (existing?.purchaseDate || null),
      payments:     payments     !== undefined ? payments     : (existing?.payments     || []),
      total:        total        !== undefined ? total        : (existing?.total        || 0),
      market:       market       !== undefined ? (market || null) : (existing?.market   || null),
    }, total);

    const idx = d.savedLists.findIndex(l => l.name === name);
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

  // ── Custom categories ─────────────────────────────────────────
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

  // ── Price history ─────────────────────────────────────────────
  function _normKey(name) {
    return String(name).toLowerCase().trim().replace(/\s+/g, '_');
  }
  function recordPrice(itemName, wholesale, retail) {
    if (!itemName || (wholesale <= 0 && retail <= 0)) return;
    const d = _read();
    d.priceHistory = d.priceHistory || {};
    const key  = _normKey(itemName);
    const hist = d.priceHistory[key] || [];
    hist.push({ date: new Date().toISOString(), wholesale, retail });
    if (hist.length > MAX_HIST) hist.splice(0, hist.length - MAX_HIST);
    d.priceHistory[key] = hist;
    _write(d);
  }
  function getPriceHistory(itemName) {
    return (_read().priceHistory || {})[_normKey(itemName)] || [];
  }

  // ── JSON Backup ───────────────────────────────────────────────
  function exportBackup() {
    const json = JSON.stringify(_read(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `lista-compras-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    return new Promise(resolve => {
      if (!file || !file.name.endsWith('.json'))
        return resolve({ ok: false, message: 'Arquivo inválido. Use um .json de backup.' });
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const incoming = JSON.parse(e.target.result);
          const current  = _read();
          const existingNames = new Set((current.savedLists || []).map(l => l.name));
          const newLists = (incoming.savedLists || [])
            .map(l => normalizeList(l))
            .filter(l => !existingNames.has(l.name));
          current.savedLists = [...(current.savedLists || []), ...newLists];
          const inHist = incoming.priceHistory || {};
          current.priceHistory = current.priceHistory || {};
          Object.keys(inHist).forEach(key => {
            const merged  = [...(current.priceHistory[key] || []), ...(inHist[key] || [])];
            const seen    = new Set();
            current.priceHistory[key] = merged
              .filter(e => { if (seen.has(e.date)) return false; seen.add(e.date); return true; })
              .slice(-MAX_HIST);
          });
          const inCats = incoming.customCategories || {};
          current.customCategories = current.customCategories || {};
          Object.keys(inCats).forEach(lt => {
            current.customCategories[lt] = { ...(current.customCategories[lt] || {}), ...(inCats[lt] || {}) };
          });
          _write(current);
          resolve({ ok: true, message: `Backup restaurado! ${newLists.length} lista(s) nova(s) importada(s).` });
        } catch { resolve({ ok: false, message: 'Falha ao ler o arquivo — JSON inválido.' }); }
      };
      reader.onerror = () => resolve({ ok: false, message: 'Erro ao ler o arquivo.' });
      reader.readAsText(file);
    });
  }

  function getRaw()        { return _read();    }
  function saveRaw(data)   { return _write(data); }

  return {
    getTheme, setTheme,
    saveCurrentList, loadCurrentList,
    getSavedLists, saveNamedList, deleteNamedList,
    getCustomCategories, addCustomCategory, removeCustomCategory,
    recordPrice, getPriceHistory,
    exportBackup, importBackup,
    normalizeList,
    getRaw, saveRaw,
  };
})();
