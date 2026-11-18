# Pagina Informazioni — design

## Perché

Chi cerca "Sbeggio" in rete trova che non risulta il nome dello sviluppatore, né una sezione informativa,
note legali o crediti. Riccardo vuole che il suo nome sia associato all'app. Serve anche, per la
pubblicazione sul Play Store, l'indirizzo pubblico di un'informativa privacy.

## Obiettivi

- Una pagina pubblica `web.sbeggio.app/informazioni`, leggibile **senza JavaScript** (motori di ricerca e
  assistenti AI che non eseguono script), con: autore, perché esiste, licenza e codice, contatti, privacy.
- `sbeggio.app/informazioni` rimanda lì (302), come già fa `/novita`.
- Autore e licenza anche nei metadati di `sbeggio.app` (la PWA, che senza JavaScript è vuota).
- La pagina raggiungibile da sito e app.

## Non obiettivi

- Nessuna riscrittura della pagina Novità in statico (stesso difetto, ma lavoro a parte).
- Nessun testo legale generico: l'informativa descrive solo ciò che l'app fa davvero.
- La scheda del Play Store non si tocca qui: si userà l'indirizzo della pagina quando si pubblica.

## Approcci considerati

1. **Pagina HTML statica scritta a mano** (scelto): `informazioni.html` come terzo ingresso di Vite, testo
   già nel file. Contro: per cambiare il testo si modifica l'HTML.
2. Nuova sezione del sito costruita da JavaScript come `/novita`: coerente, ma invisibile a chi non esegue
   script, quindi non risolve il problema di partenza.
3. Solo una schermata dentro l'app: non pubblica, niente ricerca né Play Store.

## Contenuto

- **Chi l'ha fatta**: Riccardo Oliosi, con link al profilo GitHub `ricky79`. Due righe su perché esiste,
  bozza scritta da Claude su richiesta di Riccardo (da correggere quando vuole):

  > Sbeggio nasce da un'esigenza concreta: sapere a che ora si può uscire dal lavoro senza rifare i conti
  > a mano ogni giorno, tra pause, permessi e giornate in smart working. È un progetto personale, scritto
  > e mantenuto da Riccardo Oliosi, e lo condivido come software libero perché possa servire anche ad altri.
- **Software libero**: GPL-3.0-or-later, link a LICENSE e al codice; nome e logo esclusi dalla licenza
  (come nel README).
- **Contatti**: `supporto@sbeggio.app` (la mail personale non compare).
- **Privacy**, verificata sul codice:
  - niente account, pubblicità, statistiche o tracciamento;
  - timbrature, impostazioni e luogo restano sul dispositivo;
  - la posizione, se permessa, si legge sul dispositivo solo per proporre casa/sede e non viene inviata;
  - avvisi della PWA: a `notifiche.sbeggio.app` arrivano solo il recapito push del browser e l'orario
    dell'avviso, cancellati dopo l'invio; il testo dell'avviso resta nel browser. L'app Android usa
    notifiche locali;
  - trasferimento su web.sbeggio.app: i dati viaggiano cifrati dal telefono al browser, il relay non li
    salva e non può leggerli;
  - l'app Android controlla gli aggiornamenti su GitHub;
  - le mail a supporto@ vengono inoltrate a Riccardo; il messaggio preparato dall'app contiene dati tecnici
    (versione, ecc.) visibili prima dell'invio;
  - tutto è ospitato su Cloudflare.
- Data dell'ultimo aggiornamento della pagina.

## Come (decisioni)

- `informazioni.html` alla radice, stessa testata e piè di pagina di `web.html`, stessi stili
  (`style.css`, `sito.css`), tema dal sistema; nessun manifest PWA; esclusa dalla build Android e dal
  precache del service worker.
- Worker: su `web.sbeggio.app` il percorso `/informazioni` serve la pagina statica invece di `/web`;
  su `sbeggio.app` `/informazioni` → 302 a `https://web.sbeggio.app/informazioni`.
- `index.html` e `web.html`: `<meta name="author" content="Riccardo Oliosi">` e dati strutturati JSON-LD
  (`SoftwareApplication` con autore, licenza, codice).
- Link: piè di pagina e menu del sito, scheda contatti dell'aiuto nell'app, riga sotto la versione nelle
  impostazioni ("Informazioni e privacy").
- Test: Worker (redirect e instradamento), presenza del testo chiave nell'HTML generato.

## Lasciato a chi costruisce

Impaginazione precisa e stili della pagina, purché coerenti con web.sbeggio.app.
