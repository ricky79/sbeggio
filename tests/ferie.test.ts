// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { calcolaGiornata } from '../src/core/calcolo';
import { pianoFerie, prossimaSettimana } from '../src/core/ferie';
import { riepilogoMese } from '../src/core/riepilogo';
import { statoLeggibile } from '../src/core/testi';
import { GIOVEDI, giornata, h, impostazioni, SABATO } from './helpers';

const imp = impostazioni();
const inFerie = (data = GIOVEDI) => ({ ...giornata([], { data }), ferie: true as const });

describe('ferie', () => {
  it('una giornata di ferie copre le ore dovute: saldo zero, niente da correggere', () => {
    const r = calcolaGiornata(inFerie(), imp, null);
    expect(r.ferie).toBe(480);
    expect(r.coperti).toBe(480);
    expect(r.saldo).toBe(0);
    expect(r.daCorreggere).toBe(false);
    expect(statoLeggibile(r)).toBe('Ferie');
  });

  it('anche oggi, prima di timbrare, la giornata di ferie è coperta', () => {
    const r = calcolaGiornata(inFerie(), imp, h('09:00'));
    expect(r.saldo).toBe(0);
    expect(r.uscitaPrevista).toBeNull();
  });

  it('di sabato (nessuna ora dovuta) non ci sono ore di ferie', () => {
    expect(calcolaGiornata(inFerie(SABATO), imp, null).ferie).toBe(0);
  });

  it('ferie e timbrature nello stesso giorno: da correggere', () => {
    const g = { ...giornata([['ENTRATA', '08:30'], ['USCITA', '12:30']]), ferie: true as const };
    const r = calcolaGiornata(g, imp, null);
    expect(r.daCorreggere).toBe(true);
    expect(r.problemi.join(' ')).toMatch(/ferie/i);
  });

  it('il riepilogo del mese conta giorni e ore di ferie, senza toccare il saldo', () => {
    const lavoro = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '17:45']], { data: '2026-10-02' });
    const d = { [GIOVEDI]: inFerie(), '2026-10-05': inFerie('2026-10-05'), [lavoro.data]: lavoro };
    const r = riepilogoMese(d, imp, '2026-10', { data: '2026-10-09', minuti: h('09:00') });
    expect(r.giorniFerie).toBe(2);
    expect(r.ferie).toBe(960);
    expect(r.saldo).toBe(15);
    expect(r.lavoro).toBe(480);
    expect(r.giorni.find((g) => g.data === GIOVEDI)!.ferie).toBe(true);
  });
});

describe('piano delle ferie', () => {
  it('da lunedì a domenica: solo i cinque giorni lavorativi', () => {
    const p = pianoFerie('2026-10-12', '2026-10-18', {}, imp)!;
    expect(p.date).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
    expect(p.liberi).toBe(2);
  });

  it('salta i giorni già timbrati', () => {
    const g = giornata([['ENTRATA', '08:30']], { data: '2026-10-13' });
    const p = pianoFerie('2026-10-12', '2026-10-14', { [g.data]: g }, imp)!;
    expect(p.date).toEqual(['2026-10-12', '2026-10-14']);
    expect(p.conTimbrature).toEqual(['2026-10-13']);
  });

  it('un giorno solo e intervalli non validi', () => {
    expect(pianoFerie('2026-10-12', '2026-10-12', {}, imp)!.date).toEqual(['2026-10-12']);
    expect(pianoFerie('2026-10-12', '2026-10-11', {}, imp)).toBeNull();
    expect(pianoFerie('2026-01-01', '2027-06-01', {}, imp)).toBeNull();
  });

  it('propone la prossima settimana, da lunedì a venerdì', () => {
    expect(prossimaSettimana('2026-10-10')).toEqual({ dal: '2026-10-12', al: '2026-10-16' }); // sabato
    expect(prossimaSettimana('2026-10-11')).toEqual({ dal: '2026-10-12', al: '2026-10-16' }); // domenica
    expect(prossimaSettimana('2026-10-12')).toEqual({ dal: '2026-10-19', al: '2026-10-23' }); // lunedì
    expect(prossimaSettimana('2026-10-08')).toEqual({ dal: '2026-10-12', al: '2026-10-16' }); // giovedì
  });
});
