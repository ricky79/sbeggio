import {
  CHIUSURA_SCADUTO,
  creaCollegamento,
  decifra,
  DURATA_COLLEGAMENTO_MS,
  INTERVALLO_PING_MS,
  PING,
  type Collegamento,
} from '../core/collega';
import { migra, VERSIONE_CORRENTE, type DatiSalvati } from '../storage/migrazioni';

/**
 * Ciclo di vita del collegamento nella pagina web.sbeggio.app: un QR (id + chiave) per volta, il
 * WebSocket verso il relay, la scadenza dopo 5 minuti, il ping contro i proxy e la ricezione dei dati.
 */
export type StatoSito =
  | { tipo: 'attesa'; collegamento: Collegamento; scadenza: number }
  | { tipo: 'collegato'; dati: DatiSalvati; ricevuti: number }
  | { tipo: 'errore'; motivo: 'connessione' | 'illeggibili' | 'versione' };

/** La parte di WebSocket che usiamo (nei test una presa finta). */
export interface Presa {
  binaryType: BinaryType;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  send(dati: string): void;
  close(): void;
}

export function avviaSessione(
  origine: string,
  apri: (url: string) => Presa,
  alCambio: (s: StatoSito) => void,
): { nuovo(): void } {
  let presa: Presa | null = null;
  let scadenza: ReturnType<typeof setTimeout> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  /** Ferma timer e WebSocket correnti, senza che la loro chiusura arrivi alla sessione. */
  const ferma = () => {
    clearTimeout(scadenza);
    clearInterval(ping);
    if (presa) {
      presa.onmessage = null;
      presa.onclose = null;
      presa.close();
      presa = null;
    }
  };

  const ricevi = async (c: Collegamento, messaggio: ArrayBuffer) => {
    let grezzo: unknown;
    try {
      grezzo = await decifra(messaggio, c);
    } catch {
      return alCambio({ tipo: 'errore', motivo: 'illeggibili' });
    }
    const versione = (grezzo as { version?: unknown } | null)?.version;
    if (typeof versione === 'number' && versione > VERSIONE_CORRENTE) {
      return alCambio({ tipo: 'errore', motivo: 'versione' });
    }
    try {
      alCambio({ tipo: 'collegato', dati: migra(grezzo), ricevuti: Date.now() });
    } catch {
      alCambio({ tipo: 'errore', motivo: 'illeggibili' });
    }
  };

  const nuovo = () => {
    ferma();
    const c = creaCollegamento(origine);
    const p = apri(`${origine.replace(/^http/, 'ws')}/collega/${c.id}`);
    presa = p;
    p.binaryType = 'arraybuffer';
    p.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return; // "pong"
      ferma();
      void ricevi(c, ev.data);
    };
    p.onclose = (ev) => {
      if (ev.code === CHIUSURA_SCADUTO) return nuovo();
      ferma();
      alCambio({ tipo: 'errore', motivo: 'connessione' });
    };
    scadenza = setTimeout(nuovo, DURATA_COLLEGAMENTO_MS);
    ping = setInterval(() => {
      try {
        p.send(PING);
      } catch {
        // WebSocket non ancora aperto: il prossimo ping riprova
      }
    }, INTERVALLO_PING_MS);
    alCambio({ tipo: 'attesa', collegamento: c, scadenza: Date.now() + DURATA_COLLEGAMENTO_MS });
  };

  nuovo();
  return { nuovo };
}
