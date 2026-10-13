# Scaricare le timbrature dal computer (web.sbeggio.app) — design

Data: 2026-10-13 · Branch: `feature/web-sbeggio`

## Obiettivo

Sul PC dell'ufficio si apre `https://web.sbeggio.app`, che mostra un QR code. Dall'app Sbeggio (APK
Android o PWA, iPhone compreso) si inquadra il QR: il telefono manda le timbrature al browser, cifrate
da un capo all'altro, e dalla pagina si scaricano in **CSV** o **JSON**, di **un mese a scelta** o
**tutte**. Lo scopo è avere il file direttamente sul PC per compilare il timesheet o il portale
aziendale, senza passare da email o Drive.

Scelte concordate:

- **relay cifrato**: i dati passano da un Durable Object Cloudflare che non può leggerli (la chiave sta
  solo nel QR, dopo il `#`) e non li salva. Niente WebRTC: le reti aziendali spesso bloccano le
  connessioni dirette, un WebSocket su 443 passa;
- **invio unico**: alla scansione il telefono manda tutto una volta; il browser genera da solo le
  quattro varianti (mese/tutto × CSV/JSON) senza tornare a chiedere al telefono;
- **scanner in JavaScript** uguale per APK e PWA (`BarcodeDetector` dove c'è, altrimenti jsQR): su
  iPhone è l'unica strada, perché la fotocamera di sistema aprirebbe Safari, che non vede i dati
  della PWA installata;
- **un mese a scelta** (selettore dei mesi presenti nei dati) più il totale: il timesheet spesso si
  chiude a inizio del mese dopo;
- **JSON "leggibile"**, non il formato del backup: un backup parziale reimportato sostituirebbe tutto e
  cancellerebbe gli altri mesi. Il backup completo resta nell'app;
- **tutto nel repository `sbeggio`** e nello stesso Worker `sbeggio`: la pagina web importa
  direttamente `src/core/csv.ts`, `src/storage/migrazioni.ts` e il calcolo, quindi il CSV del sito è
  per costruzione identico a quello dell'app;
- nessun account né login: il collegamento vale per quella scheda del browser.

Fuori da questa spec: collegamento "vivo" (più richieste dal browser al telefono), invio dal PC al
telefono, scelta di intervalli diversi dal mese, reimportazione del JSON leggibile nell'app, fallback
HTTP per proxy che bloccano i WebSocket (si valuta solo se la prova manuale in ufficio fallisce).

## Flusso

```
PC: web.sbeggio.app ── genera id + chiave AES casuali ──► QR: https://web.sbeggio.app/#1.<id>.<chiave>
     │ WebSocket wss://web.sbeggio.app/collega/<id> (attende)
Telefono: Impostazioni → Collega al computer → inquadra → conferma
     │ gzip(JSON del backup) → AES-GCM → POST https://web.sbeggio.app/collega/<id>
Durable Object "Collegamento" <id>: inoltra i byte al WebSocket del PC, chiude, non salva nulla
PC: decifra → migra() → selettore del mese + 4 download generati nel browser
```

## Protocollo

### Il QR

`https://web.sbeggio.app/#1.<id>.<chiave>`

- `1`: versione del protocollo;
- `<id>`: 16 byte casuali (`crypto.getRandomValues`) in base64url senza padding, 22 caratteri;
- `<chiave>`: chiave AES-256 (32 byte casuali) in base64url senza padding, 43 caratteri.

La chiave sta nel fragment: il browser non la manda mai al server. Se il QR viene inquadrato dalla
fotocamera di sistema, sul telefono si apre la pagina, che riconosce il fragment e mostra solo:
*"Questo codice va inquadrato dall'app Sbeggio: Impostazioni → Collega al computer."*

L'app accetta solo QR con host `web.sbeggio.app` (in sviluppo, `import.meta.env.DEV`, anche
`localhost`): un QR con un altro host non può dirottare l'invio verso un server diverso.

### Il messaggio

Contenuto in chiaro: `gzip(JSON.stringify(store.tutto))`, cioè lo stesso contenuto di *Esporta
backup completo (JSON)*, compresso con `CompressionStream('gzip')`.

Cifratura: AES-GCM con chiave dal QR, IV di 12 byte casuali, dati aggiuntivi autenticati = l'id in
UTF-8 (il messaggio non si può riusare su un altro collegamento).

Corpo della `POST` (binario, `application/octet-stream`): `1 byte versione (1) | 12 byte IV | dati cifrati`.

### Il relay: Durable Object `Collegamento`

Un'istanza per id (`idFromName(id)`), con WebSocket Hibernation API (SQLite-backed, compatibile con il
piano gratuito). Nello storage tiene solo i metadati: scadenza e flag "usato". Mai il messaggio.

| Richiesta | Condizione | Risposta |
|---|---|---|
| `GET` con `Upgrade: websocket` | nessun browser collegato, non usato | `101`; salva la scadenza, alarm a 5 minuti |
| `GET` con `Upgrade: websocket` | c'è già un browser o è già usato | `409` |
| `POST` | già usato | `409` |
| `POST` | nessun browser collegato (mai, chiuso o scaduto) | `404` |
| `POST` | corpo oltre 5 MB | `413` |
| `POST` | altrimenti | inoltra i byte al WebSocket, segna "usato", chiude il WebSocket (1000), `200` |
| alarm | — | chiude il WebSocket con codice `4000` ("scaduto") e cancella lo storage |

La decisione (quale risposta dare dato lo stato) è una funzione pura in `src/collegamento.ts`,
testabile senza runtime Workers; la classe fa solo da involucro.

CORS su `/collega/*` (`POST` e `OPTIONS`): `https://sbeggio.app`, `https://localhost` (origine dell'app
Capacitor) e `http://localhost:5173` (sviluppo).

### Durata e uso singolo

- Il QR vale **5 minuti**: la pagina mostra il conto alla rovescia e, allo scadere (o alla chiusura
  `4000`), genera da sola id e chiave nuovi e un nuovo QR.
- Ogni id si usa **una volta**: dopo la consegna, altri invii ricevono `409`. Un QR fotografato non
  serve più a nulla.

### Cosa vede Cloudflare

Un id casuale, gli orari, la dimensione del messaggio e gli indirizzi IP. Mai il contenuto.

## La pagina `web.sbeggio.app`

Entry Vite separato: `web.html` + `src/sito/` (il nome `src/web/` è già usato per gli avvisi push della
PWA). Riusa i colori e il tema chiaro/scuro dell'app; layout pensato per il PC ma leggibile anche da
telefono. Niente service worker né manifest: è una pagina normale, non un'app installabile.

### Stati

1. **In attesa**: QR grande al centro; sotto i passi *Apri Sbeggio sul telefono → Impostazioni →
   Collega al computer → inquadra il codice*; conto alla rovescia *"Nuovo codice tra 4:12"*.
2. **Collegato**: *"Ricevute 143 giornate alle 09:42"*, poi:
   - **Mese**: selettore con i mesi presenti nei dati (`Ottobre 2026`, …, dal più recente),
     preselezionato sul mese corrente o, se vuoto, sul più recente; pulsanti **CSV** e **JSON**;
   - **Tutto**: pulsanti **CSV** e **JSON**;
   - **Scollega**: cancella i dati dalla memoria e torna allo stato 1 con un nuovo QR.
3. **Errori**:
   - connessione al relay persa o non riuscita: *"Connessione persa"* + **Riprova** (nuovo QR);
   - dati non decifrabili o non validi: *"Dati ricevuti non leggibili"* + **Riprova**;
   - versione dei dati più nuova della pagina (`migra()` rifiuta): *"Ricarica la pagina: l'app è più
     aggiornata del sito"*.
4. **Aperta dalla fotocamera del telefono** (fragment presente): solo il messaggio della sezione *Il QR*.

I dati ricevuti stanno **solo in memoria** (una variabile del modulo): niente localStorage. Chiudendo
la scheda spariscono.

### I file

Nomi: `sbeggio-2026-10.csv`, `sbeggio-2026-10.json`, `sbeggio-tutto-2026-10-13.csv`,
`sbeggio-tutto-2026-10-13.json` (la data è quella del PC). Download con `<a download>` e Blob URL.

**CSV**: `esportaCsv()` di `src/core/csv.ts` sulle giornate filtrate, con le impostazioni ricevute;
stesse colonne e stesso formato (`;`, virgola decimale, BOM UTF-8). La giornata in corso si calcola
con l'ora del PC al momento del download (`oggi` = data e minuti attuali nel fuso Europe/Rome, come
nell'app).

**JSON leggibile** (nuova funzione pura, `src/core/esportazioni.ts`):

```json
{
  "app": "Sbeggio",
  "versioneApp": "2.7.0",
  "generato": "2026-10-13T09:42",
  "periodo": "2026-10",
  "giornate": [
    {
      "data": "2026-10-01",
      "giorno": "Mercoledì",
      "dovutiMinuti": 456,
      "lavoratiMinuti": 470,
      "permessoMinuti": 0,
      "saldoMinuti": 14,
      "stato": "Completa",
      "permessoInizioMinuti": 0,
      "permessoUscitaMinuti": 0,
      "luogo": "sede",
      "ferie": false,
      "eventi": [
        { "ora": "08:31", "tipo": "ENTRATA", "etichetta": "Entrata" }
      ],
      "sigaretteNonConteggiate": [
        { "ora": "10:15", "durataMinuti": 9 }
      ]
    }
  ]
}
```

- `periodo`: `"YYYY-MM"` per il mese, `"tutto"` per il totale;
- le giornate sono le stesse del CSV (`haContenuto`), in ordine di data; valori dal calcolo dell'app
  (`calcolaGiornata`), `stato` con lo stesso testo della colonna *Stato* del CSV;
- `luogo` come nel CSV (assente nei dati = `"sede"`); `sigaretteNonConteggiate` vuoto se non ce ne sono
  (da `SigarettaNonConteggiata`: `minuti` diventa `ora` in `HH:MM`, `durata` diventa `durataMinuti`);
- `versioneApp` è la versione del sito che genera il file.

Sempre in `src/core/esportazioni.ts`: `mesiPresenti(giornate)` (mesi `YYYY-MM` con almeno una giornata
con contenuto, dal più recente) e `giornateDelMese(giornate, mese)`.

## L'app: scansione e invio

### Dove

*Impostazioni → Dati → **Collega al computer***, accanto agli export. In *Aiuto* una voce nuova:
*"Come scarico le timbrature sul computer?"* (`src/ui/aiutoTesti.ts`).

### Scanner (`src/ui/collega.ts`)

- Dialogo a tutto schermo: anteprima della fotocamera posteriore (`getUserMedia({ video: { facingMode:
  'environment' } })`), riquadro di mira, pulsante **Annulla**. Alla chiusura, per qualunque motivo,
  si fermano tutte le tracce della fotocamera.
- Decodifica: `BarcodeDetector` con formato `qr_code` se disponibile (Chrome Android, WebView);
  altrimenti `jsqr`, caricato con `import()` dinamico solo quando serve, su un canvas a ~10 fotogrammi
  al secondo.
- QR non di Sbeggio (forma o host sbagliati): messaggio *"Questo non è un codice di Sbeggio"*, la
  scansione continua.

### Permessi

- **APK**: `<uses-permission android:name="android.permission.CAMERA" />` nel `AndroidManifest.xml`; la
  richiesta a runtime la fa già il `WebChromeClient` di Capacitor. Fotocamera negata: *"Sbeggio non può
  usare la fotocamera: abilitala in Impostazioni di Android → App → Sbeggio → Autorizzazioni."*
- **PWA**: la chiede il browser. Negata: *"Consenti l'uso della fotocamera a Sbeggio nelle impostazioni
  del browser."* Su iPhone, nella PWA installata, iOS può richiederla a ogni apertura.

### Invio

1. QR valido → la fotocamera si spegne → conferma *"Inviare tutte le timbrature al computer?"*
   (**Invia** / **Annulla**).
2. Cifratura e `POST` come nella sezione *Il messaggio*.
3. Esito con un messaggio:
   - `200`: *"Timbrature inviate al computer"*;
   - `404`: *"Codice scaduto: aggiorna la pagina sul computer e riprova"*;
   - `409`: *"Codice già usato: aggiorna la pagina sul computer e riprova"*;
   - `413`: *"Troppi dati da inviare"*;
   - errore di rete: *"Serve la connessione a internet"*;
   - altro: *"Invio non riuscito"* con il codice.

L'invio legge `store.tutto` e non modifica nulla.

### Codice puro (`src/core/collega.ts`)

- `creaCollegamento()`: id e chiave casuali, e l'URL del QR;
- `leggiQr(testo, { sviluppo })`: `{ id, chiave }` o `null` (versione, host, lunghezze);
- `cifra(dati, chiave, id)` / `decifra(messaggio, chiave, id)`: gzip + AES-GCM con il formato del
  messaggio; `decifra` fallisce su chiave, id o versione sbagliati.

Usato sia dall'app sia dal sito.

## Worker e configurazione

### `src/worker.ts`

| Host | Percorso | Cosa fa |
|---|---|---|
| `www.sbeggio.app` | qualunque | redirect 301 a `sbeggio.app` (come oggi) |
| `web.sbeggio.app`, `localhost` | `/collega/<id>` | id non valido (non base64url di 22 caratteri) → `400`; `OPTIONS` → preflight CORS; altrimenti al Durable Object `COLLEGAMENTI` |
| `web.sbeggio.app` | `/` | asset `web.html` |
| `web.sbeggio.app` | altro | asset (i chunk del sito); non trovato → `web.html` |
| `sbeggio.app` | qualunque | asset, invariato |

Il Durable Object è esportato dallo stesso modulo (`export { Collegamento } from './collegamento'`).

### `wrangler.jsonc`

- route `{ "pattern": "web.sbeggio.app", "custom_domain": true }`;
- `durable_objects.bindings`: `{ "name": "COLLEGAMENTI", "class_name": "Collegamento" }`;
- `migrations`: `[{ "tag": "v1", "new_sqlite_classes": ["Collegamento"] }]`.

Il deploy resta quello di `.github/workflows/deploy.yml` (`wrangler deploy`), senza secret nuovi.

### Vite

- multi-pagina: `build.rollupOptions.input = { index: 'index.html', web: 'web.html' }`;
- in `--mode android` solo `index.html`;
- precache del service worker: `web.html` e i chunk usati solo dal sito esclusi
  (`injectManifest.globIgnores`); il chunk di jsqr resta nel precache (lo usa l'app).

### Dipendenze nuove (piccole, senza dipendenze proprie; `qrcode-generator` MIT, `jsqr` Apache-2.0)

- `qrcode-generator`: disegna il QR nella pagina web;
- `jsqr`: decodifica nello scanner dove manca `BarcodeDetector`.

## Compatibilità con le installazioni esistenti

- **Service worker**: `web.sbeggio.app` è un'origine diversa, il service worker di `sbeggio.app` non la
  controlla e la `NavigationRoute` verso `index.html` (`src/sw.ts`) non la tocca.
- **Dati**: localStorage è per origine; il sito non vede né modifica le timbrature. L'invio è in sola
  lettura.
- **Aggiornamento**: la PWA si aggiorna come sempre (`autoUpdate`) e alla riapertura compare *Collega al
  computer*. PWA e APK fino alla 2.6.0 semplicemente non hanno la voce.
- **Precache**: cresce del solo chunk di jsqr (circa 130 KB), scaricato una volta all'aggiornamento.
- **Rete**: `index.html` non ha Content-Security-Policy, quindi la `POST` verso `web.sbeggio.app` non
  è bloccata.
- **Schema dei dati**: il sito passa il messaggio da `migra()`, quindi accetta dati di app più vecchie;
  se l'app è più nuova del sito (solo in sviluppo, perché sito e PWA hanno lo stesso deploy) chiede di
  ricaricare.
- **Punto delicato, il Worker**: ogni richiesta di `sbeggio.app` passa da `src/worker.ts`
  (`run_worker_first: true`). I test devono garantire che per `sbeggio.app` tutto continui ad andare
  agli asset come oggi.

## Test

Vitest, come oggi:

- `tests/collega.test.ts`: `creaCollegamento`/`leggiQr` andata e ritorno; QR con host, versione o
  lunghezze sbagliate → `null`; `localhost` accettato solo in sviluppo; `cifra`/`decifra` andata e
  ritorno (WebCrypto e `CompressionStream` di Node 22); `decifra` fallisce con chiave sbagliata, id
  sbagliato, versione sbagliata o dati alterati;
- `tests/esportazioni.test.ts`: `mesiPresenti` (ordine, giornate vuote escluse); `giornateDelMese`;
  JSON leggibile (campi, minuti, stato uguale al CSV, luogo predefinito, sigarette); il CSV di un mese
  coincide con le righe di quel mese del CSV completo;
- `tests/collegamento.test.ts`: la funzione pura del Durable Object, tutte le righe della tabella;
- `tests/worker.test.ts` (esiste): `sbeggio.app` invariato (`/`, un asset, un percorso qualunque);
  `www` → redirect; `web.sbeggio.app/` → `web.html`; `/collega/<id non valido>` → `400`; `OPTIONS`
  → CORS; `/collega/<id>` → Durable Object (stub).

UI della pagina e del dialogo dello scanner: controllo con Chrome headless, come le altre schermate.

### Prova manuale (prima del rilascio)

- [ ] PC: `web.sbeggio.app` mostra il QR, il conto alla rovescia, e allo scadere un QR nuovo.
- [ ] APK Android: *Collega al computer* chiede il permesso fotocamera, inquadra, conferma, invio
      riuscito; sul PC compaiono le giornate.
- [ ] PWA su iPhone (dalla Home): stessa cosa, con jsqr.
- [ ] PWA su Android (Chrome): stessa cosa.
- [ ] I quattro download si aprono in Excel; il CSV del mese coincide con quello esportato dall'app.
- [ ] Stesso QR inquadrato una seconda volta → *"Codice già usato"*.
- [ ] QR scaduto → *"Codice scaduto"*.
- [ ] Fotocamera negata → messaggio con le istruzioni.
- [ ] QR inquadrato con la fotocamera di sistema → la pagina dice di usare l'app.
- [ ] **PC sulla rete aziendale**: il WebSocket passa dal proxy.

## README e rilascio

- La frase *"i dati restano sul telefono"* diventa *"…salvo quando li mandi tu al computer, cifrati da
  un capo all'altro"*; nuova sezione *Scaricare le timbrature dal computer*; nella parte per
  sviluppatori, il Worker con il Durable Object e il sito `web.html`.
- Versione minore: **2.7.0**.
