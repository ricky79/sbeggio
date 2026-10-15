// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { calcolaGiornata } from '../src/core/calcolo';
import { sigarettaInCorso } from '../src/core/sigaretta';
import { azioneTag, esitoLettura, indirizzoTimbra, PAUSA_LETTURE_MS } from '../src/core/tagNfc';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni(); // fascia pranzo 12:00–14:30
const fine = imp.pranzo.fine;

/** Azione del tag per gli eventi dati, letta all'ora indicata. */
function azione(eventi: Parameters<typeof giornata>[0], ora: string, sigaretta = false) {
  const g = giornata(eventi);
  if (sigaretta) for (const e of g.eventi) if (e.tipo === 'USCITA_PERMESSO') e.sigaretta = true;
  const r = calcolaGiornata(g, imp, h(ora));
  return azioneTag(r, sigarettaInCorso(g) !== null, h(ora), fine);
}

describe('azione del tag', () => {
  it('segue il pulsante principale', () => {
    expect(azione([], '08:00')).toBe('ENTRATA');
    expect(azione([['ENTRATA', '08:30']], '10:00')).toBe('INIZIO_PAUSA');
    expect(azione([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']], '13:00')).toBe('FINE_PAUSA');
    expect(azione([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:00']], '15:00')).toBe('USCITA');
    expect(azione([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']], '10:30')).toBe('RIENTRO_PERMESSO');
  });

  it('a fascia pranzo finita senza pausa chiede se è pausa o uscita', () => {
    expect(azione([['ENTRATA', '08:30']], '14:29')).toBe('INIZIO_PAUSA');
    expect(azione([['ENTRATA', '08:30']], '14:30')).toBe('PAUSA_O_USCITA');
    expect(azione([['ENTRATA', '08:30']], '17:30')).toBe('PAUSA_O_USCITA');
  });

  it('con la pausa sigaretta in corso è il rientro dalla sigaretta, anche dopo la fascia pranzo', () => {
    expect(azione([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']], '10:05', true)).toBe('RIENTRO_SIGARETTA');
    expect(azione([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '15:00']], '15:05', true)).toBe('RIENTRO_SIGARETTA');
  });

  it('a giornata chiusa non c\'è nulla da timbrare', () => {
    expect(azione([['ENTRATA', '08:30'], ['USCITA', '17:30']], '17:31')).toBeNull();
  });
});

describe('esito della lettura', () => {
  const base = { azione: 'ENTRATA' as const, finestraAperta: false, ora: 1_000_000, ultimaTimbratura: null };

  it('la prima lettura timbra', () => {
    expect(esitoLettura(base)).toBe('timbra');
  });

  it('entro un minuto dall\'ultima timbratura col tag la lettura è ignorata', () => {
    expect(esitoLettura({ ...base, ultimaTimbratura: base.ora - 59_000 })).toBe('gia-letto');
    expect(esitoLettura({ ...base, ultimaTimbratura: base.ora - PAUSA_LETTURE_MS })).toBe('timbra');
  });

  it('con una finestra aperta o la giornata chiusa non timbra', () => {
    expect(esitoLettura({ ...base, finestraAperta: true })).toBe('finestra-aperta');
    expect(esitoLettura({ ...base, azione: null })).toBe('chiusa');
  });

  it('"già letto" ha la precedenza', () => {
    const recente = base.ora - 1000;
    expect(esitoLettura({ ...base, ultimaTimbratura: recente, finestraAperta: true })).toBe('gia-letto');
    expect(esitoLettura({ ...base, ultimaTimbratura: recente, azione: null })).toBe('gia-letto');
  });
});

describe('indirizzo ?timbra', () => {
  it('riconosce ?timbra e restituisce l\'indirizzo senza', () => {
    expect(indirizzoTimbra('https://sbeggio.app/?timbra')).toBe('https://sbeggio.app/');
    expect(indirizzoTimbra('https://sbeggio.app/?timbra=1')).toBe('https://sbeggio.app/');
    expect(indirizzoTimbra('https://sbeggio.app/?a=b&timbra#x')).toBe('https://sbeggio.app/?a=b#x');
  });

  it('senza ?timbra non fa nulla', () => {
    expect(indirizzoTimbra('https://sbeggio.app/')).toBeNull();
    expect(indirizzoTimbra('https://sbeggio.app/?timbrare')).toBeNull();
    expect(indirizzoTimbra('https://sbeggio.app/#timbra')).toBeNull();
  });
});
