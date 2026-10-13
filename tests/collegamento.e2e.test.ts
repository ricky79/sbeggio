import { describe, expect, it } from 'vitest';
import { creaCollegamento, decifra, inviaCollegamento, leggiQr, PING, PONG } from '../src/core/collega';
import { datiVuoti } from '../src/storage/migrazioni';
import { giornata } from './helpers';

/**
 * Prove con il relay vero. Dopo `npm run build`, avvia
 *   npx wrangler@4.147.0 dev --port 8787 --local-upstream web.sbeggio.app
 * (senza --local-upstream wrangler presenta ogni richiesta come sbeggio.app, cioè la PWA), poi:
 *   RELAY=http://localhost:8787 npx vitest run tests/collegamento.e2e.test.ts
 * Con QR=<data-url del QR della pagina> fa il telefono: manda un backup di prova a quella pagina.
 * Senza variabili i test sono saltati (anche in CI).
 */
const RELAY = process.env.RELAY;
const QR = process.env.QR;

function backup() {
  const d = datiVuoti();
  const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '17:30']]);
  d.giornate[g.data] = g;
  return d;
}

function apriBrowser(url: string): Promise<{ ws: WebSocket; prossimo: () => Promise<unknown> }> {
  return new Promise((ok, ko) => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    const coda: unknown[] = [];
    const attese: ((d: unknown) => void)[] = [];
    ws.addEventListener('message', (e) => {
      const a = attese.shift();
      if (a) a(e.data);
      else coda.push(e.data);
    });
    const prossimo = () => (coda.length ? Promise.resolve(coda.shift()) : new Promise((r) => attese.push(r)));
    ws.addEventListener('open', () => ok({ ws, prossimo }));
    ws.addEventListener('error', () => ko(new Error('WebSocket rifiutato')));
  });
}

const wsUrl = (id: string) => `${RELAY!.replace(/^http/, 'ws')}/collega/${id}`;

describe.skipIf(!RELAY)('relay vero (wrangler dev)', () => {
  it('consegna una volta sola il messaggio cifrato al browser', async () => {
    const c = creaCollegamento(RELAY!);
    const { prossimo } = await apriBrowser(wsUrl(c.id));
    const dati = backup();
    expect(await inviaCollegamento(c, dati)).toBe('inviato');
    expect(await decifra((await prossimo()) as ArrayBuffer, c)).toEqual(dati);
    expect(await inviaCollegamento(c, dati)).toBe('usato');
  });

  it('senza browser il codice è scaduto', async () => {
    expect(await inviaCollegamento(creaCollegamento(RELAY!), backup())).toBe('scaduto');
  });

  it('un secondo browser sullo stesso codice è rifiutato', async () => {
    const c = creaCollegamento(RELAY!);
    await apriBrowser(wsUrl(c.id));
    await expect(apriBrowser(wsUrl(c.id))).rejects.toThrow();
  });

  it('risponde pong al ping', async () => {
    const { ws, prossimo } = await apriBrowser(wsUrl(creaCollegamento(RELAY!).id));
    ws.send(PING);
    expect(await prossimo()).toBe(PONG);
  });
});

describe.skipIf(!QR)('telefono finto', () => {
  it('manda un backup di prova al QR della pagina', async () => {
    const c = leggiQr(QR!, { sviluppo: true });
    expect(c).not.toBeNull();
    expect(await inviaCollegamento(c!, backup())).toBe('inviato');
  });
});
