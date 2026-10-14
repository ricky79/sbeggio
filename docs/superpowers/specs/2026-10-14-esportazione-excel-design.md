# Esportazione in Excel (.xlsx) — design

Data: 2026-10-14 · Branch: `feature/esportazione-excel`

## Obiettivo

Sul PC aziendale il CSV di Sbeggio non si legge: Excel è in inglese, si aspetta la `,` come
separatore e mette ogni riga intera nella colonna A (il CSV usa `;` e i decimali con la virgola, il
formato dell'Excel italiano). Nessun CSV va bene per entrambe le lingue: `sep=;` funziona, ma con
quella riga Excel ignora il BOM UTF-8 e rompe gli accenti.

Serve un file da **aprire in Excel in qualunque lingua** con, per ogni giorno, le timbrature, l'uscita
prevista e i totali (ore lavorate, straordinario, permesso, ferie).

Scelte concordate:

- **file Excel vero (.xlsx)**, generato a mano senza nuove dipendenze: niente separatori, codifiche o
  decimali che dipendono dalla lingua;
- **ore in `h:mm`**, come vere durate di Excel (sommabili), non decimali;
- **nell'app e sul sito**: Impostazioni → Dati e backup (iPhone/PWA e Android) e web.sbeggio.app;
- **il CSV resta com'è** per reimportare e per il backup; il pulsante perde "(Excel)";
- **niente pause sigaretta** nell'elenco dei permessi (il loro tempo, se oltre la tolleranza, resta
  nelle ore di permesso);
- colonne in più rispetto alla richiesta: Ore dovute, Saldo, Luogo, Note.

Fuori da questa spec: formule in Excel, grafici, cambiamenti al formato del CSV o del JSON,
importazione di file .xlsx.

## Contenuto del file

### Fogli

- Esportazione di un mese: un foglio, chiamato con il mese ("Ottobre 2026").
- "Tutto" (sito) e l'esportazione dall'app: un foglio per mese, dal più vecchio al più recente.
- Ogni foglio: intestazione in grassetto e bloccata (resta visibile scorrendo), una riga per giorno
  in ordine di data, poi una riga vuota e la riga **Totale**.
- Solo i giorni con contenuto (`haContenuto`), come nel CSV e nello Storico.

### Colonne

| # | Colonna | Tipo di cella | Valore |
|---|---|---|---|
| A | Data | data `dd/mm/yyyy` | la data della giornata |
| B | Giorno | testo | `NOMI_GIORNI` ("Martedì") |
| C | Luogo | testo | "Ferie" se giornata di ferie, altrimenti "Smart" o "Sede" |
| D | Entrata | orario `h:mm` | prima `ENTRATA`; vuota se manca |
| E | Inizio pausa | orario | primo `INIZIO_PAUSA` |
| F | Fine pausa | orario | primo `FINE_PAUSA` |
| G | Uscita | orario | `uscitaReale(g)`: ultima `USCITA` o `USCITA_ANTICIPATA` |
| H | Permessi | testo | vedi sotto |
| I | Uscita prevista | orario | come nel riepilogo: per la giornata in corso quella calcolata adesso, per una chiusa quella salvata alla chiusura (`g.uscitaPrevista`); vuota se non nota |
| J | Ore dovute | durata `[h]:mm` | `r.dovuti` |
| K | Ore lavorate | durata | `oreGiorno(r).lavoro`: ordinarie, fino alle dovute |
| L | Straordinario | durata | `oreGiorno(r).straordinario`: blocchi interi da 30 min |
| M | Permesso | durata | `oreGiorno(r).permesso` (a blocchi da 30 min, sigarette comprese) |
| N | Ferie | durata | `r.ferie` |
| O | Saldo | testo | `+0:15`, `−0:30`, `0:00` (segno meno tipografico come nell'app) |
| P | Note | testo | "In corso" per la giornata di oggi non chiusa; i problemi di `r.problemi` uniti da " · " per una giornata da correggere; altrimenti vuota |

`r` è `calcolaGiornata(g, imp, oggi.data === g.data ? oggi.minuti : null)`, `oreGiorno` e
`uscitaReale` vengono da `riepilogo.ts`: i numeri sono per costruzione quelli dello Storico.

Le durate a zero si scrivono come `0:00` (non vuote), così le colonne si leggono e si sommano tutte
uguali. Gli orari mancanti restano celle vuote.

**Permessi (H)**: le voci, separate da " · ", in quest'ordine:

1. permesso a inizio giornata, se `g.permessoInizioMinuti > 0`: `inizio giornata 1:00` (durata
   dichiarata, in `h:mm`);
2. ogni coppia `USCITA_PERMESSO` → `RIENTRO_PERMESSO` **non** sigaretta, in ordine di orario:
   `15:00–15:30`; un'uscita senza rientro: `15:00–`;
3. permesso in uscita pianificato, se `g.permessoUscitaMinuti > 0`: `in uscita 1:00`.

Le uscite in permesso con `sigaretta: true` (e il loro rientro) non compaiono.

**Riga Totale**: A = "Totale"; J–N = somma delle colonne del foglio; O = saldo del mese come nel
riepilogo (`riepilogoMese(...).saldo`, che esclude la giornata in corso non chiusa); le altre vuote.
I totali sono valori calcolati da Sbeggio, non formule: il file si legge corretto anche nelle anteprime
che non ricalcolano.

### Perché il saldo è testo

Excel (sistema di date 1900) mostra `####` per una durata negativa. Il saldo come testo con il segno si
legge sempre; le altre durate sono non negative e restano numeri sommabili.

### Formati di Excel

- Data: numero seriale (giorni dal 30/12/1899) con formato `dd/mm/yyyy`.
- Orario: frazione di giorno (`minuti / 1440`) con formato `h:mm`.
- Durata: frazione di giorno con formato `[h]:mm` (oltre le 24 ore nei totali di "Tutto").
- Larghezze delle colonne fisse, scelte perché ci stiano intestazioni e valori tipici; H e P più
  larghe.

## Architettura

```
src/core/zip.ts     crc32(), zip(file[]) → Uint8Array           (archivio "stored", senza compressione)
src/core/xlsx.ts    cartella(fogli) → Uint8Array               (xlsx generico: celle tipizzate, stili fissi)
src/core/excel.ts   esportaExcel(giornate, imp, oggi) → Uint8Array   (i fogli di Sbeggio)
```

### `zip.ts`

- `crc32(dati: Uint8Array): number` con tabella precalcolata.
- `zip(file: { nome: string; dati: Uint8Array }[]): Uint8Array`: header locali, central directory,
  end of central directory; metodo 0 (stored), nomi UTF-8 (flag bit 11), data/ora DOS fissa. Niente
  ZIP64: un export resta ben sotto i 4 GB.

### `xlsx.ts`

Indipendente da Sbeggio.

```ts
type Cella =
  | null
  | { testo: string }
  | { numero: number }
  | { data: string }        // 'YYYY-MM-DD'
  | { orario: number }      // minuti dalla mezzanotte
  | { durata: number };     // minuti

interface Foglio {
  nome: string;             // ripulito: max 31 caratteri, niente : \ / ? * [ ]
  colonne: number[];        // larghezze
  righe: Cella[][];         // la prima è l'intestazione (grassetto, bloccata)
  grassetto?: number[];     // indici di altre righe in grassetto (la riga Totale)
}

function cartella(fogli: Foglio[]): Uint8Array;
```

- File: `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`,
  `xl/styles.xml`, `xl/worksheets/sheetN.xml`.
- Testo come `inlineStr` (niente sharedStrings), con escape di `& < > " '` e rimozione dei caratteri
  di controllo non ammessi in XML.
- Stili fissi in `styles.xml` (indice = stile): normale, grassetto, data, orario, durata, e le varianti
  in grassetto per la riga Totale.
- Riga d'intestazione bloccata con `<pane ySplit="1" state="frozen"/>`.
- Nomi dei fogli doppi dopo la pulizia: suffisso " (2)".

### `excel.ts`

`esportaExcel(giornate, imp, oggi): Uint8Array` raggruppa le giornate con contenuto per mese
(`'YYYY-MM'`), dal più vecchio, e per ciascuno costruisce un `Foglio` come descritto sopra. Il nome del
foglio usa `nomeMese` (già usato dal sito) con l'iniziale maiuscola. I totali vengono da
`riepilogoMese` per il saldo e dalla somma delle righe per le durate.

`nomeFileExcel`: nell'app `sbeggio-<data>.xlsx`; sul sito lo stesso schema di `nomeFile` con
estensione `xlsx` (si estende il tipo dell'estensione).

### App

- `src/ui/scarica.ts`: `scaricaFile(nome, contenuto: string | Uint8Array, tipo)`.
- `src/ui/dati.ts`: `condividiFile` accetta `string | Uint8Array`; nuovo `esportaExcelCondividi(adesso)`
  con lo stesso avviso "Niente da esportare" del CSV. Tipo MIME
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `src/native/file.ts`: `salvaFile` con contenuto binario lo manda in base64 con
  `codifica: 'base64'`; il testo resta com'è.
- `FilePlugin.java`: se `codifica` è `"base64"` scrive `Base64.decode(contenuto, Base64.DEFAULT)`,
  altrimenti come oggi i byte UTF-8.
- Impostazioni → Dati e backup: "Esporta Excel" prima di tutti, "Esporta CSV" al posto di
  "Esporta CSV (Excel)".

### Sito

`scarica(dati, periodo, formato)` accetta anche `'xlsx'`; i pulsanti diventano **Excel** (primario),
**CSV** e **JSON** (secondari), per il mese e per "Tutto".

### Aiuto

La voce su esportazione e importazione descrive il file Excel (un foglio per mese, timbrature, uscita
prevista, totali) e il CSV come formato per reimportare; la voce del sito cita Excel. La voce delle
Novità e il numero di versione si aggiungono al rilascio.

## Casi limite

- Nessuna giornata con contenuto: avviso "Niente da esportare" (app); sul sito i pulsanti compaiono
  solo se ci sono giornate.
- Giornata con più pause pranzo: nelle colonne la prima; i totali le contano tutte (vengono dal
  calcolo).
- Giornata di ferie senza timbrature: orari vuoti, Luogo "Ferie", Ferie = ore coperte.
- Android, "Salva con nome" annullato o scrittura fallita: come oggi per il CSV.

## Test

- `tests/zip.test.ts`: `crc32` su valori noti (`""` → 0, `"123456789"` → `0xCBF43926`); un piccolo
  lettore di zip "stored" nei test rilegge nomi e contenuti.
- `tests/xlsx.test.ts`: file obbligatori presenti; XML ben formato (i test girano in Node, senza
  `DOMParser`: un piccolo controllo nei test verifica che i tag si aprano e chiudano in ordine); escape di caratteri
  speciali e accenti; celle data/orario/durata come numeri con lo stile giusto; nomi dei fogli
  ripuliti e resi unici; riga bloccata.
- `tests/excel.test.ts`: una giornata tipo produce le colonne attese (entrata, pausa, uscita, permessi
  senza sigarette, uscita prevista); i totali coincidono con `riepilogoMese`; la giornata in corso ha
  "In corso" e non entra nel saldo; più mesi → un foglio per mese in ordine; ferie e giornate da
  correggere.
- Verifica manuale: il file generato aperto con openpyxl (ambiente Python temporaneo, fuori dal
  progetto) per controllare celle, formati e totali; `FilePlugin.java` compilato con `javac` contro
  `android.jar`; la prova finale su Excel aziendale la fa l'utente.
