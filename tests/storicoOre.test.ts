// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { calcolaGiornata } from '../src/core/calcolo';
import { straordinarioABlocchi } from '../src/core/permessi';
import { oreGiorno, riepilogoMese } from '../src/core/riepilogo';
import { giornata, GIOVEDI, h, impostazioni } from './helpers';

const imp = impostazioni();
const ore = (g: ReturnType<typeof giornata>) => oreGiorno(calcolaGiornata(g, imp, null));
const pausa = [['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30']] as [ReturnType<typeof giornata>['eventi'][0]['tipo'], string][];

describe('straordinario a blocchi da 30 minuti', () => {
  it('conta solo blocchi interi, per difetto', () => {
    expect(straordinarioABlocchi(0)).toBe(0);
    expect(straordinarioABlocchi(20)).toBe(0);
    expect(straordinarioABlocchi(29)).toBe(0);
    expect(straordinarioABlocchi(30)).toBe(30);
    expect(straordinarioABlocchi(50)).toBe(30);
    expect(straordinarioABlocchi(60)).toBe(60);
    expect(straordinarioABlocchi(-45)).toBe(0);
  });
});

describe('ore del giorno nello storico', () => {
  it('giornata normale: 8h di lavoro, niente straordinario né permesso', () => {
    const g = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA', '17:30']]);
    expect(ore(g)).toEqual({ lavoro: 480, straordinario: 0, permesso: 0 });
  });

  it('20 minuti di extra non contano: lavoro 8h, straordinario 0', () => {
    const g = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA', '17:50']]);
    expect(ore(g)).toEqual({ lavoro: 480, straordinario: 0, permesso: 0 });
  });

  it('50 minuti di extra: conta un blocco da 30', () => {
    const g = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA', '18:20']]);
    expect(ore(g)).toEqual({ lavoro: 480, straordinario: 30, permesso: 0 });
  });

  it('un\'ora di extra: straordinario 1h', () => {
    const g = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA', '18:30']]);
    expect(ore(g)).toEqual({ lavoro: 480, straordinario: 60, permesso: 0 });
  });

  it('uscita anticipata: 6h di lavoro + 2h di permesso, niente straordinario', () => {
    const g = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA_ANTICIPATA', '15:30']]);
    expect(ore(g)).toEqual({ lavoro: 360, straordinario: 0, permesso: 120 });
  });

  it('permesso a blocchi: lavoro + permesso = ore dovute', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
      ['RIENTRO_PERMESSO', '10:40'], // 40 min reali → 1h di permesso
      ...pausa,
      ['USCITA', '17:30'],
    ]);
    const o = ore(g);
    expect(o.permesso).toBe(60);
    expect(o.lavoro + o.permesso).toBe(480);
    expect(o.straordinario).toBe(0);
  });

  it('permesso a inizio giornata più straordinario', () => {
    const g = giornata([['ENTRATA', '10:30'], ...pausa, ['USCITA', '18:30']], { permessoInizio: 120 });
    expect(ore(g)).toEqual({ lavoro: 360, straordinario: 60, permesso: 120 });
  });

  it('giorno libero (sabato, 0 ore dovute): tutto straordinario, a blocchi', () => {
    const g = giornata([['ENTRATA', '09:00'], ['USCITA', '12:50']], { data: '2026-10-03' });
    expect(ore(g)).toEqual({ lavoro: 0, straordinario: 210, permesso: 0 });
  });

  it('ore mancanti con uscita normale: nessuno straordinario, lavoro reale', () => {
    const g = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA', '16:50']]);
    expect(ore(g)).toEqual({ lavoro: 440, straordinario: 0, permesso: 0 });
  });
});

describe('riepilogo mensile con le tre voci', () => {
  it('somma lavoro, straordinario conteggiato e permesso', () => {
    const a = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA', '18:20']], { data: '2026-10-01' }); // +50 → 30
    const b = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA', '17:50']], { data: '2026-10-02' }); // +20 → 0
    const c = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA_ANTICIPATA', '15:30']], { data: '2026-09-30' });
    const d = giornata([['ENTRATA', '08:30'], ...pausa, ['USCITA_ANTICIPATA', '15:30']], { data: '2026-10-05' });
    const r = riepilogoMese({ [a.data]: a, [b.data]: b, [c.data]: c, [d.data]: d }, imp, '2026-10', { data: '2026-10-09', minuti: h('09:00') });
    expect(r.giorni).toHaveLength(3);
    expect(r.lavoro).toBe(480 + 480 + 360);
    expect(r.straordinario).toBe(30);
    expect(r.permesso).toBe(120);
    expect(r.saldo).toBe(50 + 20 + 0); // il saldo esatto non viene arrotondato
  });

  it('GIOVEDI è un giorno lavorativo con 8h dovute', () => {
    expect(calcolaGiornata(giornata([]), imp, null).dovuti).toBe(480);
    expect(GIOVEDI).toBe('2026-10-01');
  });
});
