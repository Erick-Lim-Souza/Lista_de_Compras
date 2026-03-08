# 🛒 Lista de Compras Inteligente

> PWA offline-first para gerenciar listas de compras com comparação de preços atacado/varejo, histórico de gastos e dashboard analítico.

**Desenvolvido por** Erick de Lima Souza · [Green Monster Project](https://ericklima-dev.netlify.app/)  
**Live demo:** [lista-de-compras-six-brown.vercel.app](https://lista-de-compras-six-brown.vercel.app/)

---

## ✨ Funcionalidades

### 🛍️ Gestão de Listas
- Adicionar, editar e remover itens com nome, categoria, quantidade e unidade
- Marcar itens como comprados (checkbox por item)
- Filtrar por **Todos / Pendentes / Comprados**
- Suporte a múltiplos tipos de lista: Supermercado, Feira Livre, Açougue, Farmácia, Roupas, Eletrônicos, Casa e Jardim
- Categorias personalizadas por tipo de lista (com emoji)

### 💰 Comparação de Preços
- Dois campos de preço por item: **Atacado (ATK)** e **Varejo (VRJ)**
- Conversão automática de unidades: `g → kg`, `ml → L` (preço unitário correto)
- Totais calculados em tempo real na barra de estatísticas
- Cálculo automático de **economia** (varejo − atacado)

### 📈 Histórico de Preços
- Cada item com preço salvo gera um snapshot automático no localStorage
- Máximo de 30 entradas por produto
- Badge de tendência inline em cada item: `↑ +5.2%` (vermelho) · `↓ 3.1%` (verde) · `→ Estável`
- Modal de histórico completo com tabela por data e coluna de variação

### 💾 Gestão de Listas Salvas
- Salvar listas com nome personalizado
- Carregar ou excluir listas salvas
- Modal de histórico com data e contagem de itens
- Comparar duas listas salvas lado a lado (itens em comum, exclusivos de cada lista)

### 📤 Exportação
| Formato | Conteúdo |
|---------|----------|
| **TXT** | Agrupado por categoria com status ✅/⬜ e preços ATK/VRJ |
| **PDF** | jsPDF com cor accent `#00C48C`, paginação e totais |
| **CSV** | UTF-8 BOM (compatível Excel), todos os campos com preços individuais e totais |

### 🔒 Backup de Dados
- **⬇ Baixar JSON** — exporta o localStorage completo para arquivo `.json`
- **⬆ Restaurar JSON** — importa e faz **merge inteligente**:
  - Listas novas são adicionadas sem sobrescrever as existentes
  - Histórico de preços mesclado com de-duplicação por data
  - Categorias personalizadas mescladas por tipo de lista

### 📊 Dashboard Analítico (`dashboard.html`)
- **5 KPIs** animados: total gasto, média mensal, mês mais caro, nº de listas, ticket médio
- **Gráfico de barras mensal** — variação mês a mês com tooltip de percentual
- **Linha acumulada** — curva de gasto total + barrinhas por lista
- **Pizza por categoria** — distribuição percentual dos gastos
- **Mapa de calor anual** — 12 meses com intensidade de cor proporcional ao gasto
- **Timeline de compras** — cards de cada lista no período selecionado
- **Top 12 produtos** — ranking com barra de distribuição e contador de ocorrências
- Filtros rápidos: 7D / 30D / 3M / 6M / 1A / Tudo
- Período customizado com seletor de datas
- **Modo demonstração automático** — gera 18 listas fictícias com dados verossímeis quando ainda não há listas salvas

### 📲 PWA (Progressive Web App)
- Instalável como app nativo em Android, iOS e desktop
- **Funciona 100% offline** após o primeiro acesso
- Banner de instalação inteligente (descartável, salva preferência)
- Instruções de instalação para iOS (Add to Home Screen)

### 🌙 Tema Dark/Light
- Toggle persistido no localStorage
- Sincronizado entre `index.html`, `versao.html` e `dashboard.html`

---

## 🗂️ Estrutura do Projeto

```
lista-de-compras/
├── index.html          # App principal
├── dashboard.html      # Dashboard analítico
├── versao.html         # Página "Sobre / Changelog"
├── styles.css          # Design system completo
├── sw.js               # Service Worker (cache versionado + offline)
├── manifest.json       # PWA manifest
│
├── js/
│   ├── calculator.js   # Motor de cálculo puro (sem DOM)
│   ├── storage.js      # Persistência, backup e histórico de preços
│   ├── ui.js           # Renderização DOM (sem innerHTML para dados do usuário)
│   ├── export.js       # Exportação TXT / PDF / CSV
│   └── app.js          # Orquestrador — conecta todos os módulos
│
└── img/
    └── icons/          # Ícones PWA
```

---

## 🧱 Arquitetura Modular (v2.0)

O `script.js` monolítico de **1.479 linhas** foi refatorado em 5 módulos com responsabilidade única:

| Módulo | Responsabilidade | Linhas |
|--------|-----------------|--------|
| `calculator.js` | Cálculos puros, normalização de unidades, tendência de preço | 110 |
| `storage.js` | Todo o localStorage: listas, histórico, backup, temas | 200 |
| `ui.js` | Renderização DOM, sanitização de HTML, modals, toast | 407 |
| `export.js` | Geração de TXT, PDF (jsPDF) e CSV | 150 |
| `app.js` | Orquestrador: binding de eventos, delegação para módulos | 522 |

**Ordem de carregamento** (sem bundler necessário):
```html
<script src="js/calculator.js"></script>
<script src="js/storage.js"></script>
<script src="js/ui.js"></script>
<script src="js/export.js"></script>
<script src="js/app.js"></script>
```

---

## 🔐 Segurança

- **Zero `innerHTML` com dados do usuário** — toda string vinda do usuário usa `textContent` ou `createElement`
- Função `sanitize(str)` em `ui.js` para casos de exibição dinâmica
- `crypto.randomUUID()` para IDs de itens (com fallback seguro via `getRandomValues`)

---

## 💾 Schema do localStorage

Chave: `shoppingListData`

```json
{
  "theme": "dark",
  "currentList": {
    "items": [...],
    "name": "Lista Atual",
    "listType": "Supermercado"
  },
  "savedLists": [
    {
      "name": "Feira 15/06",
      "items": [...],
      "listType": "Feira Livre",
      "date": "2025-06-15T14:32:00.000Z"
    }
  ],
  "customCategories": {
    "Supermercado": {
      "Proteínas Veganas": "🌱"
    }
  },
  "priceHistory": {
    "arroz_5kg": [
      { "date": "2025-04-01T...", "wholesale": 22.90, "retail": 28.50 },
      { "date": "2025-05-10T...", "wholesale": 23.50, "retail": 29.90 }
    ]
  },
  "feedbacks": [...]
}
```

---

## 🛠️ Service Worker (v2)

Estratégia de cache por tipo de recurso:

| Recurso | Estratégia |
|---------|-----------|
| Páginas HTML (navegação) | **Network-first** → cache como fallback |
| CSS, JS, fontes, imagens | **Cache-first** → atualiza em background |
| Todo o resto | **Stale-while-revalidate** |

- Auto-ativação: novo SW toma controle imediatamente (`skipWaiting + clients.claim`)
- Limpeza automática de caches de versões anteriores no `activate`
- Aceita mensagem `SKIP_WAITING` da página para update forçado

---

## 📦 Dependências Externas (CDN)

| Biblioteca | Uso |
|-----------|-----|
| [jsPDF 2.5.1](https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js) | Exportação PDF |
| [Chart.js 4.4.1](https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js) | Gráficos do dashboard |
| [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) | Tipografia principal |
| [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) | Tipografia monospace (valores, badges) |

> Nenhum framework JS. Zero dependências de build. Funciona com `file://` local ou qualquer servidor estático.

---

## 🚀 Como Usar

### Deploy estático (Vercel / Netlify / GitHub Pages)

Faça o upload de todos os arquivos para a raiz do repositório. Não há etapa de build.

```bash
# Clonar e abrir localmente
git clone https://github.com/seu-usuario/lista-de-compras.git
cd lista-de-compras
# Abrir index.html no navegador ou usar qualquer servidor local:
npx serve .
```

### Estrutura de arquivos para o deploy

```
/
├── index.html
├── dashboard.html
├── versao.html
├── styles.css
├── sw.js
├── manifest.json
├── js/
│   ├── calculator.js
│   ├── storage.js
│   ├── ui.js
│   ├── export.js
│   └── app.js
└── img/
    └── icons/
```

---

## 📋 Changelog

### v2.0 — Refatoração + Dashboard + Backup
- ♻️ **Arquitetura modular** — `script.js` dividido em 5 módulos focados
- 📊 **Dashboard analítico** (`dashboard.html`) com 5 KPIs, 4 gráficos, heatmap e top produtos
- 📈 **Histórico de preços** por produto com badge de tendência inline (↑ ↓ →)
- 💾 **Backup JSON** — export/import com merge inteligente (não substitui dados existentes)
- 🔐 **Sanitização de HTML** — zero `innerHTML` para dados do usuário
- 🔑 **`crypto.randomUUID()`** para IDs de itens
- 🔄 **Service Worker v2** — cache versionado, auto-update, offline fallback por tipo de recurso
- 🎨 **Design tech-minimal** — JetBrains Mono + Bricolage Grotesque, CSS variables completo, dark mode nativo

### v1.0 — Versão inicial
- Adicionar, editar, excluir e marcar itens como comprados
- Filtros por status (todos / pendentes / comprados)
- Múltiplos tipos de lista e categorias personalizadas
- Cálculo de preço atacado/varejo com conversão de unidades (g→kg, ml→L)
- Exportação TXT, PDF e CSV
- Salvar, carregar e comparar listas
- PWA installável com suporte offline
- Tema dark/light persistido

---

## 📄 Licença

Projeto pessoal — uso livre com créditos ao autor.

**Erick de Lima Souza** · [ericklima-dev.netlify.app](https://ericklima-dev.netlify.app/) · Green Monster Project © 2025
