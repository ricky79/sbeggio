import { describe, expect, it, vi } from 'vitest';
import { Collegamento, decidi, type StatoDurable } from '../src/collegamento';
import { CHIUSURA_SCADUTO, MESSAGGIO_MASSIMO } from '../src/core/collega';

const get = (websocket = true) => ({ metodo: 'GET', websocket, dimensione: 0 });
const post = (dimensione = 100) => ({ metodo: 'POST', websocket: false, dimensione });
const libero = { browser: false, usato: false };
const rifiuta = (stato: number) => ({ tipo: 'rifiuta', stato });

describe('decidi', () => {
  it('apre il WebSocket del browser solo la prima volta', () => {
    expect(decidi(get(), libero)).toEqual({ tipo: 'apri' });
    expect(decidi(get(), { browser: true, usato: false })).toEqual(rifiuta(409));
    expect(decidi(get(), { browser: false, usato: true })).toEqual(rifiuta(409));
    expect(decidi(get(false), libero)).toEqual(rifiuta(426));
  });

  it('consegna al browser collegato, entro la dimensione massima', () => {
    const collegato = { browser: true, usato: false };
    expect(decidi(post(), collegato)).toEqual({ tipo: 'consegna' });
    expect(decidi(post(MESSAGGIO_MASSIMO), collegato)).toEqual({ tipo: 'consegna' });
    expect(decidi(post(MESSAGGIO_MASSIMO + 1), collegato)).toEqual(rifiuta(413));
  });

  it('rifiuta invii ripetuti o senza browser', () => {
    expect(decidi(post(), { browser: true, usato: true })).toEqual(rifiuta(409));
    expect(decidi(post(), { browser: false, usato: true })).toEqual(rifiuta(409));
    expect(decidi(post(), libero)).toEqual(rifiuta(404));
  });

  it('altri metodi non sono ammessi', () => {
    expect(decidi({ metodo: 'PUT', websocket: false, dimensione: 0 }, libero)).toEqual(rifiuta(405));
  });
});

function statoFinto(conBrowser: boolean) {
  const memoria = new Map<string, unknown>();
  const ws = { send: vi.fn(), close: vi.fn() };
  const prese = conBrowser ? [ws] : [];
  const stato: StatoDurable = {
    storage: {
      get: async <T>(k: string) => memoria.get(k) as T | undefined,
      put: async (k: string, v: unknown) => void memoria.set(k, v),
      setAlarm: vi.fn(async () => {}),
      deleteAll: vi.fn(async () => memoria.clear()),
    },
    acceptWebSocket: vi.fn(),
    getWebSockets: () => prese as unknown as WebSocket[],
    setWebSocketAutoResponse: vi.fn(),
  };
  return { stato, ws, memoria };
}

const invio = (corpo: Uint8Array<ArrayBuffer>) =>
  new Request('https://web.sbeggio.app/collega/x', { method: 'POST', body: corpo });

describe('Durable Object Collegamento', () => {
  it('inoltra il messaggio al browser, chiude e rifiuta altri invii', async () => {
    const f = statoFinto(true);
    const relay = new Collegamento(f.stato);
    const corpo = new Uint8Array([1, 2, 3]);
    const r = await relay.fetch(invio(corpo));
    expect(r.status).toBe(200);
    expect(f.ws.send).toHaveBeenCalledWith(corpo);
    expect(f.ws.close).toHaveBeenCalledWith(1000, 'consegnato');
    expect((await relay.fetch(invio(corpo))).status).toBe(409);
    expect(f.ws.send).toHaveBeenCalledTimes(1);
  });

  it('senza browser risponde 404 e non salva nulla', async () => {
    const f = statoFinto(false);
    const r = await new Collegamento(f.stato).fetch(invio(new Uint8Array([1])));
    expect(r.status).toBe(404);
    expect(f.memoria.size).toBe(0);
  });

  it('allo scadere chiude il browser con 4000 e dimentica tutto', async () => {
    const f = statoFinto(true);
    f.memoria.set('usato', true);
    await new Collegamento(f.stato).alarm();
    expect(f.ws.close).toHaveBeenCalledWith(CHIUSURA_SCADUTO, 'scaduto');
    expect(f.memoria.size).toBe(0);
  });

  it('la chiusura dal browser non lancia anche con codici riservati', () => {
    const f = statoFinto(false);
    const ws = {
      close: vi.fn(() => {
        throw new Error('codice non valido');
      }),
    };
    expect(() => new Collegamento(f.stato).webSocketClose(ws as unknown as WebSocket, 1006, '')).not.toThrow();
  });
});
