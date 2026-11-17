# Ora da tastierino — design

## Perché

Per correggere l'ora di una timbratura oggi si usano due `<select>` (ore, minuti): su Android i minuti sono
un elenco di 60 righe da scorrere. Riccardo vuole scrivere l'ora con il tastierino numerico.

## Obiettivi

- Ore e minuti si scrivono con il tastierino numerico del telefono, sempre in formato 24 ore.
- Vale ovunque si usa `selettoreOra` (`src/ui/campi.ts`): timbrature e pausa sigaretta (`src/ui/editor.ts`),
  orari nelle impostazioni (`src/ui/impostazioni.ts`).
- Correzione veloce dei soli minuti e scrittura di un orario intero di fila (`0847`).

## Non obiettivi

- Nessun tastierino disegnato dall'app, nessun `<input type="time">` (dipende dalle impostazioni regionali).
- Nessun cambio a `campoDurata`.

## Approcci considerati

- A. Campo unico `08:47` con i due punti automatici: veloce per l'orario intero, ma per cambiare i minuti si
  riscrive tutto e i valori sbagliati (`0875`) vanno gestiti.
- **B. Due caselle ore e minuti con tastierino (scelto da Riccardo)**: aspetto invariato `[08] : [47]`, il
  cursore passa da solo ai minuti, si corregge solo la parte che serve.
- C. Tastierino disegnato nell'app: uguale ovunque, ma più lavoro, ingombro e meno naturale.

## Come (decisioni)

- Due `<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off">` al posto
  dei `<select>`, stessi `aria-label`. Interfaccia di `selettoreOra` invariata
  (`elemento`, `leggi`, `imposta`, `abilita`, `onChange`): i chiamanti non cambiano.
- Al tocco il contenuto della casella è tutto selezionato: la prima cifra lo sostituisce.
- Si accettano solo cifre che possono dare un valore valido, quindi un valore fuori misura non esiste mai:
  - ore (massimo `maxOre`, di solito 23): una prima cifra che non può avere una seconda valida (es. `3`–`9`
    con massimo 23) chiude subito come `0d`; dopo `2` si accetta solo `0`–`3`;
  - minuti: prima cifra `6`–`9` chiude subito come `0d`; dopo `0`–`5` qualunque cifra.
- Casella completa → ore passa ai minuti (tutto selezionato), minuti esce dal campo (blur), così il
  tastierino si chiude.
- All'uscita da una casella: una cifra sola diventa `0d`; casella vuota torna al valore di prima.
  `onChange` scatta quando il valore cambia davvero (completamento o uscita), come oggi il `change`.
- La logica delle cifre è una funzione pura in `src/core/` con test unitari; il cablaggio DOM in `campi.ts`.
- Novità: una voce aggiunta alla 2.16.0, non ancora rilasciata (ultimo tag v2.15.1).

## Lasciato a chi costruisce

Stile delle caselle (coerente con i `<select>` di oggi: larghezza, centratura, grassetto); comportamento del
tasto cancella nella casella dei minuti vuota (tornare alle ore è gradito, non richiesto).
