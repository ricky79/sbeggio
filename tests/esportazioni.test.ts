// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { calcolaGiornata } from '../src/core/calcolo';
import { esportaCsv } from '../src/core/csv';
import {
  esportaJson,
  giornateDelMese,
  meseIniziale,
  mesiPresenti,
  nomeFile,
  TUTTO,
  type EsportazioneJson,
} from '../src/core/esportazioni';
import type { Giornata } from '../src/core/tipi';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const oggi = { data: '2026-10-13', minuti: h('09:42') };

function archivio(): Record<string, Giornata> {
  const elenco: Giornata[] = [
    giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '17:30']], { data: '2026-09-30' }),
    { ...giornata([['ENTRATA', '08:30'], ['USCITA', '17:30']], { data: '2026-10-01' }), sigaretteNonConteggiate: [{ minuti: h('10:15'), durata: 9 }] },
    { ...giornata([], { data: '2026-10-02' }), luogo: 'smart' },
    giornata([], { data: '2026-10-05' }),
    { ...giornata([], { data: '2026-12-24' }), ferie: true },
  ];
  return Object.fromEntries(elenco.map((g) => [g.data, g]));
}

const righe = (csv: string) => csv.replace('\uFEFF', '').trim().split('\r\n');

describe('mesi', () => {
  it('elenca i mesi con giornate, dal più recente', () => {
    expect(mesiPresenti(archivio())).toEqual(['2026-12', '2026-10', '2026-09']);
    expect(mesiPresenti({})).toEqual([]);
  });

  it('filtra le giornate di un mese', () => {
    expect(Object.keys(giornateDelMese(archivio(), '2026-10')).sort()).toEqual(['2026-10-01', '2026-10-02', '2026-10-05']);
    expect(giornateDelMese(archivio(), '2026-11')).toEqual({});
  });

  it('parte dal mese corrente, altrimenti dal più recente non futuro', () => {
    expect(meseIniziale(['2026-12', '2026-10', '2026-09'], '2026-10-13')).toBe('2026-10');
    // Ferie inserite in anticipo: dicembre non deve vincere su settembre.
    expect(meseIniziale(['2026-12', '2026-09'], '2026-10-13')).toBe('2026-09');
    expect(meseIniziale(['2026-12'], '2026-10-13')).toBe('2026-12');
    // Solo ferie future: il mese più vicino, non il più lontano.
    expect(meseIniziale(['2027-02', '2026-12'], '2026-10-13')).toBe('2026-12');
    expect(meseIniziale([], '2026-10-13')).toBeNull();
  });

  it('nomi dei file', () => {
    expect(nomeFile('2026-10', '2026-10-13', 'csv')).toBe('sbeggio-2026-10.csv');
    expect(nomeFile(TUTTO, '2026-10-13', 'json')).toBe('sbeggio-tutto-2026-10-13.json');
    expect(nomeFile('2026-10', '2026-10-13', 'xlsx')).toBe('sbeggio-2026-10.xlsx');
    expect(nomeFile(TUTTO, '2026-10-13', 'xlsx')).toBe('sbeggio-tutto-2026-10-13.xlsx');
  });
});

describe('CSV del mese', () => {
  it('ha le stesse righe del CSV completo per quel mese', () => {
    const tutte = righe(esportaCsv(archivio(), imp, oggi));
    const mese = righe(esportaCsv(giornateDelMese(archivio(), '2026-10'), imp, oggi));
    expect(mese).toEqual([tutte[0], ...tutte.slice(1).filter((r) => r.replace(/^"/, '').startsWith('2026-10-'))]);
  });
});

describe('JSON leggibile', () => {
  const leggi = (periodo: string, giornate = archivio(), adesso = oggi) =>
    JSON.parse(esportaJson(giornate, imp, adesso, periodo, '2.7.0')) as EsportazioneJson;

  it('intestazione e giornate con contenuto in ordine', () => {
    const j = leggi('2026-10', giornateDelMese(archivio(), '2026-10'));
    expect(j.app).toBe('Sbeggio');
    expect(j.versioneApp).toBe('2.7.0');
    expect(j.generato).toBe('2026-10-13T09:42');
    expect(j.periodo).toBe('2026-10');
    expect(j.giornate.map((g) => g.data)).toEqual(['2026-10-01', '2026-10-02']);
    expect(leggi(TUTTO).giornate.map((g) => g.data)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-12-24']);
  });

  it('valori dal calcolo dell\'app e stato uguale al CSV', () => {
    const a = archivio();
    const j = leggi(TUTTO, a).giornate.find((g) => g.data === '2026-10-01')!;
    const r = calcolaGiornata(a['2026-10-01']!, imp, null);
    expect(j).toMatchObject({
      giorno: 'Giovedì',
      dovutiMinuti: r.dovuti,
      lavoratiMinuti: r.lavorati,
      permessoMinuti: r.permesso,
      saldoMinuti: r.saldo,
      permessoInizioMinuti: 0,
      permessoUscitaMinuti: 0,
      luogo: 'sede',
      ferie: false,
    });
    const rigaCsv = righe(esportaCsv(a, imp, oggi)).find((x) => x.startsWith('2026-10-01'))!;
    expect(j.stato).toBe(rigaCsv.split(';')[6]);
    expect(j.eventi).toEqual([
      { ora: '08:30', tipo: 'ENTRATA', etichetta: 'Entrata' },
      { ora: '17:30', tipo: 'USCITA', etichetta: 'Uscita' },
    ]);
    expect(j.sigaretteNonConteggiate).toEqual([{ ora: '10:15', durataMinuti: 9 }]);
  });

  it('smart, ferie e sigarette assenti', () => {
    const tutte = leggi(TUTTO).giornate;
    expect(tutte.find((g) => g.data === '2026-10-02')).toMatchObject({ luogo: 'smart', ferie: false, eventi: [], sigaretteNonConteggiate: [] });
    expect(tutte.find((g) => g.data === '2026-12-24')).toMatchObject({ ferie: true });
  });

  it('la giornata in corso si calcola con l\'ora attuale', () => {
    const g = giornata([['ENTRATA', '08:30']], { data: '2026-10-13' });
    const j = leggi(TUTTO, { [g.data]: g }).giornate[0]!;
    expect(j.lavoratiMinuti).toBe(calcolaGiornata(g, imp, oggi.minuti).lavorati);
    expect(j.lavoratiMinuti).toBeGreaterThan(0);
  });
});
