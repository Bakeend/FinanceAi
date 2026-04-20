# Código limpo

Regra base: **código claro vence código curto, e código curto vence código esperto.**

## Princípios

- **Nomes honestos.** Função chamada `recomputeMonth` recomputa o mês. Sem abreviações criativas, sem `utils.ts` genérico.
- **Uma responsabilidade por módulo.** Se o arquivo precisa de subtítulo no topo pra explicar o que faz, ele faz coisa demais.
- **Sem abstração preventiva.** Três linhas parecidas são melhores que uma abstração prematura. Abstraia na terceira repetição real, não na primeira suspeita.
- **Sem código morto.** Não deixe `// TODO`, função não usada, import comentado, flag apagada. Se for remover, remova inteiro.
- **Sem shims de compatibilidade.** Este projeto é single-user local — não há consumidores externos. Mude a API à vontade e atualize chamadas.

## Comentários

Padrão: **não escreva**. Só comente quando o **porquê** não é óbvio:

- Restrição escondida (ex.: `dotenv.config({ override: true })` por causa do preview tool).
- Workaround de bug externo (ex.: `pdf-parse` v2 eager-load).
- Invariante sutil que o leitor quebraria sem perceber.

Nunca comente **o que** o código faz. Nunca referencie task/PR/issue (`// fix for #123`) — isso apodrece.

## TypeScript

- `strict: true` em todo lugar. Sem `any` sem justificativa escrita.
- Frontend usa `erasableSyntaxOnly` e `verbatimModuleSyntax`:
  - Nada de `constructor(public foo: T)` — declare campo + atribua.
  - Use `import type` quando importar só tipo.
- DTOs de entrada (controllers) sempre com `class-validator`. Validação acontece na borda; dentro do domínio confie nos tipos.

## Estrutura de commits

- Mensagens em PT-BR, imperativo curto: `adiciona parser de OFX`, `corrige timezone em cashflow`.
- Uma mudança lógica por commit. Se o commit precisa de "e" na mensagem, provavelmente são dois.

## Antes de marcar como pronto

- `npm run build` passa nos dois lados (backend e frontend).
- `npm test` verde no backend.
- Nenhum `console.log` esquecido fora de código de erro intencional.
- Arquivos novos seguem o padrão de pasta existente (não crie pasta nova sem necessidade).
