# Adaptação para mobile

Regra base: **mobile é cidadão de primeira classe.** Se a feature não funciona bem em 375px de largura com o dedo, ela não está pronta.

## Breakpoints

Tailwind padrão:

- `<md` (até 767px) → mobile. `BottomNav` visível, `Sidebar` oculta.
- `md+` (768px+) → desktop. `Sidebar` visível, `BottomNav` oculta.

Nunca assuma "mobile = fundo diferente". A mesma feature precisa rodar nos dois layouts.

## Checklist por página nova

1. **Navegação acessível em mobile:**
   - Se a página for top-level, adicione no `BottomNav` (slot limitado) **ou** no `MoreSheet`.
   - Sempre adicione também na `Sidebar` para desktop.
2. **Touch targets ≥ 44px.** Botões de ícone pequenos viram inimagináveis no polegar. Use `p-3` mínimo em botões de ação.
3. **Modais viram bottom sheets em mobile** quando possível. Veja `MoreSheet.tsx` como referência (framer-motion + drag pra fechar).
4. **Tabelas longas** (como `TransactionList`) colapsam pra cards empilhados em `<md`. Não tente scroll horizontal — o usuário perde contexto.
5. **Formulários:**
   - `inputMode` correto (`numeric`, `decimal`, `email`).
   - Evite dropdowns gigantes — prefira chips/sheets em mobile.
   - Teclado virtual não pode cobrir o botão de submit: use `sticky bottom-0` ou `scroll-into-view` no focus.
6. **Gráficos Recharts** respeitam `ResponsiveContainer`. Em mobile, reduza ticks do eixo X e considere esconder labels longos.

## PWA

- `manifest.webmanifest`, `icon.svg` e `sw.js` em `frontend/public/`.
- Registro do SW em `main.tsx`.
- Botão "Instalar como app" em `MoreSheet` só aparece depois de `beforeinstallprompt` (`lib/pwa.ts`).
- **Não quebre offline trivialmente.** Se a feature nova depender de rede, trate o erro com mensagem útil — não deixe tela branca.

## Gestos e atalhos

- Atalhos de teclado (`lib/shortcuts.ts`) são bônus desktop. Não dependa deles como única forma de acessar algo.
- Swipe pra fechar sheets já está implementado via framer-motion — reaproveite.

## Validação final

Antes de considerar uma feature pronta:

1. DevTools → toggle device toolbar → iPhone SE (375×667). A feature funciona?
2. Rotação landscape quebra algo?
3. Em tela 1920×1080 continua centralizada e legível (não esticar até o infinito)?

Se não testou em viewport mobile, **não está pronto.**
