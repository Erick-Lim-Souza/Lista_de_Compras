// Classe principal para gerenciar a lista de compras
class ShoppingList {
  constructor() {
    this.items = [];
    this.currentFilter = 'all';
    this.init();
  }

  // Inicialização
  init() {
    this.bindElements();
    this.bindEvents();
    this.loadFromStorage();
    this.loadTheme();
    this.render();
  }

  // Bind dos elementos DOM
  bindElements() {
    // Elementos do formulário
    this.form = document.getElementById('itemForm');
    this.itemInput = document.getElementById('itemInput');
    this.categorySelect = document.getElementById('categorySelect');
    this.quantityInput = document.getElementById('quantityInput');
    this.unitSelect = document.getElementById('unitSelect');
    this.priceInput = document.getElementById('priceInput');

    // Elementos de exibição
    this.itemList = document.getElementById('itemList');
    this.totalItems = document.getElementById('totalItems');
    this.totalPrice = document.getElementById('totalPrice');
    this.emptyState = document.getElementById('emptyState');

    // Botões
    this.addButton = document.getElementById('addButton');
    this.clearAllButton = document.getElementById('clearAllButton');
    this.shareButton = document.getElementById('shareButton');
    this.darkModeToggle = document.getElementById('darkModeToggle');
    this.themeIcon = document.querySelector('.theme-icon');

    // Botões de exportação
    this.exportTxtButton = document.getElementById('exportTxt');
    this.exportPdfButton = document.getElementById('exportPdf');
    this.exportExcelButton = document.getElementById('exportExcel');

    // Filtros
    this.filterButtons = document.querySelectorAll('.filter-btn');

    // Modal
    this.modal = document.getElementById('confirmModal');
    this.confirmMessage = document.getElementById('confirmMessage');
    this.confirmOk = document.getElementById('confirmOk');
    this.confirmCancel = document.getElementById('confirmCancel');
  }

  // Bind dos eventos
  bindEvents() {
    // Formulário
    this.form.addEventListener('submit', (e) => this.handleAddItem(e));

    // Botões principais
    this.clearAllButton.addEventListener('click', () => this.confirmClearAll());
    this.shareButton.addEventListener('click', () => this.shareList());

    // Tema
    this.darkModeToggle.addEventListener('click', () => this.toggleTheme());

    // Exportação
    this.exportTxtButton.addEventListener('click', () => this.exportToTxt());
    this.exportPdfButton.addEventListener('click', () => this.exportToPdf());
    this.exportExcelButton.addEventListener('click', () => this.exportToExcel());

    // Filtros
    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
    });

    // Modal
    this.confirmCancel.addEventListener('click', () => this.hideModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hideModal();
    });

    // Teclas de atalho
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  // Manipulação de itens
  addItem(itemData) {
    const item = {
      id: Date.now() + Math.random(),
      text: itemData.text.trim(),
      category: itemData.category,
      quantity: parseFloat(itemData.quantity) || 1,
      unit: itemData.unit,
      price: parseFloat(itemData.price) || 0,
      purchased: false,
      createdAt: new Date().toISOString()
    };

    this.items.unshift(item);
    this.saveToStorage();
    this.render();
    this.clearForm();
  }

  editItem(id, newText) {
    const item = this.items.find(item => item.id === id);
    if (item && newText.trim()) {
      item.text = newText.trim();
      this.saveToStorage();
      this.render();
    }
  }

  removeItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.saveToStorage();
    this.render();
  }

  toggleItem(id) {
    const item = this.items.find(item => item.id === id);
    if (item) {
      item.purchased = !item.purchased;
      this.saveToStorage();
      this.render();
    }
  }

  clearAll() {
    this.items = [];
    this.saveToStorage();
    this.render();
  }

  // Manipuladores de eventos
  handleAddItem(e) {
    e.preventDefault();
    
    const text = this.itemInput.value.trim();
    if (!text) {
      this.showError('Por favor, digite o nome do item.');
      return;
    }

    const itemData = {
      text,
      category: this.categorySelect.value,
      quantity: this.quantityInput.value,
      unit: this.unitSelect.value,
      price: this.priceInput.value
    };

    this.addItem(itemData);
  }

  handleKeyboard(e) {
    // Ctrl/Cmd + Enter para adicionar item
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.handleAddItem(e);
    }
    
    // Escape para fechar modal
    if (e.key === 'Escape') {
      this.hideModal();
    }
  }

  // Renderização
  render() {
    this.renderItems();
    this.renderStats();
    this.renderEmptyState();
  }

  renderItems() {
    const filteredItems = this.getFilteredItems();
    
    this.itemList.innerHTML = '';
    
    filteredItems.forEach(item => {
      const li = this.createItemElement(item);
      this.itemList.appendChild(li);
    });
  }

  createItemElement(item) {
    const li = document.createElement('li');
    li.className = item.purchased ? 'completed' : '';
    li.setAttribute('data-id', item.id);

    li.innerHTML = `
      <input type="checkbox" class="item-checkbox" ${item.purchased ? 'checked' : ''}>
      <div class="item-content">
        <div class="item-text">${this.escapeHtml(item.text)}</div>
        <div class="item-details">
          ${this.getCategoryIcon(item.category)} ${item.category} • 
          ${item.quantity} ${item.unit}
        </div>
      </div>
      <div class="item-price">R$ ${item.price.toFixed(2).replace('.', ',')}</div>
      <div class="item-actions">
        <button class="item-btn edit-btn" title="Editar item">✏️</button>
        <button class="item-btn delete-btn" title="Remover item">🗑️</button>
      </div>
    `;

    // Event listeners para este item
    const checkbox = li.querySelector('.item-checkbox');
    const editBtn = li.querySelector('.edit-btn');
    const deleteBtn = li.querySelector('.delete-btn');

    checkbox.addEventListener('change', () => this.toggleItem(item.id));
    editBtn.addEventListener('click', () => this.promptEditItem(item.id, item.text));
    deleteBtn.addEventListener('click', () => this.confirmRemoveItem(item.id));

    return li;
  }

  renderStats() {
    const total = this.calculateTotal();
    const totalItemsCount = this.items.length;
    
    this.totalItems.textContent = totalItemsCount;
    this.totalPrice.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
  }

  renderEmptyState() {
    const filteredItems = this.getFilteredItems();
    if (filteredItems.length === 0) {
      this.emptyState.classList.add('show');
      this.itemList.style.display = 'none';
    } else {
      this.emptyState.classList.remove('show');
      this.itemList.style.display = 'block';
    }
  }

  // Filtros
  getFilteredItems() {
    switch (this.currentFilter) {
      case 'completed':
        return this.items.filter(item => item.purchased);
      case 'pending':
        return this.items.filter(item => !item.purchased);
      default:
        return this.items;
    }
  }

  setFilter(filter) {
    this.currentFilter = filter;
    
    // Atualizar botões de filtro
    this.filterButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    this.render();
  }

  // Utilitários
  calculateTotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getCategoryIcon(category) {
    const icons = {
      'Alimentos': '🍎',
      'Limpeza': '🧽',
      'Higiene': '🧴',
      'Bebidas': '🥤',
      'Outros': '📦'
    };
    return icons[category] || '📦';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  // Storage
  saveToStorage() {
    try {
      localStorage.setItem('shoppingList', JSON.stringify(this.items));
    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
      this.showError('Erro ao salvar dados.');
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('shoppingList');
      if (stored) {
        this.items = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Erro ao carregar do localStorage:', error);
      this.items = [];
    }
  }

  // Tema
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    this.themeIcon.textContent = newTheme === 'dark' ? '🌞' : '🌙';
    
    localStorage.setItem('theme', newTheme);
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    document.documentElement.setAttribute('data-theme', theme);
    this.themeIcon.textContent = theme === 'dark' ? '🌞' : '🌙';
  }

  // Interface
  clearForm() {
    this.itemInput.value = '';
    this.quantityInput.value = '1';
    this.priceInput.value = '';
    this.itemInput.focus();
  }

  showError(message) {
    // Criar toast de erro simples
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--danger-color);
      color: white;
      padding: 12px 24px;
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-lg);
      z-index: 1001;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Modal
  showModal(message, callback) {
    this.confirmMessage.textContent = message;
    this.modal.classList.add('show');
    
    // Remover listeners anteriores
    this.confirmOk.replaceWith(this.confirmOk.cloneNode(true));
    this.confirmOk = document.getElementById('confirmOk');
    
    this.confirmOk.addEventListener('click', () => {
      callback();
      this.hideModal();
    });
  }

  hideModal() {
    this.modal.classList.remove('show');
  }

  // Confirmações
  confirmClearAll() {
    if (this.items.length === 0) {
      this.showError('A lista já está vazia.');
      return;
    }
    
    this.showModal('Tem certeza que deseja remover todos os itens da lista?', () => {
      this.clearAll();
    });
  }

  confirmRemoveItem(id) {
    this.showModal('Tem certeza que deseja remover este item?', () => {
      this.removeItem(id);
    });
  }

  promptEditItem(id, currentText) {
    const newText = prompt('Editar item:', currentText);
    if (newText !== null) {
      this.editItem(id, newText);
    }
  }

  // Compartilhamento
  async shareList() {
    if (this.items.length === 0) {
      this.showError('A lista está vazia.');
      return;
    }

    const shareContent = this.generateShareContent();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Minha Lista de Compras',
          text: shareContent,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          this.fallbackShare(shareContent);
        }
      }
    } else {
      this.fallbackShare(shareContent);
    }
  }

  fallbackShare(content) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content).then(() => {
        this.showSuccess('Lista copiada para a área de transferência!');
      }).catch(() => {
        this.showTextModal(content);
      });
    } else {
      this.showTextModal(content);
    }
  }

  showTextModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <h3>Compartilhar Lista</h3>
        <textarea readonly style="width: 100%; height: 200px; margin: 16px 0; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--border-radius); font-family: monospace;">${content}</textarea>
        <div class="modal-buttons">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--success-color);
      color: white;
      padding: 12px 24px;
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-lg);
      z-index: 1001;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  generateShareContent() {
    let content = "🛒 MINHA LISTA DE COMPRAS\n";
    content += "=" .repeat(30) + "\n\n";

    // Agrupar por categoria
    const categories = {};
    this.items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });

    Object.keys(categories).forEach(category => {
      content += `${this.getCategoryIcon(category)} ${category.toUpperCase()}\n`;
      content += "-".repeat(20) + "\n";
      
      categories[category].forEach(item => {
        const status = item.purchased ? "✅" : "⭕";
        content += `${status} ${item.text} - ${item.quantity} ${item.unit}`;
        if (item.price > 0) {
          content += ` - R$ ${item.price.toFixed(2).replace('.', ',')}`;
        }
        content += "\n";
      });
      content += "\n";
    });

    const total = this.calculateTotal();
    if (total > 0) {
      content += `💰 TOTAL: R$ ${total.toFixed(2).replace('.', ',')}\n`;
    }
    
    content += `\n📊 Total de itens: ${this.items.length}`;
    content += `\n📅 Criado em: ${new Date().toLocaleDateString('pt-BR')}`;

    return content;
  }

  // Função auxiliar para agrupar itens por categoria
  groupItemsByCategory() {
    const categories = {};
    this.items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });
    
    // Ordenar categorias alfabeticamente
    const sortedCategories = {};
    Object.keys(categories).sort().forEach(key => {
      // Ordenar itens dentro de cada categoria (pendentes primeiro, depois por nome)
      categories[key].sort((a, b) => {
        if (a.purchased !== b.purchased) {
          return a.purchased ? 1 : -1;
        }
        return a.text.localeCompare(b.text);
      });
      sortedCategories[key] = categories[key];
    });
    
    return sortedCategories;
  }

  // Função auxiliar para cores das categorias no PDF
  getCategoryColor(category) {
    const colors = {
      'Alimentos': [34, 197, 94],    // Verde
      'Limpeza': [59, 130, 246],     // Azul
      'Higiene': [168, 85, 247],     // Roxo
      'Bebidas': [245, 158, 11],     // Laranja
      'Outros': [107, 114, 128]      // Cinza
    };
    return colors[category] || [107, 114, 128];
  }

  // Exportação para PDF
  exportToPdf() {
    if (this.items.length === 0) {
      this.showError('A lista está vazia.');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      // Configurações de cores
      const colors = {
        primary: [79, 70, 229],
        secondary: [107, 114, 128],
        success: [16, 185, 129],
        danger: [239, 68, 68],
        text: [30, 41, 59],
        lightGray: [248, 250, 252],
        border: [226, 232, 240]
      };
      
      let y = 20;
      
      // CABEÇALHO PRINCIPAL
      // Fundo do cabeçalho
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, 210, 40, 'F');
      
      // Título principal
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('🛒 LISTA DE COMPRAS', 20, 25);
      
      // Data e hora no cabeçalho
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR');
      doc.text(`Gerado em: ${dateStr} às ${timeStr}`, 20, 35);
      
      y = 55;
      
      // RESUMO ESTATÍSTICO
      doc.setTextColor(...colors.text);
      doc.setFillColor(...colors.lightGray);
      doc.rect(15, y - 5, 180, 25, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('📊 RESUMO', 20, y + 5);
      
      const totalItems = this.items.length;
      const completedItems = this.items.filter(item => item.purchased).length;
      const pendingItems = totalItems - completedItems;
      const totalValue = this.calculateTotal();
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Total de itens: ${totalItems}`, 20, y + 12);
      doc.text(`• Comprados: ${completedItems}`, 70, y + 12);
      doc.text(`• Pendentes: ${pendingItems}`, 120, y + 12);
      doc.text(`• Valor total: R$ ${totalValue.toFixed(2).replace('.', ',')}`, 20, y + 18);
      
      y += 35;
      
      // ITENS POR CATEGORIA
      const categories = this.groupItemsByCategory();
      
      Object.keys(categories).forEach((category, categoryIndex) => {
        // Verificar se precisa de nova página
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        // Cabeçalho da categoria
        const categoryColor = this.getCategoryColor(category);
        doc.setFillColor(...categoryColor);
        doc.rect(15, y - 2, 180, 15, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const icon = this.getCategoryIcon(category);
        doc.text(`${icon} ${category.toUpperCase()}`, 20, y + 8);
        
        // Contador de itens da categoria
        const categoryItems = categories[category];
        const categoryTotal = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        doc.text(`${categoryItems.length} itens - R$ ${categoryTotal.toFixed(2).replace('.', ',')}`, 150, y + 8);
        
        y += 20;
        
        // Cabeçalho da tabela de itens
        doc.setFillColor(...colors.border);
        doc.rect(15, y, 180, 10, 'F');
        
        doc.setTextColor(...colors.text);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Status', 20, y + 6);
        doc.text('Item', 35, y + 6);
        doc.text('Qtd', 120, y + 6);
        doc.text('Unidade', 140, y + 6);
        doc.text('Preço Unit.', 165, y + 6);
        doc.text('Subtotal', 185, y + 6);
        
        y += 12;
        
        // Itens da categoria
        categoryItems.forEach((item, index) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          
          // Linha alternada
          if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(15, y - 2, 180, 8, 'F');
          }
          
          doc.setTextColor(...colors.text);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          
          // Status
          const status = item.purchased ? '✓' : '○';
          const statusColor = item.purchased ? colors.success : colors.secondary;
          doc.setTextColor(...statusColor);
          doc.text(status, 22, y + 3);
          
          // Texto do item
          doc.setTextColor(...colors.text);
          const itemText = item.text.length > 35 ? item.text.substring(0, 32) + '...' : item.text;
          if (item.purchased) {
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...colors.secondary);
          }
          doc.text(itemText, 35, y + 3);
          
          // Dados numéricos
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...colors.text);
          doc.text(item.quantity.toString(), 125, y + 3);
          doc.text(item.unit, 142, y + 3);
          doc.text(`R$ ${item.price.toFixed(2).replace('.', ',')}`, 167, y + 3);
          
          const subtotal = item.price * item.quantity;
          doc.setFont('helvetica', 'bold');
          doc.text(`R$ ${subtotal.toFixed(2).replace('.', ',')}`, 187, y + 3);
          
          y += 8;
        });
        
        y += 5;
      });
      
      // RODAPÉ
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Linha do rodapé
        doc.setDrawColor(...colors.border);
        doc.line(15, 285, 195, 285);
        
        doc.setTextColor(...colors.secondary);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Gerado por Lista de Compras Inteligente', 20, 290);
        doc.text(`Página ${i} de ${pageCount}`, 170, 290);
      }
      
      // Download do arquivo
      const fileName = `lista_compras_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      this.showSuccess('PDF exportado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      this.showError('Erro ao gerar PDF. Tente novamente.');
    }
  }

  // Exportação para Excel
  exportToExcel() {
    if (this.items.length === 0) {
      this.showError('A lista está vazia.');
      return;
    }

    try {
      // Criar estrutura CSV melhorada
      let csvContent = '\uFEFF'; // BOM para UTF-8
      
      // Cabeçalho do relatório
      csvContent += 'LISTA DE COMPRAS INTELIGENTE\n';
      csvContent += `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
      csvContent += '\n';
      
      // Resumo estatístico
      const totalItems = this.items.length;
      const completedItems = this.items.filter(item => item.purchased).length;
      const pendingItems = totalItems - completedItems;
      const totalValue = this.calculateTotal();
      
      csvContent += 'RESUMO GERAL\n';
      csvContent += 'Métrica,Valor\n';
      csvContent += `"Total de Itens","${totalItems}"\n`;
      csvContent += `"Itens Comprados","${completedItems}"\n`;
      csvContent += `"Itens Pendentes","${pendingItems}"\n`;
      csvContent += `"Valor Total","R$ ${totalValue.toFixed(2).replace('.', ',')}"\n`;
      csvContent += '\n';
      
      // Lista detalhada por categoria
      csvContent += 'LISTA DETALHADA POR CATEGORIA\n';
      csvContent += '\n';
      
      const categories = this.groupItemsByCategory();
      
      Object.keys(categories).forEach(category => {
        const categoryItems = categories[category];
        const categoryTotal = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Cabeçalho da categoria
        csvContent += `CATEGORIA: ${category.toUpperCase()}\n`;
        csvContent += `Itens nesta categoria: ${categoryItems.length}\n`;
        csvContent += `Valor da categoria: R$ ${categoryTotal.toFixed(2).replace('.', ',')}\n`;
        csvContent += '\n';
        
        // Cabeçalho da tabela
        csvContent += 'Status,Item,Quantidade,Unidade,Preço Unitário,Subtotal,Data Criação\n';
        
        // Itens da categoria
        categoryItems.forEach(item => {
          const status = item.purchased ? 'Comprado' : 'Pendente';
          const priceUnit = `R$ ${item.price.toFixed(2).replace('.', ',')}`;
          const subtotal = `R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}`;
          const createdDate = new Date(item.createdAt).toLocaleDateString('pt-BR');
          
          csvContent += `"${status}","${item.text}","${item.quantity}","${item.unit}","${priceUnit}","${subtotal}","${createdDate}"\n`;
        });
        
        csvContent += '\n';
      });
      
      // Resumo por categoria
      csvContent += 'RESUMO POR CATEGORIA\n';
      csvContent += 'Categoria,Total de Itens,Itens Comprados,Itens Pendentes,Valor Total\n';
      
      Object.keys(categories).forEach(category => {
        const categoryItems = categories[category];
        const totalCat = categoryItems.length;
        const completedCat = categoryItems.filter(item => item.purchased).length;
        const pendingCat = totalCat - completedCat;
        const valueCat = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const valueFormatted = `R$ ${valueCat.toFixed(2).replace('.', ',')}`;
        
        csvContent += `"${category}","${totalCat}","${completedCat}","${pendingCat}","${valueFormatted}"\n`;
      });
      
      // Criar e baixar arquivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const fileName = `lista_compras_${new Date().toISOString().split('T')[0]}.csv`;
      this.downloadFile(blob, fileName);
      this.showSuccess('Arquivo Excel exportado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      this.showError('Erro ao gerar arquivo Excel. Tente novamente.');
    }
  }

  // Exportação para TXT
  exportToTxt() {
    if (this.items.length === 0) {
      this.showError('A lista está vazia.');
      return;
    }

    try {
      let content = '';
      
      // Cabeçalho
      content += '╔══════════════════════════════════════════════════════════╗\n';
      content += '║                 LISTA DE COMPRAS INTELIGENTE             ║\n';
      content += '╚══════════════════════════════════════════════════════════╝\n\n';
      
      // Informações do relatório
      const now = new Date();
      content += `📅 Data: ${now.toLocaleDateString('pt-BR')}\n`;
      content += `🕐 Hora: ${now.toLocaleTimeString('pt-BR')}\n\n`;
      
      // Resumo estatístico
      const totalItems = this.items.length;
      const completedItems = this.items.filter(item => item.purchased).length;
      const pendingItems = totalItems - completedItems;
      const totalValue = this.calculateTotal();
      
      content += '📊 RESUMO GERAL\n';
      content += '═'.repeat(50) + '\n';
      content += `• Total de itens: ${totalItems}\n`;
      content += `• Itens comprados: ${completedItems}\n`;
      content += `• Itens pendentes: ${pendingItems}\n`;
      content += `• Valor total: R$ ${totalValue.toFixed(2).replace('.', ',')}\n\n`;
      
      // Lista por categoria
      const categories = this.groupItemsByCategory();
      
      Object.keys(categories).forEach(category => {
        const categoryItems = categories[category];
        const categoryTotal = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        content += `${this.getCategoryIcon(category)} ${category.toUpperCase()}\n`;
        content += '─'.repeat(category.length + 5) + '\n';
        content += `📦 ${categoryItems.length} itens • 💰 R$ ${categoryTotal.toFixed(2).replace('.', ',')}\n\n`;
        
        categoryItems.forEach((item, index) => {
          const status = item.purchased ? '✅' : '⭕';
          const number = (index + 1).toString().padStart(2, '0');
          const subtotal = (item.price * item.quantity).toFixed(2).replace('.', ',');
          
          content += `${number}. ${status} ${item.text}\n`;
          content += `    📏 ${item.quantity} ${item.unit} • 💵 R$ ${item.price.toFixed(2).replace('.', ',')} • 🧮 R$ ${subtotal}\n`;
          
          if (item.purchased) {
            content += '    ✨ Item já foi comprado\n';
          }
          content += '\n';
        });
      });
      
      // Rodapé
      content += '═'.repeat(60) + '\n';
      content += '📱 Gerado por Lista de Compras Inteligente\n';
      content += `🔗 github.com/Erick-Lim-Souza/Lista_de_Compras\n`;
      
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const fileName = `lista_compras_${new Date().toISOString().split('T')[0]}.txt`;
      this.downloadFile(blob, fileName);
      this.showSuccess('Arquivo TXT exportado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao gerar TXT:', error);
      this.showError('Erro ao gerar arquivo TXT. Tente novamente.');
    }
  }

  downloadFile(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}

// Adicionar estilos para animações
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .toast {
    animation: slideIn 0.3s ease;
  }
`;
document.head.appendChild(style);

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  new ShoppingList();
});

// Service Worker para PWA (opcional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registrado com sucesso:', registration);
      })
      .catch(registrationError => {
        console.log('Falha ao registrar SW:', registrationError);
      });
  });
}

// Botão de instalação
let deferredPrompt;
const installButton = document.createElement('button');
installButton.className = 'btn btn-primary';
installButton.textContent = '📲 Instalar App';
installButton.style.margin = '10px auto';
installButton.style.display = 'none';

document.querySelector('.action-buttons').prepend(installButton);

// Mostra o botão quando o app pode ser instalado
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installButton.style.display = 'block';
  
  installButton.addEventListener('click', () => {
    installButton.style.display = 'none';
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
    });
  });
});

// Esconde o botão após instalação
window.addEventListener('appinstalled', () => {
  installButton.style.display = 'none';
});

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registrado:', registration);
      })
      .catch(error => {
        console.log('Falha no SW:', error);
      });
  });
}
