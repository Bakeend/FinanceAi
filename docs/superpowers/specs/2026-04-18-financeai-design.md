# FinanceAi — Design Spec

**Data:** 2026-04-18
**Status:** Draft (aguardando revisão)

## 1. Objetivo

Aplicativo financeiro pessoal **single-user, local**, que lê extratos bancários (CSV/PDF), categoriza gastos via IA (OpenRouter), exibe dashboard, gera análises/previsões e oferece chat com contexto das transações.

Sem autenticação, sem multiusuário. Roda na máquina do usuário.

## 2. Stack

- **Frontend:** React (Vite) + TailwindCSS + React Router + Recharts + Framer Motion + react-dropzone.
- **Backend:** NestJS + TypeORM + PostgreSQL.
- **IA:** OpenRouter API com fallback automático entre modelos free.
- **Banco:** PostgreSQL local (instalado nativamente ou via Docker; orquestração fica a cargo do usuário).

## 3. Estrutura de pastas

```
FinanceAi/
├── backend/
│   ├── src/
│   │   ├── transactions/   upload, parse CSV/PDF, CRUD
│   │   ├── ai/             OpenRouterClient + AiService
│   │   ├── dashboard/      agregações
│   │   ├── chat/           endpoint stateless de chat
│   │   ├── database/       TypeORM datasource + migrations
│   │   └── main.ts
│   ├── test/
│   ├── .env.example        OPENROUTER_API_KEY, DATABASE_URL
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/          Dashboard, Upload, Insights, Chat
│   │   ├── components/     CategoryChart, TransactionList, ChatBox, MonthSelector, AiButton, BottomNav
│   │   ├── lib/            api client (fetch wrapper)
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── package.json
├── docs/superpowers/specs/
└── README.md
```

## 4. Banco de dados

Migrations TypeORM. Schema:

```sql
CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        DATE NOT NULL,
  descricao   TEXT NOT NULL,
  valor       NUMERIC(12,2) NOT NULL,           -- negativo = gasto, positivo = entrada
  categoria   VARCHAR(32) NOT NULL DEFAULT 'Outros',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_transactions_data ON transactions(data);

CREATE TABLE months (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes            INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano            INT NOT NULL,
  total_gasto    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_entrada  NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (mes, ano)
);
```

Categorias fixas (enum no código): `Alimentação`, `Transporte`, `Saúde`, `Lazer`, `Educação`, `Moradia`, `Compras`, `Outros`.

`months` é **upserted** ao final de cada `POST /transactions/upload` e ao final de qualquer `PATCH/DELETE` em `transactions`: o serviço recalcula `total_gasto` e `total_entrada` do mês afetado a partir de `transactions` e grava em `months`. O endpoint `GET /dashboard/summary` lê de `months` (rápido) + agregação por categoria direto de `transactions`. Sem trigger no banco — a invariante é mantida no código.

## 5. Backend — módulos e endpoints

### 5.1 `transactions/`

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/transactions/upload` | multipart; aceita CSV ou PDF; parseia → categoriza em batch via IA → grava |
| GET | `/transactions?mes=&ano=` | lista filtrada |
| PATCH | `/transactions/:id` | edita categoria manualmente |
| DELETE | `/transactions/:id` | remove |

**Parsers:**
- `CsvParser` — lê CSV com colunas `data,descricao,valor`. Aceita separador `,` ou `;`, valores BR (`1.234,56`) e US (`1234.56`).
- `PdfParser` — fluxo híbrido:
  1. Extrai texto com `pdf-parse`.
  2. Se vazio → erro 400 ("PDF parece ser imagem, use CSV").
  3. Tenta heurística (regex `dd/mm/aaaa ... valor`). Se achar ≥3 linhas válidas → usa direto.
  4. Caso contrário → fallback IA (`AiService.extractTransactions(textoBruto)`).

### 5.2 `ai/`

`OpenRouterClient` (classe interna):
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`.
- Headers: `Authorization: Bearer ${OPENROUTER_API_KEY}`, `Content-Type: application/json`, `HTTP-Referer: http://localhost:5173`, `X-Title: FinanceAi`.
- Cadeia de fallback (em ordem): `openrouter/auto`, `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen-2.5-72b-instruct:free`, `google/gemini-2.0-flash-exp:free`.
  - **Nota:** os IDs serão validados contra a lista atual do OpenRouter durante a fase de implementação. A spec original mencionava `qwen/qwen3.6-plus-preview:free` que não existe.
- Token bucket local: máximo 20 req/min, fila com espera.
- Timeout 30s.

Tratamento de erros:
- `401` → fatal, propaga.
- `429` ou `5xx` → próximo modelo da lista. Esgotando lista → lança `AiUnavailableError`.
- Resposta com JSON malformado (em chamadas estruturadas) → 1 retry com prompt reforçado. Falhando, retorna fallback semântico (ex: categoria `Outros`).

`AiService`:
- `categorizeBatch(transactions: TxRaw[])` — uma request, retorna `[{index, categoria}]`.
- `extractTransactions(rawText: string)` — usado pelo PdfParser; retorna `TxRaw[]`.
- `analyze(mes, ano)` — gera dicas de economia em texto.
- `forecast(mes, ano)` — prevê próximo mês (texto + número estimado).
- `chat(mensagem, historico, contextoTransacoes)` — chat com contexto.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/ai/analyze` | body: `{mes, ano}` → texto |
| POST | `/ai/forecast` | body: `{mes, ano}` → `{texto, valorEstimado}` |
| POST | `/ai/chat` | body: `{mensagem, historico}` → `{resposta}` |

### 5.3 `dashboard/`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/dashboard/summary?mes=&ano=` | `{totalGasto, totalEntrada, saldo, porCategoria: [{categoria, total}]}` |
| GET | `/dashboard/months` | `[{mes, ano}]` para o seletor |

### 5.4 `chat/`

Stateless: histórico vive no frontend (memória da sessão). Sem tabela de chat, sem persistência.

## 6. Frontend — páginas e componentes

### 6.1 Rotas

- `/` **Dashboard** — `MonthSelector`, 3 cards (gasto/entrada/saldo), `CategoryChart`, últimas 10 transações.
- `/upload` **Upload** — dropzone, preview parseado, botão "Confirmar e categorizar".
- `/insights` **Análise IA** — botão "Gerar análise" + botão "Prever próximo mês".
- `/chat` **Chat** — caixa de conversa, input fixo, histórico em `useState`.

### 6.2 Componentes

- `CategoryChart` — `recharts BarChart` horizontal.
- `TransactionList` — desktop: tabela com edição inline de categoria; mobile: cards empilhados.
- `MonthSelector` — dropdown de `/dashboard/months`.
- `AiButton` — botão com estados `loading/error/success`; tradução amigável de 401/429/503.
- `BottomNav` — visível só em `<md`, 4 ícones (Dashboard/Upload/Insights/Chat).
- `Sidebar` — visível em `md+`, 4 itens.

### 6.3 Estilo

- Tailwind config: `bg-slate-900` (#0f172a), cards `bg-slate-800` (#1e293b), accent `sky-400` (#38bdf8).
- Fonte DM Sans via Google Fonts no `index.html`, mapeada para `font-sans`.
- Dark mode permanente (sem toggle).

### 6.4 Animações (Framer Motion)

- Fade + slide vertical dos cards ao montar e ao trocar mês (200ms).
- Barras do gráfico crescendo (300ms, easeOut) ao carregar.
- Mensagens de chat entrando de baixo (150ms).
- Transição entre rotas com `AnimatePresence` (fade 200ms).
- Skeleton pulsante (animação CSS, sem framer) em loadings de IA e upload.

### 6.5 Responsividade

Mobile-first com breakpoints Tailwind:
- `<md`: bottom nav, 1 coluna de cards, transações como cards, gráfico com fontes/padding reduzidos, chat ocupa viewport com input fixo (`bottom-0 sticky`).
- `md+`: sidebar lateral, 3 colunas de cards, transações em tabela.
- Dropzone com `min-h-[200px]` e `touch-manipulation` para mobile.

### 6.6 Estado

Sem store global. Cada página busca o que precisa via `fetch`. Cliente HTTP fica em `lib/api.ts` com base URL `http://localhost:3001`.

## 7. Tratamento de erros

### 7.1 Backend → Frontend

| Origem | HTTP | Mensagem usuário |
|--------|------|------------------|
| OpenRouter 401 | 500 | "API key inválida, verifique `OPENROUTER_API_KEY`." |
| OpenRouter 429 (todos modelos) | 503 | "Limite da IA atingido (200/dia grátis). Tente novamente mais tarde." |
| CSV mal formatado | 400 | "CSV com colunas faltando: esperado data, descricao, valor." |
| PDF escaneado | 400 | "PDF parece ser imagem, use CSV ou PDF com texto nativo." |
| JSON malformado da IA (após retry) | — | Fallback silencioso: categoria `Outros`. |

### 7.2 Frontend

`AiButton` exibe banner inline com a mensagem do backend. Erros de rede (fetch falhou) → "Backend não respondeu, verifique se está rodando em :3001."

## 8. Variáveis de ambiente

`.env` no backend:
```
OPENROUTER_API_KEY=sk-or-...
DATABASE_URL=postgresql://user:pass@localhost:5432/financeai
PORT=3001
APP_REFERER=http://localhost:5173
APP_TITLE=FinanceAi
```

`.env.example` versionado, `.env` no `.gitignore`. Nunca hardcoded.

## 9. Testes

### Backend (Jest)

- `CsvParser` — fixtures: padrão, BR (`,` decimal), US (`.` decimal), com/sem cabeçalho, colunas faltando.
- `PdfParser` — fixtures: PDF "limpo" (heurística passa), PDF "bagunçado" (cai no fallback IA mockada), PDF vazio (erro 400).
- `OpenRouterClient` — mock de `fetch`: 429 cai para próximo modelo; 401 lança fatal; JSON malformado faz retry; lista esgotada lança `AiUnavailableError`.
- `DashboardService` — agregação por categoria com fixtures.

### Frontend

Sem testes automatizados nesta fase. Validação manual no navegador (golden path: upload CSV → ver dashboard → gerar análise → chat).

## 10. Fora de escopo (não fazer agora)

- Autenticação / multiusuário.
- OCR para PDFs escaneados.
- Persistência de chat em banco.
- Testes automatizados de frontend.
- Deploy em produção / Docker compose unificado.
- Categorias customizadas pelo usuário (lista é fixa).
- Exportação de relatórios.

## 11. Riscos conhecidos

- **Modelos free do OpenRouter mudam de nome / ficam offline.** Mitigação: cadeia de fallback + validação dos IDs no início da implementação + log claro de qual modelo respondeu.
- **Heurística de PDF varia muito entre bancos.** Mitigação: fallback IA. Caso falhe, usuário converte para CSV.
- **Cota 200 req/dia.** Mitigação: categorização em batch (1 req por upload), token bucket local.
