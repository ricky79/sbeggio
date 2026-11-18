# Stile della pausa breve — design

## Perché

La pausa breve oggi è solo "pausa sigaretta": nome, emoji e disegno parlano di fumo anche a chi non fuma.
Riccardo vuole che ognuno scelga lo stile della propria pausa. In questa prima fase tre stili: **base**,
**sigaretta** (come adesso), **birretta**. Più avanti un sondaggio anonimo raccoglierà le richieste di altri
stili (fuori da questo lavoro).

## Obiettivi

- Nuova impostazione: stile della pausa breve, `base` | `sigaretta` | `birretta`.
- Tutta l'app parla dello stile scelto (scelta B di Riccardo): bottone nella schermata Oggi, titolo e testi
  della schermata della pausa, toast al rientro, storico ("🚬 Pausa sigaretta" → emoji e nome dello stile),
  editor della timbratura, testo degli avvisi (notifiche), aiuto, impostazioni, ricerca nelle impostazioni,
  tag NFC.
- La schermata della pausa cambia disegno secondo lo stile:
  - **base**: un anello che si chiude alla fine della tolleranza, con il tempo al centro in numeri
    sottili (lo stile "A2" della bozza di ottobre; scelto da Riccardo il 2026-11-18 confrontando barra e
    anello animati); l'anello cambia colore negli ultimi 30 secondi (ambra) e a tolleranza scaduta
    (rosso), mentre lo sfondo fa quello che fa oggi;
  - **sigaretta**: come oggi, con la sotto-scelta Normale / Elettronica;
  - **birretta**: una pinta con la schiuma; la birra cala fino alla fine della tolleranza; a tolleranza
    scaduta resta il bicchiere vuoto con i segni della schiuma.
- Il suono di fine pausa e le classi `ultimi` / `scaduta` restano uguali per tutti gli stili.

## Legame con il ripensamento di Oggi

Il 2026-10-16 era rimasto aperto il dubbio "pulito contro simpatia" per la schermata della pausa. Questo
lavoro lo scioglie per la pausa breve: chi vuole il pulito sceglie Base (anello), chi vuole la simpatia
sigaretta o birretta. Il nuovo stile della schermata Oggi resta un lavoro separato.

## Non obiettivi

- Il sondaggio e la pagina delle richieste (fase successiva).
- Nessun cambio al funzionamento: uscita, tolleranza, permesso al rientro, avvisi, NFC, storico.
- Nessun cambio a nomi interni e dati salvati (`sigaretta: true` sull'evento, `tolleranzaSigaretta`,
  `sigaretteNonConteggiate`, file `sigaretta*.ts`).
- Esportazioni invariate: il CSV scrive "(sigaretta)" e lo rilegge all'importazione; l'Excel non mostra le
  pause brevi. È un formato di dati, non un testo dell'app.

## Approcci considerati

1. **Una scelta di stile e un solo posto per i testi (scelto)**: modulo con nome, emoji e frasi per stile,
   letto da tutte le schermate; una sola schermata della pausa che sceglie il disegno. Aggiungere uno stile
   = un disegno + una voce di testi.
2. Rinominare codice e dati da "sigaretta" a "pausa breve": migrazione dei dati salvati e molti file
   toccati, nessuna differenza per chi usa l'app.
3. Una schermata per stile: logica di uscita/rientro/tolleranza triplicata.

## Come (decisioni)

- `Impostazioni.pausaBreve: StilePausaBreve` in `src/core/tipi.ts`. Predefinito per chi installa ora:
  `base`. Chi ha già dati salvati senza il campo resta su `sigaretta` (in `src/storage/migrazioni.ts`):
  per loro non cambia niente finché non scelgano.
- `tipoSigaretta` resta e si mostra nelle impostazioni solo con lo stile sigaretta.
- Testi in un modulo puro `src/core/pausaBreve.ts`: per ogni stile nome ("Pausa breve", "Pausa sigaretta",
  "Pausa birretta"), emoji (☕, 🚬, 🍺) e le frasi che oggi dicono "sigaretta"; funzioni che li danno
  dallo stile. Testato.
- Impostazioni: la sezione "Pausa sigaretta" diventa "Pausa breve", con "Stile" (Base / Sigaretta /
  Birretta) e, solo per Sigaretta, "Tipo" (Normale / Elettronica); "Tolleranza" e l'avviso di rientro
  con testi neutri o dello stile.
- Disegni: `creaDisegno` sceglie tra barra (base), sigaretta normale/elettronica, birretta; stessa
  interfaccia `aggiorna(consumata)` di oggi.
- Novità: versione 2.17.0 (la 2.16.0 esce il 2026-11-18). Le note delle versioni passate restano come
  sono (sono storia).
- *Scelta di Claude*: il testo di riserva delle notifiche nel service worker (che non legge le
  impostazioni, `TESTI_GENERICI` in `src/core/avvisiPush.ts`) diventa neutro: "Pausa breve".
- *Scelta di Claude*: "Ripristina impostazioni predefinite" non cambia lo stile della pausa (è un gusto,
  non un'impostazione di lavoro); il testo di conferma non parla più di "tolleranza sigaretta".
- La migrazione verso `sigaretta` per chi ha già dati è un'eccezione alla regola "campo mancante =
  predefinito": ha un test suo.

## Lasciato a chi costruisce

Forma e colori della pinta e dell'anello, coerenti con la schermata scura della pausa; frasi precise dei
testi, purché ogni testo che oggi dice "sigaretta" segua lo stile.
