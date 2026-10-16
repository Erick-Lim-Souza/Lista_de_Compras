/**
 * js/storage.js — v3.2
 * ─────────────────────────────────────────────────────────────
 * Persistência no Supabase.
 *
 * Tabelas usadas:
 *   • lists              (draft + completed)
 *   • list_items         (itens por lista)
 *   • payments           (pagamentos por lista)
 *   • custom_categories  (categorias personalizadas)
 *   • price_history      (view — somente leitura)
 *   • user_settings      (meta mensal)
 *
 * Compatível com app.js v3.1 e ui.js v3.2.
 * ─────────────────────────────────────────────────────────────
 */
'use strict';

const Storage = (() => {

  // ═══════════════════════════════════════════════════════════
  // RESOLVE CLIENTE SUPABASE
  // ═══════════════════════════════════════════════════════════
  function _sb() {
    const client = window.supabaseClient;
    if (!client || typeof client.from !== 'function') {
      throw new Error(
        '[Storage] window.supabaseClient não inicializado. ' +
        'Confirme que js/supabase-client.js foi carregado antes de js/storage.js.'
      );
    }
    return client;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS INTERNOS
  // ═══════════════════════════════════════════════════════════

  /**
   * Retorna o usuário autenticado, normalizando o formato
   * de Auth.getUser() — aceita:
   *   • { data: { user } }   (Supabase oficial)
   *   • { user }             (wrapper)
   *   • user direto          (wrapper síncrono)
   */
  async function _getUser() {
    try {
      const res = await Auth.getUser();
      const u = res?.data?.user || res?.user || res;
      return (u && u.id) ? u : null;
    } catch {
      return null;
    }
  }

  /**
   * Busca ou cria o draft (rascunho) do usuário logado.
   * Usa maybeSingle() para não explodir quando não existe.
   */
  async function _getDraft() {
    const user = await _getUser();
    if (!user) return null;

    // 1. Tenta achar um draft existente
    const { data: existing, error: selError } = await _sb()
      .from('lists')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selError) {
      console.error('[Storage._getDraft] select:', selError);
    }

    if (existing) return existing;

    // 2. Não existe → cria um novo
    const { data: created, error: insError } = await _sb()
      .from('lists')
      .insert([{
        user_id:   user.id,
        name:      'Lista Atual',
        status:    'draft',
        list_type: 'Supermercado'
      }])
      .select()
      .single();

    if (insError) {
      console.error('[Storage._getDraft] insert:', insError);
      return null;
    }

    return created;
  }

  /** Converte valor numérico com fallback. */
  function _num(v, fallback = 0) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Mapeia uma linha de list_items (snake_case) para o formato do app.js. */
  function _rowToItem(row) {
    return {
      id:             row.id,
      name:           row.name,
      category:       row.category || 'Outros',
      unit:           row.unit || 'un',
      quantity:       _num(row.quantity, 1),
      priceWholesale: _num(row.wholesale_price, 0),
      priceRetail:    _num(row.retail_price, 0),
      completed:      !!row.completed
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 1. LISTA ATUAL (DRAFT)
  // ═══════════════════════════════════════════════════════════

  /**
   * Retorna os itens do draft atual (formato pronto para o app.js).
   */
  async function getCurrentList() {
    const draft = await _getDraft();
    if (!draft) return [];

    const { data, error } = await _sb()
      .from('list_items')
      .select('*')
      .eq('list_id', draft.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Storage.getCurrentList]', error);
      return [];
    }

    return (data || []).map(_rowToItem);
  }

  /**
   * Sincroniza os itens do draft.
   *
   * Estratégia: DELETE diferencial (só os removidos) + UPSERT dos atuais.
   * Preserva os IDs client-side (UUID v4) para que toggles e
   * edições subsequentes continuem encontrando os itens.
   */
  async function saveCurrentList(itemsArray = []) {
    const draft = await _getDraft();
    if (!draft) return false;

    // 1. Coleta IDs atuais (UUIDs válidos com 32+ chars)
    const currentIds = itemsArray
      .map(i => i.id)
      .filter(id => typeof id === 'string' && id.length >= 32);

    // 2. Lista vazia → limpa o draft inteiro
    if (currentIds.length === 0) {
      const { error } = await _sb()
        .from('list_items')
        .delete()
        .eq('list_id', draft.id);

      if (error) console.error('[Storage.saveCurrentList] delete all:', error);
      return !error;
    }

    // 3. Remove do banco os que NÃO estão mais na lista atual
    const { error: delError } = await _sb()
      .from('list_items')
      .delete()
      .eq('list_id', draft.id)
      .not('id', 'in', `(${currentIds.join(',')})`);

    if (delError) {
      console.error('[Storage.saveCurrentList] delete diff:', delError);
    }

    // 4. Upsert dos atuais (preservando id UUID client-side)
    const rows = itemsArray.map(item => ({
      id:              item.id,
      list_id:         draft.id,
      name:            item.name,
      category:        item.category || 'Outros',
      unit:            item.unit || 'un',
      quantity:        _num(item.quantity, 1),
      wholesale_price: _num(item.priceWholesale, 0),
      retail_price:    _num(item.priceRetail, 0),
      completed:       !!item.completed
    }));

    const { error: upsError } = await _sb()
      .from('list_items')
      .upsert(rows, { onConflict: 'id' });

    if (upsError) {
      console.error('[Storage.saveCurrentList] upsert:', upsError);
      return false;
    }

    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // 2. FINALIZAÇÃO DE LISTA / HISTÓRICO
  // ═══════════════════════════════════════════════════════════

  /**
   * Finaliza o draft atual como uma lista salva.
   * @param {Object} listData  { name, date, market, totalGeneral, list_type }
   * @param {Array}  items     itens da lista
   * @param {Array}  payments  [{ method, amount }]
   */
  async function saveNewList(listData = {}, items = [], payments = []) {
    const draft = await _getDraft();
    if (!draft) return null;

    // 1. Atualiza o cabeçalho do draft → completed
    const { error: updError } = await _sb()
      .from('lists')
      .update({
        name:          listData.name || 'Lista',
        market:        listData.market || null,
        purchase_date: listData.date || new Date().toISOString().slice(0, 10),
        total:         _num(listData.totalGeneral, 0),
        list_type:     listData.list_type || draft.list_type || 'Supermercado',
        status:        'completed'
      })
      .eq('id', draft.id);

    if (updError) {
      console.error('[Storage.saveNewList] update:', updError);
      throw updError;
    }

    // 2. Sincroniza os itens do draft (upsert)
    await saveCurrentList(items);

    // 3. Insere os pagamentos (schema exige `amount` NOT NULL)
    const validPayments = (payments || [])
      .filter(p => p && p.method && _num(p.amount, 0) > 0);

    if (validPayments.length > 0) {
      const rows = validPayments.map(p => ({
        list_id: draft.id,
        method:  String(p.method),
        amount:  _num(p.amount, 0)
      }));

      const { error: payError } = await _sb()
        .from('payments')
        .insert(rows);

      if (payError) console.error('[Storage.saveNewList] payments:', payError);
    }

    return { ...draft, ...listData, status: 'completed' };
  }

  /**
   * Retorna todas as listas finalizadas (com items e payments já juntos).
   */
  async function getSavedLists() {
    const user = await _getUser();
    if (!user) return [];

    const { data, error } = await _sb()
      .from('lists')
      .select(`
        *,
        list_items (*),
        payments (*)
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('purchase_date', { ascending: false });

    if (error) {
      console.error('[Storage.getSavedLists]', error);
      return [];
    }
    return data || [];
  }

  /**
   * Busca uma lista específica pelo id (com items + payments).
   */
  async function getListById(listId) {
    if (!listId) return null;

    const user = await _getUser();
    if (!user) return null;

    const { data, error } = await _sb()
      .from('lists')
      .select(`
        *,
        list_items (*),
        payments (*)
      `)
      .eq('id', listId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[Storage.getListById]', error);
      return null;
    }
    return data;
  }

  /**
   * Exclui uma lista (items e payments caem via ON DELETE CASCADE,
   * configurado no schema).
   */
  async function deleteList(listId) {
    if (!listId) return false;

    const { error } = await _sb()
      .from('lists')
      .delete()
      .eq('id', listId);

    if (error) {
      console.error('[Storage.deleteList]', error);
      return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // 3. CATEGORIAS PERSONALIZADAS
  // ═══════════════════════════════════════════════════════════

  async function getCustomCategories() {
    const user = await _getUser();
    if (!user) return [];

    const { data, error } = await _sb()
      .from('custom_categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Storage.getCustomCategories]', error);
      return [];
    }
    return data || [];
  }

  /**
   * Insere uma nova categoria. `list_type` é NOT NULL no schema.
   */
  async function saveCustomCategory(category = {}) {
    const user = await _getUser();
    if (!user) return false;

    const row = {
      user_id:   user.id,
      name:      category.name,
      emoji:     category.emoji || '📦',
      list_type: category.list_type || 'Supermercado'
    };

    const { error } = await _sb()
      .from('custom_categories')
      .insert([row]);

    if (error) {
      console.error('[Storage.saveCustomCategory]', error);
      return false;
    }
    return true;
  }

  /**
   * Remove uma categoria personalizada pelo nome (por usuário).
   */
  async function deleteCustomCategory(name) {
    if (!name) return false;

    const user = await _getUser();
    if (!user) return false;

    const { error } = await _sb()
      .from('custom_categories')
      .delete()
      .eq('user_id', user.id)
      .eq('name', name);

    if (error) {
      console.error('[Storage.deleteCustomCategory]', error);
      return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // 4. HISTÓRICO DE PREÇOS (VIEW — SOMENTE LEITURA)
  // ═══════════════════════════════════════════════════════════

  /**
   * Retorna as linhas cruas de `price_history` (view).
   * O app.js normaliza para { nome: [{ws, rt, date}] }.
   */
  async function getPriceHistory() {
    const user = await _getUser();
    if (!user) return [];

    const { data, error } = await _sb()
      .from('price_history')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_date', { ascending: false });

    if (error) {
      console.error('[Storage.getPriceHistory]', error);
      return [];
    }
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════
  // 5. DASHBOARD / CONFIGURAÇÕES
  // ═══════════════════════════════════════════════════════════

  /**
   * Retorna { budget, totalSpent, percentage, listsCount } do mês atual.
   */
  async function getDashboardData() {
    const user = await _getUser();
    if (!user) return null;

    try {
      // 1. Meta mensal
      const { data: settings, error: sErr } = await _sb()
        .from('user_settings')
        .select('monthly_budget')
        .eq('user_id', user.id)
        .maybeSingle();

      if (sErr) console.warn('[Storage.getDashboardData] settings:', sErr);
      const budget = settings ? _num(settings.monthly_budget, 0) : 0;

      // 2. Início do mês corrente
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startISO = startOfMonth.toISOString().slice(0, 10);

      // 3. Listas finalizadas do mês (usa purchase_date, não created_at)
      const { data: lists, error: lErr } = await _sb()
        .from('lists')
        .select('total, purchase_date')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('purchase_date', startISO);

      if (lErr) throw lErr;

      const totalSpent = (lists || [])
        .reduce((acc, l) => acc + _num(l.total, 0), 0);

      const percentage = budget > 0
        ? Math.min(100, (totalSpent / budget) * 100)
        : 0;

      return {
        budget,
        totalSpent,
        percentage,
        listsCount: (lists || []).length
      };
    } catch (error) {
      console.error('[Storage.getDashboardData]', error);
      return { budget: 0, totalSpent: 0, percentage: 0, listsCount: 0 };
    }
  }

  /**
   * Salva (upsert) a meta mensal do usuário.
   */
  async function saveMonthlyBudget(amount) {
    const user = await _getUser();
    if (!user) return false;

    try {
      const { error } = await _sb()
        .from('user_settings')
        .upsert(
          {
            user_id:        user.id,
            monthly_budget: _num(amount, 0),
            updated_at:     new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[Storage.saveMonthlyBudget]', error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EXPORTAÇÃO PÚBLICA
  // ═══════════════════════════════════════════════════════════
  return {
    // Draft
    getCurrentList,
    saveCurrentList,

    // Finalização / histórico
    saveNewList,
    getSavedLists,
    getListById,
    deleteList,

    // Categorias
    getCustomCategories,
    saveCustomCategory,
    deleteCustomCategory,

    // Preços
    getPriceHistory,

    // Dashboard / config
    getDashboardData,
    saveMonthlyBudget
  };

})();