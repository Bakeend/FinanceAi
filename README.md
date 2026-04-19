# FinanceAi

Aplicativo financeiro pessoal local. Upload de extratos (CSV/PDF), categorização automática via IA (OpenRouter), dashboard com gráficos, análises, previsão de gastos e chat com contexto das suas finanças.

**Stack:** NestJS + TypeORM + SQLite no backend, React + Vite + TailwindCSS + Framer Motion no frontend, OpenRouter para IA (com fallback automático entre modelos free).

## Pré-requisitos

- Node 20+
- API key do OpenRouter — crie em https://openrouter.ai/keys

(Não precisa de Postgres — o banco é SQLite, arquivo local em `backend/data/financeai.db`.)

## Setup

### Backend
```bash
cd backend
cp .env.example .env          # edite OPENROUTER_API_KEY
npm install
npm run migration:run
npm run start:dev
```
Backend roda em http://localhost:3001.

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Frontend roda em http://localhost:5173.

## Uso

1. Abra http://localhost:5173
2. **Upload** → envie um CSV (`data,descricao,valor`) ou PDF de extrato bancário
3. **Dashboard** → veja totais, gráfico de barras por categoria e lista de transações (edite a categoria inline se quiser)
4. **Insights** → botões "Gerar análise" e "Prever próximo mês"
5. **Chat** → perguntas livres com contexto das suas transações

## Testes

```bash
cd backend && npm test
```

Cobrem: `CsvParser`, `PdfParser`, `TransactionsService`, `OpenRouterClient` (fallback de modelos, 401, 429), `AiService.categorizeBatch`, `DashboardService`.

## Notas operacionais

- **Cota free do OpenRouter:** 200 req/dia e 20 req/min. Cada upload de CSV/PDF consome ~1-2 req (1 para parse IA opcional em PDF + 1 para categorização em batch). Cada análise, previsão ou mensagem de chat = 1 req.
- **Fallback de modelos:** se um modelo der 429, o cliente tenta o próximo na lista (`openrouter/auto` → `llama-3.3-70b:free` → `qwen-2.5-72b:free` → `gemini-2.0-flash-exp:free`). Se todos falharem, o app devolve 503 e mostra mensagem amigável.
- **API key inválida:** devolve 500 com mensagem clara. Verifique o `.env` do backend.
- **PDFs escaneados (sem texto)** não são suportados — converta para CSV.

## Estrutura

```
FinanceAi/
├── backend/               NestJS + TypeORM + SQLite
│   ├── src/
│   │   ├── transactions/  upload, parse CSV/PDF, CRUD
│   │   ├── ai/            OpenRouterClient + AiService + controller
│   │   ├── dashboard/     agregações por categoria/mês
│   │   └── database/      datasource + migrations
│   ├── test/fixtures/     CSVs e texto de PDF para testes
│   └── data/financeai.db  gerado em runtime
├── frontend/              React + Vite + Tailwind
│   └── src/
│       ├── pages/         Dashboard, Upload, Insights, Chat
│       ├── components/    Sidebar, BottomNav, MonthSelector, charts, etc.
│       └── lib/           api client, tipos
└── docs/superpowers/      spec e plano de implementação
```
