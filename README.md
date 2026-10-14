# Sbeggio

Web app installabile (PWA) per registrare le timbrature di lavoro da iPhone o Android e sapere
a che ora si può uscire. Funziona offline, non ha backend: **i dati restano sul telefono**
(localStorage del browser), salvo quando li mandi tu al computer con *Collega al computer*, cifrati da un capo all'altro.

App pubblicata: **https://sbeggio.app/**

## Installare l'app

Apri **https://github.com/ricky79/sbeggio/releases/latest/download/sbeggio.apk** dal telefono e segui le istruzioni per il tuo sistema.

### iPhone (Safari)

1. Apri **Safari** (deve essere Safari: le altre app non permettono di installare le PWA
   su iOS) e vai sull'indirizzo qui sopra.
2. Tocca il pulsante **Condividi** (il quadrato con la freccia verso l'alto).
3. Scorri e scegli **Aggiungi alla schermata Home**.
   Su iOS 18 e successivi verifica che **Apri come app web** sia attivo.
4. Conferma il nome "Sbeggio" e tocca **Aggiungi**.
5. Apri l'app dall'icona sulla schermata Home: parte a tutto schermo, senza la barra di Safari.

### Android (Chrome)

1. Apri **Chrome** e vai su `https://sbeggio.app/`.
2. Tocca il menu **⋮** (in alto a destra).
3. Scegli **Installa app** (su alcune versioni la voce è **Aggiungi a schermata Home**,
   poi **Installa**). Se compare in basso il banner "Installa Sbeggio", puoi usare quello.
4. Conferma con **Installa**: l'icona compare nel cassetto delle app e, se vuoi,
   sulla schermata Home.
5. Apri l'app dall'icona: parte a tutto schermo, senza la barra di Chrome.

Altri browser Android: in **Samsung Internet** usa il menu **☰ → Aggiungi pagina a →
Schermata Home** (o l'icona di installazione nella barra dell'indirizzo); in **Firefox**
usa **⋮ → Installa**. Se la voce non compare, ricarica la pagina e riprova.

Dopo la prima apertura l'app funziona anche **senza connessione**. Quando viene pubblicata una
nuova versione, viene scaricata in background e applicata alla successiva apertura.

### Avvisi nella PWA

La PWA ha gli stessi tre avvisi dell'app Android (uscita prevista, rientro dal pranzo, rientro dalla
sigaretta) come **notifiche push**. Si attivano in *Impostazioni → Avvisi → Autorizza gli avvisi*.

- Il browser non può programmare notifiche da solo: a ogni timbratura la PWA invia l'orario
  dell'avviso a un piccolo server (Cloudflare Worker, repository `sbeggio-notifiche`), che allo
  scadere manda la notifica. Al server arrivano solo l'orario e il tipo di ogni avviso e l'indirizzo
  per le notifiche del browser; timbrature e testi restano sul dispositivo.
- Serve internet quando si timbra (senza, l'avviso parte appena si torna online con l'app aperta);
  la notifica arriva con al massimo circa un minuto di ritardo.
- Su iPhone funziona solo con l'app aggiunta alla schermata Home (iOS 16.4 o successivi).
- Funziona su Chrome, Edge, Samsung Internet, Firefox e Safari; l'app Android resta l'unica che
  avvisa anche senza connessione.

### App Android con gli avvisi

Oltre alla PWA esiste un'app Android vera (costruita con [Capacitor](https://capacitorjs.com)
dallo stesso codice) che ricorda le scadenze con **notifiche** anche ad app chiusa:
- **uscita prevista**: quando puoi andare via;
- **rientro dal pranzo**: 30 minuti dopo l'inizio della pausa (durata configurabile);
- **rientro dalla pausa sigaretta**: 2 minuti prima della fine della tolleranza (anticipo configurabile, 0 = allo scadere).

Ogni avviso si attiva o disattiva in *Impostazioni → Avvisi*. Le notifiche sono programmate sul
telefono: nessun server, nessun dato fuori dal dispositivo. Anche la PWA ha gli stessi avvisi, ma
passano da un server (vedi *Avvisi nella PWA*).

#### Scaricare e installare l'APK

**Link diretto all'ultima versione:** [https://github.com/ricky79/sbeggio/releases/latest/download/sbeggio.apk](https://github.com/ricky79/sbeggio/releases/latest/download/sbeggio.apk)
(oppure la pagina [Release](https://github.com/ricky79/sbeggio/releases/latest), file `sbeggio-<versione>.apk`).

1. Apri il link dal telefono Android: il browser scarica `sbeggio.apk`.
2. Apri il file scaricato (dalla notifica del download o dall'app *File*).
3. Android chiede di consentire l'installazione da quella fonte (Chrome, File…): tocca
   **Impostazioni**, attiva **Consenti da questa fonte** e torna indietro.
4. Tocca **Installa**. Se compare un avviso di *Play Protect* ("app sconosciuta"), scegli
   **Installa comunque**: l'app non viene dal Play Store, ma è firmata sempre con la stessa chiave.
5. Apri **Sbeggio** → *Impostazioni → Avvisi* → **Autorizza gli avvisi**: concedi le notifiche e,
   su Android 12+, anche "Sveglie e promemoria" (senza, gli avvisi possono ritardare di qualche minuto).

**Aggiornamenti:** l'APK non si aggiorna da solo. Quando esce una nuova versione l'app mostra un
banner in basso con il pulsante **Scarica**: apri il file scaricato e installalo sopra, i dati restano.
Se hai chiuso il banner (ricompare con la versione successiva), scarica di nuovo dallo stesso link. Il
numero di versione installato è in fondo alle *Impostazioni*.

L'app chiede a GitHub l'ultima release (`api.github.com/repos/ricky79/sbeggio/releases/latest`)
all'avvio e quando torna in primo piano, al massimo ogni 6 ore (`src/ui/aggiornamento.ts`). Conta solo
una release che ha già `sbeggio.apk` allegato.

**Dalla PWA all'app:** i dati sono separati. Nella PWA fai *Impostazioni → Esporta backup completo
(JSON)*, poi nell'app *Impostazioni → Importa CSV o backup JSON…*.

**Se l'installazione fallisce** ("App non installata"): di solito c'è già una versione firmata con
un'altra chiave (per esempio una build di prova). Fai il backup JSON, disinstalla Sbeggio e reinstalla.

### Attenzione ai dati

- **iPhone**: i dati dell'app installata sono separati da quelli di Safari, quindi usa sempre
  l'icona sulla Home. Se elimini l'app dalla schermata Home, iOS cancella anche i suoi dati.
- **Android**: l'app installata condivide i dati con il sito aperto in Chrome. Se cancelli i
  dati di navigazione o i "dati del sito" di Chrome, o disinstalli l'app, perdi le timbrature.
- L'app chiede al sistema la memoria persistente (`navigator.storage.persist()`), ma
  conviene comunque fare ogni tanto un **backup**: *Impostazioni → Esporta backup completo (JSON)*
  e salvalo in File/iCloud (iPhone) o in Drive/File (Android). Per ripristinarlo: *Impostazioni → Importa CSV o backup JSON…*.

## Come si usa

- **Oggi**: il bottone grande propone l'azione più probabile
  (Entrata → Inizio pausa pranzo → Fine pausa pranzo → Uscita). Sotto trovi le azioni secondarie:
  *Pausa sigaretta*, *Esco in permesso*, *Rientro da permesso*, *Uscita anticipata*, *Entro dopo*
  (permesso a inizio giornata). In alto vedi l'**uscita prevista**, le ore coperte, il saldo e la
  durata della **pausa pranzo** (con quella fatta davvero, se è più corta della pausa minima, o
  "non registrata" se è obbligatoria e l'hai saltata).
- **Pausa sigaretta**: registra un'uscita e apre una schermata con il conto alla rovescia e una
  sigaretta che si consuma (normale o elettronica, a scelta). Negli ultimi 30 secondi lo schermo
  lampeggia di rosso; allo scadere la sigaretta finisce nel posacenere e lo sfondo resta rosso.
  Se rientri entro la tolleranza (11 min, configurabile) la pausa non conta nelle ore ma resta tra
  le timbrature come «🚬 Pausa sigaretta» con la durata e «non conteggiata»: si può modificare,
  eliminare o aggiungere a mano (in «Aggiungi timbratura») e non entra mai nel calcolo;
  altrimenti diventa permesso a blocchi di 30 min.
- **Tag NFC (solo app Android)**: avvicinando il telefono sbloccato a un tag NFC con scritto
  `sbeggio://timbra` (per esempio vicino ai tornelli) Sbeggio si apre e registra l'azione del bottone
  grande; dopo la fascia pranzo, senza pausa registrata, chiede se è *Inizio pausa pranzo* o *Uscita*. Il
  messaggio ha *Annulla* per 5 secondi. Il tag si prepara una volta con un'app come NFC Tools (record
  "URL / URI personalizzato") e, se sta in un posto pubblico, si blocca in sola lettura: vedi *Aiuto →
  Come preparo un tag NFC per Sbeggio?*.
- **Permesso in uscita**: se sai già che uscirai prima, tocca *+ Permesso in uscita* e indica la
  durata: l'uscita prevista si anticipa. Quando esci usa *Uscita*: conta il permesso che manca
  davvero, a blocchi di 30 min.
- **Pausa dimenticata**: passata la fascia pranzo senza pausa registrata, in *Oggi* compare un
  riquadro che propone di aggiungerla (30 min, 12:15–12:45).
- Tocca una timbratura nella timeline per **modificarla o eliminarla**. Con
  *+ Aggiungi timbratura* puoi inserirne una a mano, per esempio se l'hai dimenticata.
- **Ferie**: un giorno libero si segna dalla giornata ("🏖️ In ferie questo giorno", se non hai
  ancora timbrato); più giorni, anche futuri, dallo Storico con *🏖️ Ferie* (Dal/Al, propone la
  prossima settimana da lunedì a venerdì; salta i giorni senza ore dovute e quelli già timbrati).
  Un giorno di ferie copre le ore dovute (saldo zero), Oggi mostra 🏖️ al posto dei bottoni e il
  riepilogo del mese conta giorni e ore di ferie. Il CSV ha la colonna *Ferie*.
- **Casa o ufficio**: in alto a destra della giornata un controllo con 🏠 (da casa, smart working) e
  🏢 (in sede, il predefinito). Si può cambiare anche per i giorni passati; non cambia il
  calcolo delle ore. Nello Storico i giorni da casa hanno 🏠 e il riepilogo conta i giorni
  da casa e in sede del mese. Il CSV ha la colonna *Luogo* (Sede/Smart).
  Con *Impostazioni → Sede di lavoro* salvi la posizione dell'ufficio: all'apertura, se per oggi
  non hai ancora scelto, l'app legge la posizione e propone 🏢 entro 300 m dall'ufficio e 🏠
  altrove ("📍 dalla posizione"); finché non timbri la posizione si rilegge a ogni apertura (aperta
  a casa e poi in ufficio, la proposta passa a 🏢), alla prima timbratura diventa definitiva e una
  scelta fatta a mano vale sempre. La posizione si legge solo ad app aperta e non lascia il
  telefono (nell'app Android servono i permessi di posizione).
- **Storico**: per ogni giorno del mese, tre voci ben separate: **Lavoro**, **Straordinario** e
  **Permesso** (un trattino significa zero). Lo straordinario e il permesso sono a blocchi da
  30 minuti: 20 minuti di extra non contano, 50 minuti valgono 30. Se mancano ore compare
  "Mancano …". In alto il riepilogo del mese somma le tre voci e mostra il saldo esatto, senza
  arrotondamenti. Con *+ Giornata dimenticata* inserisci un giorno passato. Sotto ogni giorno
  chiuso c'è "Uscita 17:40 · prevista 17:25": l'uscita prevista è salvata alla chiusura (campo
  `uscitaPrevista`, anche nel backup e nella colonna *Uscita prevista* del CSV); per i giorni che
  non la hanno (dati di prima, backup, CSV) si calcola dalle timbrature all'apertura o all'import.
- **Impostazioni**: ore dovute (anche diverse per giorno della settimana), fascia pranzo,
  pausa da scalare, pausa minima, orario di inizio conteggio, tolleranza e tipo della pausa sigaretta, export e import dei dati.
- **Aiuto**: risposte ai dubbi più comuni (per esempio la differenza tra *Esco in permesso*
  e *Uscita anticipata*), con ricerca. I link **?** nelle schermate aprono direttamente
  la risposta che riguarda quel punto. Gli esempi usano le tue impostazioni correnti.
  In fondo, *Invia un suggerimento* e *Segnala un problema* aprono l'app di posta con un
  messaggio già pronto per supporto@sbeggio.app (la segnalazione include versione, dispositivo e
  impostazioni, mai le timbrature).

## Regole di calcolo

| Regola | Default |
|---|---|
| Ore dovute | 8h lun–ven, 0 sab–dom (configurabili per giorno) |
| Ore coperte | ore lavorate + ore di permesso |
| Saldo | coperte − dovute |
| Uscita prevista (al lavoro) | adesso + (dovute − coperte); se la pausa è obbligatoria, non è ancora fatta e l'uscita cade dopo la fascia pranzo, si aggiunge la pausa minima (a qualunque ora) |
| Timbrature prima delle 08:30 | contano come 08:30 (in tutti i calcoli) |
| Pausa più breve di 30 min | conta come 30 min (in tutti i calcoli) |
| Pausa pranzo | non conta come coperta |
| Pausa pranzo obbligatoria | con almeno 6h **dovute** (da Impostazioni, prima dei permessi: decisione del 2026-10-09, rivedibile); niente "No, l'ho saltata"; se esci dopo la fascia pranzo senza averla registrata si scala la pausa minima ("non registrata"), dalle giornate del 2026-10-12 in poi |
| Permesso a metà giornata | conta come coperto |
| Pausa sigaretta | entro la tolleranza (11 min) non conta e resta tra le timbrature come "non conteggiata"; oltre vale permesso a blocchi di 30 min (15 min → 30 min, 42 min → 1h), le ore coperte non cambiano e non diventa mai pausa pranzo |
| Uscita anticipata | le ore mancanti diventano permesso, a blocchi di 30 min (saldo 0) |
| Permessi | ogni permesso vale un multiplo di 30 min (1h23 → 1h30); i minuti in più non contano come lavorate, il saldo non cambia |
| Permesso in uscita pianificato | anticipa l'uscita prevista; all'uscita conta il permesso che manca davvero, a blocchi di 30 min |
| Permesso che copre la fascia pranzo (12:15–14:30) senza pausa registrata | fino a 30 min diventano pausa (configurabile); al rientro l'app mostra la ripartizione proposta (es. "30 min pausa + 2h permesso"), che puoi modificare prima di confermare |

Se la sequenza degli eventi è incoerente (per esempio *Fine pausa pranzo* senza *Inizio pausa pranzo*),
l'app non va in crash: segnala la giornata come **da correggere**, spiega il problema
e calcola i totali ignorando gli eventi incoerenti.

## Scaricare le timbrature dal computer

1. Sul computer apri **https://web.sbeggio.app**: compare un codice QR (vale 5 minuti, poi se ne genera uno nuovo).
2. Sul telefono: *Impostazioni → Collega al computer…*, inquadra il codice e conferma con **Invia**.
3. Sul computer scegli il mese e scarica **CSV** (lo stesso dell'app) o **JSON**, oppure scarica tutto.

Le timbrature viaggiano cifrate (AES-GCM) con una chiave che sta solo nel QR: il relay su Cloudflare che le
passa al browser non può leggerle e non le salva. Ogni codice si usa una volta; chiudendo la pagina i dati
spariscono dal computer. Il JSON del sito è "leggibile" (ore in minuti, timbrature con orario e tipo) e non si
reimporta nell'app: per il backup completo usa *Esporta backup completo (JSON)* nell'app.

## Export CSV

Il CSV usa `;` come separatore e la virgola per i decimali, con BOM UTF-8: si apre
direttamente con Excel in italiano. Contiene una riga per giorno (ore dovute, lavorate,
permesso, saldo in ore decimali, i permessi a inizio giornata e in uscita e l'elenco delle timbrature). Su iPhone e Android si apre il foglio
di condivisione (Mail, File, Drive, WhatsApp…); dove la condivisione non è disponibile il file
viene scaricato. Lo stesso CSV si può reimportare: le giornate presenti vengono
sovrascritte, le impostazioni restano invariate.

## Sviluppo

Richiede Node.js 22.

```bash
npm install
npm run dev        # server di sviluppo
npm test           # test Vitest del modulo di calcolo
npm run build      # typecheck + build statica in dist/
npm run preview    # anteprima della build
npm run icone      # rigenera le icone PNG di PWA e app Android dal logo SVG in scripts/logo/
```

Struttura:

```
src/core/      logica pura, senza DOM: tipi, macchina a stati, calcolo, riepilogo, CSV
src/storage/   localStorage, schema versionato e migrazioni
src/native/    avvisi dell'app Android (notifiche locali con Capacitor)
src/web/       avvisi della PWA (iscrizione push e chiamate al backend)
src/sw.ts      service worker della PWA: app offline e notifiche push
src/ui/        viste (Oggi/giornata, Storico, Impostazioni, Aiuto), dialoghi, editor
               (i testi dell'aiuto sono in src/ui/aiutoTesti.ts)
tests/         test Vitest
```

### Avvisi della PWA (sviluppo)

URL del backend e chiave pubblica VAPID sono costanti in `src/core/avvisiPush.ts` (`URL_NOTIFICHE`,
`CHIAVE_VAPID`), insieme alla logica pura (operazioni verso il backend, testo della notifica), con test.
Se il backend cambia la coppia di chiavi, la chiave va aggiornata qui: le iscrizioni fatte con quella
vecchia vengono annullate e in *Impostazioni → Avvisi* ricompare il pulsante per riattivare gli avvisi.
Se il browser rinnova da solo l'iscrizione push, il service worker riprogramma gli avvisi in sospeso. Il service worker è scritto a mano (`src/sw.ts`, strategia
`injectManifest` di vite-plugin-pwa) e si controlla con `tsconfig.sw.json`.

Con `npm run dev` il service worker non c'è e gli avvisi risultano "non disponibili". Per provarli:

```bash
npm run build
npx vite preview --port 5173   # il backend accetta richieste solo da questa porta e dal sito pubblicato
```

Poi apri `http://localhost:5173/`, autorizza gli avvisi e timbra. In Chrome, DevTools →
Application → Service workers → *Push* simula un push senza passare dal backend.

### Deploy su Cloudflare

La PWA è un Worker Cloudflare (`wrangler.jsonc`, nome `sbeggio`) che serve i file statici su
`https://sbeggio.app`; `src/worker.ts` rimanda `www.sbeggio.app` alla radice con un 301. I due domini
sono *custom domain* del Worker: i loro record DNS li crea il deploy, non vanno aggiunti a mano. Il workflow `.github/workflows/deploy.yml` esegue test e build a ogni PR e,
a ogni push su `main`, pubblica `dist/` con `wrangler deploy`.

Lo stesso Worker serve anche `https://web.sbeggio.app` (custom domain): la pagina `web.html` (sorgenti in
`src/sito/`) e il relay `/collega/<id>`, un Durable Object `Collegamento` (`src/collegamento.ts`, migrazione `v1`
in `wrangler.jsonc`) che tiene il WebSocket del browser e gli inoltra una volta il messaggio cifrato dall'app.
Per provarlo in locale: `npm run build && npx wrangler@4.147.0 dev --port 8787 --local-upstream web.sbeggio.app`
(senza `--local-upstream` wrangler presenta ogni richiesta come `sbeggio.app`, cioè la PWA); la pagina è su
`http://localhost:8787/`, le prove automatiche sono in `tests/collegamento.e2e.test.ts` (vedi il commento in testa).

Va configurato una volta sola:

1. Su Cloudflare apri **My Profile → API Tokens → Create Token** e usa il modello
   **Edit Cloudflare Workers** (account e zona `sbeggio.app`).
2. Su GitHub salvalo nel secret `CLOUDFLARE_API_TOKEN` (**Settings → Secrets and variables → Actions**).

A mano: `npm run build && npx wrangler deploy`. Il `base` in `vite.config.ts` è `/`: il sito è servito
dalla radice del dominio.

### Posta di supporto (risposta automatica)

Il Worker `sbeggio` riceve anche la posta di **supporto@sbeggio.app** (`src/email.ts`): inoltra ogni
mail all'indirizzo del secret `INOLTRO` e risponde a chi scrive con "grazie della segnalazione, le
risponderemo prima possibile". Non risponde a risponditori automatici, mailing list, bounce e
indirizzi `noreply` (niente risposte a ping-pong). Se la risposta non può partire (es. il mittente
non supera i controlli DMARC) la mail viene comunque inoltrata.

Configurazione, una volta sola (dopo il deploy del Worker con il gestore email):

1. **Secret dell'inoltro**: in Cloudflare apri *Workers & Pages → sbeggio → Settings → Variables and
   Secrets → Add*, tipo **Secret**, nome `INOLTRO`, valore il tuo indirizzo (lo stesso già verificato
   in Email Routing). In alternativa: `npx wrangler secret put INOLTRO`. Non va nel repository.
2. **Regola di instradamento**: in *sbeggio.app → Email → Email Routing → Routing rules* modifica la
   regola di `supporto@sbeggio.app`: azione **Send to a Worker**, Worker **sbeggio** (al posto di
   *Send to an email*).
3. Prova scrivendo a supporto@sbeggio.app da un altro indirizzo: arrivano l'inoltro e la risposta.

Senza il secret `INOLTRO` il Worker rifiuta la mail (chi scrive riceve un errore di consegna) invece di
perderla. Il testo della risposta è `TESTO_RISPOSTA` in `src/email.ts`.

### App Android

L'app (cartella `android/`) racchiude la build web in un contenitore Android. Il codice è lo stesso
della PWA: la parte nativa è `src/native/` (notifiche e tag NFC), `capacitor.config.ts` e il plugin
`NfcPlugin.java` (vedi *Tag NFC*).

```bash
npm run build:android   # build web per Android (base './', senza service worker) + cap sync
npm run android:apri    # come sopra e apre Android Studio
```

Serve Android Studio (JDK 21 e SDK Android). Dopo ogni modifica al codice web esegui di nuovo
`npm run build:android`. Gli avvisi si calcolano in `src/core/avvisi.ts` (funzione pura, con test);
`src/native/avvisi.ts` li programma con il plugin `@capacitor/local-notifications`.

**APK in automatico:** il workflow `.github/workflows/android.yml` costruisce l'APK quando
`rilascio.yml` lo richiama per una nuova versione (vedi *Rilascio*), oppure a ogni push di un tag di
versione creato a mano (`git tag v1.8.0 && git push origin v1.8.0`). Lo allega alla release come
`sbeggio-<versione>.apk` e come `sbeggio.apk`, il nome fisso usato dal link di download permanente, e
lo salva anche come artefatto del workflow.

**Firma dell'APK:** perché ogni versione si installi sopra la precedente, l'APK va firmato sempre con
la stessa chiave. La chiave non sta nel repository ma in due *secret* (Settings → Secrets and
variables → Actions): `KRUMIRO_KEYSTORE_BASE64` (il keystore `.jks` codificato in base64) e
`KRUMIRO_KEYSTORE_PASSWORD`; l'alias è `krumiro`. Con i secret il workflow costruisce e firma la
release; senza, ripiega su una chiave di debug che cambia a ogni esecuzione (avviso nel log), e quegli
APK non si aggiornano uno sopra l'altro. Per creare una chiave nuova:

```bash
keytool -genkeypair -keystore sbeggio-firma.jks -storetype PKCS12 -alias krumiro \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Sbeggio, C=IT"
base64 -w0 sbeggio-firma.jks   # valore del secret KRUMIRO_KEYSTORE_BASE64
```

Conserva keystore e password fuori dal repository (sono già esclusi da `.gitignore`): se li perdi,
le nuove versioni non si installano sopra quelle esistenti. La stessa chiave serve anche per il
Play Store. Il numero di versione viene da
`package.json`. L'`appId` (`app.sbeggio`) non si può più cambiare dopo la
pubblicazione. Icone e schermata di avvio sono le stesse della PWA: `npm run icone` le rigenera tutte
(PWA e Android) da `scripts/genera-icone.mjs`.

### Rilascio

Ogni PR approvata su `main` è un rilascio:

1. Nella PR verso `main` (di solito da `develop`) aggiorna la versione e fai il commit:
   `npm version patch --no-git-tag-version` per le correzioni, `minor` per le novità, `major` per i
   cambiamenti incompatibili. Il controllo **Versione** (`.github/workflows/versione.yml`) fallisce se
   la versione non è più alta dell'ultimo tag.
2. Nello stesso commit aggiungi in cima a `src/core/novita.ts` le novità della versione: versione, data e
   2–3 frasi brevi per chi usa l'app. Un test fallisce se la versione di `package.json` non ha la sua voce.
   Da lì nascono il foglio "Novità" che l'app mostra una volta dopo l'aggiornamento, *Aiuto → Novità*, la
   pagina [web.sbeggio.app/novita](https://web.sbeggio.app/novita) (anche da sbeggio.app/novita) e le note
   della release su GitHub.
3. Approvando la PR, `deploy.yml` pubblica la PWA e `rilascio.yml` crea il tag `v<versione>` con la
   release (prima le novità, poi l'elenco delle PR generato da GitHub) e ci allega l'APK costruito da
   `android.yml`: PWA e APK escono insieme, con la stessa versione.

Se la versione ha già un tag (per esempio un push su `main` senza aggiornarla), `rilascio.yml` non
pubblica nulla. Il versionCode di Android deriva dalla versione: major × 10000 + minor × 100 + patch
(1.8.0 → 10800, `scripts/versione.ts`), quindi minor e patch devono restare sotto 100. Per rendere il
controllo obbligatorio: Settings → Branches → regola di `main` → *Require status checks to pass* →
`controlla`.

### Tag NFC

Nell'app Android un tag NFC con il solo URI `sbeggio://timbra` registra l'azione del bottone principale
di *Oggi*, anche ad app chiusa. Il formato è definitivo: i tag ai tornelli vengono bloccati in sola
lettura e non si possono più cambiare. Niente Android Application Record: su un telefono senza
Sbeggio aprirebbe il Play Store.

- `android/app/src/main/AndroidManifest.xml`: filtro `NDEF_DISCOVERED` con schema `sbeggio` e host
  `timbra` su `MainActivity` (`singleTask`), permessi `NFC` e `VIBRATE`, `android.hardware.nfc` non
  obbligatorio.
- `NfcPlugin.java` (plugin Capacitor locale `Nfc`, registrato in `MainActivity`): trasforma l'intent
  del tag nell'evento `tag`, trattenuto finché il JavaScript non ascolta (avvio a freddo) e ignorato
  se l'app è riaperta dalle recenti; metodi `stato()`, `apriImpostazioniNfc()`, `vibra()`.
  `MainActivity` non riconsegna il tag quando Android ricrea l'activity.
- `src/core/tagNfc.ts` (puro, con test): quale azione registrare (dopo la fascia pranzo senza pausa
  chiede *Inizio pausa pranzo* o *Uscita*) e quando ignorare la lettura (entro un minuto da una timbratura
  col tag, con una finestra aperta, a giornata chiusa).
- `src/ui/tagNfc.ts`: esegue l'azione come il tocco, con *Annulla* nel messaggio per 5 secondi.

La prova manuale (l'NFC non si emula) è nella checklist di
`docs/superpowers/specs/2026-10-06-tag-nfc-design.md`.

### Schema dei dati

I dati sono salvati nella chiave `timbrature` di localStorage, con un campo `version`.
Se lo schema cambia, aggiungi un passo in `MIGRAZIONI` (`src/storage/migrazioni.ts`)
e incrementa `VERSIONE_CORRENTE`. Se i dati salvati non sono leggibili, l'app ne conserva
una copia in una chiave `timbrature-corrotto-<timestamp>` e riparte da zero.

## Licenza

Copyright (C) 2026 Riccardo Oliosi

Sbeggio è software libero: puoi ridistribuirlo e modificarlo secondo i termini della
[GNU General Public License](LICENSE) pubblicata dalla Free Software Foundation, versione 3 o (a tua
scelta) qualunque versione successiva. È distribuito sperando che sia utile, ma **senza alcuna garanzia**,
nemmeno quella implicita di commerciabilità o di idoneità a uno scopo particolare: i dettagli sono nella
licenza.

Chi ridistribuisce l'app, anche modificata, deve farlo con la stessa licenza e rendere disponibile il
codice sorgente.

Il nome **Sbeggio** e il logo non sono coperti dalla licenza: una versione modificata va pubblicata con un
altro nome e un altro logo.
