# 🛒 Lista de Compras Inteligente

> PWA offline-first para gerenciar listas de compras com comparação de preços atacado/varejo, histórico de gastos, dashboard analítico com inteligência preditiva e sugestão automática de listas baseada em ciclos de consumo.

**Desenvolvido por** Erick de Lima Souza · [Green Monster Project](https://ericklima-dev.netlify.app/)  
**Live demo:** [lista-de-compras-six-brown.vercel.app](https://lista-de-compras-six-brown.vercel.app/)

---

## ✨ Funcionalidades

### 🛍️ Gestão de Listas
- Adicionar, editar e remover itens com nome, categoria, quantidade e unidade
- Marcar itens como comprados com **vibração háptica** (40ms) em dispositivos móveis
- **Auto-ordenação:** itens comprados descem automaticamente para o final da lista
- Filtrar por **Todos / Pendentes / Comprados**
- Suporte a múltiplos tipos de lista: Supermercado 🛒, Feira Livre 🥕, Açougue 🍖, Farmácia 💊, Roupas 👕, Eletrônicos 📱, Casa e Jardim 🏠
- Categorias personalizadas por tipo de lista (com emoji)

### 💰 Comparação de Preços
- Dois campos de preço por item: **Atacado (ATK)** e **Varejo (VRJ)**
- Conversão automática de unidades: `g → kg`, `ml → L` (preço unitário correto)
- Totais calculados em tempo real na barra de estatísticas
- Cálculo automático de **economia** (varejo − atacado)

### 🔁 Ciclos de Consumo e Sugestão de Listas
- Motor de análise `estimateProductCycle()` detecta automaticamente o **intervalo médio de recompra** de cada produto baseado no histórico de listas salvas
- Indicador de urgência inline em cada item da lista:
  - `⏳ Dura ~25 dias` — produto em dia
  - `🔔 ~3d p/ repor` — acabando (≥ 80% do ciclo)
  - `⚠️ Acaba há 5d` — vencido
- **Modal de Sugestão de Lista** (botão `💡` no header):
  - Abas por tipo de lista + aba "Todos"
  - Chips de resumo: vencidos, acabando, em dia, novos
  - Indicador de confiança por produto: `●●●` alta (7+ compras) · `●●○` média (4–6) · `●○○` baixa (2–3)
  - Barra de progresso de urgência por produto
  - Seleção manual individual ou `☑ Todos urgentes` (fallback para todos se nenhum for urgente)
  - Itens com 1 só ocorrência exibidos com badge `❓ Novo`
  - Seleção multi-tipo → dialog pergunta qual tipo de lista criar

### 💳 Pagamentos Múltiplos
- Campo de **forma de pagamento** ao salvar: PIX, Dinheiro, Cartão de Crédito, Cartão de Débito, Vale Alimentação, Vale Refeição
- Botão `÷ dividir pagamento` para registrar múltiplas formas numa mesma compra
- Badge `✓ fechado` quando os valores somam exatamente o total; `faltam R$ X` quando há divergência
- Alerta de divergência mas sem bloqueio de salvamento

### 🏪 Campo Mercado
- Registro do estabelecimento em cada lista salva (Assaí, Atacadão, Carrefour, Extra, Pão de Açúcar, Dia, Mercadinho ou campo livre)
- Alimenta os gráficos de **Gastos por Mercado** e **Economia por Mercado** no dashboard

### 📈 Histórico de Preços
- Cada item com preço salvo gera um snapshot automático no localStorage
- Máximo de 30 entradas por produto
- Badge de tendência inline em cada item: `↑ +5.2%` (vermelho) · `↓ 3.1%` (verde) · `→ Estável`
- Modal de histórico completo com tabela por data e coluna de variação

### 💾 Gestão de Listas Salvas
- Salvar listas com nome personalizado, tipo, mercado e data de compra
- Carregar ou excluir listas salvas
- Modal de histórico com data, contagem de itens, forma de pagamento e mercado
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

---

## 📊 Dashboard Analítico (`dashboard.html`)

### Filtros Globais
- **Período:** 7D / 30D / 3M / 6M / 1A / Tudo + seletor de datas customizado
- **Tipo de lista:** Todos / Supermercado / Feira Livre / Açougue / Farmácia / Roupas / Eletrônicos / Casa e Jardim — filtro dinâmico populado pelos tipos presentes no histórico real; todos os 13 gráficos respondem

### KPIs (5 cards animados)
Total gasto · Média por mês · Mês mais caro · Nº de listas · Ticket médio

### Gráficos (13 visualizações)

| # | Gráfico | Tipo | Dados |
|---|---------|------|-------|
| 01 | Gasto Mensal | Barras verticais | Soma por mês, barra de pico destacada, tooltip com Δ% |
| 02 | Evolução de Gastos | Linha + barras (eixo duplo) | Acumulado + valor individual por lista |
| 03 | Gastos por Categoria | Donut | Custo por categoria dos itens (nível de produto) |
| 04 | Mapa de Calor Anual | 12 células / navegação por ano | Intensidade proporcional ao mês de pico |
| 05 | Formas de Pagamento | Donut | Total pago por modalidade (suporta divisão) |
| 06 | Ticket Médio por Pagamento | Barras horizontais | Média gasta quando usa cada método |
| 07 | Gastos por Mercado | Donut | Proporção do gasto por estabelecimento |
| 08 | Economia por Mercado | Ranking c/ barras | Economia acumulada `(varejo − atacado) × qty` |
| 09 | Tendência de Inflação | Linha dupla (eixo duplo) | Gasto médio/mês + variação % desde o 1º mês |
| 10 | Previsão do Próximo Mês | Card preditivo | Média móvel ponderada (pesos 1-2-3, janela 3 meses) |
| 11 | Evolução de Preços | Barras horizontais | Top 8 produtos por variação absoluta de preço |
| 12 | Top 12 Produtos | Tabela c/ barra | Ranking por total gasto, qty acumulada, conversão g→kg |
| 13 | Linha do Tempo | Cards cronológicos | Cada lista com data, tipo, mercado e pagamentos |

### Modo demonstração automático
Gera 18 listas fictícias com dados verossímeis quando o usuário ainda não possui listas salvas.

### Guia dos Gráficos (`ajuda.html`)
Página de documentação interativa acessível pelo botão `❓ Guia dos Gráficos` no header do dashboard:
- Explicação detalhada de cada um dos 13 gráficos
- Quais dados precisam estar preenchidos (badges: obrigatório / recomendado)
- Algoritmos reais com fórmulas (média móvel ponderada da previsão, cálculo de economia, intensidade do heatmap)
- Dicas práticas de preenchimento
- Índice navegável com scroll suave

---

## 📲 PWA (Progressive Web App)

- Instalável como app nativo em Android, iOS e desktop
- **Funciona 100% offline** após o primeiro acesso
- Banner de instalação inteligente (descartável, salva preferência)
- Instruções de instalação para iOS (Add to Home Screen)
- Cache versionado `v3` no Service Worker

---

## 🗂️ Estrutura do Projeto

```
lista-de-compras/
├── index.html          # App principal (430 linhas)
├── dashboard.html      # Dashboard analítico (1.246 linhas)
├── ajuda.html          # Guia dos Gráficos (1.191 linhas)
├── versao.html         # Página "Sobre / Changelog"
├── styles.css          # Design system — única fonte de estilos (1.647 linhas)
├── sw.js               # Service Worker cache v3 (offline-first)
├── manifest.json       # PWA manifest
│
├── js/
│   ├── calculator.js   # Cálculos, ciclos de consumo, análise de produtos (315 linhas)
│   ├── storage.js      # Persistência, schema v3, backup, migração automática (265 linhas)
│   ├── ui.js           # Renderização DOM — zero innerHTML para dados do usuário (436 linhas)
│   ├── export.js       # Exportação TXT / PDF / CSV (150 linhas)
│   └── app.js          # Orquestrador: eventos, PaymentManager, SuggestionManager (1.103 linhas)
│
└── img/
    └── icons/          # Ícones PWA
```

---

## 🧱 Arquitetura Modular (v3.0)

| Módulo | Responsabilidade | Linhas |
|--------|-----------------|--------|
| `calculator.js` | Cálculos puros: preços, unidades, tendências, ciclos de consumo, análise de produtos | 315 |
| `storage.js` | localStorage: listas, histórico, backup, tema, migração v1→v2→v3 | 265 |
| `ui.js` | Renderização DOM, sanitização HTML, modals, toasts, histórico | 436 |
| `export.js` | TXT, PDF (jsPDF) e CSV | 150 |
| `app.js` | Orquestrador: eventos, `PaymentManager`, `SuggestionManager`, `_applySuggestedList` | 1.103 |

**Ordem de carregamento** (sem bundler necessário):
```html
<script src="js/calculator.js"></script>
<script src="js/storage.js"></script>
<script src="js/ui.js"></script>
<script src="js/export.js"></script>
<script src="js/app.js"></script>
```

---

## 💾 Schema do localStorage (v3)

Chave: `shoppingListData`

```json
{
  "schemaVersion": 3,
  "theme": "dark",
  "currentList": {
    "items": [],
    "name": "Lista Atual",
    "listType": "Supermercado"
  },
  "savedLists": [
    {
      "name": "Feira 15/06",
      "items": [],
      "listType": "Feira Livre",
      "createdAt": "2025-06-15T12:00:00.000Z",
      "purchaseDate": "2025-06-15T12:00:00.000Z",
      "payments": [
        { "method": "pix", "amount": 120.00 }
      ],
      "market": "Assaí",
      "total": 120.00,
      "date": "2025-06-15T12:00:00.000Z"
    }
  ],
  "customCategories": {
    "Supermercado": {
      "Proteínas Veganas": "🌱"
    }
  },
  "priceHistory": {
    "arroz_5kg": [
      { "date": "2025-04-01T12:00:00.000Z", "wholesale": 22.90, "retail": 28.50 }
    ]
  },
  "feedbacks": []
}
```

**Migração automática:** `storage.js` detecta `schemaVersion` e migra silenciosamente de v1/v2 para v3.  
Principal mudança da v3: `payments[]` (array) substitui `paymentMethod` (string) + adição de `purchaseDate` e `market`.

---

## 🤖 Motor de Ciclos de Consumo (`calculator.js`)

```js
estimateProductCycle(itemName, savedLists)
// → { avgDays, daysSinceLast, occurrences, confidence }

productCycleStatus(cycleResult)
// → { urgency: 'ok' | 'soon' | 'overdue' | 'unknown', daysLeft }

analyzeAllProducts(savedLists, { minOccurrences })
// → [{ name, norm, urgency, avgDays, daysSinceLast, confidence,
//      lastQty, lastUnit, listType, category }]
```

**Níveis de urgência:**

| Nível | Critério | Visual |
|-------|----------|--------|
| `overdue` | `daysSinceLast ≥ avgDays` | Barra vermelha |
| `soon` | `daysSinceLast ≥ avgDays × 0.8` | Barra laranja |
| `ok` | `daysSinceLast < avgDays × 0.8` | Barra verde |
| `unknown` | Apenas 1 ocorrência | Badge `❓ Novo` |

---

## 🔐 Segurança

- **Zero `innerHTML` com dados do usuário** — toda string vinda do usuário usa `textContent` ou `createElement`
- Função `sanitize(str)` em `ui.js` para casos de exibição dinâmica
- `crypto.randomUUID()` para IDs de itens (com fallback seguro via `getRandomValues`)

---

## 🛠️ Service Worker (v3)

| Recurso | Estratégia |
|---------|-----------|
| Páginas HTML (navegação) | **Network-first** → cache como fallback |
| CSS, JS, fontes, imagens | **Cache-first** → atualiza em background |
| Todo o resto | **Stale-while-revalidate** |

Shell cacheado: `index.html`, `dashboard.html`, `ajuda.html`, `versao.html`, `styles.css`, todos os módulos JS.

---

## 📦 Dependências Externas (CDN)

| Biblioteca | Uso |
|-----------|-----|
| [jsPDF 2.5.1](https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js) | Exportação PDF |
| [Chart.js 4.4.1](https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js) | 13 gráficos do dashboard |
| [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) | Tipografia principal |
| [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) | Tipografia monospace (valores, badges) |

> Nenhum framework JS. Zero dependências de build. Funciona com `file://` local ou qualquer servidor estático.

---

## 🚀 Como Usar

```bash
# Clonar e abrir localmente
git clone https://github.com/seu-usuario/lista-de-compras.git
cd lista-de-compras
npx serve .
```

Ou faça deploy direto no Vercel / Netlify / GitHub Pages — não há etapa de build.

---

## 📋 Changelog

### v3.0 — Ciclos de Consumo · Pagamentos · Mercado · Dashboard Avançado
- 🔁 **Ciclos de consumo** — `estimateProductCycle()` detecta padrão de recompra de cada produto
- 💡 **Sugestão automática de lista** — modal com tabs por tipo, urgência, confiança e seleção inteligente
- 💳 **Pagamentos múltiplos** — `payments[]` array, split de pagamento, badge de fechamento
- 🏪 **Campo Mercado** — estabelecimento por lista, alimenta gráficos de mercado no dashboard
- 📊 **Dashboard:** 8 novos gráficos (pagamentos, mercado, economia, inflação, previsão, evolução de preços)
- 🎛️ **Filtro de tipo** no dashboard — todos os 13 gráficos respondem ao tipo selecionado
- 📖 **Guia dos Gráficos** (`ajuda.html`) — documentação interativa com fórmulas e algoritmos reais
- 📳 **Vibração háptica** no toggle de item (40ms)
- 🔃 **Auto-sort** — itens comprados descem automaticamente para o fim da lista
- 🎨 **CSS unificado** — `styles.css` é a única fonte de estilos para todas as páginas
- 🛡️ **Schema v3** com migração automática de v1/v2

### v2.0 — Refatoração + Dashboard + Backup
- ♻️ **Arquitetura modular** — `script.js` dividido em 5 módulos focados
- 📊 **Dashboard analítico** com KPIs, gráficos, heatmap e top produtos
- 📈 **Histórico de preços** com badge de tendência inline (↑ ↓ →)
- 💾 **Backup JSON** com merge inteligente
- 🔐 **Sanitização HTML** — zero `innerHTML` para dados do usuário
- 🔄 **Service Worker v2** — cache versionado, auto-update

### v1.0 — Versão inicial
- CRUD de itens, filtros, tipos de lista, categorias personalizadas
- Comparação atacado/varejo com conversão de unidades
- Exportação TXT, PDF e CSV
- Salvar, carregar e comparar listas
- PWA instalável com suporte offline
- Tema dark/light persistido

---

## 📄 Licença

Projeto pessoal — uso livre com créditos ao autor.

**Erick de Lima Souza** · [ericklima-dev.netlify.app](https://ericklima-dev.netlify.app/) · Green Monster Project © 2025
