import { inviaCollegamento, leggiQr, messaggioEsito, messaggioFotocamera, type Collegamento } from '../core/collega';
import { inApp } from '../native/app';
import { store } from '../storage/store';
import { avviso, conferma, toast } from './dialoghi';
import { ErroreFotocamera, scansionaQr } from './scanner';

/** Impostazioni → Collega al computer: inquadra il QR di web.sbeggio.app e manda le timbrature cifrate. */
export async function collegaComputer(): Promise<void> {
  let collegamento: Collegamento | null;
  try {
    collegamento = await scansionaQr((testo) => leggiQr(testo, { sviluppo: import.meta.env.DEV }));
  } catch (e) {
    if (!(e instanceof ErroreFotocamera)) throw e;
    await avviso('Fotocamera non disponibile', messaggioFotocamera(e.motivo, inApp()));
    return;
  }
  if (!collegamento) return;
  if (!(await conferma('Collega al computer', 'Inviare tutte le timbrature al computer?', 'Invia'))) return;
  toast('Invio in corso…');
  let esito;
  try {
    // Sola lettura: l'invio non modifica i dati.
    esito = await inviaCollegamento(collegamento, store.tutto);
  } catch {
    // Cifratura non disponibile (es. iOS prima della 16.4) o altro errore imprevisto: mai in silenzio.
    await avviso('Invio non riuscito', 'Qualcosa non ha funzionato durante l\'invio. Riprova; se succede ancora, aggiorna il sistema del telefono.');
    return;
  }
  if (esito === 'inviato') toast(messaggioEsito(esito));
  else await avviso('Invio non riuscito', messaggioEsito(esito));
}
