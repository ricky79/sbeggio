# Nuovi cibi della pausa pranzo — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spaghetti, gelato (una cucchiata alla volta), insalata e sushi nella schermata della pausa pranzo, accanto ai quattro cibi esistenti.

**Architecture:** come i cibi attuali in `src/ui/pranzoDisegni.ts`: SVG statico per cibo, `creaDisegnoPranzo` restituisce `aggiorna(mangiato)` che applica funzioni pure esportate e testate; `.cibo-porzione` / `.cibo-resti` gestiti dal CSS con `.pranzo.finito`.

**Tech Stack:** TypeScript, SVG inline, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-11-18-nuovi-cibi-pranzo-design.md`

## Global Constraints

- Ramo `feature/nuovi-cibi-pranzo` da `develop`.
- viewBox 300 × 180, cibo attorno a `CX = 118`, avvolto da `svg()`; id di `mask`/`clipPath` unici per cibo (prefisso col nome del cibo).
- `CIBI` diventa `['ramen', 'pizza', 'panino', 'mela', 'spaghetti', 'gelato', 'insalata', 'sushi']`.
- Novità: voce nella 2.16.0, nessun cambio di versione. Nessuna dipendenza nuova.
- Commit in italiano con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; non toccare `.gitignore`, `DANONCONDIVIDERE.txt`, `logo.png`, `session.txt`.

## Review Focus

- **`mangiato` fuori da 0–1** (orologio indietro, pausa oltre la minima): ogni funzione limita con `tra0e1` → Task 1, test con -1 e 2.
- **Gelato all'ultima cucchiata di una pallina**: la pallina sparisce, nessun arco "fantasma" sulla successiva → Task 1 (`statoGelato`) e Task 2 (screenshot a metà).
- **id SVG duplicati** se due disegni finissero nello stesso documento (riepilogo/riapertura): prefissi unici → Task 2, controllo con grep.
- **A fine pausa** restano solo i resti: forchetta, bacchette, cucchiaino e porzione nascosti → Task 2, screenshot a 1 con `.finito`.
- **Pausa in corso durante l'aggiornamento** può cambiare piatto: accettato dalla spec, nessun test.

---

### Task 1: Come si consumano i cibi nuovi

**Files:**
- Modify: `src/ui/pranzoDisegni.ts` (funzioni esportate, accanto a `livelloRamen`)
- Test: `tests/pranzo.test.ts` (`describe('disegni')`)

**Interfaces:**
- Produces:
  - `scalaSpaghetti(mangiato: number): number` — 1 a 0, 0.35 a 1, lineare.
  - `CUCCHIATE_PER_PALLINA = 4`, `PALLINE_GELATO = 3`; `statoGelato(mangiato: number): { palline: number; cucchiate: number }` — cucchiate prese in tutto `floor(12 · m)`; `palline` = palline ancora nella coppetta (`3 − floor(prese / 4)`), `cucchiate` = archi tolti alla pallina in cima (`prese % 4`).
  - `INGREDIENTI_INSALATA = { mais: 0.25, carote: 0.5, pomodorini: 0.75, foglie: 1 } as const`; `ingredientiInsalata(mangiato): (keyof typeof INGREDIENTI_INSALATA)[]` — quelli con `mangiato < soglia`.
  - `PEZZI_SUSHI = 6`; `pezziSushi(mangiato: number): number` — `ceil(6 · (1 − m))`.

- [ ] **Step 1: Ramo, spec e piano** — `git switch -c feature/nuovi-cibi-pranzo develop`; commit di spec e piano (`.md` e `.html`).
- [ ] **Step 2: Test che falliscono**

```ts
it('spaghetti: il nido si rimpicciolisce', () => {
  expect(scalaSpaghetti(0)).toBe(1);
  expect(scalaSpaghetti(1)).toBe(0.35);
  expect(scalaSpaghetti(-1)).toBe(1);
  expect(scalaSpaghetti(2)).toBe(0.35);
});

it('gelato: una cucchiata alla volta, dalla pallina in cima', () => {
  expect(statoGelato(0)).toEqual({ palline: 3, cucchiate: 0 });
  expect(statoGelato(1 / 12)).toEqual({ palline: 3, cucchiate: 1 });
  expect(statoGelato(3 / 12)).toEqual({ palline: 3, cucchiate: 3 });
  expect(statoGelato(4 / 12)).toEqual({ palline: 2, cucchiate: 0 }); // all'ultima cucchiata la pallina sparisce
  expect(statoGelato(0.5)).toEqual({ palline: 2, cucchiate: 2 });
  expect(statoGelato(1)).toEqual({ palline: 0, cucchiate: 0 });
  expect(statoGelato(2)).toEqual({ palline: 0, cucchiate: 0 });
});

it('insalata: gli ingredienti spariscono uno alla volta, le foglie per ultime', () => {
  expect(ingredientiInsalata(0)).toEqual(['mais', 'carote', 'pomodorini', 'foglie']);
  expect(ingredientiInsalata(0.5)).toEqual(['pomodorini', 'foglie']);
  expect(ingredientiInsalata(0.9)).toEqual(['foglie']);
  expect(ingredientiInsalata(1)).toEqual([]);
});

it('sushi: sei pezzi che spariscono uno alla volta', () => {
  expect(pezziSushi(0)).toBe(6);
  expect(pezziSushi(0.5)).toBe(3);
  expect(pezziSushi(1)).toBe(0);
  expect(pezziSushi(-1)).toBe(6);
});
```

- [ ] **Step 3:** `npx vitest run tests/pranzo.test.ts` → FAIL (funzioni assenti).
- [ ] **Step 4:** implementare le funzioni con `tra0e1`, ognuna con un commento di una riga come quelle esistenti.
- [ ] **Step 5:** `npx vitest run tests/pranzo.test.ts` → PASS.
- [ ] **Step 6: Commit** — "Pausa pranzo: come si consumano spaghetti, gelato, insalata e sushi".

---

### Task 2: I disegni

**Files:**
- Modify: `src/ui/pranzoDisegni.ts` (costanti `SPAGHETTI`, `GELATO`, `INSALATA`, `SUSHI`, record `SVG`, rami in `creaDisegnoPranzo`)
- Modify: `src/core/pranzo.ts:13` (`CIBI`)
- Modify: `src/style.css` (dopo `@keyframes bacchette`)
- Modify: `src/core/novita.ts` (voce 2.16.0)

**Interfaces:**
- Consumes: funzioni del Task 1.

- [ ] **Step 1: Disegni** (stile dei cibi esistenti, colori pieni, nessun testo):
  - **SPAGHETTI**: `PIATTO`; `.cibo-resti` = macchia di sugo e due spaghetti; `.cibo-porzione.spaghetti-nido` = nido di spaghetti (tratti curvi gialli) con sugo rosso e basilico, centrato su (118, 100); `.forchetta` sopra, animata con `forchetta` (rotazione leggera come `bacchette`). `aggiorna`: `transform` di scala `scalaSpaghetti(m)` attorno al centro del nido.
  - **GELATO**: coppetta (vetro o cialda) con cucchiaino `.cucchiaino`; tre palline (`.gelato-pallina`, dal basso: cioccolato, pistacchio, fragola in cima), ognuna con una `mask` propria (`gelato-mask-0..2`) che contiene 3 cerchi neri `.gelato-cucchiata` sul bordo della pallina (posizioni fisse distribuite attorno al cerchio, il centro del cerchio nero fuori dal bordo così che tolga un arco). `.cibo-resti` = gelato sciolto sul fondo. `aggiorna`: le palline oltre `palline` nascoste (si toglie dall'alto); sulla pallina in cima visibili i primi `cucchiate` cerchi neri, nascosti gli altri; sulle palline sotto nessun arco.
  - **INSALATA**: ciotola; `.insalata-foglie`, `.insalata-pomodorini`, `.insalata-carote`, `.insalata-mais`; `.cibo-resti` = gocce d'olio e una foglia. `aggiorna`: `visibility` secondo `ingredientiInsalata(m)`.
  - **SUSHI**: tagliere scuro; sei pezzi `.sushi-pezzo` da sinistra (maki e nigiri al salmone alternati); ciotolina di soia e wasabi fuori dalla porzione; `.bacchette` appoggiate. `.cibo-resti` = qualche chicco di riso. `aggiorna`: visibili gli ultimi `pezziSushi(m)` pezzi (spariscono da sinistra).
- [ ] **Step 2:** `CIBI` a otto; record `SVG` completo (il tipo `Record<Cibo, string>` lo impone).
- [ ] **Step 3: CSS** — `.pranzo.finito` nasconde anche `.forchetta`, `.cucchiaino`, `.gelato-pallina`; `@keyframes forchetta`; nessuna animazione nuova oltre la forchetta.
- [ ] **Step 4: Novità** — nella 2.16.0: "Nella pausa pranzo arrivano spaghetti, gelato (una cucchiata alla volta), insalata e sushi."
- [ ] **Step 5:** `npx vitest run` → PASS (anche "a turno tutti i cibi"); `npm run typecheck`; `npm run build`; `grep -o 'id="[a-z-]*[0-9]*"' src/ui/pranzoDisegni.ts | sort | uniq -d` → nessun duplicato.
- [ ] **Step 6: Verifica visiva** — `npm run dev`, pagina temporanea `prova-cibi.html` alla radice che importa `/src/style.css` e `creaDisegnoPranzo` e mostra gli otto cibi a `mangiato` 0, 0.5 e 1 (con un contenitore `.pranzo.finito` per l'1), sfondo scuro come la schermata; screenshot a 390 px (finestra minima 500: contenuti larghi 390). Controllare in particolare il gelato a 1/12, 5/12, 0.5. Cancellare la pagina temporanea.
- [ ] **Step 7: Commit** — "Pausa pranzo: spaghetti, gelato, insalata e sushi".
