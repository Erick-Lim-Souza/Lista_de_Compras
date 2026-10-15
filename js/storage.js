/**
 * js/storage.js
 * ─────────────────────────────────────────────────────────────
 * Gerencia a persistência de dados no Supabase.
 * ─────────────────────────────────────────────────────────────
 */
'use strict';

const Storage = (() => {

  // ─────────────────────────────────────────────────────────
  // 1. GERENCIAMENTO DA LISTA ATUAL (RASCUNHO)
  // ─────────────────────────────────────────────────────────

  /**
   * Busca ou cria a lista de rascunho (draft) do usuário logado.
   */
  async function getDraftList() {
    const user = Auth.getUser();
    if (!user) return null;

    // Busca a lista com status 'draft'
    let { data: draftList, error } = await supabase
      .from('lists')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .single();

    // Se não existir, cria uma nova
    if (!draftList || error) {
      const { data: newList, error: insertError } = await supabase
        .from('lists')
        .insert([{ 
          user_id: user.id, 
          name: 'Lista Atual', 
          status: 'draft',
          list_type: 'Supermercado'
        }])
        .select()
        .single();

      if (insertError) console.error('Erro ao criar rascunho:', insertError);
      draftList = newList;
    }

    return draftList;
  }

  /**
   * Retorna os itens da lista atual.
   */
  async function getCurrentList() {
    const draft = await getDraftList();
    if (!draft) return [];

    const { data: items, error } = await supabase
      .from('list_items')
      .select('*')
      .eq('list_id', draft.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar itens:', error);
      return [];
    }
    return items || [];
  }

  /**
   * Salva a lista atual (sincroniza os itens).
   * Para simplificar, removemos os itens antigos do rascunho e inserimos os novos.
   */
  async function saveCurrentList(itemsArray) {
    const draft = await getDraftList();
    if (!draft) return;

    // 1. Limpa os itens antigos deste rascunho
    await supabase
      .from('list_items')
      .delete()
      .eq('list_id', draft.id);

    if (itemsArray.length === 0) return;

    // 2. Prepara os novos itens para inserção
    const itemsToInsert = itemsArray.map(item => ({
      list_id: draft.id,
      name: item.name,
      category: item.category || 'Outros',
      unit: item.unit || 'un',
      quantity: item.quantity || 1,
      wholesale_price: item.priceWholesale || 0,
      retail_price: item.priceRetail || 0,
      completed: item.completed || false
    }));

    // 3. Insere os itens atualizados
    const { error } = await supabase
      .from('list_items')
      .insert(itemsToInsert);

    if (error) console.error('Erro ao salvar itens:', error);
  }

  // ─────────────────────────────────────────────────────────
  // 2. GERENCIAMENTO DE HISTÓRICO (LISTAS SALVAS)
  // ─────────────────────────────────────────────────────────

  /**
   * Finaliza a compra: muda o status do rascunho para 'completed' e salva pagamentos.
   */
  async function saveNewList(listData, items, payments) {
    const draft = await getDraftList();
    if (!draft) return;

    // 1. Atualiza o cabeçalho da lista para 'completed'
    const { error: updateError } = await supabase
      .from('lists')
      .update({
        name: listData.name,
        market: listData.market,
        purchase_date: listData.date,
        total: listData.totalGeneral,
        status: 'completed'
      })
      .eq('id', draft.id);

    if (updateError) {
      console.error('Erro ao finalizar lista:', updateError);
      return;
    }

    // 2. Garante que os itens estão salvos e atualizados
    await saveCurrentList(items);

    // 3. Salva os pagamentos
    if (payments && payments.length > 0) {
      const paymentsToInsert = payments.map(p => ({
        list_id: draft.id,
        method: p.method,
        amount: p.amount
      }));
      await supabase.from('payments').insert(paymentsToInsert);
    }

    // O histórico de preços (View) será atualizado automaticamente pelo banco!
  }

  /**
   * Busca todas as listas finalizadas (Histórico).
   */
  async function getSavedLists() {
    const user = Auth.getUser();
    if (!user) return [];

    const { data: lists, error } = await supabase
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
      console.error('Erro ao buscar histórico:', error);
      return [];
    }
    return lists || [];
  }

  /**
   * Exclui uma lista do histórico.
   */
  async function deleteList(listId) {
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', listId);

    if (error) console.error('Erro ao deletar lista:', error);
  }

  // ─────────────────────────────────────────────────────────
  // 3. CATEGORIAS PERSONALIZADAS
  // ─────────────────────────────────────────────────────────

  async function getCustomCategories() {
    const user = Auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Erro ao buscar categorias:', error);
      return [];
    }
    return data || [];
  }

  async function saveCustomCategory(category) {
    const user = Auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('custom_categories')
      .insert([{
        user_id: user.id,
        name: category.name,
        emoji: category.emoji,
        list_type: category.list_type || 'Supermercado'
      }]);

    if (error) console.error('Erro ao salvar categoria:', error);
  }

  // ─────────────────────────────────────────────────────────
  // 4. HISTÓRICO DE PREÇOS (VIEW)
  // ─────────────────────────────────────────────────────────

  async function getPriceHistory() {
    const user = Auth.getUser();
    if (!user) return [];

    // Busca diretamente da View que criamos/identificamos no banco
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar histórico de preços:', error);
      return [];
    }
    return data || [];
  }

  // ─────────────────────────────────────────────────────────
  // 5. DASHBOARD E CONFIGURAÇÕES (METAS)
  // ─────────────────────────────────────────────────────────

  /**
   * Busca os dados consolidados para o Dashboard (Meta e Gastos do mês)
   */
  async function getDashboardData() {
    const user = Auth.getUser();
    if (!user) return null;

    try {
      // 1. Buscar a meta mensal
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('monthly_budget')
        .eq('user_id', user.id)
        .single();

      const budget = settingsData ? parseFloat(settingsData.monthly_budget) : 0;

      // 2. Definir o primeiro dia do mês atual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // 3. Buscar as listas finalizadas do mês atual
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('total')
        .eq('user_id', user.id)
        .eq('status', 'completed') // Apenas listas finalizadas contam para o gasto
        .gte('created_at', startOfMonth.toISOString());

      if (listsError) throw listsError;

      // 4. Calcular o total gasto
      const totalSpent = listsData.reduce((acc, list) => acc + parseFloat(list.total || 0), 0);

      // 5. Calcular a porcentagem
      let percentage = 0;
      if (budget > 0) {
        percentage = (totalSpent / budget) * 100;
      }

      return {
        budget: budget,
        totalSpent: totalSpent,
        percentage: percentage > 100 ? 100 : percentage,
        listsCount: listsData.length
      };
    } catch (error) {
      console.error('Erro ao buscar dados do Dashboard:', error);
      return null;
    }
  }

  /**
   * Atualiza a meta mensal de gastos do usuário
   */
  async function saveMonthlyBudget(amount) {
    const user = Auth.getUser();
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ 
          user_id: user.id, 
          monthly_budget: parseFloat(amount),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao salvar meta mensal:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // EXPORTAÇÃO PÚBLICA DO MÓDULO
  // ─────────────────────────────────────────────────────────
  return {
    getCurrentList,
    saveCurrentList,
    saveNewList,
    getSavedLists,
    deleteList,
    getCustomCategories,
    saveCustomCategory,
    getPriceHistory,
    getDashboardData,
    saveMonthlyBudget
  };

})();