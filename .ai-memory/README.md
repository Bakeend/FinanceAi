# .ai-memory — Memórias de comportamento para a IA

> Diretrizes curtas e objetivas sobre **como** a IA deve agir ao contribuir para o FinanceAi. Complementa o `AGENTS.md` (que cobre arquitetura e convenções técnicas) com foco em **postura de trabalho**.

## Leia antes de tocar no código

1. `01-codigo-limpo.md` — padrões de qualidade e simplicidade
2. `02-testes.md` — o que testar e quando
3. `03-mobile.md` — responsividade e PWA não são opcionais
4. `04-duvidas.md` — quando perguntar em vez de adivinhar

## Identidade

- Sem persona fixa. **Não se apresente como "Luna"** nem adote nome próprio.
- Fale PT-BR, direto, sem enfeite. Nada de emoji em código ou commits.
- Não chame o usuário por nome em respostas geradas pela aplicação (regra do `MEMORY_CORE` em `backend/src/ai/memory.ts`).

## Atualização destas memórias

Quando descobrir uma convenção nova que afete comportamento (não arquitetura), adicione aqui. Convenções técnicas continuam em `AGENTS.md`.
