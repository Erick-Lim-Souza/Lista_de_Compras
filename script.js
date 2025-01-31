// Seleciona os elementos do DOM
const itemInput = document.getElementById('itemInput');
const addButton = document.getElementById('addButton');
const clearAllButton = document.getElementById('clearAllButton');
const shareButton = document.getElementById('shareButton');
const exportTxtButton = document.getElementById('exportTxt');
const exportPdfButton = document.getElementById('exportPdf');
const exportExcelButton = document.getElementById('exportExcel');
const itemList = document.getElementById('itemList');
const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;

// Carrega os itens salvos no localStorage
let items = JSON.parse(localStorage.getItem('items')) || [];

// Função para salvar no localStorage
function saveItems() {
  localStorage.setItem('items', JSON.stringify(items));
}

// Função para renderizar os itens na tela
function renderItems() {
  itemList.innerHTML = '';
  items.sort();
  items.forEach((item, index) => {
    const li = document.createElement('li');

    // Checkbox para marcar como comprado
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.purchased || false;
    checkbox.addEventListener('change', () => {
      item.purchased = checkbox.checked;
      saveItems();
      renderItems();
    });
    li.appendChild(checkbox);

    const itemText = document.createElement('span');
    itemText.textContent = item.text;
    li.classList.toggle('completed', item.purchased);
    li.appendChild(itemText);

    // Botão para remover item com animação
    const removeButton = document.createElement('button');
    removeButton.textContent = '🗑';
    removeButton.addEventListener('click', () => {
      li.classList.add('removing');
      setTimeout(() => {
        items.splice(index, 1);
        saveItems();
        renderItems();
      }, 300);
    });

    // Botão para editar item
    const editButton = document.createElement('button');
    editButton.textContent = '✏️';
    editButton.addEventListener('click', () => {
      const updatedItem = prompt('Editar item:', item.text);
      if (updatedItem && updatedItem.trim() !== '') {
        items[index].text = updatedItem.trim();
        saveItems();
        renderItems();
      }
    });

    li.appendChild(editButton);
    li.appendChild(removeButton);
    itemList.appendChild(li);
  });
}

// Exportação para PDF com formatação
exportPdfButton.addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Lista de Compras', 20, 20);
  doc.setFontSize(12);
  items.forEach((item, index) => {
    doc.text(`${index + 1}. ${item.text} ${item.purchased ? '(Comprado)' : ''}`, 20, 30 + index * 10);
  });
  doc.save('lista_de_compras.pdf');
});

// Alterna modo escuro
darkModeToggle.addEventListener('click', () => {
  body.classList.toggle('dark-mode');
  darkModeToggle.textContent = body.classList.contains('dark-mode') ? '🌞' : '🌙';
  localStorage.setItem('darkMode', body.classList.contains('dark-mode'));
});

// Verifica se o modo escuro estava ativo ao carregar a página
if (localStorage.getItem('darkMode') === 'true') {
  body.classList.add('dark-mode');
  darkModeToggle.textContent = '🌞';
}

renderItems();
