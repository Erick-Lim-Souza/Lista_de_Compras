/**
 * js/calculator.js
 * ─────────────────────────────────────────────────────────────
 * Pure calculation engine — no DOM, no localStorage, no side-effects.
 * Every function is a deterministic (input → output) transformation.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const Calculator = (() => {

  // ── Unit normalisation ──────────────────────────────────────
  // g → kg  (÷1000), ml → l  (÷1000). Everything else unchanged.
  function _normaliseQty(rawQty, unit) {
    const qty = parseFloat(rawQty) || 1;
    if (unit === 'g')  return qty / 1000;
    if (unit === 'ml') return qty / 1000;
    return qty;
  }

  /**
   * Returns total prices for a single item.
   * @returns {{ wholesale, retail, unitWholesale, unitRetail, qty }}
   */
  function calculateUnitPrice(item) {
    const qty = _normaliseQty(item.quantity, item.unit);
    const pw  = parseFloat(item.priceWholesale) || 0;
    const pr  = parseFloat(item.priceRetail)    || 0;
    return { wholesale: qty * pw, retail: qty * pr, unitWholesale: pw, unitRetail: pr, qty };
  }

  /**
   * Grand totals across all *pending* items.
   * @returns {{ general, economy, wholesale, retail }}
   */
  function calculateTotals(items) {
    let general = 0, economy = 0, wholesale = 0, retail = 0;
    items.forEach(item => {
      if (item.completed) return;
      const p = calculateUnitPrice(item);
      wholesale += p.wholesale;
      retail    += p.retail;
      general   += item.priceWholesale > 0 ? p.wholesale : p.retail;
      if (item.priceWholesale > 0 && item.priceRetail > 0) economy += p.retail - p.wholesale;
    });
    return { general, economy, wholesale, retail };
  }

  /**
   * Formats a monetary value: 2 dp minimum, 3 dp only when the third
   * decimal is non-zero (needed for per-gram / per-ml unit pricing).
   * Always returns a string.
   */
  function formatPrice(value) {
    const n = parseFloat(value) || 0;
    const s = n.toFixed(3);
    return s.endsWith('0') ? n.toFixed(2) : s;
  }

  /**
   * Compares currentPrice against the last entry in history[].
   * @param  {number} currentPrice
   * @param  {Array}  history  — [{date,wholesale,retail},…]  oldest→newest
   * @returns {{ arrow, label, pct, direction } | null}
   */
  function priceTrend(currentPrice, history) {
    if (!history || history.length === 0 || currentPrice <= 0) return null;
    const last = history[history.length - 1];
    const prev = last.wholesale > 0 ? last.wholesale : last.retail;
    if (prev <= 0) return null;

    const diff = currentPrice - prev;
    const pct  = Math.abs((diff / prev) * 100).toFixed(1);

    if (Math.abs(diff) < 0.005) return { arrow: '→', label: 'Estável', pct: '0.0', direction: 'stable' };
    return diff > 0
      ? { arrow: '↑', label: `+${pct}%`, pct, direction: 'up'   }
      : { arrow: '↓', label: `${pct}%`,  pct, direction: 'down' };
  }

  /** Debounce — ready for future autocomplete / live-search. */
  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Collision-resistant UUID.
   * Uses crypto.randomUUID() when available; falls back to a
   * time + crypto.getRandomValues() hybrid (never Date.now() alone).
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const arr = new Uint8Array(16);
    (crypto || window.crypto).getRandomValues(arr);
    arr[6] = (arr[6] & 0x0f) | 0x40; // version 4
    arr[8] = (arr[8] & 0x3f) | 0x80; // variant
    return [...arr].map((b, i) =>
      ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0')
    ).join('');
  }

  /**
   * Calcula a média de dias entre compras de um produto específico.
   * Usa listas salvas com purchaseDate ou createdAt para montar a linha do tempo.
   *
   * @param {string} itemName     — nome do produto
   * @param {Array}  savedLists   — array de listas salvas
   * @returns {{ avgDays:number, occurrences:number, lastDate:Date, nextEstimate:Date } | null}
   */
  function estimateProductCycle(itemName, savedLists) {
    const norm = String(itemName).toLowerCase().trim();
    const dates = [];

    (savedLists || []).forEach(list => {
      const found = (list.items || []).find(it =>
        String(it.name).toLowerCase().trim() === norm
      );
      if (!found) return;
      const raw = list.purchaseDate || list.createdAt || list.date;
      if (!raw) return;
      const d = new Date(raw);
      if (!isNaN(d)) dates.push(d);
    });

    if (dates.length < 2) return dates.length === 1
      ? { avgDays: null, occurrences: 1, lastDate: dates[0], nextEstimate: null }
      : null;

    dates.sort((a, b) => a - b);

    let total = 0;
    for (let i = 1; i < dates.length; i++) {
      total += (dates[i] - dates[i - 1]) / 864e5;
    }
    const avgDays     = Math.round(total / (dates.length - 1));
    const lastDate    = dates[dates.length - 1];
    const nextEstimate = new Date(lastDate.getTime() + avgDays * 864e5);

    return { avgDays, occurrences: dates.length, lastDate, nextEstimate };
  }

  /**
   * Returns how many days since lastDate and whether the item is likely running out.
   * "running out" = daysSinceLast >= (avgDays * 0.85)
   */
  function productCycleStatus(cycleResult) {
    if (!cycleResult || !cycleResult.lastDate) return null;
    const daysSinceLast = Math.round((Date.now() - cycleResult.lastDate.getTime()) / 864e5);
    const pct = cycleResult.avgDays ? daysSinceLast / cycleResult.avgDays : 0;
    return {
      daysSinceLast,
      pct: Math.min(pct, 1),
      runningOut: pct >= 0.85,
      overdue:    pct >= 1.0,
    };
  }

  /**
   * Motor Preditivo: Analisa todos os produtos do histórico e calcula urgência.
   * @param {Array} savedLists - Histórico de listas salvas.
   * @param {Object} options - Opções de filtragem (ex: minOccurrences).
   * @returns {Array} Lista de produtos analisados com status de urgência.
   */
function analyzeAllProducts(savedLists, options = {}) {
  const minOccurrences = options.minOccurrences || 1;
  const productMap = new Map();

  (savedLists || []).forEach(list => {
    const listDate = list.purchaseDate || list.createdAt || list.date;
    if (!listDate) return;
    const dateObj = new Date(listDate);
    if (isNaN(dateObj)) return;

    (list.items || []).forEach(item => {
      const name = item.name.trim();
      const norm = name.toLowerCase();
      if (!productMap.has(norm)) {
        productMap.set(norm, {
          name,
          norm,
          category: item.category,
          listType: list.listType,
          purchases: [],   // array de {date, price, qty, unit}
        });
      }
      const p = productMap.get(norm);
      p.purchases.push({
        date: dateObj,
        price: item.priceWholesale > 0 ? item.priceWholesale : item.priceRetail,
        qty: item.quantity,
        unit: item.unit
      });
    });
  });

  const results = [];
  productMap.forEach(p => {
    if (p.purchases.length < minOccurrences) return;
    p.purchases.sort((a, b) => a.date - b.date);
    const last = p.purchases[p.purchases.length - 1];
    const first = p.purchases[0];
    const lastDate = last.date;

    let avgDays = null;
    if (p.purchases.length >= 2) {
      let totalDiff = 0;
      for (let i = 1; i < p.purchases.length; i++) {
        totalDiff += (p.purchases[i].date - p.purchases[i-1].date) / 864e5;
      }
      avgDays = Math.round(totalDiff / (p.purchases.length - 1));
    }

    const daysSinceLast = Math.round((Date.now() - lastDate.getTime()) / 864e5);
    const pct = avgDays ? daysSinceLast / avgDays : 0;
    let urgency = 'unknown';
    if (avgDays) {
      if (pct >= 1.0) urgency = 'overdue';
      else if (pct >= 0.85) urgency = 'soon';
      else urgency = 'ok';
    }

    results.push({
      name: p.name,
      norm: p.norm,
      category: p.category,
      listType: p.listType,
      occurrences: p.purchases.length,
      lastDate,
      avgDays,
      daysSinceLast,
      daysUntilNext: avgDays ? Math.max(0, avgDays - daysSinceLast) : null,
      pct: Math.min(pct, 1.2),
      urgency,
      lastPrice: last.price,
      lastQty: last.qty,
      lastUnit: last.unit
    });
  });

  return results.sort((a, b) => {
    const score = { overdue: 3, soon: 2, ok: 1, unknown: 0 };
    return score[b.urgency] - score[a.urgency] || b.pct - a.pct;
  });
}

  return { 
    calculateUnitPrice, 
    calculateTotals, 
    formatPrice, 
    priceTrend, 
    debounce, 
    generateId, 
    estimateProductCycle, 
    productCycleStatus,
    analyzeAllProducts 
  };
})();
