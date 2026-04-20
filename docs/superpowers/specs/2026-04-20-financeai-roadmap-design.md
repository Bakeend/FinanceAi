# FinanceAi — Roadmap de Melhorias

**Data:** 2026-04-20  
**Contexto:** Uso pessoal. App já possui transações, orçamentos, metas, chat AI, múltiplas contas, trips, insights, PWA.  
**Abordagem:** Roadmap faseado — Fase 1 corrige dores imediatas, Fase 2 adiciona features, Fase 3 aumenta robustez.

---

## Fase 1 — Correções e melhorias no existente

### 1.1 Sistema de sinal universal (+ / -)

**Problema:** O sistema armazena despesas como valores negativos (ex: `-300`), mas os campos de input não aceitam negativos — o que impede split e cria atrito na edição manual e no preenchimento pela IA.

**Solução:** Adotar um toggle de sinal em todos os campos de valor do app. O campo sempre exibe o valor absoluto; o sinal é controlado por um botão `[ + ] [ - ]` ao lado.

**Regras:**
- O campo de valor aceita apenas números positivos
- O botão toggle define o sinal: `+` = receita, `-` = despesa
- Internamente o sistema continua armazenando negativos para despesas
- Ao carregar uma transação existente com `-300`, o campo exibe `300` e o toggle fica em `[ - ]`
- A IA, ao preencher automaticamente, nunca escreve o sinal no campo — apenas define o estado do toggle
- Padrão ao criar nova transação: toggle em `[ - ]` (despesa é o caso mais comum)

**Onde se aplica:**
- Criação de transação (`/adicionar`, `/new-transaction`)
- Edição de transação (modal de edição)
- Split de transação (cada parcela tem seu próprio toggle)
- Qualquer campo de valor preenchido pela IA

### 1.2 Split com suporte a negativo

**Problema:** O split de transações não funciona quando o valor original é negativo, pois os campos de parcela não aceitam sinal.

**Solução:** Com o sistema de sinal do item 1.1, o split fica desbloqueado naturalmente. Ajustes adicionais:
- Cada parcela exibe campo de valor absoluto + toggle de sinal
- Validação: soma das parcelas (com sinais) deve fechar o valor original
- Mensagem de erro clara caso a soma não bata: "Soma das parcelas: -250. Faltam -50."
- O toggle de cada parcela começa com o mesmo sinal do valor original

### 1.3 Dashboard com insights automáticos

**Problema:** O dashboard exibe KPIs e gráficos, mas não interpreta os dados — o usuário precisa perceber sozinho o que está acontecendo.

**Solução:** Adicionar uma seção "O que está acontecendo" no topo do dashboard, com até 3 frases geradas automaticamente a partir dos dados locais (sem chamar a IA para isso):

Lógica de geração:
- Variação de gasto por categoria >20% vs. mês anterior → "Você gastou X% mais em [categoria] este mês"
- Orçamento com >80% consumido antes do dia 20 → "[Categoria] está com X% do orçamento usado"
- Meta com projeção de atraso → "Sua meta [nome] pode não ser atingida no prazo atual"

Os insights são calculados no frontend com os dados já disponíveis — sem nova rota no backend.

---

## Fase 2 — Novas features

### 2.1 Previsão financeira (Forecasting)

**O que faz:** Projeta saldo e gastos dos próximos 3-6 meses com base em histórico e transações recorrentes já cadastradas.

**Componentes:**
- Algoritmo de projeção: usa média dos últimos 3 meses por categoria + transações recorrentes confirmadas
- Exibido numa nova aba "Previsão" dentro da página Planejamento (sem criar nova rota)
- Gráfico de linha: saldo previsto mês a mês
- Lista de alertas: metas em risco, categorias acima da média histórica

**Limitações aceitas:** Não usa ML — é média simples + recorrências. Suficiente para uso pessoal.

### 2.2 Multi-moeda

**O que faz:** Permite registrar transações em moedas diferentes de BRL, com conversão automática.

**Componentes:**
- Campo de moeda no formulário de transação (BRL padrão)
- Conversão via AwesomeAPI (`economia.awesomeapi.com.br`) — gratuita, sem chave
- Taxa de câmbio buscada uma vez por dia e cacheada no backend (tabela `ExchangeRate`)
- Relatórios exibem valor em BRL com nota "(USD 50,00 @ 5,20)"
- Contas podem ter moeda padrão configurada

**Limitações aceitas:** Taxa histórica simplificada — usa a taxa do dia da transação se disponível, caso contrário a mais recente.

### 2.3 Scan de recibo por foto

**O que faz:** Permite fotografar um cupom fiscal e extrair os dados automaticamente.

**Fluxo:**
1. Botão "Escanear recibo" na tela de adicionar transação
2. Abre seletor de arquivo (câmera no mobile via `accept="image/*;capture=camera"`)
3. Imagem enviada para o backend, que chama OpenRouter com prompt de extração
4. IA retorna JSON: `{ estabelecimento, valor, data, itens[] }`
5. Frontend preenche o formulário — usuário revisa e confirma
6. **Nunca salva automaticamente sem confirmação explícita**

**Prompt de extração:** Estruturado para retornar JSON válido, com fallback se algum campo não for legível.

### 2.4 Offline mais robusto

**O que faz:** Transações criadas sem internet são enfileiradas e sincronizadas automaticamente quando a conexão volta.

**Componentes:**
- Fila de sync armazenada em IndexedDB (chave: `pendingTransactions`)
- Service worker já existente recebe lógica de background sync
- Quando online: tenta processar a fila em ordem FIFO
- Badge no ícone do app / header: "3 transações pendentes"
- Conflito de ID: transações offline usam UUID temporário prefixado `tmp_`, substituído pelo ID do backend após sync

---

## Fase 3 — Qualidade técnica

### 3.1 Autenticação real

**Escopo:** Login com email + senha. Sem cadastro público — usuário criado via seed script.

**Componentes:**
- Backend: endpoint `POST /auth/login` retornando JWT; middleware de guard nas rotas existentes
- JWT armazenado em cookie `httpOnly` (não localStorage — evita XSS)
- Frontend: tela de login simples; redirect automático se não autenticado
- Script `npm run seed:user` para criar o usuário inicial

**O que não muda:** Sem registro público, sem OAuth, sem "esqueci a senha" — uso pessoal não precisa.

### 3.2 Testes de integração no backend

**Escopo:** Rotas críticas cobertas por testes de integração usando SQLite in-memory.

**Rotas prioritárias:**
1. `POST /transactions` — criação com e sem split
2. `PATCH /transactions/:id` — edição, incluindo valor negativo
3. `POST /transactions/:id/split` — split com soma correta
4. `POST /ai/categorize` — categorização retorna categoria válida
5. `GET /budgets` — totais corretos por mês

**Meta:** 60-70% de cobertura nas rotas acima. Não buscar 100%.

### 3.3 Declaração de IR simplificada

**O que faz:** Gera um resumo anual de rendimentos e despesas dedutíveis para facilitar o preenchimento do IR.

**Fluxo:**
- Nova seção "Resumo para IR" em Relatórios, filtrável por ano
- Categorias mapeadas para grupos fiscais (configurado uma vez pelo usuário):
  - Rendimentos, Despesas médicas, Educação, Outros
- Exibe totais por grupo fiscal
- Botão "Exportar PDF" usando jsPDF (já integrado no projeto)

**Mapeamento:** Usuário associa suas categorias aos grupos fiscais uma única vez numa tela de configuração simples. O sistema lembra.

---

## Resumo do Roadmap

| Fase | Items | Critério para avançar |
|------|-------|----------------------|
| **1** | Toggle de sinal, Split corrigido, Insights no dashboard | Uso diário sem atrito |
| **2** | Forecasting, Multi-moeda, OCR recibo, Offline robusto | Fase 1 estável há 1-2 semanas |
| **3** | Auth, Testes, IR | Quando quiser robustez ou deploy público |

## Decisões técnicas

- **Toggle de sinal:** componente reutilizável `<AmountInput>` que substitui todos os `<input type="number">` de valor monetário
- **Forecasting:** cálculo no frontend, sem nova rota — dados já disponíveis via APIs existentes
- **Multi-moeda:** nova tabela `exchange_rates` no SQLite; entidade `currency` em `Transaction`
- **OCR:** reutiliza cliente OpenRouter já configurado; novo endpoint `POST /ai/extract-receipt`
- **Auth:** módulo NestJS já existe — completar guard + estratégia JWT + tela de login
- **Testes:** Jest + Supertest (padrão NestJS); SQLite in-memory via TypeORM `synchronize: true`
