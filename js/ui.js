/**
 * js/ui.js — v3.2
 * ─────────────────────────────────────────────────────────────
 * All DOM mutations live here.
 *
 * Security rule:
 *   User-supplied strings (item names, list names, category names …)
 *   ALWAYS go through textContent / createElement — never innerHTML.
 *   innerHTML is only used for fully-trusted, hard-coded template
 *   strings that contain zero user data.
 *
 * Changes in v3.2 (relativas à original):
 *   • showModal/hideModal aceitam string OU elemento
 *   • showConfirm() adicionado (usado pelo app.js)
 *   • showListTypeSelection() corrigida (values são {emoji,categories})
 *   • Todas as demais funções preservadas 1:1
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const UI = (() => {

  // ── Sanitisation helpers ───────────────────────────────────────

  function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.textContent;
  }

  function setText(el, value) {
    if (el) el.textContent = String(value ?? '');
  }

  // ── Toast ──────────────────────────────────────────────────────

  function showToast(message) {
    document.querySelector('.toast')?.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = String(message);
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.cssText += 'opacity:0;transform:translateX(-50%) translateY(10px);transition:opacity .25s,transform .25s;';
      setTimeout(() => t.remove(), 260);
    }, 2800);
  }

  // ── Modals ─────────────────────────────────────────────────────
  // Aceita string (id) OU elemento DOM
  function _resolveModal(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return document.getElementById(ref);
    if (ref instanceof Element) return ref;
    return null;
  }

  function showModal(ref) {
    const modal = _resolveModal(ref);
    if (!modal) {
      console.warn('[UI.showModal] Elemento não encontrado:', ref);
      return;
    }
    modal.classList.add('show', 'active', 'visible');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function hideModal(ref) {
    const modal = _resolveModal(ref);
    if (!modal) return;
    modal.classList.remove('show', 'active', 'visible');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function hideAllModals() {
    document.querySelectorAll('.modal').forEach(m => {
      m.classList.remove('show', 'active', 'visible');
      m.style.display = 'none';
    });
    document.body.style.overflow = '';
  }

  // ── Confirm ────────────────────────────────────────────────────
  // Usa #confirmModal se existir; fallback nativo se não existir
  function showConfirm(message, onConfirm, onCancel) {
    const modal     = document.getElementById('confirmModal');
    const msgEl     = document.getElementById('confirmMessage');
    const okBtn     = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    if (!modal || !msgEl || !okBtn || !cancelBtn) {
      // Fallback nativo
      if (window.confirm(String(message))) onConfirm?.();
      else onCancel?.();
      return;
    }

    msgEl.textContent = String(message ?? 'Tem certeza?');

    // Clona para limpar listeners antigos
    const newOk     = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.replaceWith(newOk);
    cancelBtn.replaceWith(newCancel);

    newOk.addEventListener('click', () => {
      hideModal(modal);
      try { onConfirm?.(); } catch (e) { console.error(e); }
    });

    newCancel.addEventListener('click', () => {
      hideModal(modal);
      try { onCancel?.(); } catch (e) { console.error(e); }
    });

    showModal(modal);
  }

  // ── Theme ──────────────────────────────────────────────────────

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // ── List-type selection modal ──────────────────────────────────
  // CORRIGIDA: listTypes values são objetos { emoji, categories }
  function showListTypeSelection(listTypes, onSelect) {
    // Remove overlay anterior se existir
    document.querySelectorAll('.list-type-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'modal show active visible list-type-overlay';
    overlay.style.display = 'flex';

    const box = document.createElement('div');
    box.className = 'modal-content';

    const title = document.createElement('h3');
    title.textContent = '🛒 Escolha o tipo de lista';
    box.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'list-type-grid';

    Object.entries(listTypes).forEach(([type, config]) => {
      const emoji = (config && typeof config === 'object' && config.emoji)
        ? config.emoji
        : '📝';

      const btn = document.createElement('button');
      btn.className    = 'list-type-btn';
      btn.dataset.type = type;

      const eEl = document.createElement('div');
      eEl.textContent = emoji;

      const lEl = document.createElement('div');
      lEl.textContent = type;

      btn.appendChild(eEl);
      btn.appendChild(lEl);

      btn.addEventListener('click', () => {
        overlay.remove();
        document.body.style.overflow = '';
        try { onSelect(type); } catch (e) { console.error(e); }
      });

      grid.appendChild(btn);
    });

    box.appendChild(grid);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  // ── Item list rendering ────────────────────────────────────────

  function renderItems(items, filtered, handlers, formatPrice, calcUnit, getTrend, getCatEmoji) {
    const list = document.getElementById('itemList');
    if (!list) return;
    list.innerHTML = '';

    filtered.forEach(item => {
      const origIdx = items.indexOf(item);
      const uPrice  = calcUnit(item);
      const li      = document.createElement('li');
      if (item.completed) li.classList.add('completed');

      // Checkbox
      const cb      = document.createElement('input');
      cb.type       = 'checkbox';
      cb.className  = 'item-checkbox';
      cb.checked    = item.completed;
      cb.addEventListener('change', () => handlers.onToggle(origIdx));

      // Content
      const content = document.createElement('div');
      content.className = 'item-content';

      const nameEl = document.createElement('div');
      nameEl.className   = 'item-text';
      nameEl.textContent = item.name;   // safe

      const detailEl = document.createElement('div');
      detailEl.className   = 'item-details';
      detailEl.textContent = `${getCatEmoji(item.category)} ${item.category} · ${item.quantity} ${item.unit}`;

      content.appendChild(nameEl);
      content.appendChild(detailEl);

      // Prices block
      if (uPrice.wholesale > 0 || uPrice.retail > 0) {
        content.appendChild(_buildPricesBlock(uPrice, item, formatPrice));
      }

      // Cycle of consumption hint
      try {
        const lists = Storage.getSavedLists();
        const cycle = Calculator.estimateProductCycle(item.name, lists);
        if (cycle && cycle.avgDays) {
          const status = Calculator.productCycleStatus(cycle);
          const hintEl = document.createElement('div');
          let cls   = 'item-cycle-hint';
          let icon  = '⏳';
          let label = `Dura ~${cycle.avgDays} dias`;
          if (status?.overdue) {
            cls += ' overdue';
            icon = '⚠️';
            label = `Acaba há ${status.daysSinceLast - cycle.avgDays}d (comprar!)`;
          } else if (status?.runningOut) {
            cls += ' running-out';
            icon = '🔔';
            const days = cycle.nextEstimate
              ? Math.max(0, Math.round((cycle.nextEstimate - Date.now()) / 864e5))
              : '?';
            label = `~${days}d p/ repor`;
          }
          hintEl.className = cls;
          hintEl.textContent = `${icon} ${label}`;
          content.appendChild(hintEl);
        }
      } catch { /* storage not available yet */ }

      // Trend badge
      const trend = getTrend ? getTrend(item) : null;
      if (trend) content.appendChild(_buildTrendBadge(trend));

      // Action buttons
      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const mkBtn = (cls, icon, title, handler) => {
        const b       = document.createElement('button');
        b.className   = `item-btn ${cls}`;
        b.title       = title;
        b.textContent = icon;
        b.addEventListener('click', handler);
        return b;
      };

      actions.appendChild(mkBtn('hist-btn',   '📈', 'Histórico de preço', () => handlers.onHistory(origIdx)));
      actions.appendChild(mkBtn('edit-btn',   '✏️', 'Editar',             () => handlers.onEdit(origIdx)));
      actions.appendChild(mkBtn('delete-btn', '🗑️', 'Excluir',            () => handlers.onDelete(origIdx)));

      li.appendChild(cb);
      li.appendChild(content);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function _buildPricesBlock(uPrice, item, formatPrice) {
    const div = document.createElement('div');
    div.className = 'item-prices';

    [
      { label: 'ATK', value: uPrice.wholesale, unit: uPrice.unitWholesale },
      { label: 'VRJ', value: uPrice.retail,    unit: uPrice.unitRetail    },
    ].forEach(({ label, value, unit }) => {
      if (value <= 0) return;
      const row = document.createElement('div');
      row.className = 'price-item';

      const lbl = document.createElement('span');
      lbl.className = 'price-label';
      lbl.textContent = label + ':';

      const val = document.createElement('span');
      val.className = 'price-value';
      val.textContent = `R$ ${formatPrice(value)}`;

      const uEl = document.createElement('span');
      uEl.className = 'price-unit';
      uEl.textContent = `(R$ ${unit.toFixed(2)}/${item.unit})`;

      row.appendChild(lbl);
      row.appendChild(val);
      row.appendChild(uEl);
      div.appendChild(row);
    });
    return div;
  }

  function _buildTrendBadge(trend) {
    const s = document.createElement('span');
    s.className   = `price-trend trend-${trend.direction}`;
    s.textContent = `${trend.arrow} ${trend.label}`;
    return s;
  }

  // ── Stats bar ──────────────────────────────────────────────────

  function renderStats(items, totals, formatPrice) {
    setText(document.getElementById('totalItems'),   items.length);
    setText(document.getElementById('totalGeneral'), `R$${formatPrice(totals.general)}`);
    setText(document.getElementById('totalEconomy'), `R$${formatPrice(totals.economy)}`);
  }

  // ── Empty state ────────────────────────────────────────────────

  function renderEmptyState(filtered) {
    document.getElementById('emptyState')?.classList.toggle('show', filtered.length === 0);
  }

  // ── History modal ──────────────────────────────────────────────

  function renderHistory(savedLists, handlers) {
    const container = document.getElementById('historyList');
    if (!container) return;
    container.innerHTML = '';

    if (savedLists.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'text-align:center;color:var(--txt-3);font-family:var(--mono);font-size:.75rem;padding:20px 0;';
      p.textContent   = 'Nenhuma lista salva ainda.';
      container.appendChild(p);
      return;
    }

    savedLists.forEach((list, index) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const info = document.createElement('div');

      const name = document.createElement('div');
      name.className   = 'history-name';
      name.textContent = list.name;   // safe

      const dateStr = list.purchaseDate
        ? new Date(list.purchaseDate).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : (list.date ? new Date(list.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

      const PAY_ICO = {
        dinheiro:'💵', pix:'⚡', cartao_credito:'💳 Cré', cartao_debito:'💳 Déb',
        vale_alimentacao:'🥗', vale_refeicao:'🍽️', outro:'📌'
      };

      const pmts = Array.isArray(list.payments) && list.payments.length
        ? list.payments
        : list.paymentMethod
          ? [{ method: list.paymentMethod, amount: 0 }]
          : [];

      const payStr = pmts.length
        ? '  ·  ' + pmts.map(p =>
            (PAY_ICO[p.method] || '💳') + (p.amount > 0 ? ' R$' + p.amount.toFixed(0) : '')
          ).join(' + ')
        : '';

      const mktStr  = list.market ? `  ·  🏪 ${list.market}` : '';

      const details = document.createElement('div');
      details.className   = 'history-details';
      details.textContent = `📅 ${dateStr}  ·  ${list.items.length} itens${payStr}${mktStr}`;

      info.appendChild(name);
      info.appendChild(details);

      const acts = document.createElement('div');
      acts.className = 'history-actions';

      const loadBtn = _mkBtn('btn btn-primary btn-sm',   'Carregar', () => handlers.onLoad(index));
      const editBtn = _mkBtn('btn btn-secondary btn-sm', '📅 Data',  () => handlers.onEditDate(index));
      const delBtn  = _mkBtn('btn btn-danger  btn-sm',   'Excluir',  () => handlers.onDelete(index));

      acts.appendChild(loadBtn);
      acts.appendChild(editBtn);
      acts.appendChild(delBtn);

      item.appendChild(info);
      item.appendChild(acts);
      container.appendChild(item);
    });
  }

  // ── Custom categories ──────────────────────────────────────────

  function renderCustomCategories(cats, onRemove) {
    const container = document.getElementById('customCategoriesList');
    if (!container) return;
    container.innerHTML = '';

    const entries = Object.entries(cats);
    if (entries.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'text-align:center;color:var(--txt-3);font-size:.75rem;margin:12px 0;';
      p.textContent   = 'Nenhuma categoria personalizada';
      container.appendChild(p);
      return;
    }

    entries.forEach(([name, emoji]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg-card);border:1px solid var(--line);border-radius:var(--r-xs);margin-bottom:4px;';

      const lbl = document.createElement('span');
      lbl.textContent = `${emoji} ${name}`;   // safe

      const btn = _mkBtn('btn btn-danger btn-sm', 'Remover', () => onRemove(name));

      row.appendChild(lbl);
      row.appendChild(btn);
      container.appendChild(row);
    });
  }

  // ── Price history modal ────────────────────────────────────────

  function renderPriceHistoryModal(itemName, history) {
    const modal   = document.getElementById('priceHistoryModal');
    const titleEl = document.getElementById('priceHistoryTitle');
    const content = document.getElementById('priceHistoryContent');
    if (!modal || !content) return;

    if (titleEl) titleEl.textContent = `📈 Histórico de Preços — ${itemName}`;
    content.innerHTML = '';

    if (history.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'text-align:center;color:var(--txt-3);font-size:.8rem;padding:24px 0;';
      p.textContent   = 'Ainda não há histórico de preço para este produto.';
      content.appendChild(p);
      showModal(modal);
      return;
    }

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.75rem;';

    const thead = table.createTHead();
    const hr    = thead.insertRow();
    ['Data', 'Atacado', 'Varejo', 'Tendência'].forEach(h => {
      const th = document.createElement('th');
      th.style.cssText = 'text-align:left;padding:7px 8px;border-bottom:2px solid var(--line);color:var(--txt-3);font-weight:600;letter-spacing:.06em;text-transform:uppercase;';
      th.textContent = h;
      hr.appendChild(th);
    });

    const tbody = table.createTBody();
    history.forEach((entry, i) => {
      const prev      = i > 0 ? history[i - 1] : null;
      const prevPrice = prev ? (prev.wholesale || prev.retail) : 0;
      const currPrice = entry.wholesale || entry.retail;

      let trendTxt   = '—';
      let trendColor = 'var(--txt-3)';

      if (prevPrice > 0 && currPrice > 0) {
        const diff = currPrice - prevPrice;
        const pct  = Math.abs((diff / prevPrice) * 100).toFixed(1);
        if (Math.abs(diff) < 0.005) { trendTxt = '→ Estável'; }
        else if (diff > 0) { trendTxt = `↑ +${pct}%`; trendColor = 'var(--danger)'; }
        else               { trendTxt = `↓ ${pct}%`;  trendColor = 'var(--accent)'; }
      }

      const row = tbody.insertRow();
      row.style.borderBottom = '1px solid var(--line)';

      [
        new Date(entry.date).toLocaleDateString('pt-BR'),
        entry.wholesale > 0 ? `R$ ${entry.wholesale.toFixed(2)}` : '—',
        entry.retail    > 0 ? `R$ ${entry.retail.toFixed(2)}`    : '—',
        trendTxt,
      ].forEach((txt, ci) => {
        const td = row.insertCell();
        td.style.cssText = `padding:7px 8px;color:${ci === 3 ? trendColor : 'var(--txt-2)'};`;
        td.textContent   = txt;
      });
    });

    content.appendChild(table);
    showModal(modal);
  }

  // ── Comparison results ─────────────────────────────────────────

  function renderComparisonResults(comparison, name1, name2) {
    const container = document.getElementById('compareResults');
    if (!container) return;
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'comparison-results';

    [
      {
        title: `📋 Em comum (${comparison.common.length})`,
        texts: comparison.common.map(({ item1, item2 }) =>
          `${item1.name} — ${sanitize(name1)}: ${item1.quantity} ${item1.unit} | ${sanitize(name2)}: ${item2.quantity} ${item2.unit}`)
      },
      {
        title: `📝 Só em ${sanitize(name1)} (${comparison.onlyInList1.length})`,
        texts: comparison.onlyInList1.map(i => `${i.name} — ${i.quantity} ${i.unit}`)
      },
      {
        title: `📝 Só em ${sanitize(name2)} (${comparison.onlyInList2.length})`,
        texts: comparison.onlyInList2.map(i => `${i.name} — ${i.quantity} ${i.unit}`)
      },
    ].forEach(({ title, texts }) => {
      const sec = document.createElement('div');
      sec.className = 'comparison-section';

      const h = document.createElement('h5');
      h.textContent = title;
      sec.appendChild(h);

      if (texts.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Nenhum item';
        sec.appendChild(p);
      } else {
        texts.forEach(txt => {
          const d = document.createElement('div');
          d.className   = 'comparison-item';
          d.textContent = txt;
          sec.appendChild(d);
        });
      }
      wrap.appendChild(sec);
    });

    container.appendChild(wrap);
  }

  // ── Profile / Config Helpers ───────────────────────────────────

  function fillConfigProfile(user) {
    if (!user) return;
    const nameInput  = document.getElementById('profileName');
    const photoInput = document.getElementById('profilePhotoUrl');

    if (nameInput) {
      nameInput.value = user.user_metadata?.apelido
                     || user.user_metadata?.nome
                     || user.email.split('@')[0]
                     || '';
    }
    if (photoInput) {
      photoInput.value = user.user_metadata?.avatar_url || '';
    }
  }

  function getProfileFormData() {
    return {
      name:     document.getElementById('profileName')?.value.trim(),
      photoUrl: document.getElementById('profilePhotoUrl')?.value.trim(),
      password: document.getElementById('profileNewPassword')?.value
    };
  }

  function clearProfilePassword() {
    const p = document.getElementById('profileNewPassword');
    if (p) p.value = '';
  }

  // ── Internal helper ────────────────────────────────────────────

  function _mkBtn(cls, label, handler) {
    const b = document.createElement('button');
    b.className   = cls;
    b.textContent = label;
    b.addEventListener('click', handler);
    return b;
  }

  // ── Exports ────────────────────────────────────────────────────
  return {
    sanitize, setText,
    showToast, showModal, hideModal, hideAllModals, showConfirm, applyTheme,
    showListTypeSelection,
    renderItems, renderStats, renderEmptyState,
    renderHistory, renderCustomCategories,
    renderPriceHistoryModal, renderComparisonResults,
    fillConfigProfile, getProfileFormData, clearProfilePassword
  };

})();