# Tema di Natale e suoni — design

Data: 2026-10-27 · Branch: `feature/tema-natale-suoni`

## Obiettivo

Dopo Halloween (2.14.0) Sbeggio si veste anche per Natale, e insieme arrivano i **suoni**: oggi l'app è
muta (vibra solo alla lettura del tag NFC). Un suono conferma la timbratura e avvisa quando una pausa
arriva alla fine; nelle feste i suoni diventano a tema, anche per Halloween.

Escono **insieme, in una sola versione** (2.15.0).

Fuori da questa spec: musica di sottofondo, suoni sulle notifiche ad app chiusa, decorazioni di Natale
su schermate diverse da Oggi (oltre al pupazzo nei titoli), un regolatore di volume, suoni diversi
per ogni tipo di timbratura.

## Parte 1 — Tema di Natale

Stessa struttura del tema di Halloween: `src/core/festa.ts`, `src/ui/tema.ts`,
`src/ui/festaDisegni.ts`, `src/style.css` (`:root[data-festa='natale']`), interruttore e ricerca in
Impostazioni → Aspetto.

### Cosa si vede (scelto dall'utente sulle bozze)

- **Colore principale verde abete** (pulsanti, barra di avanzamento, accento). Sfondo chiaro appena
  caldo; nel tema scuro sfondo blu notte. Valori delle bozze, da rifinire per il contrasto (≥ 4,5:1 del
  testo sui pulsanti, come Halloween):

  | | chiaro | scuro |
  |---|---|---|
  | `--sfondo` | `#f4f4f1` | `#070c18` |
  | `--superficie` | (resta `#ffffff`) | `#121a2a` |
  | `--superficie-2` | `#e9ebe6` | `#1d2638` |
  | `--testo-2` | `#66686c` | `#a7afc0` |
  | `--bordo` | (resta) | `rgba(225,235,255,.14)` |
  | `--accento` | `#15803d` | `#4ade80` |
  | `--accento-testo` | `#ffffff` | `#03210e` |
  | `--accento-tenue` | `rgba(21,128,61,.12)` | `rgba(74,222,128,.16)` |

  Il verde dell'accento è vicino a `--positivo`: accettato (succede lo stesso con l'arancione di
  Halloween e `--pausa`).
- **Babbo Natale sulla slitta con due renne** (quella davanti col naso rosso) che passa in alto, come la
  strega ma **da sinistra a destra**, con lo stesso ritmo (un passaggio ogni 40 s, il primo dopo 4 s),
  sopra il titolo e non sui numeri. Elemento SVG vero in `festaDisegni.ts`.
- **Fiocchi di neve**: pochi (4–6), piccoli, cadono lenti nella fascia alta dello schermo, dove a Halloween
  passano i pipistrelli. Grigio-azzurro nel tema chiaro (`#c7d2df`), quasi bianchi nello scuro.
- **⛄ accanto ai titoli** (`.intestazione h1::after`). Non 🎄: l'abete c'è già sulla scheda.
- **Scheda principale di Oggi**: **neve appoggiata sul bordo superiore** (una fascia bianca ondulata che
  sporge un po' sopra la scheda) e un **abetino addobbato** (stella, palline) nell'angolo in alto a
  destra. Entrambi fermi.
- Colore della barra di stato (`COLORE_BARRA_FESTA`) uguale a `--sfondo` del tema.
- Con "riduci movimento" slitta e fiocchi non si vedono (la regola `prefers-reduced-motion` esistente
  ferma le animazioni; la slitta, come la strega, deve restare fuori schermo da ferma).

I disegni di riferimento sono nella bozza `.superpowers/brainstorm/*/content/natale-a-verde-v2.html`
(slitta, neve, abete in SVG): si possono riprendere, adattandoli allo stile di quelli di Halloween.

### Quando

- **Dall'8 dicembre al 6 gennaio compresi** (data di Roma), ogni anno. Decisione mia: dall'Immacolata
  all'Epifania.
- `Festa` diventa `'halloween' | 'natale'`; `festaDelGiorno` gestisce un periodo che scavalca il capodanno.
- **Spegnimento per stagione, non per anno di calendario**: `chiaveFesta` per Natale usa l'anno in cui la
  stagione è iniziata (spento il 20/12/2026 → `natale-2026`, che vale ancora il 2/1/2027; l'8/12/2027 il
  tema torna). Halloween resta com'è (le chiavi già salvate restano valide).
- Fino al 6 gennaio compreso l'utente lo spegne e lo riaccende quante volte vuole; dal 7 gennaio
  spariscono tema e interruttore.
- Interruttore "Tema di Natale ⛄" in Aspetto solo in quei giorni, nota "Fino all'Epifania, poi torna da
  solo il tema normale."; nella ricerca con sinonimi tipo "natale neve renne babbo slitta abete verde".
- Test in `tests/festa.test.ts`: confini 7/12, 8/12, 31/12, 1/1, 6/1, 7/1; chiave della stagione a cavallo
  d'anno; voce di ricerca visibile solo a Natale.

## Parte 2 — Suoni

### Interruttore (deciso dall'utente)

- **Un solo interruttore "Suoni"** in Impostazioni, **spento all'inizio** per tutti (anche per chi
  aggiorna). Decisione mia: sta in Impostazioni → Aspetto, sotto il tema, ed è una preferenza del
  dispositivo come il tema (in `localStorage`, non nel backup, non toccata da "Ripristina valori
  predefiniti"). Trovabile con la ricerca ("suoni audio volume campanelle silenzio").
- Nota sotto l'interruttore: "Si sentono solo con l'app aperta." (testo da rifinire).

### Quando suona (deciso dall'utente)

| Momento | Dove nel codice (indicativo) |
|---|---|
| **Timbratura registrata** | `eseguiAzione` in `src/ui/giorno.ts` e `gestisciTag` in `src/ui/tagNfc.ts`, cioè una timbratura nuova da pulsante o da tag (compresi inizio pausa sigaretta e pausa pranzo). Decisione mia: **non** per modifiche o eliminazioni dall'editor, Annulla, importazioni, ferie. Col tag suona nello stesso punto in cui oggi vibra (solo se la giornata è cambiata davvero). |
| **Fine della pausa sigaretta** | `src/ui/sigaretta.ts`, nel passaggio alla fase `scaduta` mentre la schermata è aperta (stesso momento dello `spegnimento`, `spegnimentoDaAnimare`). Non quando la schermata si apre già scaduta. |
| **Fine della pausa pranzo** | `src/ui/pranzo.ts`, quando `minimaFatta` passa da falso a vero mentre la schermata è aperta (la pausa minima è fatta). Non quando si apre già fatta. |
| **Primo passaggio della festa** | Al primo passaggio della slitta (Natale) o della strega (Halloween) dopo l'apertura dell'app; i passaggi successivi sono muti. Il suono parte quando la figura entra in scena. |

- **Solo ad app aperta** (deciso dall'utente). Le notifiche ad app chiusa tengono il suono normale del
  telefono: niente canali Android con suoni personalizzati.
- **Notifica e suono insieme** (deciso dall'utente sulla mia proposta): mentre la schermata della pausa
  sigaretta o della pausa pranzo è aperta, la notifica di fine di quella pausa non viene mostrata e si
  sente solo il suono dell'app; alla chiusura della schermata, se la pausa è ancora in corso, la notifica
  si riprogramma come oggi. Decisione mia: vale **solo con i suoni accesi**; con i suoni spenti la
  notifica resta com'è, così chi non vuole suoni non perde l'avviso. Tocca la programmazione in
  `src/native/avvisi.ts` (e l'equivalente della PWA, `src/web/avvisi.ts`).
- "Apertura dell'app" per il primo passaggio: avvio dell'app o ritorno in primo piano dopo
  essere stata in background (decisione mia; se il builder trova più naturale solo l'avvio, va bene).
- Se il browser blocca il suono perché l'utente non ha ancora toccato lo schermo (regola dei browser
  sull'autoplay), quel passaggio resta muto e si riprova al passaggio successivo, sempre una volta sola
  (decisione mia). Nessun messaggio d'errore.

### Quali suoni (proposti da me, voci vere confermate dall'utente)

| Momento | Tutto l'anno | Natale | Halloween |
|---|---|---|---|
| Passaggio (solo il primo) | — | campanelle della slitta | risata della strega |
| Timbratura registrata | "ding" breve | campanellino singolo | rintocco di campana cupo e breve |
| Fine pausa sigaretta / pranzo | doppio ding più lungo | campanelle + "oh oh oh!" | ululato di lupo |

- Il set a tema vale solo con il tema della festa **acceso** (`festaAccesa()`); con il tema spento si
  sentono quelli di tutto l'anno.
- Il suono della timbratura deve essere breve (≤ 1 s) per non sovrapporsi a sé stesso con tocchi
  ravvicinati; quello di fine pausa e del passaggio fino a ~3 s.

### Registrazioni

- **Registrazioni vere** (deciso dall'utente), con **licenza CC0** (compatibile con la GPL, vedi
  `THIRD_PARTY_LICENSES.md`), ad esempio da Freesound filtrando per CC0.
- Per ognuna si annota in `THIRD_PARTY_LICENSES.md` titolo, autore, link e licenza (CC0 non lo richiede,
  ma serve a sapere da dove arriva).
- Tagliate, con silenzi iniziali tolti (il suono deve partire subito), volume uniformato tra loro,
  mono, compresse: una decina di file, **in tutto sotto ~400 KB**. Formato leggibile da Chrome
  Android, dalla WebView di Capacitor e da Safari iPhone (MP3 va bene ovunque).
- Vanno nel precache della PWA (oggi `globPatterns` include solo js, css, html, svg, png, webmanifest),
  così si sentono anche offline. L'app Android li ha già dentro il pacchetto.
- **L'utente ascolta i suoni scelti prima del rilascio** e può chiederne di diversi: il builder propone,
  non decide da solo che una risata "va bene". Decisione mia sul come: i suoni si cercano **per primi**,
  in un solo giro per tutti e otto (2 di tutto l'anno, 3 di Natale, 3 di Halloween). Il builder prepara i file già
  tagliati e li fa ascoltare all'utente (pagina con i lettori audio, 2–3 candidati per momento) prima di
  collegarli al codice. Il codice intanto si può scrivere con i file provvisori.
- Se per un momento non si trova una registrazione CC0 accettabile (per esempio un "oh oh oh!"), quel
  momento usa il suono di tutto l'anno e la versione esce lo stesso (decisione mia).

### Volume e silenzioso (decisioni mie)

- Volume: quello dei contenuti multimediali del telefono; nessun regolatore nell'app.
- **App Android**: se il telefono è in silenzioso o in vibrazione, Sbeggio non suona (serve un piccolo
  metodo nativo che legga la modalità della suoneria, ad esempio accanto a `vibra` nel plugin esistente
  o in un plugin nuovo).
- **PWA/sito**: la modalità silenziosa non si può leggere; decide solo l'interruttore. Su iPhone Safari
  può comunque tacere col tasto del silenzioso: va bene così.
- Un suono che non parte (file mancante, audio bloccato) non deve mai bloccare né rallentare la
  timbratura.

## Rilascio

- Una sola versione, **2.15.0**, con le voci in `src/core/novita.ts`: il tema di Natale (dall'8
  dicembre, si spegne da Aspetto) e i suoni (spenti all'inizio, si accendono da Impostazioni → Aspetto →
  Suoni; a Natale e Halloween sono a tema). Testo semplice come le voci precedenti.
- Oggi è il 27 ottobre: se la versione esce dopo il 1° novembre, i suoni di Halloween si sentiranno dal
  prossimo anno. Segnalato all'utente nel brainstorming, che non ha chiesto di uscire prima.

## Altre decisioni mie (dalla revisione)

- Le decorazioni di Natale (slitta, fiocchi) sono globali come la strega e i pipistrelli; neve e abete
  solo sulla scheda principale.
- Con "riduci movimento" la slitta e la strega non si vedono, quindi anche il loro suono di passaggio
  tace.
- "Timbratura registrata" si riconosce dal controllo esistente "la giornata è cambiata davvero",
  compresi i pulsanti Rientro delle schermate sigaretta e pranzo; un solo suono anche quando passa dal
  tag.
- App Android: si può togliere l'obbligo del tocco per l'audio nella WebView
  (`mediaPlaybackRequiresUserGesture` in `MainActivity`); il metodo per la modalità suoneria va in
  `NfcPlugin` accanto a `vibra`.

## Lasciato al builder

- Struttura del codice dei suoni (un modulo tipo `src/ui/suoni.ts` con `suona(momento)` che sceglie il
  set in base alla festa), `HTMLAudioElement` o Web Audio, precaricamento.
- Come agganciare il suono all'ingresso in scena di slitta e strega (eventi dell'animazione CSS o timer
  con gli stessi tempi).
- Forma esatta dei disegni di Natale, purché fedeli alla bozza approvata; ritocchi ai colori per il
  contrasto.
- Test: logica pura (date di Natale, chiave di stagione, scelta del set di suoni, "solo al primo
  passaggio") con vitest; il resto si verifica nell'app.
