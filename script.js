 // Classe principal para gerenciar a lista de compras
        class ShoppingList {
            constructor() {
                this.items = [];
                this.currentFilter = 'all';
                this.currentListId = null;
                this.currentListName = 'Lista Atual';
                this.editingIndex = -1;
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

            // Vincular elementos DOM
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
                this.currentListNameEl = document.getElementById('currentListName');

                // Botões
                this.addButton = document.getElementById('addButton');
                this.clearAllButton = document.getElementById('clearAllButton');
                this.shareButton = document.getElementById('shareButton');
                this.darkModeToggle = document.getElementById('darkModeToggle');
                this.themeIcon = document.querySelector('.theme-icon');

                // Botões de histórico
                this.historyButton = document.getElementById('historyButton');
                this.saveListButton = document.getElementById('saveListButton');
                this.newListButton = document.getElementById('newListButton');

                // Botões de exportação
                this.exportTxtButton = document.getElementById('exportTxt');
                this.exportPdfButton = document.getElementById('exportPdf');
                this.exportExcelButton = document.getElementById('exportExcel');

                // Filtros
                this.filterButtons = document.querySelectorAll('.filter-btn');

                // Modal de confirmação
                this.confirmModal = document.getElementById('confirmModal');
                this.confirmMessage = document.getElementById('confirmMessage');
                this.confirmOk = document.getElementById('confirmOk');
                this.confirmCancel = document.getElementById('confirmCancel');

                // Modal de histórico
                this.historyModal = document.getElementById('historyModal');
                this.historyList = document.getElementById('historyList');
                this.historyClose = document.getElementById('historyClose');

                // Modal de salvar lista
                this.saveListModal = document.getElementById('saveListModal');
                this.listNameInput = document.getElementById('listNameInput');
                this.saveCancel = document.getElementById('saveCancel');
                this.saveConfirm = document.getElementById('saveConfirm');
            }

            // Vincular eventos
            bindEvents() {
                // Formulário
                this.form.addEventListener('submit', (e) => this.handleSubmit(e));

                // Botões principais
                this.clearAllButton.addEventListener('click', () => this.confirmClearAll());
                this.shareButton.addEventListener('click', () => this.shareList());
                this.darkModeToggle.addEventListener('click', () => this.toggleTheme());

                // Histórico e gerenciamento de listas
                this.historyButton.addEventListener('click', () => this.showHistory());
                this.saveListButton.addEventListener('click', () => this.showSaveDialog());
                this.newListButton.addEventListener('click', () => this.createNewList());

                // Exportação
                this.exportTxtButton.addEventListener('click', () => this.exportToTxt());
                this.exportPdfButton.addEventListener('click', () => this.exportToPdf());
                this.exportExcelButton.addEventListener('click', () => this.exportToExcel());

                // Filtros
                this.filterButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
                });

                // Modais
                this.confirmCancel.addEventListener('click', () => this.hideModal(this.confirmModal));
                this.historyClose.addEventListener('click', () => this.hideModal(this.historyModal));
                this.saveCancel.addEventListener('click', () => this.hideModal(this.saveListModal));
                this.saveConfirm.addEventListener('click', () => this.saveCurrentList());

                // Fechar modais ao clicar fora
                [this.confirmModal, this.historyModal, this.saveListModal].forEach(modal => {
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) this.hideModal(modal);
                    });
                });

                // Atalhos de teclado
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        this.hideAllModals();
                    }
                });
            }

            // Manipular envio do formulário
            handleSubmit(e) {
                e.preventDefault();
                
                const item = {
                    name: this.itemInput.value.trim(),
                    category: this.categorySelect.value,
                    quantity: parseFloat(this.quantityInput.value) || 1,
                    unit: this.unitSelect.value,
                    price: parseFloat(this.priceInput.value) || 0,
                    completed: false,
                    id: Date.now().toString()
                };

                if (this.editingIndex >= 0) {
                    // Editando item existente
                    this.items[this.editingIndex] = { ...item, id: this.items[this.editingIndex].id };
                    this.editingIndex = -1;
                    this.addButton.textContent = '➕ Adicionar Item';
                } else {
                    // Adicionando novo item
                    this.items.push(item);
                }

                this.resetForm();
                this.saveToStorage();
                this.render();
                this.showToast('Item adicionado com sucesso!');
            }

            // Resetar formulário
            resetForm() {
                this.form.reset();
                this.quantityInput.value = '1';
                this.itemInput.focus();
            }

            // Alternar tema
            toggleTheme() {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                document.documentElement.setAttribute('data-theme', newTheme);
                this.themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
                
                // Salvar preferência do tema
                const data = this.getStorageData();
                data.theme = newTheme;
                this.saveStorageData(data);
            }

            // Carregar tema
            loadTheme() {
                const data = this.getStorageData();
                const theme = data.theme || 'light';
                document.documentElement.setAttribute('data-theme', theme);
                this.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
            }

            // Definir filtro
            setFilter(filter) {
                this.currentFilter = filter;
                this.filterButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.filter === filter);
                });
                this.render();
            }

            // Alternar status do item
            toggleItem(index) {
                this.items[index].completed = !this.items[index].completed;
                this.saveToStorage();
                this.render();
            }

            // Editar item
            editItem(index) {
                const item = this.items[index];
                this.itemInput.value = item.name;
                this.categorySelect.value = item.category;
                this.quantityInput.value = item.quantity;
                this.unitSelect.value = item.unit;
                this.priceInput.value = item.price;
                
                this.editingIndex = index;
                this.addButton.textContent = '✏️ Atualizar Item';
                this.itemInput.focus();
            }

            // Excluir item
            deleteItem(index) {
                this.confirmMessage.textContent = `Deseja excluir "${this.items[index].name}"?`;
                this.showModal(this.confirmModal);
                
                this.confirmOk.onclick = () => {
                    this.items.splice(index, 1);
                    this.saveToStorage();
                    this.render();
                    this.hideModal(this.confirmModal);
                    this.showToast('Item excluído com sucesso!');
                };
            }

            // Confirmar limpar lista
            confirmClearAll() {
                if (this.items.length === 0) {
                    this.showToast('A lista já está vazia!');
                    return;
                }

                this.confirmMessage.textContent = 'Deseja limpar toda a lista?';
                this.showModal(this.confirmModal);
                
                this.confirmOk.onclick = () => {
                    this.items = [];
                    this.saveToStorage();
                    this.render();
                    this.hideModal(this.confirmModal);
                    this.showToast('Lista limpa com sucesso!');
                };
            }

            // Compartilhar lista
            shareList() {
                if (this.items.length === 0) {
                    this.showToast('Adicione itens para compartilhar!');
                    return;
                }

                const text = this.generateTextList();
                
                if (navigator.share) {
                    navigator.share({
                        title: `${this.currentListName}`,
                        text: text
                    });
                } else {
                    navigator.clipboard.writeText(text).then(() => {
                        this.showToast('Lista copiada para a área de transferência!');
                    });
                }
            }

            // Gerar lista em texto
            generateTextList() {
                let text = `📝 ${this.currentListName}\n\n`;
                
                const categories = {};
                this.items.forEach(item => {
                    if (!categories[item.category]) {
                        categories[item.category] = [];
                    }
                    categories[item.category].push(item);
                });

                Object.keys(categories).forEach(category => {
                    text += `${this.getCategoryEmoji(category)} ${category}:\n`;
                    categories[category].forEach(item => {
                        const status = item.completed ? '✅' : '⬜';
                        const price = item.price > 0 ? ` - R$ ${item.price.toFixed(2)}` : '';
                        text += `${status} ${item.quantity} ${item.unit} de ${item.name}${price}\n`;
                    });
                    text += '\n';
                });

                const total = this.calculateTotal();
                if (total > 0) {
                    text += `💰 Total: R$ ${total.toFixed(2)}`;
                }

                return text;
            }

            // Obter emoji da categoria
            getCategoryEmoji(category) {
                const emojis = {
                    'Alimentos': '🍎',
                    'Limpeza': '🧽',
                    'Higiene': '🧴',
                    'Bebidas': '🥤',
                    'Outros': '📦'
                };
                return emojis[category] || '📦';
            }

            // Exportar para TXT
            exportToTxt() {
                const text = this.generateTextList();
                this.downloadFile(`${this.currentListName}.txt`, text, 'text/plain');
                this.showToast('Lista exportada para TXT!');
            }

            // Exportar para PDF
            exportToPdf() {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Título
                doc.setFontSize(20);
                doc.text(this.currentListName, 20, 30);
                
                let y = 50;
                doc.setFontSize(12);
                
                const categories = {};
                this.items.forEach(item => {
                    if (!categories[item.category]) {
                        categories[item.category] = [];
                    }
                    categories[item.category].push(item);
                });

                Object.keys(categories).forEach(category => {
                    doc.setFontSize(14);
                    doc.text(category, 20, y);
                    y += 10;
                    
                    doc.setFontSize(10);
                    categories[category].forEach(item => {
                        const status = item.completed ? '[✓]' : '[ ]';
                        const price = item.price > 0 ? ` - R$ ${item.price.toFixed(2)}` : '';
                        const line = `${status} ${item.quantity} ${item.unit} de ${item.name}${price}`;
                        doc.text(line, 25, y);
                        y += 7;
                        
                        if (y > 270) {
                            doc.addPage();
                            y = 20;
                        }
                    });
                    y += 5;
                });

                const total = this.calculateTotal();
                if (total > 0) {
                    doc.setFontSize(12);
                    doc.text(`Total: R$ ${total.toFixed(2)}`, 20, y);
                }

                doc.save(`${this.currentListName}.pdf`);
                this.showToast('Lista exportada para PDF!');
            }

            // Exportar para Excel
            exportToExcel() {
                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "Item,Categoria,Quantidade,Unidade,Preço,Status\n";
                
                this.items.forEach(item => {
                    const status = item.completed ? 'Comprado' : 'Pendente';
                    const price = item.price.toFixed(2).replace('.', ',');
                    csvContent += `"${item.name}","${item.category}","${item.quantity}","${item.unit}","${price}","${status}"\n`;
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `${this.currentListName}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showToast('Lista exportada para Excel!');
            }

            // Download de arquivo
            downloadFile(filename, content, type) {
                const blob = new Blob([content], { type });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            // Mostrar histórico
            showHistory() {
                const data = this.getStorageData();
                const savedLists = data.savedLists || [];
                
                this.historyList.innerHTML = '';
                
                if (savedLists.length === 0) {
                    this.historyList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhuma lista salva</p>';
                } else {
                    savedLists.forEach((list, index) => {
                        const listItem = document.createElement('div');
                        listItem.className = 'history-item';
                        listItem.innerHTML = `
                            <div class="history-info">
                                <div class="history-name">${list.name}</div>
                                <div class="history-details">
                                    ${list.items.length} itens • ${new Date(list.date).toLocaleDateString()}
                                </div>
                            </div>
                            <div class="history-actions">
                                <button class="btn btn-primary" onclick="app.loadList(${index})">Carregar</button>
                                <button class="btn btn-danger" onclick="app.deleteList(${index})">Excluir</button>
                            </div>
                        `;
                        this.historyList.appendChild(listItem);
                    });
                }
                
                this.showModal(this.historyModal);
            }

            // Carregar lista do histórico
            loadList(index) {
                const data = this.getStorageData();
                const savedLists = data.savedLists || [];
                
                if (savedLists[index]) {
                    this.items = [...savedLists[index].items];
                    this.currentListName = savedLists[index].name;
                    this.currentListNameEl.textContent = this.currentListName;
                    this.saveToStorage();
                    this.render();
                    this.hideModal(this.historyModal);
                    this.showToast(`Lista "${this.currentListName}" carregada!`);
                }
            }

            // Excluir lista do histórico
            deleteList(index) {
                const data = this.getStorageData();
                const savedLists = data.savedLists || [];
                
                if (savedLists[index]) {
                    const listName = savedLists[index].name;
                    savedLists.splice(index, 1);
                    data.savedLists = savedLists;
                    this.saveStorageData(data);
                    this.showHistory(); // Recarregar histórico
                    this.showToast(`Lista "${listName}" excluída!`);
                }
            }

            // Mostrar diálogo de salvar
            showSaveDialog() {
                this.listNameInput.value = this.currentListName;
                this.showModal(this.saveListModal);
                this.listNameInput.focus();
            }

            // Salvar lista atual
            saveCurrentList() {
                const name = this.listNameInput.value.trim();
                
                if (!name) {
                    this.showToast('Digite um nome para a lista!');
                    return;
                }

                const data = this.getStorageData();
                if (!data.savedLists) data.savedLists = [];
                
                const listData = {
                    name,
                    items: [...this.items],
                    date: new Date().toISOString()
                };

                // Verificar se já existe uma lista com o mesmo nome
                const existingIndex = data.savedLists.findIndex(list => list.name === name);
                if (existingIndex >= 0) {
                    data.savedLists[existingIndex] = listData;
                } else {
                    data.savedLists.push(listData);
                }

                this.saveStorageData(data);
                this.currentListName = name;
                this.currentListNameEl.textContent = name;
                this.hideModal(this.saveListModal);
                this.showToast('Lista salva com sucesso!');
            }

            // Criar nova lista
            createNewList() {
                if (this.items.length > 0) {
                    this.confirmMessage.textContent = 'Deseja criar uma nova lista? A lista atual será perdida se não for salva.';
                    this.showModal(this.confirmModal);
                    
                    this.confirmOk.onclick = () => {
                        this.items = [];
                        this.currentListName = 'Lista Atual';
                        this.currentListNameEl.textContent = this.currentListName;
                        this.saveToStorage();
                        this.render();
                        this.hideModal(this.confirmModal);
                        this.showToast('Nova lista criada!');
                    };
                } else {
                    this.showToast('A lista já está vazia!');
                }
            }

            // Renderizar lista
            render() {
                this.renderItems();
                this.renderStats();
                this.renderEmptyState();
            }

            // Renderizar itens
            renderItems() {
                const filteredItems = this.getFilteredItems();
                
                this.itemList.innerHTML = '';
                
                filteredItems.forEach((item, index) => {
                    const originalIndex = this.items.indexOf(item);
                    const li = document.createElement('li');
                    li.className = item.completed ? 'completed' : '';
                    
                    const price = item.price > 0 ? `<span class="item-price">R$ ${item.price.toFixed(2)}</span>` : '';
                    
                    li.innerHTML = `
                        <input type="checkbox" class="item-checkbox" ${item.completed ? 'checked' : ''} 
                               onchange="app.toggleItem(${originalIndex})">
                        <div class="item-content">
                            <div class="item-text">${item.name}</div>
                            <div class="item-details">
                                ${this.getCategoryEmoji(item.category)} ${item.category} • 
                                ${item.quantity} ${item.unit}
                            </div>
                        </div>
                        ${price}
                        <div class="item-actions">
                            <button class="item-btn edit-btn" onclick="app.editItem(${originalIndex})" title="Editar">
                                ✏️
                            </button>
                            <button class="item-btn delete-btn" onclick="app.deleteItem(${originalIndex})" title="Excluir">
                                🗑️
                            </button>
                        </div>
                    `;
                    
                    this.itemList.appendChild(li);
                });
            }

            // Obter itens filtrados
            getFilteredItems() {
                switch (this.currentFilter) {
                    case 'completed':
                        return this.items.filter(item => item.completed);
                    case 'pending':
                        return this.items.filter(item => !item.completed);
                    default:
                        return this.items;
                }
            }

            // Renderizar estatísticas
            renderStats() {
                const totalItems = this.items.length;
                const totalPrice = this.calculateTotal();
                
                this.totalItems.textContent = totalItems;
                this.totalPrice.textContent = `R$ ${totalPrice.toFixed(2)}`;
            }

            // Calcular total
            calculateTotal() {
                return this.items.reduce((total, item) => total + (item.price || 0), 0);
            }

            // Renderizar estado vazio
            renderEmptyState() {
                const filteredItems = this.getFilteredItems();
                this.emptyState.classList.toggle('show', filteredItems.length === 0);
            }

            // Mostrar toast
            showToast(message) {
                // Criar elemento toast
                const toast = document.createElement('div');
                toast.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--primary-color);
                    color: white;
                    padding: 12px 24px;
                    border-radius: var(--border-radius);
                    box-shadow: var(--shadow-lg);
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                `;
                toast.textContent = message;
                document.body.appendChild(toast);

                // Remover após 3 segundos
                setTimeout(() => {
                    toast.style.animation = 'slideOut 0.3s ease';
                    setTimeout(() => {
                        if (document.body.contains(toast)) {
                            document.body.removeChild(toast);
                        }
                    }, 300);
                }, 3000);
            }

            // Mostrar modal
            showModal(modal) {
                modal.classList.add('show');
                document.body.style.overflow = 'hidden';
            }

            // Esconder modal
            hideModal(modal) {
                modal.classList.remove('show');
                document.body.style.overflow = '';
            }

            // Esconder todos os modais
            hideAllModals() {
                [this.confirmModal, this.historyModal, this.saveListModal].forEach(modal => {
                    this.hideModal(modal);
                });
            }

            // Salvar no armazenamento
            saveToStorage() {
                const data = this.getStorageData();
                data.currentList = {
                    items: this.items,
                    name: this.currentListName
                };
                this.saveStorageData(data);
            }

            // Carregar do armazenamento
            loadFromStorage() {
                const data = this.getStorageData();
                if (data.currentList) {
                    this.items = data.currentList.items || [];
                    this.currentListName = data.currentList.name || 'Lista Atual';
                    this.currentListNameEl.textContent = this.currentListName;
                }
            }

            // Obter dados do armazenamento
            getStorageData() {
                try {
                    const data = JSON.parse(localStorage.getItem('shoppingListApp') || '{}');
                    return data;
                } catch (e) {
                    return {};
                }
            }

            // Salvar dados no armazenamento
            saveStorageData(data) {
                try {
                    localStorage.setItem('shoppingListApp', JSON.stringify(data));
                } catch (e) {
                    console.error('Erro ao salvar dados:', e);
                }
            }
        }

        // Inicializar aplicação
        const app = new ShoppingList();

        // Registrar Service Worker para PWA (opcional)
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {
                    // Service worker não disponível, continuar normalmente
                });
            });
        }

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

// Verifica se o usuário já se identificou
function initAccess() {
  const user = JSON.parse(localStorage.getItem('userInfo'));
  if (!user) {
    document.getElementById('accessModal').classList.add('show');
    document.body.style.overflow = 'hidden';
  } else {
    app.render(); // ou startApp()
  }
}

// Submete dados de nome/e-mail
document.getElementById('accessForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim();

  if (!name || !email) return;

  const userInfo = { name, email };
  localStorage.setItem('userInfo', JSON.stringify(userInfo));

  // Atualiza lista de testadores
  let users = JSON.parse(localStorage.getItem('userList') || '[]');
  users.push(userInfo);
  localStorage.setItem('userList', JSON.stringify(users));

  document.getElementById('accessModal').classList.remove('show');
  document.body.style.overflow = '';
  app.render(); // ou startApp()
});

// Mascarar e-mail
function maskEmail(email) {
  const [name, domain] = email.split('@');
  return name.slice(0, 2) + '***@' + domain;
}

// Mostrar lista de testadores
function showTesterList() {
  const list = JSON.parse(localStorage.getItem('userList') || '[]');
  const ul = document.getElementById('testerDisplay');
  ul.innerHTML = '';
  list.forEach(u => {
    const li = document.createElement('li');
    li.textContent = `${u.name} — ${maskEmail(u.email)}`;
    ul.appendChild(li);
  });
  showModal('testerList');
}

// Modal genérico
function showModal(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}
function hideModal(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}

// Enviar feedback
function sendFeedback() {
  const input = document.getElementById('feedbackInput');
  const feedback = input.value.trim();
  if (!feedback) return alert('Digite algo');

  let all = JSON.parse(localStorage.getItem('feedbackList') || '[]');
  const user = JSON.parse(localStorage.getItem('userInfo'));
  all.push({ name: user.name, email: user.email, feedback, date: new Date().toISOString() });
  localStorage.setItem('feedbackList', JSON.stringify(all));

  input.value = '';
  hideModal('feedbackForm');
  alert('Feedback enviado! (apenas visível localmente)');
}

function showAdminOptionsIfAllowed() {
  const user = JSON.parse(localStorage.getItem('userInfo'));
  const allowedEmails = ['erickdelimasouza@gmail.com', 'erick.devzone@gmail.com'];

  if (user && allowedEmails.includes(user.email)) {
    const adminBtn = document.createElement('button');
    adminBtn.textContent = '📬 Ver Feedbacks';
    adminBtn.className = 'btn btn-secondary';
    adminBtn.onclick = showAllFeedbacks;
    adminBtn.style.position = 'fixed';
    adminBtn.style.bottom = '80px';
    adminBtn.style.right = '20px';
    adminBtn.style.zIndex = '9999';
    document.body.appendChild(adminBtn);
  }
}

function showAllFeedbacks() {
  const list = JSON.parse(localStorage.getItem('feedbackList') || '[]');
  const ul = document.getElementById('allFeedbacksList');
  ul.innerHTML = '';

  if (list.length === 0) {
    ul.innerHTML = '<li>Nenhum feedback registrado.</li>';
  } else {
    list.forEach(f => {
      const li = document.createElement('li');
      li.style.marginBottom = '12px';
      li.innerHTML = `
        <strong>${f.name}</strong> (${f.email})<br>
        <em>${new Date(f.date).toLocaleString()}</em><br>
        ${f.feedback}
      `;
      ul.appendChild(li);
    });
  }

  showModal('allFeedbacksModal');
}

initAccess();
showAdminOptionsIfAllowed();
// Shopping List Application
// script.js
