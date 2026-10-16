// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { avanzamentoPranzo, CIBI, ciboDellaPausa, pranzoDaRiprendere, pranzoInCorso, testoCronometro } from '../src/core/pranzo';
import { bordiMela, bordoPanino, ingredientiRamen, livelloRamen, spicchiRimasti } from '../src/ui/pranzoDisegni';
import { giornata } from './helpers';

const MIN = 60_000;

describe('cibo a sorpresa', () => {
  it('a turno tutti i cibi, uno per ogni minuto di inizio', () => {
    const base = Date.UTC(2026, 9, 16, 10, 0, 0);
    const visti = new Set(Array.from({ length: CIBI.length }, (_, i) => ciboDellaPausa(base + i * MIN)));
    expect(visti.size).toBe(CIBI.length);
  });

  it('stesso cibo per tutta la pausa: conta il minuto, non i secondi', () => {
    const inizio = Date.UTC(2026, 9, 16, 10, 41, 0);
    expect(ciboDellaPausa(inizio + 59_999)).toBe(ciboDellaPausa(inizio));
  });
});

describe('avanzamento verso la pausa minima', () => {
  it('il cibo si consuma fino alla pausa minima', () => {
    expect(avanzamentoPranzo(0, 30)).toEqual({ mangiato: 0, minimaFatta: false });
    expect(avanzamentoPranzo(15 * MIN, 30)).toEqual({ mangiato: 0.5, minimaFatta: false });
    expect(avanzamentoPranzo(30 * MIN, 30)).toEqual({ mangiato: 1, minimaFatta: true });
    expect(avanzamentoPranzo(75 * MIN, 30)).toEqual({ mangiato: 1, minimaFatta: true });
  });

  it('senza pausa minima il piatto è già finito; orologio indietro = inizio', () => {
    expect(avanzamentoPranzo(0, 0)).toEqual({ mangiato: 1, minimaFatta: true });
    expect(avanzamentoPranzo(-5000, 30)).toEqual({ mangiato: 0, minimaFatta: false });
  });
});

describe('cronometro', () => {
  it('conta in avanti, con le ore da un\'ora in su', () => {
    expect(testoCronometro(0)).toBe('00:00');
    expect(testoCronometro(7 * MIN + 42_999)).toBe('07:42');
    expect(testoCronometro(59 * MIN + 59_000)).toBe('59:59');
    expect(testoCronometro(67 * MIN + 5000)).toBe('1:07:05');
    expect(testoCronometro(-1000)).toBe('00:00');
  });
});

describe('pausa pranzo in corso', () => {
  it('l\'inizio della pausa aperta, null altrimenti', () => {
    const inPausa = giornata([
      ['ENTRATA', '09:00'],
      ['INIZIO_PAUSA', '12:41'],
    ]);
    expect(pranzoInCorso(inPausa)?.tipo).toBe('INIZIO_PAUSA');
    expect(pranzoDaRiprendere(inPausa)?.minuti).toBe(12 * 60 + 41);
    const rientrato = giornata([
      ['ENTRATA', '09:00'],
      ['INIZIO_PAUSA', '12:41'],
      ['FINE_PAUSA', '13:28'],
    ]);
    expect(pranzoInCorso(rientrato)).toBeNull();
    expect(pranzoInCorso(giornata([['ENTRATA', '09:00']]))).toBeNull();
  });

  it('con timbrature incoerenti la schermata non si ripresenta da sola', () => {
    const incoerente = giornata([
      ['ENTRATA', '09:00'],
      ['INIZIO_PAUSA', '12:41'],
      ['RIENTRO_PERMESSO', '12:50'],
    ]);
    expect(pranzoInCorso(incoerente)).not.toBeNull();
    expect(pranzoDaRiprendere(incoerente)).toBeNull();
  });
});

describe('disegni', () => {
  it('pizza: otto spicchi che spariscono uno alla volta', () => {
    expect(spicchiRimasti(0)).toBe(8);
    expect(spicchiRimasti(0.01)).toBe(8);
    expect(spicchiRimasti(0.5)).toBe(4);
    expect(spicchiRimasti(1)).toBe(0);
    expect(spicchiRimasti(2)).toBe(0);
  });

  it('panino e mela vanno dall\'intero alla fine', () => {
    expect(bordoPanino(0)).toBe(204);
    expect(bordoPanino(1)).toBe(44);
    expect(bordiMela(0)).toEqual({ sinistro: 72, destro: 164 });
    expect(bordiMela(1)).toEqual({ sinistro: 110, destro: 126 });
  });

  it('ramen: il brodo cala e gli ingredienti spariscono uno alla volta', () => {
    expect(livelloRamen(0)).toEqual({ abbassamento: 0, scala: 1 });
    expect(livelloRamen(1)).toEqual({ abbassamento: 14, scala: 0.6 });
    expect(ingredientiRamen(0)).toEqual(['alga', 'uovo', 'naruto', 'carne']);
    expect(ingredientiRamen(0.5)).toEqual(['naruto', 'carne']);
    expect(ingredientiRamen(1)).toEqual([]);
  });
});
