# Stile della pausa breve — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** la pausa breve ha tre stili (base con anello, sigaretta, birretta con la pinta); tutta l'app ne usa nome ed emoji.

**Architecture:** nuova impostazione `pausaBreve`; un modulo puro `src/core/pausaBreve.ts` con nome ed emoji per stile, letto da ogni testo che oggi dice "sigaretta"; la schermata `src/ui/sigaretta.ts` resta una sola e `creaDisegno` sceglie anello, sigaretta (normale/elettronica) o pinta. Nomi interni e dati salvati invariati.

**Tech Stack:** TypeScript, SVG inline, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-11-18-stile-pausa-breve-design.md`

## Global Constraints

- Ramo `feature/pausa_breve` (già aperto da `develop`).
- Stili e testi esatti: `base` → "Pausa breve", ☕; `sigaretta` → "Pausa sigaretta", 🚬; `birretta` → "Pausa birretta", 🍺.
- Predefinito per installazioni nuove: `base`; dati salvati senza il campo: `sigaretta`.
- Invariati: `Evento.sigaretta`, `tolleranzaSigaretta`, `sigaretteNonConteggiate`, `tipoSigaretta`, chiavi di localStorage, id degli avvisi (`-sigaretta`), CSV "(sigaretta)", note delle versioni passate in `novita.ts`.
- Versione 2.17.0 con voce nelle novità.
- Commit in italiano con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; non toccare `.gitignore`, `DANONCONDIVIDERE.txt`, `logo.png`, `session.txt`.

## Review Focus

- **Utente esistente che aggiorna l'app**: deve restare su Sigaretta, con tutti i testi come prima → Task 1, test di `normalizzaImpostazioni` con dati senza il campo.
- **Backup JSON importato da una versione vecchia**: stessa regola (passa da `normalizzaImpostazioni`) → Task 1, stesso test.
- **Notifica di rientro mostrata dal service worker** quando la pagina non ha lasciato il testo: testo neutro "Pausa breve" → Task 2, test su `TESTI_GENERICI`.
- **Stile cambiato con una pausa in corso**: impossibile dalla schermata (è a tutto schermo); lo storico e i testi successivi usano lo stile nuovo, accettato.
- **Ripristina impostazioni predefinite**: lo stile non cambia → Task 3.

---

### Task 1: Impostazione e testi dello stile

**Files:**
- Modify: `src/core/tipi.ts` (tipo, campo, predefinito)
- Modify: `src/storage/migrazioni.ts` (`normalizzaImpostazioni`)
- Create: `src/core/pausaBreve.ts`
- Test: `tests/pausaBreve.test.ts`, `tests/migrazioni.test.ts`

**Interfaces:**
- Produces:
  - `export type StilePausaBreve = 'base' | 'sigaretta' | 'birretta'` in `tipi.ts`; `Impostazioni.pausaBreve: StilePausaBreve`; `IMPOSTAZIONI_PREDEFINITE.pausaBreve = 'base'`.
  - `pausaBreve.ts`: `STILI_PAUSA_BREVE: readonly StilePausaBreve[]` (ordine base, sigaretta, birretta); `nomePausa(stile): string` ("Pausa breve"…); `emojiPausa(stile): string`; `etichettaPausa(stile): string` = `${emoji} ${nome}`; `nomePausaMinuscolo(stile): string` ("pausa breve"…).

- [ ] **Step 1: Test che falliscono**
  - `tests/pausaBreve.test.ts`: per ogni stile `nomePausa`, `emojiPausa`, `etichettaPausa`, `nomePausaMinuscolo` uguali ai valori dei Global Constraints; `STILI_PAUSA_BREVE` uguale a `['base', 'sigaretta', 'birretta']`.
  - `tests/migrazioni.test.ts`: `normalizzaImpostazioni({})` → `pausaBreve === 'sigaretta'` (dati salvati senza il campo); `normalizzaImpostazioni({ pausaBreve: 'birretta' })` → `'birretta'`; valore non valido (`'caffè'`) → `'sigaretta'`; `datiVuoti().impostazioni.pausaBreve === 'base'`; `normalizzaImpostazioni(null).pausaBreve === 'base'`.
- [ ] **Step 2:** `npx vitest run tests/pausaBreve.test.ts tests/migrazioni.test.ts` → FAIL.
- [ ] **Step 3:** implementare (commento in `migrazioni.ts`: perché qui il campo mancante non prende il predefinito).
- [ ] **Step 4:** stessi test → PASS; `npm run typecheck` → errori solo dove `Impostazioni` è costruita a mano nei test (sistemare `tests/helpers.ts` se serve).
- [ ] **Step 5: Commit** — "Pausa breve: impostazione dello stile (base, sigaretta, birretta) e i suoi testi".

---

### Task 2: Tutta l'app parla dello stile scelto

**Files:**
- Modify: `src/core/statoGiornata.ts` (etichetta di `PAUSA_SIGARETTA`), `src/ui/giorno.ts:178,306,346,352`, `src/ui/editor.ts:35,137,149-150`, `src/ui/tagNfc.ts:76`, `src/ui/sigaretta.ts` (titolo, aria-label, avviso "non chiusa", conferma e toast di annullamento, toast di rientro), `src/core/avvisi.ts:110`, `src/core/avvisiPush.ts:151`, `src/core/segnalazione.ts:50`, `src/ui/aiutoTesti.ts` (righe con "sigaretta" / 🚬, compreso l'id-voce che resta `pausa-sigaretta`), `src/ui/ricercaImpostazioni.ts:68-76` (nomi neutri + sinonimi con breve/sigaretta/birra), `src/ui/impostazioni.ts:131-133` (etichette degli avvisi)
- Test: `tests/aiuto.test.ts`, `tests/avvisi.test.ts`, `tests/avvisiPush.test.ts`, `tests/segnalazione.test.ts`, `tests/statoGiornata.test.ts` (o dove sono testate le etichette)

**Interfaces:**
- Consumes: funzioni del Task 1, `store.impostazioni.pausaBreve` / `imp.pausaBreve`.
- Produces: `etichettaAzione(azione: Azione, stile: StilePausaBreve): string` in `statoGiornata.ts` (per `PAUSA_SIGARETTA` = `etichettaPausa(stile)`, per le altre `ETICHETTE_AZIONE[azione]`); `ETICHETTE_AZIONE.PAUSA_SIGARETTA` diventa "Pausa breve" (valore neutro di riserva).

- [ ] **Step 1: Test che falliscono**
  - `etichettaAzione('PAUSA_SIGARETTA', 'birretta') === '🍺 Pausa birretta'`, `etichettaAzione('ENTRATA', 'birretta') === ETICHETTE_AZIONE.ENTRATA`.
  - Avvisi (`src/core/avvisi.ts`): con `pausaBreve: 'birretta'` il titolo dell'avviso di rientro contiene "Pausa birretta" e non "sigaretta"; con `'sigaretta'` resta "Pausa sigaretta quasi finita" / "finita".
  - `TESTI_GENERICI.sigaretta.titolo === 'Pausa breve'`.
  - Segnalazione: la riga delle impostazioni contiene lo stile (es. "Pausa breve: stile birretta, tolleranza 11 min").
  - Aiuto: con `pausaBreve: 'base'` nessun testo di `vociAiuto(imp)` contiene "sigaretta" né 🚬 (salvo la voce che spiega gli stili, se la si aggiunge); con `'sigaretta'` la voce `pausa-sigaretta` ha domanda "Pausa sigaretta" come oggi.
- [ ] **Step 2:** i test → FAIL.
- [ ] **Step 3:** sostituire ogni testo della lista Files con nome/emoji dello stile (`store.impostazioni.pausaBreve` nella UI, `imp.pausaBreve` nel core). Nell'aiuto la descrizione del disegno segue lo stile (anello / sigaretta normale o elettronica / pinta) e la frase sulle impostazioni dice "Impostazioni → Pause → Pausa breve".
- [ ] **Step 4:** `npx vitest run` → PASS; `npm run typecheck`.
- [ ] **Step 5: Controllo** — `grep -rn "igarett\|🚬" src --include=*.ts` ripassato a mano: restano solo nomi interni, CSV, id, `novita.ts` storica, il disegno della sigaretta e i testi dello stile sigaretta.
- [ ] **Step 6: Commit** — "Pausa breve: nome ed emoji dello stile scelto in tutta l'app".

---

### Task 3: Impostazioni

**Files:**
- Modify: `src/ui/impostazioni.ts:273-300` (selettori), `:405-415` (scheda), `:445-455` (ripristina)
- Modify: `src/ui/ricercaImpostazioni.ts` (voce `stile-pausa`)

**Interfaces:**
- Consumes: `STILI_PAUSA_BREVE`, `nomePausa`.

- [ ] **Step 1:** scheda "Pausa breve": riga "Stile" con chip Base / Sigaretta / Birretta (stesso componente `preset`/`chip` di oggi, id riga `stile-pausa`); riga "Tipo" (Normale / Elettronica) solo con stile sigaretta; "Tolleranza (min)" con aria-label neutra; link d'aiuto "Come funziona la pausa breve?".
- [ ] **Step 2:** "Ripristina": conserva `pausaBreve` (si rimette dopo `Object.assign`); il testo di conferma dice "tolleranza della pausa breve 11 min" invece di "tolleranza sigaretta… sigaretta normale".
- [ ] **Step 3:** ricerca: voce `{ id: 'stile-pausa', nome: 'Stile della pausa breve', pagina: 'pause', sinonimi: 'sigaretta birra birretta caffè anello disegno fumo' }`; `tipo-sigaretta` resta (si trova solo con lo stile sigaretta: la riga è nascosta altrimenti, il risultato della ricerca deve portare alla pagina comunque).
- [ ] **Step 4:** `npx vitest run` (anche `tests/ricercaImpostazioni.test.ts`) → PASS; typecheck.
- [ ] **Step 5: Verifica visiva** — app in Chrome headless a 390 px (pagina temporanea nello stesso origin con l'app in iframe, `--force-prefers-reduced-motion`): Impostazioni → Pause con stile base (niente "Tipo") e sigaretta (con "Tipo").
- [ ] **Step 6: Commit** — "Pausa breve: scelta dello stile nelle impostazioni".

---

### Task 4: Anello e pinta

**Files:**
- Modify: `src/ui/sigarettaDisegni.ts` (`creaDisegno`, nuovi SVG)
- Modify: `src/ui/sigaretta.ts:70-104` (stile letto all'apertura, classi del dialog)
- Modify: `src/style.css` (sezione `.sigaretta`)
- Test: `tests/sigarettaDisegni.test.ts`

**Interfaces:**
- Consumes: `Impostazioni.pausaBreve`, `tipoSigaretta`.
- Produces:
  - `creaDisegno(stile: StilePausaBreve, tipo: TipoSigaretta, inizio: number): Disegno` (stessa `Disegno` di oggi).
  - `arcoAnello(consumata: number): number` — `stroke-dashoffset` dell'anello: circonferenza `2π·88` (≈ 552.9) a 0, 0 a 1, limitato 0–1.
  - `misureBirretta(consumata: number): { yBirra: number; altezzaBirra: number }` — livello della birra nel bicchiere, pieno a 0, fondo vuoto a 1, limitato 0–1.

- [ ] **Step 1: Test che falliscono** (`tests/sigarettaDisegni.test.ts`): `arcoAnello(0)` ≈ 552.9, `arcoAnello(1) === 0`, `arcoAnello(2) === 0`, `arcoAnello(-1)` ≈ 552.9; `misureBirretta(0).altezzaBirra` > 0 e massima, `misureBirretta(1).altezzaBirra === 0`, `misureBirretta(0.5)` a metà (± 1); `yBirra + altezzaBirra` costante (il fondo del bicchiere non si muove).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Disegni**
  - **Anello (base)**: SVG 200×200 come nella bozza scelta: cerchio di fondo `#3a3a3c` e arco `stroke-width 10`, `stroke-linecap round`, ruotato di -90°, colore `#2dd4bf`; con `.ultimi` `#fbbf24`, con `.scaduta` `#f87171`. Per lo stile base il timer va **al centro dell'anello** in numeri sottili (font-weight 300) con sotto "entro le HH:MM": `sigaretta.ts` mette `timer` dentro la scena quando lo stile è base (classe del dialog `pausa-base`).
  - **Birretta**: pinta (vetro chiaro con riflesso), birra ambrata con bollicine e cappello di schiuma che scende col livello; a 1 bicchiere vuoto con i segni della schiuma sul vetro. Classe del dialog `birretta`.
  - Sigaretta normale/elettronica invariate.
- [ ] **Step 4:** test → PASS; `npx vitest run`; typecheck; build.
- [ ] **Step 5: Verifica visiva** — pagina temporanea (dev server) che apre i tre disegni a `consumata` 0, 0.5, 1 e la schermata con classi `ultimi`/`scaduta`; screenshot 390 px. Togliere la pagina.
- [ ] **Step 6: Commit** — "Pausa breve: anello per lo stile base e pinta per la birretta".

---

### Task 5: Versione 2.17.0

**Files:** `package.json`, `package-lock.json` (due occorrenze in testa), `src/core/novita.ts`

- [ ] **Step 1:** versione 2.17.0 → `npx vitest run tests/novita.test.ts` FAIL.
- [ ] **Step 2:** voce in cima: data del giorno, testo: "La pausa breve ora ha uno stile a scelta: base con l'anello, sigaretta o birretta con la pinta che cala. Lo scegli in Impostazioni → Pause → Pausa breve, e tutta l'app usa il nome che hai scelto." → PASS.
- [ ] **Step 3: Commit** — "Versione 2.17.0: novità (stile della pausa breve)".
