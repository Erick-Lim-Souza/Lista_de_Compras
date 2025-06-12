// Classe principal para gerenciar a lista de compras
class ShoppingList {
    constructor() {
        this.items = [];
        this.currentFilter = 'all';
        this.currentListId = null;
        this.currentListName = 'Lista Atual';
        this.editingIndex = -1;
        this.listTypes = {
            'Supermercado': '🛒',
            'Açougue': '🍖',
            'Roupas': '👕',
            'Farmácia': '💊',
            'Eletrônicos': '📱',
            'Casa e Jardim': '🏠',
            'Feira Livre': '🥕'
        };
        this.currentListType = 'Supermercado';
        this.init();
    }

    // Inicialização
    init() {
        this.bindElements();
        this.bindEvents();
        this.loadFromStorage();
        this.loadTheme();
        this.showListTypeSelection();
    }

    // Vincular elementos DOM
    bindElements() {
        // Elementos do formulário
        this.form = document.getElementById('itemForm');
        this.itemInput = document.getElementById('itemInput');
        this.categorySelect = document.getElementById('categorySelect');
        this.quantityInput = document.getElementById('quantityInput');
        this.unitSelect = document.getElementById('unitSelect');
        this.priceWholesaleInput = document.getElementById('priceWholesaleInput');
        this.priceRetailInput = document.getElementById('priceRetailInput');

        // Elementos de exibição
        this.itemList = document.getElementById('itemList');
        this.totalItems = document.getElementById('totalItems');
        this.totalWholesale = document.getElementById('totalWholesale');
        this.totalRetail = document.getElementById('totalRetail');
        this.emptyState = document.getElementById('emptyState');
        this.currentListNameEl = document.getElementById('currentListName');

        // Botões
        this.addButton = document.getElementById('addButton');
        this.clearAllButton = document.getElementById('clearAllButton');
        this.shareButton = document.getElementById('shareButton');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.themeIcon = document.querySelector('.theme-icon');
        this.compareListsButton = document.getElementById('compareListsButton');

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

        // Modal de comparação
        this.compareModal = document.getElementById('compareModal');
        this.compareList1 = document.getElementById('compareList1');
        this.compareList2 = document.getElementById('compareList2');
        this.compareResults = document.getElementById('compareResults');
        this.compareExecute = document.getElementById('compareExecute');
        this.compareClose = document.getElementById('compareClose');
    }

    // Mostrar seleção de tipo de lista
    showListTypeSelection() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>🛒 Escolha o tipo de lista</h3>
                <div class="list-type-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin: 20px 0;">
                    ${Object.entries(this.listTypes).map(([type, emoji]) => `
                        <button class="list-type-btn" data-type="${type}" style="
                            padding: 20px;
                            border: 2px solid var(--border-color);
                            border-radius: var(--border-radius);
                            background: var(--bg-secondary);
                            cursor: pointer;
                            transition: var(--transition);
                            text-align: center;
                            font-size: 14px;
                        ">
                            <div style="font-size: 2rem; margin-bottom: 8px;">${emoji}</div>
                            <div>${type}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Adicionar eventos aos botões
        modal.querySelectorAll('.list-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentListType = btn.dataset.type;
                this.updateCategoriesForListType();
                document.body.removeChild(modal);
                this.render();
            });
            
            btn.addEventListener('mouseenter', () => {
                btn.style.borderColor = 'var(--primary-color)';
                btn.style.background = 'var(--primary-color)';
                btn.style.color = 'white';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.borderColor = 'var(--border-color)';
                btn.style.background = 'var(--bg-secondary)';
                btn.style.color = 'var(--text-primary)';
            });
        });
    }

    // Atualizar categorias baseado no tipo de lista
    updateCategoriesForListType() {
        const categories = this.getCategoriesForListType(this.currentListType);
        this.categorySelect.innerHTML = '';
        
        Object.entries(categories).forEach(([category, emoji]) => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = `${emoji} ${category}`;
            this.categorySelect.appendChild(option);
        });
    }

    // Obter categorias para tipo de lista
    getCategoriesForListType(listType) {
        switch (listType) {
            case 'Supermercado':
            case 'Feira Livre':
                return {
                    'Alimentos': '🍎',
                    'Hortifruti': '🥦',
                    'Ovo': '🥚',
                    'Carnes': '🍖',
                    'Limpeza': '🧽',
                    'Higiene': '🧴',
                    'Bebidas': '🥤',
                    'Outros': '📦'
                };
            case 'Açougue':
                return {
                    'Carne Bovina': '🐄',
                    'Carne Frango': '🐔',
                    'Carne Suína': '🐖',
                    'Carne Peixe': '🐟',
                    'Carne Javali': '🐗',
                    'Ovo': '🥚',
                    'Outros': '📦'
                };
            case 'Roupas':
                return {
                    'Camisetas': '👕',
                    'Calças': '👖',
                    'Sapatos': '👟',
                    'Acessórios': '👜',
                    'Íntimas': '🩲',
                    'Outros': '📦'
                };
            case 'Farmácia':
                return {
                    'Medicamentos': '💊',
                    'Higiene': '🧴',
                    'Cosméticos': '💄',
                    'Vitaminas': '🍯',
                    'Primeiros Socorros': '🩹',
                    'Outros': '📦'
                };
            case 'Eletrônicos':
                return {
                    'Smartphones': '📱',
                    'Computadores': '💻',
                    'Acessórios': '🔌',
                    'Games': '🎮',
                    'Audio/Video': '🎧',
                    'Outros': '📦'
                };
            case 'Casa e Jardim':
                return {
                    'Móveis': '🪑',
                    'Decoração': '🖼️',
                    'Ferramentas': '🔧',
                    'Jardim': '🌱',
                    'Limpeza': '🧽',
                    'Outros': '📦'
                };
            default:
                return {
                    'Alimentos': '🍎',
                    'Hortifruti': '🥦',
                    'Carnes': '🍖',
                    'Limpeza': '🧽',
                    'Higiene': '🧴',
                    'Bebidas': '🥤',
                    'Outros': '📦'
                };
        }
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
        this.compareListsButton.addEventListener('click', () => this.showCompareDialog());

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
        this.compareClose.addEventListener('click', () => this.hideModal(this.compareModal));
        this.compareExecute.addEventListener('click', () => this.executeComparison());

        // Fechar modais ao clicar fora
        [this.confirmModal, this.historyModal, this.saveListModal, this.compareModal].forEach(modal => {
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
            priceWholesale: parseFloat(this.priceWholesaleInput.value) || 0,
            priceRetail: parseFloat(this.priceRetailInput.value) || 0,
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
        this.priceWholesaleInput.value = item.priceWholesale || 0;
        this.priceRetailInput.value = item.priceRetail || 0;
        
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
        let text = `📝 ${this.currentListName} (${this.listTypes[this.currentListType]} ${this.currentListType})\n\n`;
        
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
                const unitPrice = this.calculateUnitPrice(item);
                let priceText = '';
                if (unitPrice.wholesale > 0 || unitPrice.retail > 0) {
                    // Mostrar até 3 casas decimais sem arredondamento
                    const wholesaleFormatted = this.formatPriceWithDecimals(unitPrice.wholesale);
                    const retailFormatted = this.formatPriceWithDecimals(unitPrice.retail);
                    priceText = ` - Atacado: R$ ${wholesaleFormatted} | Varejo: R$ ${retailFormatted}`;
                }
                text += `${status} ${item.quantity} ${item.unit} de ${item.name}${priceText}\n`;
            });
            text += '\n';
        });

        const totals = this.calculateTotals();
        if (totals.wholesale > 0 || totals.retail > 0) {
            text += `💰 Total Atacado: R$ ${this.formatPriceWithDecimals(totals.wholesale)}\n`;
            text += `💰 Total Varejo: R$ ${this.formatPriceWithDecimals(totals.retail)}`;
        }

        return text;
    }

    // Formatar preço com até 3 casas decimais
    formatPriceWithDecimals(value) {
        // Converter para string com 3 casas decimais
        const formatted = value.toFixed(3);
        // Remover zeros desnecessários no final, mas manter pelo menos 2 casas decimais
        return parseFloat(formatted).toFixed(Math.max(2, 3 - (formatted.split('.')[1] || '').replace(/0+$/, '').length + (formatted.split('.')[1] || '').replace(/0+$/, '').length));
    }

    // Obter emoji da categoria
    getCategoryEmoji(category) {
        const currentCategories = this.getCategoriesForListType(this.currentListType);
        return currentCategories[category] || '📦';
    }

    // Exportar para TXT
    exportToTxt() {
        const text = this.generateTextList();
        this.downloadFile(`${this.currentListName}.txt`, text, 'text/plain');
        this.showToast('Lista exportada para TXT!');
    }

    // Exportar para PDF
    exportToPdf() {
        if (this.items.length === 0) {
            this.showToast('Adicione itens para exportar!');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configurar fonte para suportar caracteres especiais
        doc.setFont("helvetica");
        
        // Título principal
        doc.setFontSize(18);
        doc.setTextColor(79, 70, 229); // Cor primária
        doc.text(`${this.currentListName}`, 20, 25);
        
        // Subtítulo com tipo de lista
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Tipo: ${this.currentListType}`, 20, 35);
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 42);
        
        // Linha separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 48, 190, 48);
        
        let y = 60;
        
        // Agrupar itens por categoria
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
            
            // Título da categoria
            doc.setFontSize(14);
            doc.setTextColor(79, 70, 229);
            doc.text(`${this.getCategoryEmoji(category)} ${category}`, 20, y);
            y += 8;
            
            // Linha sob a categoria
            doc.setDrawColor(79, 70, 229);
            doc.line(20, y, 100, y);
            y += 10;
            
            // Itens da categoria
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            
            categories[category].forEach(item => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                
                const status = item.completed ? '[✓]' : '[ ]';
                const unitPrice = this.calculateUnitPrice(item);
                
                // Linha principal do item
                let itemText = `${status} ${item.quantity} ${item.unit} de ${item.name}`;
                doc.text(itemText, 25, y);
                y += 6;
                
                // Preços (se existirem)
                if (unitPrice.wholesale > 0 || unitPrice.retail > 0) {
                    doc.setTextColor(100, 100, 100);
                    doc.setFontSize(9);
                    
                    if (unitPrice.wholesale > 0) {
                        const wholesaleFormatted = this.formatPriceWithDecimals(unitPrice.wholesale);
                        doc.text(`   Atacado: R$ ${wholesaleFormatted}`, 30, y);
                        y += 5;
                    }
                    
                    if (unitPrice.retail > 0) {
                        const retailFormatted = this.formatPriceWithDecimals(unitPrice.retail);
                        doc.text(`   Varejo: R$ ${retailFormatted}`, 30, y);
                        y += 5;
                    }
                    
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(10);
                }
                
                y += 3; // Espaço entre itens
            });
            
            y += 8; // Espaço entre categorias
        });

        // Totais
        const totals = this.calculateTotals();
        if (totals.wholesale > 0 || totals.retail > 0) {
            if (y > 250) {
                doc.addPage();
                y = 20;
            }
            
            // Linha separadora
            doc.setDrawColor(200, 200, 200);
            doc.line(20, y, 190, y);
            y += 10;
            
            doc.setFontSize(12);
            doc.setTextColor(79, 70, 229);
            doc.text('TOTAIS:', 20, y);
            y += 8;
            
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            if (totals.wholesale > 0) {
                doc.text(`Total Atacado: R$ ${this.formatPriceWithDecimals(totals.wholesale)}`, 25, y);
                y += 7;
            }
            
            if (totals.retail > 0) {
                doc.text(`Total Varejo: R$ ${this.formatPriceWithDecimals(totals.retail)}`, 25, y);
                y += 7;
            }
        }

        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, 170, 285);
            doc.text('Gerado por Lista de Compras Inteligente', 20, 285);
        }

        doc.save(`${this.currentListName}.pdf`);
        this.showToast('Lista exportada para PDF!');
    }

    // Exportar para Excel
    exportToExcel() {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Item,Categoria,Quantidade,Unidade,Preço Atacado,Preço Varejo,Total Atacado,Total Varejo,Status\n";
        
        this.items.forEach(item => {
            const status = item.completed ? 'Comprado' : 'Pendente';
            const unitPrice = this.calculateUnitPrice(item);
            const priceWholesale = (item.priceWholesale || 0).toFixed(2).replace('.', ',');
            const priceRetail = (item.priceRetail || 0).toFixed(2).replace('.', ',');
            const totalWholesale = this.formatPriceWithDecimals(unitPrice.wholesale).replace('.', ',');
            const totalRetail = this.formatPriceWithDecimals(unitPrice.retail).replace('.', ',');
            csvContent += `"${item.name}","${item.category}","${item.quantity}","${item.unit}","${priceWholesale}","${priceRetail}","${totalWholesale}","${totalRetail}","${status}"\n`;
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
            this.currentListType = savedLists[index].listType || 'Supermercado';
            this.currentListNameEl.textContent = this.currentListName;
            this.updateCategoriesForListType();
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
            listType: this.currentListType,
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
                this.showListTypeSelection();
                this.saveToStorage();
                this.render();
                this.hideModal(this.confirmModal);
                this.showToast('Nova lista criada!');
            };
        } else {
            this.showListTypeSelection();
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
            
            const unitPrice = this.calculateUnitPrice(item);
            const priceDisplay = this.generatePriceDisplay(unitPrice, item);
            
            li.innerHTML = `
                <input type="checkbox" class="item-checkbox" ${item.completed ? 'checked' : ''} 
                       onchange="app.toggleItem(${originalIndex})">
                <div class="item-content">
                    <div class="item-text">${item.name}</div>
                    <div class="item-details">
                        ${this.getCategoryEmoji(item.category)} ${item.category} • 
                        ${item.quantity} ${item.unit}
                    </div>
                    ${priceDisplay}
                </div>
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

    // Gerar exibição de preços
    generatePriceDisplay(unitPrice, item) {
        let display = '';
        
        if (unitPrice.wholesale > 0 || unitPrice.retail > 0) {
            display += '<div class="item-prices">';
            
            if (unitPrice.wholesale > 0) {
                display += `<div class="price-item">
                    <span class="price-label">Atacado:</span>
                    <span class="price-value">R$ ${this.formatPriceWithDecimals(unitPrice.wholesale)}</span>
                    <span class="price-unit">(R$ ${unitPrice.unitWholesale.toFixed(2)}/${item.unit})</span>
                </div>`;
            }
            
            if (unitPrice.retail > 0) {
                display += `<div class="price-item">
                    <span class="price-label">Varejo:</span>
                    <span class="price-value">R$ ${this.formatPriceWithDecimals(unitPrice.retail)}</span>
                    <span class="price-unit">(R$ ${unitPrice.unitRetail.toFixed(2)}/${item.unit})</span>
                </div>`;
            }
            
            display += '</div>';
        }
        
        return display;
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
        const totals = this.calculateTotals();
        
        this.totalItems.textContent = totalItems;
        this.totalWholesale.textContent = `R$ ${this.formatPriceWithDecimals(totals.wholesale)}`;
        this.totalRetail.textContent = `R$ ${this.formatPriceWithDecimals(totals.retail)}`;
    }

    // Calcular totais
    calculateTotals() {
        return this.items.reduce((totals, item) => {
            const unitPrice = this.calculateUnitPrice(item);
            
            totals.wholesale += unitPrice.wholesale;
            totals.retail += unitPrice.retail;
            
            return totals;
        }, { wholesale: 0, retail: 0 });
    }

    // Calcular preço por unidade
    calculateUnitPrice(item) {
        let quantity = parseFloat(item.quantity) || 1;
        const priceWholesale = parseFloat(item.priceWholesale) || 0;
        const priceRetail = parseFloat(item.priceRetail) || 0;

        // Conversões automáticas para unidades padrão
        if (item.unit === 'g') quantity = quantity / 1000; // Converter para kg
        if (item.unit === 'ml') quantity = quantity / 1000; // Converter para litros

        return {
            wholesale: quantity * priceWholesale,
            retail: quantity * priceRetail,
            unitWholesale: priceWholesale,
            unitRetail: priceRetail,
            quantity: quantity
        };
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
        [this.confirmModal, this.historyModal, this.saveListModal, this.compareModal].forEach(modal => {
            this.hideModal(modal);
        });
    }

    // Mostrar diálogo de comparação
    showCompareDialog() {
        const data = this.getStorageData();
        const savedLists = data.savedLists || [];
        
        if (savedLists.length < 2) {
            this.showToast('É necessário ter pelo menos 2 listas salvas para comparar!');
            return;
        }

        // Limpar e popular os selects
        this.compareList1.innerHTML = '<option value="">Selecione uma lista...</option>';
        this.compareList2.innerHTML = '<option value="">Selecione uma lista...</option>';
        
        savedLists.forEach((list, index) => {
            const option1 = new Option(list.name, index);
            const option2 = new Option(list.name, index);
            this.compareList1.appendChild(option1);
            this.compareList2.appendChild(option2);
        });

        this.compareResults.innerHTML = '<p>Selecione duas listas para comparar.</p>';
        this.showModal(this.compareModal);
    }

    // Executar comparação
    executeComparison() {
        const list1Index = this.compareList1.value;
        const list2Index = this.compareList2.value;
        
        if (!list1Index || !list2Index || list1Index === list2Index) {
            this.showToast('Selecione duas listas diferentes para comparar!');
            return;
        }

        const data = this.getStorageData();
        const savedLists = data.savedLists || [];
        const list1 = savedLists[list1Index];
        const list2 = savedLists[list2Index];

        const comparison = this.compareLists(list1, list2);
        this.renderComparisonResults(comparison, list1.name, list2.name);
    }

    // Comparar listas
    compareLists(list1, list2) {
        const items1 = list1.items || [];
        const items2 = list2.items || [];
        
        const common = [];
        const onlyInList1 = [];
        const onlyInList2 = [];
        
        items1.forEach(item1 => {
            const found = items2.find(item2 => 
                item1.name.toLowerCase() === item2.name.toLowerCase() && 
                item1.category === item2.category
            );
            
            if (found) {
                common.push({ item1, item2: found });
            } else {
                onlyInList1.push(item1);
            }
        });
        
        items2.forEach(item2 => {
            const found = items1.find(item1 => 
                item1.name.toLowerCase() === item2.name.toLowerCase() && 
                item1.category === item2.category
            );
            
            if (!found) {
                onlyInList2.push(item2);
            }
        });
        
        return { common, onlyInList1, onlyInList2 };
    }

    // Renderizar resultados da comparação
    renderComparisonResults(comparison, list1Name, list2Name) {
        let html = `
            <div class="comparison-results">
                <h4>Comparação: ${list1Name} vs ${list2Name}</h4>
                
                <div class="comparison-section">
                    <h5>📋 Itens em comum (${comparison.common.length})</h5>
                    ${comparison.common.length === 0 ? '<p>Nenhum item em comum</p>' : ''}
                    ${comparison.common.map(({ item1, item2 }) => `
                        <div class="comparison-item">
                            <strong>${item1.name}</strong> (${item1.category})
                            <br>
                            <small>
                                ${list1Name}: ${item1.quantity} ${item1.unit} | 
                                ${list2Name}: ${item2.quantity} ${item2.unit}
                            </small>
                        </div>
                    `).join('')}
                </div>
                
                <div class="comparison-section">
                    <h5>📝 Apenas em ${list1Name} (${comparison.onlyInList1.length})</h5>
                    ${comparison.onlyInList1.length === 0 ? '<p>Nenhum item exclusivo</p>' : ''}
                    ${comparison.onlyInList1.map(item => `
                        <div class="comparison-item">
                            ${item.name} (${item.category}) - ${item.quantity} ${item.unit}
                        </div>
                    `).join('')}
                </div>
                
                <div class="comparison-section">
                    <h5>📝 Apenas em ${list2Name} (${comparison.onlyInList2.length})</h5>
                    ${comparison.onlyInList2.length === 0 ? '<p>Nenhum item exclusivo</p>' : ''}
                    ${comparison.onlyInList2.map(item => `
                        <div class="comparison-item">
                            ${item.name} (${item.category}) - ${item.quantity} ${item.unit}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        this.compareResults.innerHTML = html;
    }

    // Salvar no localStorage
    saveToStorage() {
        const data = this.getStorageData();
        data.currentList = {
            items: this.items,
            name: this.currentListName,
            listType: this.currentListType
        };
        this.saveStorageData(data);
    }

    // Carregar do localStorage
    loadFromStorage() {
        const data = this.getStorageData();
        if (data.currentList) {
            this.items = data.currentList.items || [];
            this.currentListName = data.currentList.name || 'Lista Atual';
            this.currentListType = data.currentList.listType || 'Supermercado';
            this.currentListNameEl.textContent = this.currentListName;
            this.updateCategoriesForListType();
        }
    }

    // Obter dados do storage
    getStorageData() {
        try {
            return JSON.parse(localStorage.getItem('shoppingListData')) || {};
        } catch (e) {
            return {};
        }
    }

    // Salvar dados no storage
    saveStorageData(data) {
        try {
            localStorage.setItem('shoppingListData', JSON.stringify(data));
        } catch (e) {
            console.error('Erro ao salvar dados:', e);
        }
    }
}

// Inicializar aplicação
const app = new ShoppingList();

// Funções globais para acesso
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

function showTesterList() {
    const data = app.getStorageData();
    const testers = data.testers || [];
    const list = document.getElementById('testerDisplay');
    
    list.innerHTML = testers.map(tester => 
        `<li>${tester.name} (${tester.email}) - ${new Date(tester.date).toLocaleDateString()}</li>`
    ).join('');
    
    showModal('testerList');
}

function sendFeedback() {
    const feedback = document.getElementById('feedbackInput').value.trim();
    if (!feedback) {
        app.showToast('Digite um feedback!');
        return;
    }
    
    const data = app.getStorageData();
    if (!data.feedbacks) data.feedbacks = [];
    
    data.feedbacks.push({
        text: feedback,
        date: new Date().toISOString(),
        user: data.currentUser || 'Anônimo'
    });
    
    app.saveStorageData(data);
    document.getElementById('feedbackInput').value = '';
    hideModal('feedbackForm');
    app.showToast('Feedback enviado com sucesso!');
}

// Gerenciar acesso
document.getElementById('accessForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    
    if (!name || !email) {
        app.showToast('Preencha todos os campos!');
        return;
    }
    
    const data = app.getStorageData();
    if (!data.testers) data.testers = [];
    
    const existingTester = data.testers.find(t => t.email === email);
    if (!existingTester) {
        data.testers.push({
            name,
            email,
            date: new Date().toISOString()
        });
    }
    
    data.currentUser = name;
    app.saveStorageData(data);
    
    hideModal('accessModal');
    app.showToast(`Bem-vindo, ${name}!`);
});

// Adicionar estilos CSS para comparação
const style = document.createElement('style');
style.textContent = `
    .comparison-results {
        text-align: left;
        max-height: 400px;
        overflow-y: auto;
    }
    
    .comparison-section {
        margin-bottom: 20px;
        padding: 10px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
    }
    
    .comparison-section h5 {
        margin: 0 0 10px 0;
        color: var(--primary-color);
    }
    
    .comparison-item {
        padding: 8px;
        margin: 5px 0;
        background: var(--bg-secondary);
        border-radius: 4px;
        font-size: 0.9rem;
    }
    
    .item-prices {
        margin-top: 4px;
        font-size: 0.85rem;
    }
    
    .price-item {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 2px 0;
    }
    
    .price-label {
        color: var(--text-secondary);
        font-weight: 500;
    }
    
    .price-value {
        color: var(--success-color);
        font-weight: 600;
    }
    
    .price-unit {
        color: var(--text-secondary);
        font-size: 0.8rem;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);


// Adicionar eventos para configurações
document.addEventListener('DOMContentLoaded', function() {
    const versionButton = document.getElementById('versionButton');
    const configButton = document.getElementById('configButton');
    const configModal = document.getElementById('configModal');
    const configClose = document.getElementById('configClose');
    const changeListType = document.getElementById('changeListType');
    const addCustomCategory = document.getElementById('addCustomCategory');
    const newCategoryName = document.getElementById('newCategoryName');
    const newCategoryEmoji = document.getElementById('newCategoryEmoji');
    const currentListTypeDisplay = document.getElementById('currentListTypeDisplay');
    const customCategoriesList = document.getElementById('customCategoriesList');

    // Botão de versão
    if (versionButton) {
        versionButton.addEventListener('click', () => {
            window.open('versao.html', '_blank');
        });
    }

    // Botão de configurações
    if (configButton) {
        configButton.addEventListener('click', () => {
            showConfigModal();
        });
    }

    // Fechar modal de configurações
    if (configClose) {
        configClose.addEventListener('click', () => {
            app.hideModal(configModal);
        });
    }

    // Alterar tipo de lista
    if (changeListType) {
        changeListType.addEventListener('click', () => {
            app.showListTypeSelection();
            app.hideModal(configModal);
        });
    }

    // Adicionar categoria personalizada
    if (addCustomCategory) {
        addCustomCategory.addEventListener('click', () => {
            addCustomCategoryFunction();
        });
    }

    // Função para mostrar modal de configurações
    function showConfigModal() {
        if (currentListTypeDisplay) {
            currentListTypeDisplay.textContent = app.currentListType;
        }
        loadCustomCategories();
        app.showModal(configModal);
    }

    // Função para carregar categorias personalizadas
    function loadCustomCategories() {
        const data = app.getStorageData();
        const customCategories = data.customCategories || {};
        const listTypeCategories = customCategories[app.currentListType] || {};
        
        if (customCategoriesList) {
            customCategoriesList.innerHTML = '';
            
            Object.entries(listTypeCategories).forEach(([name, emoji]) => {
                const categoryItem = document.createElement('div');
                categoryItem.className = 'custom-category-item';
                categoryItem.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    margin: 4px 0;
                    background: var(--bg-secondary);
                    border-radius: var(--border-radius);
                    border: 1px solid var(--border-color);
                `;
                
                categoryItem.innerHTML = `
                    <span>${emoji} ${name}</span>
                    <button onclick="removeCustomCategory('${name}')" style="
                        background: var(--danger-color);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 4px 8px;
                        cursor: pointer;
                        font-size: 12px;
                    ">Remover</button>
                `;
                
                customCategoriesList.appendChild(categoryItem);
            });
            
            if (Object.keys(listTypeCategories).length === 0) {
                customCategoriesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin: 20px 0;">Nenhuma categoria personalizada</p>';
            }
        }
    }

    // Função para adicionar categoria personalizada
    function addCustomCategoryFunction() {
        const name = newCategoryName.value.trim();
        const emoji = newCategoryEmoji.value.trim();
        
        if (!name || !emoji) {
            app.showToast('Preencha o nome e emoji da categoria!');
            return;
        }
        
        const data = app.getStorageData();
        if (!data.customCategories) data.customCategories = {};
        if (!data.customCategories[app.currentListType]) data.customCategories[app.currentListType] = {};
        
        data.customCategories[app.currentListType][name] = emoji;
        app.saveStorageData(data);
        
        // Atualizar categorias na interface
        app.updateCategoriesForListType();
        
        // Limpar campos
        newCategoryName.value = '';
        newCategoryEmoji.value = '';
        
        // Recarregar lista de categorias personalizadas
        loadCustomCategories();
        
        app.showToast('Categoria adicionada com sucesso!');
    }

    // Função global para remover categoria personalizada
    window.removeCustomCategory = function(categoryName) {
        const data = app.getStorageData();
        if (data.customCategories && data.customCategories[app.currentListType]) {
            delete data.customCategories[app.currentListType][categoryName];
            app.saveStorageData(data);
            
            // Atualizar categorias na interface
            app.updateCategoriesForListType();
            
            // Recarregar lista de categorias personalizadas
            loadCustomCategories();
            
            app.showToast('Categoria removida com sucesso!');
        }
    };
});

// Atualizar método updateCategoriesForListType para incluir categorias personalizadas
if (typeof app !== 'undefined') {
    const originalUpdateCategories = app.updateCategoriesForListType;
    app.updateCategoriesForListType = function() {
        const categories = this.getCategoriesForListType(this.currentListType);
        
        // Adicionar categorias personalizadas
        const data = this.getStorageData();
        const customCategories = data.customCategories || {};
        const listTypeCustomCategories = customCategories[this.currentListType] || {};
        
        // Combinar categorias padrão com personalizadas
        const allCategories = { ...categories, ...listTypeCustomCategories };
        
        this.categorySelect.innerHTML = '';
        
        Object.entries(allCategories).forEach(([category, emoji]) => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = `${emoji} ${category}`;
            this.categorySelect.appendChild(option);
        });
    };
}

