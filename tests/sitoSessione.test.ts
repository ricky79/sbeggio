import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cifra, creaCollegamento, DURATA_COLLEGAMENTO_MS, INTERVALLO_PING_MS, type Collegamento } from '../src/core/collega';
import { datiVuoti } from '../src/storage/migrazioni';
import { avviaSessione, type Presa, type StatoSito } from '../src/sito/sessione';

interface PresaFinta extends Presa {
  url: string;
  send: Mock<(dati: string) => void>;
  close: Mock<() => void>;
}

function prova(origine = 'https://web.sbeggio.app') {
  const prese: PresaFinta[] = [];
  const stati: StatoSito[] = [];
  const sessione = avviaSessione(
    origine,
    (url) => {
      const p: PresaFinta = { url, binaryType: 'blob', onmessage: null, onclose: null, send: vi.fn<(dati: string) => void>(), close: vi.fn<() => void>() };
      prese.push(p);
      return p;
    },
    (s) => stati.push(s),
  );
  const ultima = () => prese[prese.length - 1]!;
  const stato = () => stati[stati.length - 1]!;
  const collegamento = () => (stato() as Extract<StatoSito, { tipo: 'attesa' }>).collegamento;
  const ricevi = async (dati: unknown, c: Collegamento = collegamento()) => {
    const p = ultima();
    p.onmessage?.({ data: (await cifra(dati, c)).buffer } as MessageEvent);
  };
  /** Attende la decifratura (asincrona) del messaggio ricevuto. */
  const finché = (tipo: StatoSito['tipo']) => vi.waitFor(() => expect(stato().tipo).toBe(tipo));
  return { sessione, prese, stati, ultima, stato, collegamento, ricevi, finché };
}

beforeEach(() => {
  // Solo i timer della sessione: i flussi di compressione di Node devono restare veri.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date('2026-10-13T07:42:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('sessione del sito', () => {
  it('apre il WebSocket del collegamento e mostra il QR con la scadenza', () => {
    const t = prova();
    expect(t.prese).toHaveLength(1);
    expect(t.ultima().binaryType).toBe('arraybuffer');
    const s = t.stato();
    expect(s.tipo).toBe('attesa');
    if (s.tipo !== 'attesa') return;
    expect(t.ultima().url).toBe(`wss://web.sbeggio.app/collega/${s.collegamento.id}`);
    expect(s.scadenza).toBe(Date.now() + DURATA_COLLEGAMENTO_MS);
  });

  it('in locale usa ws://', () => {
    const t = prova('http://localhost:8787');
    expect(t.ultima().url).toMatch(/^ws:\/\/localhost:8787\/collega\//);
  });

  it('riceve, decifra e migra i dati, poi chiude il WebSocket', async () => {
    const t = prova();
    const dati = datiVuoti();
    await t.ricevi(dati);
    await t.finché('collegato');
    const s = t.stato();
    expect(s.tipo === 'collegato' && s.dati).toEqual(dati);
    expect(t.ultima().close).toHaveBeenCalled();
    // Dopo la ricezione la scadenza non genera un nuovo QR.
    vi.advanceTimersByTime(DURATA_COLLEGAMENTO_MS * 2);
    expect(t.prese).toHaveLength(1);
  });

  it('dati cifrati con un\'altra chiave o non validi: errore "illeggibili"', async () => {
    const a = prova();
    await a.ricevi(datiVuoti(), creaCollegamento());
    await a.finché('errore');
    expect(a.stato()).toEqual({ tipo: 'errore', motivo: 'illeggibili' });

    const b = prova();
    await b.ricevi('ciao');
    await b.finché('errore');
    expect(b.stato()).toEqual({ tipo: 'errore', motivo: 'illeggibili' });
  });

  it('dati di un\'app più nuova: errore "versione"', async () => {
    const t = prova();
    await t.ricevi({ ...datiVuoti(), version: 99 });
    await t.finché('errore');
    expect(t.stato()).toEqual({ tipo: 'errore', motivo: 'versione' });
  });

  it('chiusura 4000 dal relay (scaduto): nuovo QR', () => {
    const t = prova();
    const primo = t.collegamento();
    t.ultima().onclose?.({ code: 4000 } as CloseEvent);
    expect(t.prese).toHaveLength(2);
    expect(t.collegamento().id).not.toBe(primo.id);
  });

  it('connessione persa: errore e niente più timer', () => {
    const t = prova();
    t.ultima().onclose?.({ code: 1006 } as CloseEvent);
    expect(t.stato()).toEqual({ tipo: 'errore', motivo: 'connessione' });
    vi.advanceTimersByTime(DURATA_COLLEGAMENTO_MS * 2);
    expect(t.prese).toHaveLength(1);
    expect(t.ultima().send).not.toHaveBeenCalled();
  });

  it('allo scadere genera da sola un nuovo QR e chiude il vecchio WebSocket', () => {
    const t = prova();
    const vecchia = t.ultima();
    vi.advanceTimersByTime(DURATA_COLLEGAMENTO_MS);
    expect(t.prese).toHaveLength(2);
    expect(vecchia.close).toHaveBeenCalled();
    // La chiusura del vecchio WebSocket non deve arrivare alla sessione come "connessione persa".
    expect(vecchia.onclose).toBeNull();
  });

  it('manda un ping ogni 25 secondi, contro i proxy che chiudono le connessioni ferme', () => {
    const t = prova();
    vi.advanceTimersByTime(INTERVALLO_PING_MS * 3);
    expect(t.ultima().send).toHaveBeenCalledTimes(3);
    expect(t.ultima().send).toHaveBeenCalledWith('ping');
  });

  it('un ping su un WebSocket non ancora aperto non rompe la sessione', () => {
    const t = prova();
    t.ultima().send.mockImplementation(() => {
      throw new DOMException('x', 'InvalidStateError');
    });
    expect(() => vi.advanceTimersByTime(INTERVALLO_PING_MS)).not.toThrow();
  });

  it('nuovo() (Scollega, Riprova) torna in attesa con un altro QR', async () => {
    const t = prova();
    await t.ricevi(datiVuoti());
    await t.finché('collegato');
    t.sessione.nuovo();
    expect(t.stato().tipo).toBe('attesa');
    expect(t.prese).toHaveLength(2);
  });
});
