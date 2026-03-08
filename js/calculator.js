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

  return { calculateUnitPrice, calculateTotals, formatPrice, priceTrend, debounce, generateId };
})();
