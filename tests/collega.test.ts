// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it, vi } from 'vitest';
import {
  cifra,
  creaCollegamento,
  decifra,
  ErroreCollegamento,
  ID_VALIDO,
  inviaCollegamento,
  leggiFragment,
  leggiQr,
  messaggioEsito,
  messaggioFotocamera,
  motivoFotocamera,
  ORIGINE_SITO,
  urlQr,
} from '../src/core/collega';

const dati = { version: 1, impostazioni: { a: 1 }, giornate: { '2026-10-01': { data: '2026-10-01', eventi: [] } } };

describe('QR del collegamento', () => {
  it('crea id e chiave casuali in base64url', () => {
    const a = creaCollegamento();
    const b = creaCollegamento();
    expect(a.origine).toBe(ORIGINE_SITO);
    expect(a.id).toMatch(ID_VALIDO);
    expect(a.chiave).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.id).not.toBe(b.id);
    expect(a.chiave).not.toBe(b.chiave);
  });

  it('il QR porta versione, id e chiave nel fragment e si rilegge', () => {
    const c = creaCollegamento();
    const url = urlQr(c);
    expect(url).toBe(`https://web.sbeggio.app/#1.${c.id}.${c.chiave}`);
    expect(leggiQr(url, { sviluppo: false })).toEqual(c);
    expect(leggiFragment(`#1.${c.id}.${c.chiave}`)).toEqual({ id: c.id, chiave: c.chiave });
    expect(leggiFragment('')).toBeNull();
  });

  it('rifiuta QR di altri siti, di altre versioni o malformati', () => {
    const c = creaCollegamento();
    const f = `#1.${c.id}.${c.chiave}`;
    const sbagliati = [
      `https://evil.example/${f}`,
      `http://web.sbeggio.app/${f}`,
      `https://web.sbeggio.app/altro${f}`,
      `https://web.sbeggio.app/?x=1${f}`,
      `https://web.sbeggio.app/#2.${c.id}.${c.chiave}`,
      `https://web.sbeggio.app/#1.${c.id.slice(1)}.${c.chiave}`,
      `https://web.sbeggio.app/#1.${c.id}`,
      'ciao',
      '',
    ];
    for (const t of sbagliati) expect(leggiQr(t, { sviluppo: false }), t).toBeNull();
  });

  it('accetta localhost solo in sviluppo', () => {
    const c = creaCollegamento('http://localhost:8787');
    expect(leggiQr(urlQr(c), { sviluppo: false })).toBeNull();
    expect(leggiQr(urlQr(c), { sviluppo: true })).toEqual(c);
  });
});

describe('cifratura', () => {
  it('andata e ritorno, da Uint8Array e da ArrayBuffer', async () => {
    const c = creaCollegamento();
    const m = await cifra(dati, c);
    expect(m[0]).toBe(1);
    expect(await decifra(m, c)).toEqual(dati);
    expect(await decifra(m.buffer, c)).toEqual(dati);
  });

  it('comprime e non lascia nulla in chiaro', async () => {
    const molti = {
      giornate: Array.from({ length: 300 }, (_, i) => ({ data: `2026-01-${i}`, eventi: [{ tipo: 'ENTRATA', minuti: 510 }] })),
    };
    const m = await cifra(molti, creaCollegamento());
    expect(m.byteLength).toBeLessThan(JSON.stringify(molti).length / 4);
    expect(new TextDecoder().decode(m)).not.toContain('ENTRATA');
  });

  it('fallisce con chiave, id, versione o dati sbagliati', async () => {
    const c = creaCollegamento();
    const m = await cifra(dati, c);
    await expect(decifra(m, { ...c, chiave: creaCollegamento().chiave })).rejects.toBeInstanceOf(ErroreCollegamento);
    await expect(decifra(m, { ...c, id: creaCollegamento().id })).rejects.toBeInstanceOf(ErroreCollegamento);
    const versione = m.slice();
    versione[0] = 2;
    await expect(decifra(versione, c)).rejects.toBeInstanceOf(ErroreCollegamento);
    const alterato = m.slice();
    const ultimo = alterato.length - 1;
    alterato[ultimo] = alterato[ultimo]! ^ 1;
    await expect(decifra(alterato, c)).rejects.toBeInstanceOf(ErroreCollegamento);
    await expect(decifra(m.slice(0, 13), c)).rejects.toBeInstanceOf(ErroreCollegamento);
  });
});

describe('invio dall\'app', () => {
  const risposta = (status: number) => vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status }));

  it('manda il messaggio cifrato al relay del QR', async () => {
    const c = creaCollegamento();
    const invia = risposta(200);
    expect(await inviaCollegamento(c, dati, invia)).toBe('inviato');
    const [url, init] = invia.mock.calls[0]!;
    expect(url).toBe(`https://web.sbeggio.app/collega/${c.id}`);
    expect(init.method).toBe('POST');
    expect(await decifra(init.body as Uint8Array, c)).toEqual(dati);
  });

  it.each([
    [404, 'scaduto'],
    [409, 'usato'],
    [413, 'troppo-grande'],
  ] as const)('stato %i → %s', async (stato, esito) => {
    expect(await inviaCollegamento(creaCollegamento(), dati, risposta(stato))).toBe(esito);
  });

  it('altri stati ed errori di rete', async () => {
    expect(await inviaCollegamento(creaCollegamento(), dati, risposta(500))).toEqual({ stato: 500 });
    const giu = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await inviaCollegamento(creaCollegamento(), dati, giu)).toBe('rete');
  });

  it('messaggi degli esiti', () => {
    expect(messaggioEsito('inviato')).toBe('Timbrature inviate al computer');
    expect(messaggioEsito('scaduto')).toBe('Codice scaduto: aggiorna la pagina sul computer e riprova');
    expect(messaggioEsito('usato')).toBe('Codice già usato: aggiorna la pagina sul computer e riprova');
    expect(messaggioEsito('troppo-grande')).toBe('Troppi dati da inviare');
    expect(messaggioEsito('rete')).toBe('Serve la connessione a internet');
    expect(messaggioEsito({ stato: 502 })).toBe('Invio non riuscito (errore 502)');
  });
});

describe('fotocamera', () => {
  it('riconosce il motivo dell\'errore', () => {
    expect(motivoFotocamera(new DOMException('x', 'NotAllowedError'))).toBe('negata');
    expect(motivoFotocamera(new DOMException('x', 'SecurityError'))).toBe('negata');
    expect(motivoFotocamera(new DOMException('x', 'NotFoundError'))).toBe('assente');
    expect(motivoFotocamera(new DOMException('x', 'OverconstrainedError'))).toBe('assente');
    expect(motivoFotocamera(new TypeError('x'))).toBe('altro');
    expect(motivoFotocamera('x')).toBe('altro');
  });

  it('spiega come abilitarla nell\'app e nel browser', () => {
    expect(messaggioFotocamera('negata', true)).toBe(
      'Sbeggio non può usare la fotocamera: abilitala in Impostazioni di Android → App → Sbeggio → Autorizzazioni.',
    );
    expect(messaggioFotocamera('negata', false)).toBe('Consenti l\'uso della fotocamera a Sbeggio nelle impostazioni del browser.');
    expect(messaggioFotocamera('assente', false)).toBe('Non trovo una fotocamera su questo dispositivo.');
    expect(messaggioFotocamera('altro', true)).toBe('Non riesco ad aprire la fotocamera. Riprova.');
  });
});
