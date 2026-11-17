# Ora da tastierino — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** in `selettoreOra` le due tendine diventano due caselle ore/minuti che si scrivono col tastierino numerico, sempre 24 ore, con passaggio automatico ai minuti.

**Architecture:** la logica delle cifre è una funzione pura in `src/core/inputOra.ts` (testabile in node); `src/ui/campi.ts` la applica all'evento `input` di due `<input inputmode="numeric">`, normalizzando quello che il tastierino ha scritto (robusto anche con tastiere che non mandano `beforeinput`). L'interfaccia di `selettoreOra` non cambia.

**Tech Stack:** TypeScript, Vite, Vitest (ambiente node, niente DOM: il cablaggio si verifica in Chrome headless).

**Spec:** `docs/superpowers/specs/2026-11-17-ora-da-tastierino-design.md`

## Global Constraints

- Ramo `feature/ora-da-tastierino` da `develop`.
- Sempre 24 ore; nessun `<input type="time">`, nessuna dipendenza nuova.
- `selettoreOra(minuti, { maxOre?, aria?, onChange? })` → `{ elemento, leggi(), imposta(v), abilita(si) }` invariato; `aria-label` invariati (`<aria>: ore`, `<aria>: minuti`).
- Novità: voce aggiunta alla 2.16.0 (non rilasciata), nessun cambio di versione.
- Intestazioni SPDX nei file nuovi; commit in italiano con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; non toccare `.gitignore`, `DANONCONDIVIDERE.txt`, `logo.png`, `session.txt`.

## Review Focus

- **Incollare `08:47` o scrivere `0847` di fila nella casella delle ore**: le cifre oltre le ore vanno nei minuti → Task 1, `resto`.
- **Tastiere che compongono il testo (Gboard) o scrivono più caratteri per evento**: si normalizza il valore intero a ogni `input` → Task 1 (`normalizza` su stringhe con caratteri non numerici) e Task 2 (verifica nel browser).
- **Uscire dalla casella con una cifra sola o vuota**: `0d` o valore di prima → Task 1, `chiudi`.
- **`imposta()` chiamato dall'esterno e `abilita(false)`** (ore dovute per giorno nelle impostazioni): caselle aggiornate e disabilitate → Task 2, verifica nel browser.
- **`maxOre` diverso da 23**: il limite delle ore segue `maxOre` → Task 1, test con massimo 12.

---

### Task 1: Logica delle cifre

**Files:**
- Create: `src/core/inputOra.ts`
- Test: `tests/inputOra.test.ts`

**Interfaces:**
- Produces:
  - `export interface Casella { testo: string; completa: boolean; resto: string }`
  - `export function normalizza(scritto: string, massimo: number): Casella` — tiene solo le cifre di `scritto` e le aggiunge una alla volta da vuoto: una cifra che renderebbe il valore > `massimo` è scartata; una prima cifra `d` con `d*10 > massimo` chiude subito come `0d`; due cifre valide chiudono. Le cifre dopo la chiusura finiscono in `resto`.
  - `export function chiudi(testo: string, precedente: number): number` — `''` → `precedente`; altrimenti il numero.

- [ ] **Step 1: Ramo, spec e piano** — `git switch -c feature/ora-da-tastierino develop`; commit di spec e piano (`.md` e `.html`): "Ora da tastierino: progetto e piano".

- [ ] **Step 2: Test che falliscono** (`tests/inputOra.test.ts`):

```ts
describe('normalizza: ore (massimo 23)', () => {
  it.each([
    ['', { testo: '', completa: false, resto: '' }],
    ['1', { testo: '1', completa: false, resto: '' }],
    ['2', { testo: '2', completa: false, resto: '' }],
    ['8', { testo: '08', completa: true, resto: '' }],
    ['23', { testo: '23', completa: true, resto: '' }],
    ['24', { testo: '2', completa: false, resto: '' }],
    ['0847', { testo: '08', completa: true, resto: '47' }],
    ['08:47', { testo: '08', completa: true, resto: '47' }],
    ['847', { testo: '08', completa: true, resto: '47' }],
  ])('%s', (scritto, atteso) => expect(normalizza(scritto, 23)).toEqual(atteso));
});

describe('normalizza: minuti (massimo 59)', () => {
  it.each([
    ['5', { testo: '5', completa: false, resto: '' }],
    ['7', { testo: '07', completa: true, resto: '' }],
    ['59', { testo: '59', completa: true, resto: '' }],
    ['a4', { testo: '4', completa: false, resto: '' }],
  ])('%s', (scritto, atteso) => expect(normalizza(scritto, 59)).toEqual(atteso));
});

it('il limite delle ore segue il massimo', () => {
  expect(normalizza('2', 12)).toEqual({ testo: '02', completa: true, resto: '' });
  expect(normalizza('13', 12)).toEqual({ testo: '1', completa: false, resto: '' });
});

it('chiudi: vuota torna al valore di prima, una cifra vale da sola', () => {
  expect(chiudi('', 8)).toBe(8);
  expect(chiudi('5', 8)).toBe(5);
  expect(chiudi('47', 8)).toBe(47);
});
```

- [ ] **Step 3:** `npx vitest run tests/inputOra.test.ts` → FAIL (modulo assente).
- [ ] **Step 4:** implementare `normalizza` e `chiudi` in `src/core/inputOra.ts` (commento in testa: perché si normalizza tutto il valore a ogni `input`).
- [ ] **Step 5:** `npx vitest run tests/inputOra.test.ts` → PASS.
- [ ] **Step 6: Commit** — "Ora da tastierino: logica delle cifre di ore e minuti".

---

### Task 2: Le caselle in `selettoreOra`

**Files:**
- Modify: `src/ui/campi.ts:12-43` (`selettoreOra`)
- Modify: `src/style.css:1909-1933` (`.selettore-ora`)
- Modify: `src/core/novita.ts` (voce 2.16.0)

**Interfaces:**
- Consumes: `normalizza`, `chiudi` dal Task 1.
- Produces: `selettoreOra` con interfaccia invariata.

- [ ] **Step 1: `selettoreOra`**
  - Due `el('input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '2', autocomplete: 'off', 'aria-label': … })`; stato interno `ore`, `minuti` (numeri) da cui `leggi()`; `imposta(v)` aggiorna stato e testo (`due(n)`); `abilita` imposta `disabled`.
  - `focus` (e `click`): `select()` di tutto il contenuto.
  - `input` sulle ore: `normalizza(valore, maxOre)`; scrive `testo`; se `completa`: aggiorna lo stato, focus ai minuti e, se c'è `resto`, lo applica ai minuti come un loro `input`.
  - `input` sui minuti: `normalizza(valore, 59)`; se `completa`: aggiorna lo stato e `blur()`.
  - `blur` di ciascuna: `chiudi(testo, valore di prima)`, riscrive `due(n)`; `onChange(leggi())` solo se il totale è cambiato rispetto all'ultimo notificato.
  - Facoltativo (spec, "lasciato a chi costruisce"): `Backspace` con minuti vuoti → focus alle ore.
  - Aggiornare il commento della funzione (tastierino invece della ruota; perché non `type="time"`).
- [ ] **Step 2: CSS** — `.selettore-ora input` con lo stesso aspetto dei `select` di oggi (larghezza ~ 2 cifre + padding, `text-align: center`, grassetto ereditato, `min-height` come gli altri campi); `:disabled` con `opacity: 0.4`; rimuovere le regole `select` non più usate.
- [ ] **Step 3: Novità** — nella voce 2.16.0 di `src/core/novita.ts`, aggiungere: "Gli orari si scrivono con il tastierino numerico: tocca le ore o i minuti e digita, il cursore passa da solo ai minuti."
- [ ] **Step 4:** `npx vitest run` → tutta la suite PASS; `npm run typecheck` → nessun errore; `npm run build` → senza errori.
- [ ] **Step 5: Verifica nel browser** — `npx vite preview`, pagina temporanea nello stesso origin con l'app in un iframe da 390 px (`--force-prefers-reduced-motion`), via script: aprire "Aggiungi timbratura", scrivere nelle caselle simulando `input` (`'8'` → minuti a fuoco con `08`; `'47'` → `08:47` e blur; incollare `0847` nelle ore → `08:47`; svuotare e uscire → valore di prima); leggere i valori e fare uno screenshot del foglio. Nelle impostazioni: ore dovute di un giorno con "usa predefinite" attivo → caselle disabilitate. Togliere la pagina temporanea da `dist/`.
- [ ] **Step 6: Commit** — "Orari col tastierino numerico: due caselle ore e minuti al posto delle tendine".
