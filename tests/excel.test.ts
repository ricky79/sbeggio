// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { esportaExcel, INTESTAZIONE_EXCEL, oreMinuti, saldoOreMinuti, testoPermessi } from '../src/core/excel';
import { riepilogoMese } from '../src/core/riepilogo';
import type { Giornata } from '../src/core/tipi';
import { STILE } from '../src/core/xlsx';
import { celle, leggiZip, nomiDeiFogli } from './leggiXlsx';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const oggi = { data: '2026-10-05', minuti: h('10:00') };

/** Giovedì 1/10: pausa pranzo e una sigaretta oltre la tolleranza. */
function conSigaretta(): Giornata {
  const g = giornata(
    [
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:15'],
      ['USCITA_PERMESSO', '15:00'],
      ['RIENTRO_PERMESSO', '15:20'],
      ['USCITA', '17:30'],
    ],
    { data: '2026-10-01' },
  );
  g.eventi[3]!.sigaretta = true;
  return g;
}

/** Venerdì 2/10: permesso a inizio giornata e un permesso intermedio. */
function conPermessi(): Giornata {
  return giornata(
    [
      ['ENTRATA', '09:30'],
      ['USCITA_PERMESSO', '10:00'],
      ['RIENTRO_PERMESSO', '10:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA', '18:00'],
    ],
    { data: '2026-10-02', permessoInizio: 60 },
  );
}

function perData(...g: Giornata[]): Record<string, Giornata> {
  return Object.fromEntries(g.map((x) => [x.data, x]));
}

function foglio(giornate: Record<string, Giornata>, n = 1, quando = oggi) {
  const file = leggiZip(esportaExcel(giornate, imp, quando));
  return { file, c: celle(file.get(`xl/worksheets/sheet${n}.xml`)!) };
}

const minuti = (valore: string) => Math.round(Number(valore) * 1440);

describe('formati', () => {
  it('ore e saldo in h:mm', () => {
    expect(oreMinuti(0)).toBe('0:00');
    expect(oreMinuti(75)).toBe('1:15');
    expect(oreMinuti(600)).toBe('10:00');
    expect(saldoOreMinuti(0)).toBe('0:00');
    expect(saldoOreMinuti(15)).toBe('+0:15');
    expect(saldoOreMinuti(-90)).toBe('−1:30');
  });
});

describe('testoPermessi', () => {
  it('elenca inizio giornata, permessi intermedi e uscita, senza le sigarette', () => {
    const g = conPermessi();
    g.permessoUscitaMinuti = 60;
    expect(testoPermessi(g)).toBe('inizio giornata 1:00 · 10:00–10:30 · in uscita 1:00');
    expect(testoPermessi(conSigaretta())).toBe('');
  });

  it('mostra un permesso non ancora rientrato', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '15:00'],
    ]);
    expect(testoPermessi(g)).toBe('15:00–');
  });
});

describe('esportaExcel', () => {
  it('intestazione nell\'ordine concordato', () => {
    const { c } = foglio(perData(conSigaretta()));
    expect(INTESTAZIONE_EXCEL).toEqual([
      'Data', 'Giorno', 'Luogo', 'Entrata', 'Inizio pausa', 'Fine pausa', 'Uscita', 'Permessi',
      'Uscita prevista', 'Ore dovute', 'Ore lavorate', 'Straordinario', 'Permesso', 'Ferie', 'Saldo', 'Note',
    ]);
    expect(c.get('A1')!.valore).toBe('Data');
    expect(c.get('P1')!.valore).toBe('Note');
  });

  it('una giornata: timbrature, permessi senza sigarette e ore come nel riepilogo', () => {
    const g = conSigaretta();
    g.uscitaPrevista = h('17:10');
    const giornate = perData(g);
    const { c } = foglio(giornate);
    const giorno = riepilogoMese(giornate, imp, '2026-10', oggi).giorni[0]!;
    expect(c.get('A2')).toMatchObject({ stile: STILE.data, valore: '46296' });
    expect(c.get('B2')!.valore).toBe('Giovedì');
    expect(c.get('C2')!.valore).toBe('Sede');
    expect(minuti(c.get('D2')!.valore)).toBe(h('08:30'));
    expect(c.get('D2')!.stile).toBe(STILE.orario);
    expect(minuti(c.get('E2')!.valore)).toBe(h('12:30'));
    expect(minuti(c.get('F2')!.valore)).toBe(h('13:15'));
    expect(minuti(c.get('G2')!.valore)).toBe(h('17:30'));
    expect(c.has('H2')).toBe(false); // solo la sigaretta: nessun permesso elencato
    expect(minuti(c.get('I2')!.valore)).toBe(h('17:10'));
    expect(minuti(c.get('J2')!.valore)).toBe(giorno.risultato.dovuti);
    expect(c.get('J2')!.stile).toBe(STILE.durata);
    expect(minuti(c.get('K2')!.valore)).toBe(giorno.ore.lavoro);
    expect(minuti(c.get('L2')!.valore)).toBe(giorno.ore.straordinario);
    expect(minuti(c.get('M2')!.valore)).toBe(giorno.ore.permesso);
    expect(giorno.ore.permesso).toBeGreaterThan(0); // la sigaretta oltre la tolleranza resta nelle ore
    expect(minuti(c.get('N2')!.valore)).toBe(0);
    expect(c.get('O2')!.valore).toBe(saldoOreMinuti(giorno.risultato.saldo));
    expect(c.has('P2')).toBe(false);
  });

  it('riga Totale in grassetto con le somme e il saldo del mese', () => {
    const giornate = perData(conSigaretta(), conPermessi());
    const { c } = foglio(giornate);
    const r = riepilogoMese(giornate, imp, '2026-10', oggi);
    // Righe: 1 intestazione, 2–3 giorni, 4 vuota, 5 totale.
    expect(c.has('A4')).toBe(false);
    expect(c.get('A5')).toEqual({ stile: STILE.normale + STILE.grassetto, valore: 'Totale', testo: true });
    const dovuti = r.giorni.reduce((s, x) => s + x.risultato.dovuti, 0);
    expect(minuti(c.get('J5')!.valore)).toBe(dovuti);
    expect(minuti(c.get('K5')!.valore)).toBe(r.lavoro);
    expect(minuti(c.get('L5')!.valore)).toBe(r.straordinario);
    expect(minuti(c.get('M5')!.valore)).toBe(r.permesso);
    expect(minuti(c.get('N5')!.valore)).toBe(r.ferie);
    expect(c.get('J5')!.stile).toBe(STILE.durata + STILE.grassetto);
    expect(c.get('O5')!.valore).toBe(saldoOreMinuti(r.saldo));
    expect(c.get('H3')!.valore).toBe('inizio giornata 1:00 · 10:00–10:30');
    expect(c.get('B3')!.valore).toBe('Venerdì');
  });

  it('la giornata in corso ha la nota e non entra nel saldo del totale', () => {
    const inCorso = giornata([['ENTRATA', '08:00']], { data: oggi.data });
    const giornate = perData(conSigaretta(), inCorso);
    const { c } = foglio(giornate);
    expect(c.get('P3')!.valore).toBe('In corso');
    const chiuse = riepilogoMese(perData(conSigaretta()), imp, '2026-10', oggi);
    expect(c.get('O5')!.valore).toBe(saldoOreMinuti(chiuse.saldo));
  });

  it('una giornata di ferie oggi non è "In corso"', () => {
    const ferie: Giornata = { data: oggi.data, permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [], ferie: true };
    const { c } = foglio(perData(ferie));
    expect(c.get('C2')!.valore).toBe('Ferie');
    expect(c.has('D2')).toBe(false);
    expect(minuti(c.get('N2')!.valore)).toBe(minuti(c.get('J2')!.valore));
    expect(c.has('P2')).toBe(false);
  });

  it('una giornata da correggere riporta i problemi nelle note', () => {
    const errata = giornata([['USCITA', '17:00']], { data: '2026-10-01' });
    const giornate = perData(errata);
    const { c } = foglio(giornate);
    const problemi = riepilogoMese(giornate, imp, '2026-10', oggi).giorni[0]!.risultato.problemi;
    expect(problemi.length).toBeGreaterThan(0);
    expect(c.get('P2')!.valore).toBe(problemi.join(' · '));
  });

  it('smart working nella colonna Luogo', () => {
    const g = conSigaretta();
    g.luogo = 'smart';
    expect(foglio(perData(g)).c.get('C2')!.valore).toBe('Smart');
  });

  it('un foglio per mese, dal più vecchio', () => {
    const ottobre = conSigaretta();
    const settembre = giornata([['ENTRATA', '08:30'], ['USCITA', '16:30']], { data: '2026-09-30' });
    const { file } = foglio(perData(ottobre, settembre));
    expect(nomiDeiFogli(file)).toEqual(['Settembre 2026', 'Ottobre 2026']);
    expect(celle(file.get('xl/worksheets/sheet1.xml')!).get('A2')!.valore).toBe('46295');
  });

  it('ignora le giornate senza contenuto', () => {
    const vuota: Giornata = { data: '2026-08-03', permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [] };
    const { file } = foglio(perData(conSigaretta(), vuota));
    expect(nomiDeiFogli(file)).toEqual(['Ottobre 2026']);
  });
});
