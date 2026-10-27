# Tema di Natale e suoni — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tema di Natale (8 dicembre – 6 gennaio) sul modello di Halloween, più suoni ad app aperta (timbratura, fine pausa, primo passaggio di slitta/strega), a tema nelle feste, con un interruttore spento all'inizio; uscita unica 2.15.0.

**Architecture:** la logica pura va in `src/core/` (date e chiave della festa, scelta del file di suono, "solo al primo passaggio", avvisi da tacere) con test vitest; la parte DOM in `src/ui/` (tema, disegni, lettore audio, agganci nelle schermate); un metodo nativo nel plugin `Nfc` per la modalità suoneria. I suoni sono MP3 in `public/suoni/`, nel precache della PWA.

**Tech Stack:** TypeScript, Vite + vite-plugin-pwa (injectManifest), Capacitor 8 (Android, Java), vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-tema-natale-e-suoni-design.md`

## Global Constraints

- Ogni file nuovo inizia con l'intestazione SPDX `GPL-3.0-or-later` / `Copyright (C) 2026 Riccardo Oliosi`, come gli altri (CSS con `/* */`, Java con `//`).
- Codice, nomi e commenti in italiano, nello stile dei file vicini; testi per l'utente semplici, senza dettagli tecnici.
- Nessuna dipendenza npm nuova.
- Registrazioni solo **CC0**, annotate in `THIRD_PARTY_LICENSES.md` (titolo, autore, link, licenza).
- Suoni: timbratura ≤ 1 s; fine pausa e passaggio fino a ~3 s; mono, silenzio iniziale tolto, volumi uniformi; **in tutto sotto ~400 KB**; MP3.
- Natale: dall'8 dicembre al 6 gennaio compresi, data di Roma (`adessoRoma().data`).
- Preferenze del dispositivo in `localStorage` (non nel backup, non toccate da "Ripristina"), con `try/catch` come in `src/ui/tema.ts`.
- Un suono che non parte non blocca né rallenta mai la timbratura (nessun `await` sul suono nei percorsi di timbratura, nessuna eccezione che esce).
- `prefers-reduced-motion`: slitta e fiocchi non si vedono (la regola globale in `src/style.css` già ferma le animazioni).
- Verifica a ogni task: `npm test` e `npm run typecheck` verdi.

## Review Focus

1. **Spegnimento del tema a cavallo di capodanno**: spento il 20/12 deve restare spento il 2/1, e tornare l'8/12 dell'anno dopo. → test in Task 2.
2. **Suono di passaggio bloccato dal browser** (nessun tocco ancora): non si segna come suonato, si riprova al passaggio dopo, una volta sola; al ritorno in primo piano si riparte da capo. → test in Task 3.
3. **Schermata della pausa che si apre già scaduta / con pausa minima già fatta** (app riaperta a pausa finita): niente suono. → controllo nel passaggio di fase, Task 6.
4. **Notifica di fine pausa con i suoni spenti o con anticipo diverso**: deve restare programmata, si toglie solo se coincide col suono e i suoni sono accesi. → test in Task 7.
5. **Tema della festa spento**: si sentono i suoni di tutto l'anno, e nessun suono di passaggio (strega/slitta non ci sono). → test in Task 3.

---

### Task 1: Le registrazioni (prima di tutto, con l'ascolto dell'utente)

**Files:**
- Create: `public/suoni/ding.mp3`, `public/suoni/ding-doppio.mp3`, `public/suoni/natale-campanelle.mp3`, `public/suoni/natale-campanellino.mp3`, `public/suoni/natale-ohoh.mp3`, `public/suoni/halloween-risata.mp3`, `public/suoni/halloween-campana.mp3`, `public/suoni/halloween-ululato.mp3`
- Modify: `THIRD_PARTY_LICENSES.md` (nuova sezione "Suoni")

**Interfaces:**
- Produces: gli otto file con esattamente quei nomi (Task 3 li elenca).

- [ ] **Step 1: Strumenti.** Serve `ffmpeg` per tagliare e comprimere (non è installato: `which ffmpeg` vuoto). Chiedere all'utente il permesso prima di installarlo (`winget install Gyan.FFmpeg`); non installare di nascosto.
- [ ] **Step 2: Cercare 2–3 candidati CC0 per ognuno degli otto momenti** (spec, tabella "Quali suoni") su Freesound (filtro licenza "Creative Commons 0"), Wikimedia Commons, OpenGameArt. Scaricarli in una cartella nuova e vuota dello scratchpad (dati non fidati), annotando per ognuno titolo, autore, link, licenza.
- [ ] **Step 3: Preparare i candidati** con ffmpeg: taglio, silenzio iniziale tolto (`silenceremove`), mono, volume normalizzato (`loudnorm`), MP3 ~64–96 kbps, durate entro i limiti dei Global Constraints.
- [ ] **Step 4: Pagina d'ascolto** nel visual companion (server già usato nel brainstorming, `.superpowers/brainstorm/`): un `<audio controls>` per candidato, raggruppati per momento, con le opzioni cliccabili. Mandare all'utente l'URL e aspettare la sua scelta. **Non si prosegue senza.**
- [ ] **Step 5: Copiare i file scelti** in `public/suoni/` con i nomi sopra. Per un momento senza candidato accettato non si crea il file (Task 3 ricade sul suono di tutto l'anno). Controllare il totale: `du -ch public/suoni/*.mp3` < 400 KB.
- [ ] **Step 6: `THIRD_PARTY_LICENSES.md`**: sezione "Suoni" con una riga per file (nome del file, titolo, autore, link, CC0).
- [ ] **Step 7: Commit** `git add public/suoni THIRD_PARTY_LICENSES.md && git commit -m "Suoni: registrazioni CC0 per timbratura, fine pausa e feste"`

### Task 2: Natale nel calendario delle feste

**Files:**
- Modify: `src/core/festa.ts`
- Test: `tests/festa.test.ts`

**Interfaces:**
- Produces: `type Festa = 'halloween' | 'natale'`; `festaDelGiorno(data: string): Festa | null`; `chiaveFesta(festa: Festa, data: string): string` (Natale: anno di inizio della stagione).

- [ ] **Step 1: Test che falliscono** in `tests/festa.test.ts`:

```ts
it('Natale dall\'8 dicembre all\'Epifania compresi, a cavallo d\'anno', () => {
  expect(festaDelGiorno('2026-12-07')).toBeNull();
  expect(festaDelGiorno('2026-12-08')).toBe('natale');
  expect(festaDelGiorno('2026-12-31')).toBe('natale');
  expect(festaDelGiorno('2027-01-01')).toBe('natale');
  expect(festaDelGiorno('2027-01-06')).toBe('natale');
  expect(festaDelGiorno('2027-01-07')).toBeNull();
});

it('Natale spento resta spento fino all\'Epifania, l\'anno dopo torna', () => {
  expect(chiaveFesta('natale', '2026-12-20')).toBe('natale-2026');
  expect(chiaveFesta('natale', '2027-01-02')).toBe('natale-2026');
  expect(chiaveFesta('natale', '2027-12-08')).toBe('natale-2027');
  expect(chiaveFesta('halloween', '2026-10-26')).toBe('halloween-2026'); // invariata
});
```

- [ ] **Step 2:** `npx vitest run tests/festa.test.ts` → FAIL (`'natale'` non esiste).
- [ ] **Step 3: Implementare** in `src/core/festa.ts`: costante `NATALE = { da: '12-08', a: '01-06' }`; `festaDelGiorno` controlla Halloween poi Natale (`mmgg >= da || mmgg <= a`); `chiaveFesta` per Natale usa l'anno precedente se `mmgg <= '01-06'`. Aggiornare il commento in testa ("Per ora solo Halloween").
- [ ] **Step 4:** `npx vitest run tests/festa.test.ts` → PASS; `npm run typecheck` → errori attesi solo dove `Record<Festa, …>` è incompleto (`tema.ts`): si chiudono nel Task 4, ma per non lasciare il ramo rotto aggiungere qui la voce `natale: { chiaro: '#f4f4f1', scuro: '#070c18' }` a `COLORE_BARRA_FESTA` in `src/ui/tema.ts`.
- [ ] **Step 5: Commit** `"Tema di Natale: dall'8 dicembre all'Epifania, spegnimento per stagione"`

### Task 3: Logica dei suoni

**Files:**
- Create: `src/core/suoni.ts`
- Test: `tests/suoni.test.ts`

**Interfaces:**
- Consumes: `Festa` (Task 2); i nomi dei file del Task 1.
- Produces:
  - `type MomentoSuono = 'timbratura' | 'finePausa' | 'passaggio'`
  - `fileSuono(momento: MomentoSuono, festa: Festa | null): string | null` — nome del file in `public/suoni/` (es. `'natale-campanellino.mp3'`), `null` = nessun suono.
  - `creaPassaggio(suona: () => Promise<boolean>): { alPassaggio(): void; allaRiapertura(): void }`

- [ ] **Step 1: Test che falliscono** in `tests/suoni.test.ts`:

```ts
describe('fileSuono', () => {
  it('tutto l\'anno: ding e doppio ding, nessun passaggio', () => {
    expect(fileSuono('timbratura', null)).toBe('ding.mp3');
    expect(fileSuono('finePausa', null)).toBe('ding-doppio.mp3');
    expect(fileSuono('passaggio', null)).toBeNull();
  });
  it('Natale e Halloween a tema', () => {
    expect(fileSuono('timbratura', 'natale')).toBe('natale-campanellino.mp3');
    expect(fileSuono('finePausa', 'natale')).toBe('natale-ohoh.mp3');
    expect(fileSuono('passaggio', 'natale')).toBe('natale-campanelle.mp3');
    expect(fileSuono('timbratura', 'halloween')).toBe('halloween-campana.mp3');
    expect(fileSuono('finePausa', 'halloween')).toBe('halloween-ululato.mp3');
    expect(fileSuono('passaggio', 'halloween')).toBe('halloween-risata.mp3');
  });
});

describe('creaPassaggio', () => {
  it('suona solo al primo passaggio', async () => { /* suona → true; alPassaggio ×3 → chiamata 1 volta */ });
  it('se il browser lo blocca riprova al passaggio dopo, una volta sola', async () => {
    /* prima risposta false, poi true; alPassaggio ×3 → chiamate 2 */
  });
  it('al ritorno in primo piano si riparte da capo', async () => {
    /* alPassaggio, allaRiapertura, alPassaggio → chiamate 2 */
  });
  it('un passaggio mentre il primo sta ancora provando non suona due volte', async () => {
    /* suona resta in attesa; alPassaggio ×2 → chiamata 1 */
  });
});
```

(Per i test asincroni: `await Promise.resolve()` / `vi.waitFor` dopo ogni `alPassaggio`.)

- [ ] **Step 2:** `npx vitest run tests/suoni.test.ts` → FAIL (modulo mancante).
- [ ] **Step 3: Implementare `src/core/suoni.ts`**: tabella `Record<Festa | 'sempre', Record<MomentoSuono, string | null>>`. Se in futuro un file a tema manca (Task 1 Step 5), lo si mette a `null` nella tabella e `fileSuono` ricade su `sempre` per timbratura e fine pausa (aggiungere un caso di test se succede davvero). `creaPassaggio` tiene lo stato `'da-suonare' | 'in-corso' | 'suonato'`; un `false` o un rifiuto della promessa riporta a `'da-suonare'`. Nessun import dal DOM.
- [ ] **Step 4:** `npx vitest run tests/suoni.test.ts` → PASS.
- [ ] **Step 5: Commit** `"Suoni: scelta del file per momento e festa, solo al primo passaggio"`

### Task 4: Aspetto del tema di Natale e interruttori in Aspetto

**Files:**
- Modify: `src/ui/festaDisegni.ts`, `src/ui/tema.ts`, `src/style.css`, `src/ui/impostazioni.ts`, `src/ui/ricercaImpostazioni.ts`
- Test: `tests/festa.test.ts`, `tests/ricercaImpostazioni.test.ts`

**Interfaces:**
- Consumes: `Festa`, `festaDelGiorno` (Task 2).
- Produces: `creaDecorazioni(festa: Festa): HTMLElement` (contenitore `.festa-decorazioni` con `data-festa`); le figure in volo hanno la classe comune `festa-volo` (strega: `festa-strega festa-volo`, slitta: `festa-slitta festa-volo`), usata dal Task 6.

- [ ] **Step 1: Test che falliscono**: in `tests/festa.test.ts` il test della ricerca diventa per entrambe le feste:

```ts
const ids = (q: string, festa: Festa | null) => cercaImpostazioni(q, { app: false, festa }).map((v) => v.id);
expect(ids('renne', 'natale')).toContain('natale');
expect(ids('renne', null)).not.toContain('natale');
expect(ids('natale', 'halloween')).not.toContain('natale');
```

- [ ] **Step 2:** `npx vitest run tests/festa.test.ts` → FAIL.
- [ ] **Step 3: Ricerca**: in `VOCI` dopo `halloween`: `{ id: 'natale', nome: 'Tema di Natale', pagina: 'aspetto', sinonimi: 'neve renne babbo slitta abete verde festa', soloFesta: 'natale' }`.
- [ ] **Step 4: Interruttore in Aspetto** (`impostazioni.ts`): il ramo `festaDiOggi() === 'halloween'` diventa generico su `festaDiOggi()`, con i testi per festa:
  - halloween: `'Tema di Halloween 🎃'`, `'Fino a Ognissanti, poi torna da solo il tema normale.'`, voce `'halloween'` (invariati);
  - natale: `'Tema di Natale ⛄'`, `'Fino all\'Epifania, poi torna da solo il tema normale.'`, voce `'natale'`.
- [ ] **Step 5: Disegni** in `festaDisegni.ts`: `SVG_SLITTA` (Babbo Natale con sacco, slitta rossa con pattino dorato, due renne, la prima col naso rosso; volo verso destra) e `creaDecorazioni(festa)`: Halloween → strega; Natale → slitta + 5 `<span class="festa-fiocco">` con posizione/durata/ritardo diversi nello stile inline. Riferimento grafico: `.superpowers/brainstorm/*/content/natale-a-verde-v2.html` (gruppi `xm-slitta-def`, `xm-renna`). In `tema.ts`, `applica()` sostituisce il contenitore se `data-festa` non corrisponde alla festa accesa.
- [ ] **Step 6: CSS** in `src/style.css`, blocco `:root[data-festa='natale']` sotto quello di Halloween, con i valori della tabella colori della spec (chiaro e scuro); `.intestazione h1::after { content: ' ⛄'; }`; `.scheda-principale::before` = neve sul bordo (SVG data-URI della fascia ondulata `xm-neve-def`, `top: -9px`, alta ~16 px, larga quanto la scheda) e `::after` = abetino (data-URI di `xm-abete-def`, 38 px, in alto a destra); `.festa-decorazioni` visibile con `:root[data-festa]` (generalizzare la regola di Halloween); `.festa-slitta` (~104 px, `top: calc(var(--sicuro-alto) + 6px)`, animazione `slitta` 40 s lineare, ritardo 4 s, da `translateX(-140px)` a `calc(100vw + 20px)` entro il 24% del giro, poi ferma fuori schermo); `.festa-fiocco` (5 px, `#c7d2df` chiaro / `#e8eef8` scuro, animazione `fiocco` che scende ~110 px nella fascia alta e sfuma). Contrasto: `#ffffff` su `#15803d` ≈ 5,0:1 e `#03210e` su `#4ade80` ≥ 4,5:1 — verificare e scrivere il valore nel commento come per Halloween.
- [ ] **Step 7:** `npm test` e `npm run typecheck` → verdi.
- [ ] **Step 8: Controllo visivo** con Chrome headless (memoria del progetto: `chrome.exe --headless=new --screenshot`, finestra ≥ 500 px; per 360 px un iframe): build di sviluppo con la data forzata a un giorno di dicembre (es. sovrascrivere temporaneamente `festaDiOggi` dalla console o un parametro di sviluppo che **non** resta nel commit), tema chiaro e scuro, schermata Oggi. Confrontare con la bozza approvata.
- [ ] **Step 9: Commit** `"Tema di Natale: verde abete, slitta con le renne, neve e abetino sulla scheda, pupazzo nei titoli"`

### Task 5: Modalità silenziosa sul telefono (Android)

**Files:**
- Modify: `android/app/src/main/java/app/sbeggio/NfcPlugin.java`, `android/app/src/main/java/app/sbeggio/MainActivity.java`, `src/native/nfc.ts`
- Test: `tests/nativeNfc.test.ts`

**Interfaces:**
- Produces: `telefonoSilenzioso(): Promise<boolean>` in `src/native/nfc.ts` — `true` solo nell'app con la suoneria in silenzioso o vibrazione; `false` fuori dall'app o se il plugin non risponde (build vecchia).

- [ ] **Step 1: Test che falliscono** in `tests/nativeNfc.test.ts` (aggiungere `suoneria: vi.fn()` al plugin finto):

```ts
describe('telefono silenzioso', () => {
  it('silenzioso o vibrazione: true; normale: false', async () => {
    const { telefonoSilenzioso } = await carica();
    plugin.suoneria.mockResolvedValue({ silenzioso: true });
    expect(await telefonoSilenzioso()).toBe(true);
    plugin.suoneria.mockResolvedValue({ silenzioso: false });
    expect(await telefonoSilenzioso()).toBe(false);
  });
  it('fuori dall\'app o plugin vecchio: false', async () => {
    const { telefonoSilenzioso } = await carica();
    plugin.suoneria.mockRejectedValue(new Error('not implemented'));
    expect(await telefonoSilenzioso()).toBe(false);
    ambiente.app = false;
    expect(await telefonoSilenzioso()).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/nativeNfc.test.ts` → FAIL.
- [ ] **Step 3: TypeScript**: `suoneria(): Promise<{ silenzioso: boolean }>` in `PluginNfc`; `telefonoSilenzioso()` come `statoNfc` (inApp, try/catch).
- [ ] **Step 4: Java**: in `NfcPlugin` `@PluginMethod public void suoneria(PluginCall call)` che risolve `{ silenzioso: audioManager.getRingerMode() != AudioManager.RINGER_MODE_NORMAL }` (`AudioManager` null → `false`). In `MainActivity`, dopo `super.onCreate`, `getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false)` con un commento sul perché (suono del primo passaggio prima di un tocco).
- [ ] **Step 5:** `npx vitest run tests/nativeNfc.test.ts` → PASS. Java: compilare i due file con il `javac` della JBR contro `%LOCALAPPDATA%\Android\Sdk\platforms\android-37.0\android.jar` più stub minimi di Capacitor (vedi memoria `build-android-locale`); `gradlew` qui non parte, la build completa la fa il workflow "App Android" sulla PR.
- [ ] **Step 6: Commit** `"App Android: legge la modalità silenziosa e permette l'audio senza tocco"`

### Task 6: Lettore, interruttore Suoni e agganci

**Files:**
- Create: `src/ui/suoni.ts`
- Modify: `src/ui/giorno.ts`, `src/ui/sigaretta.ts`, `src/ui/pranzo.ts`, `src/ui/tema.ts`, `src/ui/impostazioni.ts`, `src/ui/ricercaImpostazioni.ts`, `vite.config.ts`
- Test: `tests/ricercaImpostazioni.test.ts`, `tests/suoniUi.test.ts`

**Interfaces:**
- Consumes: `fileSuono`, `creaPassaggio`, `MomentoSuono` (Task 3); `festaAccesa` (`tema.ts`); `telefonoSilenzioso` (Task 5); `.festa-volo` (Task 4).
- Produces (in `src/ui/suoni.ts`):
  - `suoniAccesi(): boolean` — chiave `localStorage` `'timbrature-suoni'`, accesi solo se vale `'1'` (predefinito: spenti).
  - `impostaSuoni(accesi: boolean): void` — salva e lancia `document.dispatchEvent(new Event(EVENTO_RICALCOLA_AVVISI))` (costante del Task 7; fino ad allora va bene definirla qui ed esportarla da `src/core/avvisi.ts` nel Task 7).
  - `suona(momento: MomentoSuono): Promise<boolean>` — `false` se spenti, se `telefonoSilenzioso()`, se il file è `null`, se `play()` rifiuta; mai eccezioni. Un `HTMLAudioElement` per file, riusato (`currentTime = 0`). URL: `` `${import.meta.env.BASE_URL}suoni/${file}` ``.
  - `avviaSuoni(): void` — passaggio: `creaPassaggio(() => suona('passaggio'))`; ascolta `animationstart` e `animationiteration` sul documento filtrando `.festa-volo`; `allaRiapertura()` su `visibilitychange` → `visible`.

- [ ] **Step 1: Test che falliscono**:
  - `tests/ricercaImpostazioni.test.ts`: `expect(ids('suoni')).toEqual(['suoni']); expect(ids('campanelle')).toContain('suoni');`
  - `tests/suoniUi.test.ts` (nel progetto non c'è jsdom: come in `tests/uiTagNfc.test.ts` si fingono i moduli con `vi.mock` — `../src/native/nfc`, `../src/ui/tema` — e i globali con `vi.stubGlobal`: `localStorage` in memoria, `Audio` finto con `play` controllabile, `document` con `dispatchEvent`): con `localStorage` vuoto `suoniAccesi()` è `false` e `suona('timbratura')` risolve `false` senza creare `Audio`; con `impostaSuoni(true)` e `telefonoSilenzioso` → `true`, `suona` risolve `false` senza creare `Audio`; con `impostaSuoni(true)` e `play` finto che rifiuta, `suona` risolve `false` senza lanciare; `impostaSuoni` emette l'evento di ricalcolo.
- [ ] **Step 2:** `npx vitest run tests/ricercaImpostazioni.test.ts tests/suoniUi.test.ts` → FAIL.
- [ ] **Step 3: Implementare `src/ui/suoni.ts`** come da Interfaces; voce di ricerca `{ id: 'suoni', nome: 'Suoni', pagina: 'aspetto', sinonimi: 'audio volume campanelle silenzio' }` dopo `tema`; in Aspetto, sotto la scheda del tema e prima di quella della festa: `scheda(null, riga('Suoni', interruttore(suoniAccesi(), impostaSuoni, 'Suoni'), 'Si sentono solo con l\'app aperta.', 'suoni'))`.
- [ ] **Step 4: Agganci della timbratura** (`void suona('timbratura')`, senza `await`), solo dove nasce una timbratura nuova da pulsante o tag:
  - `giorno.ts` `eseguiAzione`: subito prima del `toast` finale e prima del `toast` nel ramo `USCITA` con permesso; **non** in `RIAPRI` né in `PERMESSO_INIZIO_GIORNATA`.
  - `sigaretta.ts` `avviaPausaSigaretta` e `rientra` (entrambi i rami).
  - `pranzo.ts` `avviaPausaPranzo`, `finePausaPranzo` (ramo senza schermata) e `chiudiPausa`.
  - Il percorso del tag passa da queste funzioni: nessun suono in `tagNfc.ts` (la vibrazione resta).
- [ ] **Step 5: Agganci di fine pausa** (`void suona('finePausa')`), solo sul passaggio di stato a schermata aperta:
  - `sigaretta.ts`: dove `spegnimentoDaAnimare(fasePrecedente, c.fase)` è vero (già falso all'apertura su pausa scaduta).
  - `pranzo.ts` `aggiorna()`: variabile `minimaPrima: boolean | null = null`; suona solo se `minimaPrima === false && a.minimaFatta` (alla prima chiamata `null` → niente suono se si apre già fatta).
- [ ] **Step 6: Avvio**: `avviaSuoni()` in `src/main.ts` accanto ad `avviaTema()`. In `festaDisegni.ts` aggiungere `festa-volo` alle classi di strega e slitta.
- [ ] **Step 7: Precache**: in `vite.config.ts` `globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,mp3}']`.
- [ ] **Step 8:** `npm test`, `npm run typecheck`, `npm run build` → verdi; nel build controllare che `dist/sw.js` (o il manifest di precache) contenga `suoni/ding.mp3`.
- [ ] **Step 9: Prova nell'app** (`npm run dev`, Chrome): Aspetto → Suoni acceso; timbrare → ding; pausa sigaretta con tolleranza corta (Impostazioni) fino a scadenza → doppio ding; data forzata a dicembre → campanelle al primo passaggio della slitta, non al secondo; ridurre a icona e tornare → di nuovo al primo passaggio.
- [ ] **Step 10: Commit** `"Suoni: interruttore in Aspetto, timbratura, fine pausa e primo passaggio della festa"`

### Task 7: Niente notifica sovrapposta al suono

**Files:**
- Modify: `src/core/avvisi.ts`, `src/native/avvisi.ts`, `src/web/avvisi.ts`, `src/ui/sigaretta.ts`, `src/ui/pranzo.ts`, `src/ui/suoni.ts`
- Test: `tests/avvisi.test.ts`

**Interfaces:**
- Consumes: `suoniAccesi` (Task 6).
- Produces:
  - in `OpzioniAvvisi`: `schermateAperte?: { sigaretta?: boolean; pranzo?: boolean }`.
  - `EVENTO_RICALCOLA_AVVISI = 'sbeggio:ricalcola-avvisi'` esportata da `src/core/avvisi.ts`.
  - `schermataSigarettaAperta(): boolean` (`sigaretta.ts`), `schermataPranzoAperta(): boolean` (`pranzo.ts`, vera solo col cronometro, non col riepilogo).
  - `schermateDaTacere(): OpzioniAvvisi['schermateAperte']` in `src/ui/suoni.ts`: `{}` se i suoni sono spenti, altrimenti lo stato delle due schermate.

- [ ] **Step 1: Test che falliscono** in `tests/avvisi.test.ts` (giornate e impostazioni con gli helper esistenti):

```ts
describe('notifica tolta quando coincide col suono dell'app', () => {
  it('sigaretta con anticipo 0 e schermata aperta: niente avviso', () => {
    expect(pianificaAvvisi(sigaretta(), conAvvisi({ sigarettaAnticipo: 0 }), { data: GIOVEDI, minuti: h('10:00') }, { schermateAperte: { sigaretta: true } })).toEqual([]);
  });
  it('sigaretta con anticipo 2: l\'avviso resta anche a schermata aperta', () => {
    expect(pianificaAvvisi(sigaretta(), conAvvisi({ sigarettaAnticipo: 2 }), { data: GIOVEDI, minuti: h('10:00') }, { schermateAperte: { sigaretta: true } })).toHaveLength(1);
  });
  it('pranzo con avviso uguale alla pausa minima e schermata aperta: niente avviso', () => { /* pranzoMinuti 30, pausaMinima 30 → [] */ });
  it('pranzo con avviso dopo 45 minuti: resta', () => { /* pranzoMinuti 45 → 1 avviso */ });
  it('senza schermateAperte tutto come prima', () => { /* stessi casi senza opzione → 1 avviso */ });
});
```

- [ ] **Step 2:** `npx vitest run tests/avvisi.test.ts` → FAIL.
- [ ] **Step 3: `pianificaAvvisi`**: salta l'avviso `pausa` se `opz.schermateAperte?.pranzo && imp.avvisi.pranzoMinuti === imp.pausaMinima`; salta `sigaretta` se `opz.schermateAperte?.sigaretta && imp.avvisi.sigarettaAnticipo === 0`. Aggiornare il commento della funzione.
- [ ] **Step 4:** `npx vitest run tests/avvisi.test.ts` → PASS.
- [ ] **Step 5: Collegare**: `native/avvisi.ts` ed `web/avvisi.ts` passano `schermateAperte: schermateDaTacere()` a `pianificaAvvisi` e in `avviaAvvisi` ascoltano `EVENTO_RICALCOLA_AVVISI` → `sincronizzaAvvisi()`. `sigaretta.ts` e `pranzo.ts` lanciano l'evento all'apertura della schermata e alla sua chiusura (evento `close` del `dialog`; per il pranzo anche al passaggio al riepilogo). `impostaSuoni` già lo lancia (Task 6). Attenzione al ciclo di import: `suoni.ts` importa da `sigaretta.ts`/`pranzo.ts`, che importano `suona` da `suoni.ts` — se il bundler o i test lo soffrono, spostare i due flag "schermata aperta" in un modulo minimo `src/ui/schermatePausa.ts` importato da tutti e tre.
- [ ] **Step 6:** `npm test`, `npm run typecheck` → verdi.
- [ ] **Step 7: Commit** `"Avvisi: a schermata aperta e suoni accesi niente notifica che si sovrappone al suono"`

### Task 8: Versione 2.15.0

**Files:**
- Modify: `src/core/novita.ts`, `package.json`, `package-lock.json`

- [ ] **Step 1: Novità** in cima a `NOVITA`, `versione: '2.15.0'`, `data` = giorno del rilascio. Voci (testo da rifinire, nello stile della 2.14.0):
  - `'Arrivano i suoni 🔔: un ding quando timbri e quando finisce la pausa sigaretta o pranzo. Sono spenti: li accendi da Impostazioni → Aspetto → Suoni. Si sentono solo con l\'app aperta.'`
  - `'A Natale e Halloween i suoni sono a tema: campanelle e "oh oh oh!", oppure campane e ululati.'`
  - `'Dall\'8 dicembre all\'Epifania Sbeggio si veste per Natale ⛄: verde abete, neve sulla scheda, un abetino e Babbo Natale che passa con le renne. Lo spegni da Impostazioni → Aspetto → Tema di Natale.'`
- [ ] **Step 2: Versione**: `npm version 2.15.0 --no-git-tag-version`; poi `npm run versione:controlla` → OK.
- [ ] **Step 3:** `npm test`, `npm run typecheck`, `npm run build` → verdi.
- [ ] **Step 4: Commit** `"Versione 2.15.0: novità (tema di Natale e suoni)"`
