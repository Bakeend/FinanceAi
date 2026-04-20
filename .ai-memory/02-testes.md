# Testes das atualizações

Regra base: **toda atualização com lógica (não-CRUD puro) vem com teste.** Mudar código sem testar é entregar um bug com atraso.

## O que testar (backend, Jest)

Obrigatório quando tocar em:

- **Parsers** (`CsvParser`, `PdfParser`, futuros OFX/QIF). Cobrir separadores, formatos de data, valores BR/US, linhas inválidas, fallback para IA.
- **Services com regra de negócio.** Dedup, transferências, parcelamento, split, recategorização em lote, agregações do dashboard.
- **Integração com OpenRouter.** Fallback de modelo, 401 (fatal), 429 (próximo modelo), parsing de JSON com retry.
- **Migrations** — rode `npm run migration:run` numa cópia do banco antes de commitar.

Padrão de mock: `jest.Mocked<Repository<T>>` via `getRepositoryToken`. Fixtures em `backend/test/fixtures/`.

## O que não precisa de teste

- Controllers que só delegam pro service (o service já tem teste).
- Entidades TypeORM puras (decorators).
- Tipos/DTOs.

## Frontend

Não temos suíte automatizada. **Valide sempre:**

1. `npm run build` — se `tsc -b && vite build` passa, tipos e bundle estão OK.
2. Abra a feature no browser (desktop + viewport mobile DevTools).
3. Teste o caminho feliz **e** um caso de borda (lista vazia, mês sem dados, erro da API).

Se o build passar mas você não conseguir abrir no browser, **diga isso explicitamente** no relato final. Não afirme "funciona" sem ter visto funcionar.

## Quando um teste quebra

1. Leia o assert. Entenda o que o teste esperava.
2. **Não "conserte" silenciando o teste** (remover assert, `expect(true).toBe(true)`, `skip`). Se o comportamento mudou de propósito, atualize a asserção e explique no commit. Se não mudou, o bug é no código novo.
3. Nunca use `--no-verify` pra passar por cima de hook de teste.

## Cobertura nova

Ao adicionar suite, siga o estilo dos testes existentes: `describe` por classe/service, `it` em PT-BR ou EN curto, arrange/act/assert visuais. Não vale teste que só instancia a classe.
