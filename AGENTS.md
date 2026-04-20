# FinanceAi — Guia para agentes de IA

> **Leia este arquivo antes de modificar o código.** Ele resume decisões de arquitetura, convenções e armadilhas já encontradas. Atualize quando introduzir uma nova convenção.
>
> Para **postura de trabalho** (código limpo, testes, mobile, protocolo de dúvidas), veja `.ai-memory/`.

## Visão geral

Aplicativo financeiro pessoal **single-user, local**. Sem autenticação. Lê extratos (CSV/PDF), categoriza via IA, mostra dashboard, analisa e conversa.

- **Backend:** NestJS 10 + TypeORM + SQLite (`backend/`) na porta 3001
- **Frontend:** React 19 + Vite 8 + TailwindCSS 3 + Framer Motion + Recharts (`frontend/`) na porta 5173
- **IA:** OpenRouter com fallback entre modelos free (`openrouter/auto` → Llama 3.3 → Qwen 2.5 → Gemini 2.0)
- **Monorepo simples** — pastas lado a lado, sem workspaces. Script raiz `npm run dev` usa `concurrently`.

## Convenções NUNCA quebre

### Usuário
- **Sem git.** Não rode `git init`, `git add`, `git commit`, nada. O usuário não usa controle de versão neste projeto.
- **Sem autenticação.** Ignore qualquer sugestão de login/JWT/multiusuário. Se pedirem, pergunte antes de criar.
- **PostgreSQL NÃO.** Use SQLite (`better-sqlite3`). Env var é `DATABASE_PATH`, não `DATABASE_URL`.

### Código
- **TypeScript strict em tudo.** Frontend tem `erasableSyntaxOnly: true` → **não use parameter properties no constructor** (`constructor(public foo: T)` quebra). Declare campos separadamente.
- **Imports de tipo** com `import type` quando for só tipo (`verbatimModuleSyntax` no frontend).
- **Tailwind v3** (não v4). Classes estáticas apenas; **nada de classes dinâmicas interpoladas** tipo `bg-${cor}-500` — use `style={{ backgroundColor: hex }}` quando a cor vier de dado.
- **Design tokens** em `frontend/tailwind.config.js`: `bg`, `bg-soft`, `card`, `card-hover`, `border`, `accent`, `muted`. Gradients em `accent-gradient`, `rose-gradient`, `emerald-gradient`. Shadows: `shadow-glow-accent/rose/emerald`, `shadow-card`.
- **Fonte:** DM Sans via Google Fonts (carregada em `index.html`), configurada como `font-sans` no Tailwind.
- **Animações:** Framer Motion. Padrão de entrada: `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: N, duration: 0.3-0.4 }}`.
- **Ícones:** Lucide React (`lucide-react`). Nada de emoji em componentes novos.
- **Toda página tem** `MonthSelector` onde faz sentido + header com `gradient-text` no título.

### Respostas da IA (prompts em `backend/src/ai/ai.service.ts`)
- **Toda chamada de IA passa por `this.buildSys(taskRules, extraContext?)`** que prepende `MEMORY_CORE` de `backend/src/ai/memory.ts`.
- `MEMORY_CORE` contém regras globais (idioma PT-BR obrigatório, proibir markdown, não chamar o usuário por nome, honestidade sobre dados ausentes, sugerir "Recategorizar" quando dominante for "Outros"). **Não duplique essas regras em prompts específicos** — só adicione regras da tarefa.
- **Sempre rode a resposta pelo `this.stripMarkdown()`** antes de devolver texto livre (modelos free ignoram a instrução com frequência).
- **JSON com retry:** use `tryParseJson()` (já existe) que tenta 2x e retorna fallback seguro se falhar.
- **Categorias** vêm de `backend/src/transactions/categoria.enum.ts` (20 valores). Cada uma tem dica em `CATEGORIA_HINTS`. Quando adicionar categoria, também adicione no frontend em `frontend/src/lib/categories.ts` com Icon + cor + hint.

## Arquitetura

```
FinanceAi/
├── package.json              # scripts raiz (npm run dev = concurrently)
├── backend/
│   ├── src/
│   │   ├── main.ts           # bootstrap; dotenv.config({ override: true }) NO TOPO
│   │   ├── app.module.ts     # registra todos os módulos
│   │   ├── database/         # TypeORM datasource + migrations
│   │   ├── transactions/     # entity, service, controller, parsers
│   │   ├── accounts/         # contas/cartões
│   │   ├── goals/            # metas (limite + poupança)
│   │   ├── reminders/        # lembretes recorrentes
│   │   ├── dashboard/        # summary, trend, alerts, anomalies, cashflow, timeline
│   │   └── ai/               # OpenRouterClient + AiService + memory + rate-limiter
│   ├── data/financeai.db     # SQLite (criado em runtime)
│   └── .env                  # OPENROUTER_API_KEY, DATABASE_PATH, PORT=3001
├── frontend/
│   ├── index.html            # DM Sans + manifest + meta tags PWA
│   ├── public/               # manifest.webmanifest, icon.svg, sw.js
│   └── src/
│       ├── main.tsx          # router + UndoProvider + SW register
│       ├── components/       # Layout, Sidebar, BottomNav, MoreSheet, charts, chips, modals
│       ├── pages/            # Dashboard, Transactions, NewTransaction, Upload, Goals, Compare, Insights, Chat, Reminders, Accounts
│       ├── lib/              # api, types, categories, theme, shortcuts, undo (tsx), pdf, pwa
│       └── index.css         # Tailwind + tema dark/light
└── .claude/launch.json       # configs pra preview_start
```

## Pontos importantes por módulo

### Backend

**Main/bootstrap (`main.ts`):**
- **`dotenv.config({ override: true })` NO TOPO do arquivo.** Necessário porque o preview tool passa `PORT=5173` via env que sobreescreveria a porta do backend. Sem isso, backend acaba bindando em 5173.
- Validação global via `ValidationPipe({ transform: true, whitelist: true })`.
- `AiErrorsFilter` global captura `AiAuthError` (500) e `AiUnavailableError` (503).

**Transactions:**
- `createMany` faz **dedup automático** por signature `data|descrição-normalizada|cents`. Transações idênticas são ignoradas.
- Detecta **transferências internas** (`is_transfer`) por heurística: `Pix...você mesmo` ou par com valores opostos em ±3 dias com descrições similares. Transfers são excluídas de `recomputeMonth`, summary, charts.
- **Parcelamento** via `installment_group` + `installment_num` + `installment_total`. `createInstallments` gera N rows espaçadas de 1 mês.
- **Split** via `split_parent_id`. `splitTransaction` apaga o pai e cria filhos somando o mesmo valor.
- **Tags** (JSON array) via transformer no entity.
- **Attachment** (base64 data URL) como coluna TEXT.
- `findFiltered` suporta `mes, ano, categoria, q, tipo, accountId`.

**Parsers:**
- `CsvParser` detecta separador `,`/`;`, formato BR (`1.234,56`) ou US (`1234.56`), data ISO ou `dd/mm/yyyy`.
- `PdfParser` tem `deps.extractText` injetável (útil pra testes). Em produção usa **`require('pdf-parse')` lazy** (não `import`) porque pdf-parse v2 tem bug de eager-load e **mudou pra classe `PDFParse`**. Uso: `new PDFParse({ data: new Uint8Array(buf) }).getText()`.
- Heurística regex procura `dd/mm/yyyy ... valor,XX` em linhas ancoradas (`^...$` com flag `gm`). Se acha < 3 matches, cai no `deps.fallbackAi` (AiService.extractTransactions).

**AI (`ai.service.ts`):**
- Todo método usa `this.buildSys(taskRules, extraContext?)` que mescla `MEMORY_CORE` + memória do usuário (tabela `ai_memory`) + regras específicas.
- `categorizeBatch`: rodadas de 50 em 50 (chunked em `recategorize`) pra evitar timeout.
- Fallback de modelo automático no `OpenRouterClient` com retry: se 429/5xx, tenta próximo modelo. Se 401, propaga `AiAuthError` (fatal).
- Token bucket local 20 req/min default.

**Dashboard:**
- `summary/trend/alerts/recurring/anomalies/yearlyProjection/cashflow/balanceTimeline` — todos excluem `is_transfer = 1`.
- `alerts` retorna array vazio se mês anterior não tem dados (evita falso "novo gasto em tudo").
- `anomalies` usa mediana por categoria × multiplicador (≥3x flagged).

### Frontend

**Navegação:**
- `Sidebar.tsx` (desktop `md+`): 9 itens + toggle tema + link de memória/app.
- `BottomNav.tsx` (mobile `<md`): 4 itens + FAB central pro `/new`. Link "Mais" abre `MoreSheet`.
- `MoreSheet.tsx`: sheet bottom-up com os itens que não couberam no BottomNav (Contas, Insights, Upload, Metas, Comparar, Lembretes) + tema + "Instalar como app" (só quando `beforeinstallprompt` dispara).
- `MonthSelector`: **se o mês atual não tiver dados, auto-sincroniza pro mês mais recente com dados**. Sem isso, a UI mostrava "Abr 2026" visualmente mas o estado ficava em mês vazio → "nenhuma transação".

**Componentes-chave:**
- `TransactionList`: suporta bulk actions (checkbox, barra flutuante pra categorizar/transfer/excluir em massa). Clique na linha abre `TransactionEditModal`.
- `TransactionEditModal`: edita tudo incluindo tags, conta, attachment. Tem botão "Dividir transação" que abre um segundo modo. Se a tx tem `installmentGroup`, mostra checkbox "Aplicar a todas as parcelas".
- `CategoryChip` + `lib/categories.ts`: fonte única de verdade pra categoria → ícone + cor. **Qualquer nova categoria precisa entrar aqui**.
- `UndoProvider` (`lib/undo.tsx`): context que gerencia toasts com "Desfazer" por 6s. Usado em exclusões (single + bulk).
- `GlobalSearchBar`: modal de busca com IA acionado por `Ctrl+K` ou `/`. Backend traduz NL em filtros.

**PWA:**
- `public/manifest.webmanifest` + `public/icon.svg` + `public/sw.js` (SW minimal no-op).
- Registrado em `main.tsx`.
- Botão "Instalar como app" em `MoreSheet` só aparece depois de `beforeinstallprompt` via `lib/pwa.ts` (module-level pub/sub).

**Atalhos (`lib/shortcuts.ts`):**
- `D` Dashboard, `T` Transações, `N` Nova, `U` Upload, `G` Metas, `I` Insights, `C` Chat
- `/` ou `Ctrl+K` → abre `GlobalSearchBar`
- `Esc` desfoca input
- **Ignorados quando digitando em input/textarea/select.**

**Tema claro/escuro (`lib/theme.ts`):**
- Toggle no rodapé da Sidebar + no MoreSheet.
- Persiste em localStorage.
- CSS overrides via `html.light .bg-card { ... }` no `index.css`. Dynamic Tailwind classes NÃO funcionam aqui.

## Banco de dados

Migrations em `backend/src/database/migrations/`:
- `Init` — tabelas `transactions` + `months`
- `Features` — tags, goals, chat_messages
- `FeaturesV2` — is_transfer em tx, tipo em goals (limite/poupanca)
- `FeaturesV3` — accounts, reminders, account_id/installments/split/attachment em tx (+ seed "Conta principal" UUID `00000000-0000-0000-0000-000000000001`)
- `AiMemory` — tabela `ai_memory` single-row

**Pra criar migration:**
```bash
cd backend
npm run migration:create -- src/database/migrations/NomeDaMigration
# edita o arquivo gerado
npm run migration:run
```

**Gotcha SQLite:**
- Sem `gen_random_uuid()` — TypeORM gera UUIDs JS-side via `@PrimaryGeneratedColumn('uuid')`.
- Sem `TIMESTAMPTZ` — use `datetime('now')` default ou `@CreateDateColumn` sem `type`.
- Sem `NUMERIC(12,2)` com precisão real — TypeORM mapeia pra NUMERIC/REAL. Use transformer `from: (v: string) => Number(v)` pra deserializar.
- `UPSERT` funciona (`ON CONFLICT DO UPDATE`). Usamos com `unique(['mes','ano'])` em months.

## OpenRouter API

- Modelos da cadeia definidos em `AiModule` (`src/ai/ai.module.ts`). Prioridade: `openrouter/auto` → `meta-llama/llama-3.3-70b-instruct:free` → `qwen/qwen-2.5-72b-instruct:free` → `google/gemini-2.0-flash-exp:free`.
- Headers obrigatórios: `Authorization: Bearer ${key}`, `Content-Type`, `HTTP-Referer` (env `APP_REFERER`), `X-Title` (env `APP_TITLE`).
- **Quota free:** 20 req/min, 200 req/dia. Respeite com `TokenBucket`.
- Se todos modelos 429 → `AiUnavailableError` (503 pro cliente). Se 401 → `AiAuthError` (500, mensagem explícita pro usuário sobre key inválida).
- **Modelos free ignoram instruções com frequência.** Regras importantes (idioma, no markdown, no nome próprio) são **repetidas 3 vezes**: no `MEMORY_CORE`, stripadas na resposta via `stripMarkdown`, e logadas quando falha JSON pra retry.

## Testes

**Backend:** Jest, 15 testes em 7 suites. Rode `npm test` em `backend/`. Cobrem `CsvParser`, `PdfParser`, `TransactionsService`, `DashboardService`, `OpenRouterClient` (fallback + 401 + 429), `AiService.categorizeBatch`.

Quando adicionar funcionalidade com lógica (não só CRUD), adicione teste seguindo o padrão existente. Mocks via `jest.Mocked<Repository<T>>` + `getRepositoryToken`.

**Frontend:** sem testes automatizados. Valide com `npm run build` (`tsc -b && vite build`) — se passa sem erros TS, considera-se OK.

## Workflow típico pra adicionar feature

1. **Schema (se muda DB):** criar migration, aplicar, atualizar entities.
2. **Backend service:** método no service existente ou novo módulo. Teste unitário se tem lógica não-trivial.
3. **Backend controller:** endpoint REST. DTOs com class-validator.
4. **Registrar módulo** em `app.module.ts` se novo.
5. **Frontend api client:** adiciona função em `src/lib/api.ts`.
6. **Frontend types:** atualiza `src/lib/types.ts`.
7. **Componente/página:** segue estilo existente (rounded-2xl, border-border, bg-card, framer-motion entrance).
8. **Rota** em `src/main.tsx`, **link** em Sidebar + MoreSheet se aplicável.
9. `npm run build` nos dois lados pra confirmar.

## Armadilhas conhecidas

1. **`pdf-parse` v2 mudou API.** Use `new PDFParse({ data })`, não import default. Lazy via `require()` pra evitar ENOENT de eager-load.
2. **Preview tool passa `PORT=5173` via env** — precisa `dotenv.config({ override: true })` no topo do `main.ts`.
3. **Vite pula pra 5174** se 5173 estiver ocupado por backend antigo. Se `preview_start` reusar server, pode navegar pra porta errada. Pare + start fresh.
4. **`erasableSyntaxOnly: true`** quebra parameter properties no constructor — use campo + atribuição explícita.
5. **Bulk update de transações** tem que chamar `recomputeMonth` pra cada mês afetado, senão `months` table fica desatualizada.
6. **Transferências detectadas automaticamente** são excluídas de summary/charts. Se o usuário reclamar que algo sumiu, pode ser isso — oferecer desmarcar "transfer" no edit modal.
7. **`recategorize` em lote chunkado** (50 por vez). Timeout se rodar tudo junto com muitas transações.
8. **Ícones Recharts** não aceitam inline style pra cores dinâmicas — use `fill="#hex"` ou definir `<linearGradient>` em `<defs>`.
9. **`stepAfter` area chart do Recharts** desenha linha horizontal até o próximo X, depois vertical. Usado no Cashflow pra evitar "barras voando" de waterfall tradicional.
10. **`alerts` retorna vazio** se mês anterior não tem dados — evita falso "novo gasto em tudo" quando é primeiro mês.

## Variáveis de ambiente

`backend/.env`:
```
OPENROUTER_API_KEY=sk-or-v1-...
DATABASE_PATH=./data/financeai.db
PORT=3001
APP_REFERER=http://localhost:5173
APP_TITLE=FinanceAi
```

`frontend/.env`:
```
VITE_API_URL=http://localhost:3001
```

## Ao escrever código neste projeto

- **Siga padrões existentes.** Se tem 10 páginas com header `<h2 className="text-3xl font-bold tracking-tight">Título <span className="gradient-text">parte</span></h2>`, a 11ª segue isso.
- **Reutilize componentes.** `CategoryChip`, `MonthSelector`, `Sparkline`, `UndoProvider` — use quando aplicável.
- **Mobile-first.** Teste em 375px. Grids desktop devem empilhar em mobile.
- **Não quebre `npm run build`** no frontend nem no backend. Faça o check antes de considerar feito.
- **Português do Brasil** em todo texto de UI, prompts, erros do usuário.
