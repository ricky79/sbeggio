# Pagina Informazioni — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** una pagina pubblica statica `web.sbeggio.app/informazioni` (autore, licenza, contatti, privacy), leggibile senza JavaScript, con metadati di autore su tutte le pagine e link da sito e app.

**Architecture:** `informazioni.html` è un terzo ingresso HTML di Vite, testo già nel file e CSS collegati con `<link>` (nessuno script necessario). Il Worker la serve su `web.sbeggio.app/informazioni` e rimanda lì da `sbeggio.app/informazioni`. Esclusa dalla build Android e dal precache della PWA.

**Tech Stack:** Vite 8, TypeScript, Cloudflare Workers Assets, Vitest (ambiente node).

**Spec:** `docs/superpowers/specs/2026-11-17-pagina-informazioni-design.md`

## Global Constraints

- Ramo: `feature/pagina-informazioni` da `develop`.
- Autore: `Riccardo Oliosi`, profilo `https://github.com/ricky79`. Contatto: `supporto@sbeggio.app` (mai la mail personale).
- Licenza: GPL-3.0-or-later, link `https://github.com/ricky79/sbeggio/blob/main/LICENSE`; codice `https://github.com/ricky79/sbeggio`. Nome e logo esclusi dalla licenza.
- Indirizzo pubblico: `https://web.sbeggio.app/informazioni`; `https://sbeggio.app/informazioni` → 302 lì.
- Testi in italiano; l'informativa dichiara solo ciò che il codice fa (vedi spec, sezione Privacy). Nessun testo legale generico.
- Nuovi file con intestazione `SPDX-License-Identifier: GPL-3.0-or-later` / `Copyright (C) 2026 Riccardo Oliosi`.
- Nessuna dipendenza nuova.
- Commit: messaggi in italiano come nel resto della storia, chiusi con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Non toccare `.gitignore`, `DANONCONDIVIDERE.txt`, `logo.png`, `session.txt` (modifiche locali di Riccardo).

## Review Focus

- **Pagina aperta senza JavaScript** (curl, crawler): nome, mail e privacy devono essere nel sorgente HTML servito → Task 2, test sul file e controllo su `dist/informazioni.html`.
- **`/informazioni/` con la barra finale o `/informazioni.html`** su web.sbeggio.app: deve arrivare la stessa pagina, non il sito del QR → Task 1, `it.each` sui tre percorsi.
- **PWA installata e offline**: la pagina non deve finire nel precache né far comparire il manifest → Task 2, controllo su `dist/sw.js` e su `dist/informazioni.html`.
- **App Android**: `informazioni.html` non deve entrare nella build `--mode android` → Task 2, ingresso solo nella build web.
- **Tema scuro senza JavaScript**: con lo script inline bloccato la pagina resta leggibile (variabili di `:root` del tema chiaro) → Task 2, verifica visiva con Chrome headless.

---

### Task 1: Instradamento nel Worker

**Files:**
- Modify: `src/worker.ts` (funzioni `richiestaSito` e `fetch`)
- Test: `tests/worker.test.ts`

**Interfaces:**
- Produces: `web.sbeggio.app/informazioni` → `ASSETS.fetch` con URL `https://web.sbeggio.app/informazioni`; `sbeggio.app/informazioni` → 302.

- [ ] **Step 1: Ramo e spec**

```bash
git switch -c feature/pagina-informazioni develop
git add docs/superpowers/specs/2026-11-17-pagina-informazioni-design.md docs/superpowers/specs/2026-11-17-pagina-informazioni-design.html docs/superpowers/plans/2026-11-17-pagina-informazioni.md docs/superpowers/plans/2026-11-17-pagina-informazioni.html
git commit -m "Pagina Informazioni: progetto e piano"
```

- [ ] **Step 2: Test che falliscono**

In `describe('worker di sbeggio.app')`:

```ts
it.each(['/informazioni', '/informazioni/'])('sbeggio.app%s rimanda alla pagina Informazioni del sito', async (percorso) => {
  const { env, fetch } = envFinto();
  const r = await worker.fetch(new Request(`https://sbeggio.app${percorso}`), env);
  expect(r.status).toBe(302);
  expect(r.headers.get('Location')).toBe('https://web.sbeggio.app/informazioni');
  expect(fetch).not.toHaveBeenCalled();
});
```

In `describe('worker di web.sbeggio.app')`:

```ts
it.each(['/informazioni', '/informazioni/', '/informazioni.html'])('%s serve la pagina statica Informazioni', async (percorso) => {
  const { env, fetch } = envFinto();
  await worker.fetch(new Request(`https://web.sbeggio.app${percorso}`), env);
  // Workers Assets serve informazioni.html all'indirizzo /informazioni.
  expect(fetch.mock.calls[0]![0].url).toBe('https://web.sbeggio.app/informazioni');
});
```

- [ ] **Step 3:** `npx vitest run tests/worker.test.ts` → i nuovi casi FALLISCONO (302 assente; URL `/web`).

- [ ] **Step 4: Implementazione**

- Costante `const PERCORSO_INFORMAZIONI = /^\/informazioni(\.html|\/)?$/;`
- In `fetch`, accanto al redirect di `/novita`: su `sbeggio.app` se il percorso corrisponde → `Response.redirect(\`https://${SITO}/informazioni\`, 302)`.
- In `richiestaSito`: se il percorso corrisponde → `new Request(new URL('/informazioni', url), richiesta)`; aggiornare il commento della funzione.
- Aggiornare il commento in testa al Worker (elenco dei domini) con la pagina Informazioni.

- [ ] **Step 5:** `npx vitest run tests/worker.test.ts` → PASS, compresi i test esistenti.

- [ ] **Step 6: Commit** — `git commit -am "Worker: pagina Informazioni su web.sbeggio.app, sbeggio.app/informazioni rimanda lì"`

---

### Task 2: La pagina statica e la build

**Files:**
- Create: `informazioni.html` (radice, accanto a `web.html`)
- Create: `src/sito/informazioni.css` (solo gli stili del testo della pagina)
- Modify: `vite.config.ts` (ingresso, plugin `sitoSenzaManifest`, `globIgnores`)
- Test: `tests/informazioni.test.ts`

**Interfaces:**
- Consumes: instradamento del Task 1.
- Produces: `dist/informazioni.html` nella build web; ancore di sezione `#autore`, `#licenza`, `#contatti`, `#privacy` (usate dai link del Task 4).

- [ ] **Step 1: Test che falliscono** — `tests/informazioni.test.ts`, legge il file con `readFileSync('informazioni.html', 'utf8')` (ambiente node, niente DOM):

```ts
it('il testo è già nell\'HTML, senza bisogno di JavaScript', () => {
  expect(html).toContain('Riccardo Oliosi');
  expect(html).toContain('https://github.com/ricky79');
  expect(html).toContain('mailto:supporto@sbeggio.app');
  expect(html).toContain('https://github.com/ricky79/sbeggio/blob/main/LICENSE');
  for (const id of ['autore', 'licenza', 'contatti', 'privacy']) expect(html).toContain(`id="${id}"`);
  expect(html).not.toMatch(/<script[^>]*type="module"/);
});

it('l\'informativa dice cosa parte dal telefono e cosa no', () => {
  for (const frase of ['notifiche.sbeggio.app', 'Cloudflare', 'GitHub', 'posizione', 'cifrat']) expect(html).toContain(frase);
});

it('la mail personale non compare', () => {
  expect(html).not.toMatch(/@gmail\.com/i);
});
```

- [ ] **Step 2:** `npx vitest run tests/informazioni.test.ts` → FAIL (file assente).

- [ ] **Step 3: `informazioni.html`**

- Struttura copiata da `web.html`: stesse intestazioni SPDX, `lang="it"`, `color-scheme`, favicon, script inline del tema dal sistema, testata `.sito-testata` (menu: Novità, **Informazioni** con `aria-current="page"`**, Apri l'app) e piè `.sito-piede`.
- `<title>Informazioni · Sbeggio</title>`, `<meta name="description" content="Chi ha fatto Sbeggio, licenza, contatti e informativa sulla privacy.">`, `<link rel="canonical" href="https://web.sbeggio.app/informazioni">`.
- CSS con `<link rel="stylesheet" href="/src/style.css">`, `/src/sito/sito.css`, `/src/sito/informazioni.css` (Vite li elabora come per un ingresso HTML).
- `<main class="sito">` con `<h1>Informazioni</h1>` e quattro `<section>` con `id` `autore`, `licenza`, `contatti`, `privacy`. Testi:
  - **Chi l'ha fatta**: il paragrafo della spec, con "Riccardo Oliosi" che punta a `https://github.com/ricky79`.
  - **Software libero**: GPL 3.0 o successive, link a LICENSE e al codice; "Il nome Sbeggio e il logo non sono coperti dalla licenza."
  - **Contatti**: `supporto@sbeggio.app` come `mailto:`; dall'app anche da Aiuto → Suggerimenti e problemi.
  - **Privacy**: le voci della spec, una per `<li>`, nell'ordine della spec, più "Ultimo aggiornamento: 17 novembre 2026".
- `src/sito/informazioni.css`: larghezza di lettura (`max-width` ~ 680px), spaziatura delle sezioni, link sottolineati; colori solo da variabili di `style.css`.

- [ ] **Step 4:** `npx vitest run tests/informazioni.test.ts` → PASS.

- [ ] **Step 5: `vite.config.ts`**

- `input`: build web `{ index: 'index.html', sito: 'web.html', informazioni: 'informazioni.html' }`; android invariato.
- `sitoSenzaManifest`: rimuove il manifest anche per `ctx.path === '/informazioni.html'` (aggiornare il commento).
- `globIgnores`: aggiungere `'informazioni.html'` e `'assets/informazioni-*.css'`.

- [ ] **Step 6: Verifica della build**

Run: `npm run build`, poi
`grep -c "Riccardo Oliosi" dist/informazioni.html` → ≥ 1;
`grep -c 'rel="manifest"' dist/informazioni.html` → 0;
`grep -c "informazioni" dist/sw.js` → 0;
`npx vite build --mode android --outDir "$TMP/android-dist"` e `ls "$TMP/android-dist"` → nessun `informazioni.html`.

- [ ] **Step 7: Verifica visiva** — `npx vite preview`, poi Chrome headless (vedi memoria "Build Android in locale": UI verificata con Chrome headless) a 390px di larghezza, tema chiaro e scuro (`--force-dark-mode`), e una volta con JavaScript disattivato (`--blink-settings=scriptEnabled=false`). Atteso: testata, testo e piè leggibili, nessuno scorrimento orizzontale.

- [ ] **Step 8: Commit** — `git add informazioni.html src/sito/informazioni.css vite.config.ts tests/informazioni.test.ts && git commit -m "Pagina Informazioni: autore, licenza, contatti e privacy, leggibile senza JavaScript"`

---

### Task 3: Autore nei metadati

**Files:**
- Modify: `index.html`, `web.html`, `informazioni.html` (nel `<head>`)
- Test: `tests/informazioni.test.ts`

**Interfaces:**
- Produces: in ogni pagina `<meta name="author" content="Riccardo Oliosi">` e un `<script type="application/ld+json">`.

- [ ] **Step 1: Test che falliscono**

```ts
it.each(['index.html', 'web.html', 'informazioni.html'])('%s dichiara autore e licenza', (file) => {
  const sorgente = readFileSync(file, 'utf8');
  expect(sorgente).toContain('<meta name="author" content="Riccardo Oliosi"');
  const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(sorgente)?.[1];
  const dati = JSON.parse(json!);
  expect(dati['@type']).toBe('SoftwareApplication');
  expect(dati.name).toBe('Sbeggio');
  expect(dati.author).toEqual({ '@type': 'Person', name: 'Riccardo Oliosi', url: 'https://github.com/ricky79' });
  expect(dati.license).toBe('https://www.gnu.org/licenses/gpl-3.0.html');
});
```

- [ ] **Step 2:** `npx vitest run tests/informazioni.test.ts` → FAIL.

- [ ] **Step 3:** aggiungere a ciascun file il `meta` e il JSON-LD con, oltre ai campi del test: `"@context": "https://schema.org"`, `"url": "https://sbeggio.app"`, `"description"` uguale alla meta description di `index.html`, `"applicationCategory": "BusinessApplication"`, `"operatingSystem": "Android, Web"`, `"inLanguage": "it"`, `"isAccessibleForFree": true`, `"sameAs": ["https://github.com/ricky79/sbeggio", "https://web.sbeggio.app/informazioni"]`.

- [ ] **Step 4:** `npx vitest run` → PASS (tutta la suite). `npm run build` → senza errori; il JSON-LD è presente in `dist/index.html`.

- [ ] **Step 5: Commit** — `git commit -am "Autore e licenza nei metadati delle pagine (meta author, JSON-LD)"`

---

### Task 4: Link dal sito e dall'app

**Files:**
- Modify: `src/core/segnalazione.ts` (nuova costante)
- Modify: `web.html` (menu e piè), `informazioni.html` (piè, stessa riga di `web.html`)
- Modify: `src/ui/aiuto.ts` (`schedaContatti`)
- Modify: `src/ui/impostazioni.ts:515` (riga sotto la versione)
- Modify: `src/style.css` (classe `.versione` e link sotto)
- Test: `tests/segnalazione.test.ts`

**Interfaces:**
- Produces: `export const URL_INFORMAZIONI = 'https://web.sbeggio.app/informazioni';` in `src/core/segnalazione.ts`.

- [ ] **Step 1: Test che fallisce** in `tests/segnalazione.test.ts`:

```ts
it('la pagina Informazioni è sul sito pubblico', () => {
  expect(URL_INFORMAZIONI).toBe('https://web.sbeggio.app/informazioni');
});
```

- [ ] **Step 2:** `npx vitest run tests/segnalazione.test.ts` → FAIL (export assente).

- [ ] **Step 3: Implementazione**

- `src/core/segnalazione.ts`: la costante, con commento "pagina pubblica con autore, licenza e privacy".
- `web.html`: nel menu `<a href="/informazioni">Informazioni</a>` dopo Novità; nel piè, prima di "Codice sorgente", "Fatto da Riccardo Oliosi ·" e il link `Informazioni e privacy` → `/informazioni`. Stesso piè in `informazioni.html`.
- `schedaContatti` (`src/ui/aiuto.ts`): sotto i pulsanti, `<p class="nota">` con link `el('a', { href: URL_INFORMAZIONI }, 'Chi ha fatto Sbeggio e come tratta i tuoi dati')`. Link semplice come gli altri dell'aiuto (sull'APK Capacitor apre il browser di sistema).
- `src/ui/impostazioni.ts:515`: la riga diventa `el('p', { class: 'versione' }, \`Sbeggio v${__VERSIONE_APP__} · di Riccardo Oliosi · \`, el('a', { href: URL_INFORMAZIONI }, 'Informazioni e privacy'))`; in `src/style.css` il link in `.versione` eredita il colore ed è sottolineato.

- [ ] **Step 4:** `npx vitest run` → PASS; `npm run typecheck` → nessun errore.

- [ ] **Step 5: Verifica visiva** — `npm run dev`, Chrome headless a 390px: Impostazioni (riga sotto la versione su una o due righe, non tagliata) e Aiuto → Suggerimenti e problemi; `web.html` con il nuovo menu a 390px senza scorrimento orizzontale (il menu ha ora tre voci).

- [ ] **Step 6: Commit** — `git commit -am "Link a Informazioni e privacy da sito, aiuto e impostazioni"`

---

### Task 5: Novità e versione

Segue la convenzione dei rilasci (commit "Versione X.Y.Z: novità (…)" su `develop` dopo il merge).

**Files:**
- Modify: `package.json` (`version` → `2.16.0`), `package-lock.json` (stesso campo, due occorrenze in testa)
- Modify: `src/core/novita.ts` (voce in cima)

- [ ] **Step 1:** voce `{ versione: '2.16.0', data: '<giorno del rilascio>', voci: ['Nuova pagina Informazioni: chi ha fatto Sbeggio, la licenza, i contatti e come vengono trattati i tuoi dati. La trovi in fondo alle impostazioni e su web.sbeggio.app/informazioni.'] }`.
- [ ] **Step 2:** `npx vitest run tests/novita.test.ts` → PASS; `npm run versione:codice` stampa il nuovo versionCode.
- [ ] **Step 3: Commit** — `git commit -am "Versione 2.16.0: novità (pagina Informazioni e privacy)"`
