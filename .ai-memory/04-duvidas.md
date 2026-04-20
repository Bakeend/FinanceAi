# Em dúvida, pergunte

Regra base: **pergunta boa custa 30 segundos; suposição errada custa refatoração.**

## Quando perguntar antes de codar

Sempre que qualquer uma destas for verdade:

- O pedido é ambíguo e tem **≥2 interpretações plausíveis** que levam a código bem diferente.
- A mudança toca **dinheiro, dedup, transferências ou categorização** — áreas onde um erro silencioso gera prejuízo pro usuário.
- A feature exigiria **romper uma convenção** do `AGENTS.md` (ex.: adicionar autenticação, trocar DB, usar Postgres).
- O usuário pediu algo que **contradiz código/teste existente** — pode ter esquecido que já existia.
- Preciso **apagar, renomear ou migrar dados** existentes no SQLite do usuário.
- Surge um **novo serviço externo, nova dependência pesada ou nova env var obrigatória**.

## Como perguntar

- **Uma pergunta por vez**, curta, com as opções numeradas.
- Ofereça o que você **acharia** a escolha padrão e **por quê** — não jogue a decisão crua.
- Dê contexto mínimo pro usuário responder sem abrir o código.

Formato preferido:

```
Antes de implementar, preciso confirmar:

Quando o usuário importar o mesmo CSV duas vezes, eu:
  (a) ignoro silenciosamente duplicatas (comportamento atual via dedup)
  (b) mostro um resumo "X novas, Y ignoradas"
  (c) pergunto antes de importar

Sugiro (b) — mantém dedup mas dá feedback. OK?
```

## Quando **não** perguntar

- Detalhe estético pequeno (cor de hover, espaçamento) — use os design tokens e siga.
- Decisões já documentadas em `AGENTS.md` ou `.ai-memory/`. Leia primeiro.
- Refatoração interna que não muda comportamento visível.
- Escolha entre duas soluções equivalentes — escolha uma e siga.

## Suposições que você decidiu sozinho

Se fez uma escolha sem perguntar (porque era pequena), **relate no fim**:

> Assumi que transferências entre contas próprias não entram no total de gastos — segue o padrão existente em `is_transfer`. Me avise se quer diferente.

Isso dá ao usuário chance de redirecionar sem perder o progresso.

## Dúvida durante execução

Travou no meio da implementação? **Pare e pergunte.** Não:

- Empurre com `any`, `@ts-ignore`, `as unknown as X`.
- Crie mock fake que "parece funcionar".
- Commite código que você sabe que está errado esperando "arrumar depois".

Melhor entregar 70% funcionando com uma pergunta aberta do que 100% aparentando funcionar mas quebrado por dentro.
