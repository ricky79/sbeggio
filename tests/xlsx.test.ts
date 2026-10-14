// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { cartella, nomiFogli, seriale, STILE, type Foglio } from '../src/core/xlsx';
import { celle, leggiZip, nomiDeiFogli, xmlBenFormato } from './leggiXlsx';

const foglio = (modifiche: Partial<Foglio> = {}): Foglio => ({
  nome: 'Ottobre 2026',
  colonne: [12, 8],
  righe: [[{ testo: 'Data' }, { testo: 'Entrata' }], [{ data: '2026-10-14' }, { orario: 510 }]],
  ...modifiche,
});

describe('cartella', () => {
  it('contiene tutti i file di un .xlsx, ben formati', () => {
    const file = leggiZip(cartella([foglio(), foglio({ nome: 'Novembre 2026' })]));
    expect([...file.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    for (const [nome, xml] of file) expect(xmlBenFormato(xml), nome).toBe(true);
    expect(file.get('[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml');
    expect(file.get('xl/_rels/workbook.xml.rels')).toContain('Target="worksheets/sheet2.xml"');
    expect(nomiDeiFogli(file)).toEqual(['Ottobre 2026', 'Novembre 2026']);
  });

  it('scrive date, orari e durate come numeri con il loro stile', () => {
    const f = foglio({
      righe: [
        [{ testo: 'Data' }, { testo: 'Entrata' }, { testo: 'Ore' }, { testo: 'N' }],
        [{ data: '2026-10-14' }, { orario: 510 }, { durata: 1800 }, { numero: 3 }],
      ],
    });
    const c = celle(leggiZip(cartella([f])).get('xl/worksheets/sheet1.xml')!);
    expect(c.get('A2')).toEqual({ stile: STILE.data, valore: '46309', testo: false });
    expect(c.get('B2')).toEqual({ stile: STILE.orario, valore: String(510 / 1440), testo: false });
    expect(c.get('C2')).toEqual({ stile: STILE.durata, valore: String(1800 / 1440), testo: false });
    expect(c.get('D2')).toEqual({ stile: STILE.normale, valore: '3', testo: false });
  });

  it('mette in grassetto l\'intestazione e le righe indicate, e la blocca', () => {
    const f = foglio({ righe: [[{ testo: 'Data' }], [{ testo: 'x' }], [{ durata: 60 }]], grassetto: [2] });
    const xml = leggiZip(cartella([f])).get('xl/worksheets/sheet1.xml')!;
    const c = celle(xml);
    expect(c.get('A1')!.stile).toBe(STILE.normale + STILE.grassetto);
    expect(c.get('A2')!.stile).toBe(STILE.normale);
    expect(c.get('A3')!.stile).toBe(STILE.durata + STILE.grassetto);
    expect(xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('<col min="1" max="1" width="12" customWidth="1"/>');
  });

  it('salta le celle vuote e quelle con numeri non validi', () => {
    const f = foglio({ righe: [[{ testo: 'a' }, null, { orario: Number.NaN }, { durata: Infinity }, { testo: '' }]] });
    const c = celle(leggiZip(cartella([f])).get('xl/worksheets/sheet1.xml')!);
    expect([...c.keys()]).toEqual(['A1']);
  });

  it('fa l\'escape dei caratteri speciali e toglie quelli di controllo', () => {
    const f = foglio({ nome: 'R&D <1>', righe: [[{ testo: 'a & b < c > "d" \'e\' Giovedì\u0007' }]] });
    const file = leggiZip(cartella([f]));
    const xml = file.get('xl/worksheets/sheet1.xml')!;
    expect(xmlBenFormato(xml)).toBe(true);
    expect(xmlBenFormato(file.get('xl/workbook.xml')!)).toBe(true);
    expect(celle(xml).get('A1')!.valore).toBe('a & b < c > "d" \'e\' Giovedì');
    expect(nomiDeiFogli(file)).toEqual(['R&D <1>']);
  });

  it('con zero fogli lancia un errore', () => {
    expect(() => cartella([])).toThrow();
  });
});

describe('nomiFogli', () => {
  it('toglie i caratteri vietati, tronca a 31 e rende unici', () => {
    expect(nomiFogli(['a/b:c?d*e[f]g\\h', "'citato'", '', 'x'.repeat(40), 'Mese', 'mese'])).toEqual([
      'abcdefgh',
      'citato',
      'Foglio',
      'x'.repeat(31),
      'Mese',
      'mese (2)',
    ]);
  });
});

describe('seriale', () => {
  it('conta i giorni come Excel', () => {
    expect(seriale('1900-03-01')).toBe(61);
    expect(seriale('2026-01-01')).toBe(46023);
    expect(seriale('2026-10-14')).toBe(46309);
  });
});
