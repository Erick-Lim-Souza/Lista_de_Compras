# Lista de Compras Inteligente 🛒

Uma aplicação web moderna e responsiva para gerenciar suas listas de compras de forma prática e eficiente!

![GitHub license](https://img.shields.io/github/license/Erick-Lim-Souza/Lista_de_Compras?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/Erick-Lim-Souza/Lista_de_Compras?style=flat-square)
![GitHub repo size](https://img.shields.io/github/repo-size/Erick-Lim-Souza/Lista_de_Compras?style=flat-square)

## ✨ Funcionalidades

### 📝 Gerenciamento de Itens
- ➕ **Adicionar itens** com categoria, quantidade, unidade e preço
- ✏️ **Editar itens** facilmente
- 🗑️ **Remover itens** com confirmação
- ✅ **Marcar como comprado** com checkbox
- 🔄 **Filtrar itens** (todos, pendentes, comprados)

### 💰 Controle Financeiro
- 📊 **Cálculo automático** do valor total
- 💵 **Preços por item** com formatação brasileira
- 📈 **Estatísticas** de itens e valores

### 🎨 Interface Moderna
- 🌙 **Modo escuro/claro** automático
- 📱 **Design responsivo** para mobile e desktop
- 🎯 **Interface intuitiva** e acessível
- ⚡ **Animações suaves** e feedback visual

### 📤 Exportação e Compartilhamento
- 📄 **Exportar para TXT** formatado
- 📑 **Exportar para PDF** com categorias
- 📊 **Exportar para Excel/CSV**
- 📤 **Compartilhar** via API nativa ou clipboard

### 🔧 Funcionalidades Avançadas
- 💾 **Salvamento automático** no localStorage
- ⌨️ **Atalhos de teclado** (Ctrl+Enter para adicionar)
- 🏷️ **Categorização** com ícones
- 🔍 **Estado vazio** informativo
- ⚠️ **Validação de dados** com feedback

## 🚀 Melhorias Implementadas

### 🔧 Correções de Bugs
- ✅ Cor do texto corrigida no modo escuro
- ✅ Validação adequada de dados de entrada
- ✅ Tratamento de erros do localStorage
- ✅ Escape de HTML para segurança
- ✅ Modal de confirmação funcionando corretamente

### 🎨 Melhorias de Design
- ✅ Interface completamente redesenhada
- ✅ Tema escuro/claro com variáveis CSS
- ✅ Layout responsivo otimizado
- ✅ Tipografia moderna (Inter font)
- ✅ Componentes com melhor acessibilidade

### ⚡ Melhorias de Performance
- ✅ Código refatorado em classe ES6
- ✅ Event listeners otimizados
- ✅ Renderização eficiente
- ✅ Lazy loading de recursos

### 🔐 Melhorias de Segurança
- ✅ Sanitização de dados de entrada
- ✅ Validação de tipos
- ✅ Tratamento seguro de localStorage

## 🛠️ Tecnologias Utilizadas

- **HTML5** - Estrutura semântica
- **CSS3** - Estilos modernos com variáveis e grid/flexbox
- **JavaScript ES6+** - Lógica da aplicação com classes
- **jsPDF** - Geração de PDFs
- **LocalStorage API** - Persistência de dados
- **Web Share API** - Compartilhamento nativo

## 📱 Compatibilidade

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ✅ Dispositivos móveis iOS/Android

## 🚀 Como Usar

### 1. Adicionar Itens
1. Digite o nome do item
2. Selecione a categoria
3. Defina quantidade e unidade
4. Adicione o preço (opcional)
5. Clique em "Adicionar Item" ou use Ctrl+Enter

### 2. Gerenciar Lista
- **Marcar como comprado**: Clique no checkbox
- **Editar item**: Clique no ícone de lápis ✏️
- **Remover item**: Clique no ícone de lixeira 🗑️
- **Filtrar itens**: Use os botões de filtro

### 3. Exportar e Compartilhar
- **TXT**: Lista formatada em texto
- **PDF**: Documento com categorias e totais
- **Excel**: Planilha CSV compatível
- **Compartilhar**: Via WhatsApp, email, etc.

### 4. Personalização
- **Tema**: Clique no ícone 🌙/🌞 no canto superior
- **Categorias**: 5 categorias pré-definidas com ícones
- **Unidades**: 6 tipos de unidades disponíveis

## ⌨️ Atalhos de Teclado

- `Ctrl + Enter` - Adicionar item
- `Escape` - Fechar modal
- `Tab` - Navegar entre campos

## 🔧 Instalação e Execução

### Método 1: Execução Direta
1. Clone o repositório:
```bash
git clone https://github.com/Erick-Lim-Souza/Lista_de_Compras.git
```

2. Abra o arquivo `index.html` no navegador

### Método 2: Servidor Local
1. Instale um servidor HTTP simples:
```bash
# Com Python
python -m http.server 8000

# Com Node.js
npx http-server

# Com PHP
php -S localhost:8000
```

2. Acesse `http://localhost:8000`

## 📁 Estrutura do Projeto

```
Lista_de_Compras/
├── index.html          # Estrutura HTML
├── styles.css          # Estilos CSS modernos
├── script.js           # Lógica JavaScript
├── README.md           # Documentação
└── assets/             # Recursos (ícones, imagens)
```

## 🔮 Próximas Funcionalidades

- [ ] **PWA**: Transformar em Progressive Web App
- [ ] **Sincronização**: Backup na nuvem
- [ ] **Templates**: Listas predefinidas
- [ ] **Histórico**: Listas anteriores
- [ ] **Colaboração**: Listas compartilhadas
- [ ] **Notificações**: Lembretes de compras
- [ ] **Geolocalização**: Mercados próximos
- [ ] **Comparação**: Preços entre mercados

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. **Fork** o repositório
2. Crie uma **branch** para sua feature: `git checkout -b feature/nova-funcionalidade`
3. **Commit** suas mudanças: `git commit -m 'Adiciona nova funcionalidade'`
4. **Push** para a branch: `git push origin feature/nova-funcionalidade`
5. Abra um **Pull Request**

### 🐛 Reportar Bugs

Use as [Issues do GitHub](https://github.com/Erick-Lim-Souza/Lista_de_Compras/issues) para reportar bugs ou sugerir melhorias.

## 📄 Licença

Este projeto está licenciado sob a **Licença MIT**. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👨‍💻 Autor

**Erick Souza**

- 🌐 [GitHub: Erick-Lim-Souza](https://github.com/Erick-Lim-Souza)
- 💼 [LinkedIn](https://www.linkedin.com/in/erick-souza-70404686/)
- 🎓 [Perfil DIO.me](https://www.dio.me/users/erickdelimasouza)
- 📚 [Perfil Alura](https://cursos.alura.com.br/user/erickdelimasouza)
- 📧 Email: erick.devzone@gmail.com

## 🙏 Agradecimentos

- Comunidade de desenvolvedores
- Bibliotecas open source utilizadas
- Feedback dos usuários

---

**Desenvolvido com ❤️ e dedicação ao aprendizado de tecnologias web modernas.**

*Transforme suas compras em uma experiência organizada e eficiente!* 🛒✨
