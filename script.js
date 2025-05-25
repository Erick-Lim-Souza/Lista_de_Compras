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

  // Exportação
  exportToTxt() {
    if (this.items.length === 0) {
      this.showError('A lista está vazia.');
      return;
    }

    const content = this.generateExportContent('txt');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    this.downloadFile(blob, 'lista_de_compras.txt');
  }

  exportToPdf() {
    if (this.items.length === 0) {
      this.showError('A lista está vazia.');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      // Configurações
      doc.setFont('helvetica');
      
      // Título
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('🛒 Lista de Compras', 20, 25);
      
      // Data
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 35);
      
      let y = 50;
      
      // Agrupar por categoria
      const categories = {};
      this.items.forEach(item => {
        if (!categories[item.category]) {
          categories[item.category] = [];
        }
        categories[item.category].push(item);
      });
      
      Object.keys(categories).forEach(category => {
        // Verificar se precisa de nova página
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        // Categoria
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${this.getCategoryIcon(category)} ${category}`, 20, y);
        y += 10;
        
        // Itens da categoria
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        categories[category].forEach(item => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          
          const status = item.purchased ? '✓' : '○';
          const line = `${status} ${item.text} - ${item.quantity} ${item.unit} - R$ ${item.price.toFixed(2)}`;
          doc.text(line, 25, y);
          y += 7;
        });
        
        y += 5;
      });
      
      // Total
      const total = this.calculateTotal();
      if (total > 0) {
        y += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total: R$ ${total.toFixed(2)}`, 20, y);
      }
      
      doc.save('lista_de_compras.pdf');
      this.showSuccess('PDF exportado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      this.showError('Erro ao gerar PDF. Tente novamente.');
    }
  }

  exportToExcel() {
    if (this.items.length === 0) {
      this.showError('A lista está vazia.');
      return;
    }

    // Criar CSV compatível com Excel
    let csvContent = '\uFEFF'; // BOM para UTF-8
    csvContent += 'Categoria,Item,Quantidade,Unidade,Preço,Status\n';
    
    this.items.forEach(item => {
      const status = item.purchased ? 'Comprado' : 'Pendente';
      const price = item.price.toFixed(2).replace('.', ',');
      csvContent += `"${item.category}","${item.text}","${item.quantity}","${item.unit}","R$ ${price}","${status}"\n`;
    });
    
    // Adicionar total
    const total = this.calculateTotal().toFixed(2).replace('.', ',');
    csvContent += `\n"TOTAL","","","","R$ ${total}",""\n`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    this.downloadFile(blob, 'lista_de_compras.csv');
    this.showSuccess('Arquivo Excel exportado com sucesso!');
  }

  generateExportContent(format) {
    let content = "LISTA DE COMPRAS\n";
    content += "================\n\n";
    
    content += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
    content += `Total de itens: ${this.items.length}\n\n`;
    
    // Agrupar por categoria
    const categories = {};
    this.items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });
    
    Object.keys(categories).forEach(category => {
      content += `${category.toUpperCase()}\n`;
      content += "-".repeat(category.length) + "\n";
      
      categories[category].forEach(item => {
        const status = item.purchased ? "[X]" : "[ ]";
        content += `${status} ${item.text} - ${item.quantity} ${item.unit}`;
        if (item.price > 0) {
          content += ` - R$ ${item.price.toFixed(2)}`;
        }
        content += "\n";
      });
      content += "\n";
    });
    
    const total = this.calculateTotal();
    if (total > 0) {
      content += `TOTAL: R$ ${total.toFixed(2)}\n`;
    }
    
    return content;
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
