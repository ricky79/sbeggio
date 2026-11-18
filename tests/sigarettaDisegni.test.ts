// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { arcoAnello, COLORI_LIQUIDO, coloreLiquido, misureBirretta, misureElettronica, misureNormale } from '../src/ui/sigarettaDisegni';

describe('misure del disegno', () => {
  it('sigaretta normale: la cartina si accorcia e la punta la segue', () => {
    expect(misureNormale(0).larghezzaCartina).toBeCloseTo(200);
    expect(misureNormale(0).spostamentoPunta).toBeCloseTo(0);
    expect(misureNormale(0.5).larghezzaCartina).toBeCloseTo(100);
    expect(misureNormale(0.5).spostamentoPunta).toBeCloseTo(-100);
    expect(misureNormale(1).larghezzaCartina).toBeCloseTo(0);
    expect(misureNormale(1).spostamentoPunta).toBeCloseTo(-200);
  });

  it('sigaretta elettronica: il liquido scende fino a svuotare il serbatoio', () => {
    expect(misureElettronica(0).altezzaLiquido).toBeCloseTo(20);
    expect(misureElettronica(0).yLiquido).toBeCloseTo(58);
    expect(misureElettronica(0.5).altezzaLiquido).toBeCloseTo(10);
    expect(misureElettronica(0.5).yLiquido).toBeCloseTo(68);
    expect(misureElettronica(1).altezzaLiquido).toBeCloseTo(0);
    expect(misureElettronica(1).yLiquido).toBeCloseTo(78);
  });

  it('sigaretta elettronica: il liquido ha uno dei sette colori, a caso tra una pausa e l\'altra', () => {
    const colori = Object.values(COLORI_LIQUIDO);
    expect(colori).toHaveLength(7);
    const inizio = Date.UTC(2026, 9, 6, 10, 30);
    // Pause iniziate al millisecondo o al minuto (ripresa dopo la riapertura): escono tutti i colori.
    const alMillisecondo = Array.from({ length: 7 }, (_, i) => coloreLiquido(inizio + i));
    const alMinuto = Array.from({ length: 7 }, (_, i) => coloreLiquido(inizio + i * 60_000));
    expect(new Set(alMillisecondo)).toEqual(new Set(colori));
    expect(new Set(alMinuto)).toEqual(new Set(colori));
  });

  it('sigaretta elettronica: la stessa pausa ha sempre lo stesso colore', () => {
    expect(coloreLiquido(1_760_000_123_456)).toBe(coloreLiquido(1_760_000_123_456));
  });

  it('fuori da 0–1 non produce misure negative né eccessive', () => {
    expect(misureNormale(-0.2).larghezzaCartina).toBeCloseTo(200);
    expect(misureNormale(1.5).larghezzaCartina).toBeCloseTo(0);
    expect(misureNormale(1.5).spostamentoPunta).toBeCloseTo(-200);
    expect(misureElettronica(-1).altezzaLiquido).toBeCloseTo(20);
    expect(misureElettronica(1.5).altezzaLiquido).toBeCloseTo(0);
  });
});

describe('stile base: anello che si chiude', () => {
  const giro = 2 * Math.PI * 88;
  it('aperto a inizio pausa, chiuso alla fine della tolleranza, limitato tra 0 e 1', () => {
    expect(arcoAnello(0)).toBeCloseTo(giro);
    expect(arcoAnello(0.5)).toBeCloseTo(giro / 2);
    expect(arcoAnello(1)).toBe(0);
    expect(arcoAnello(2)).toBe(0);
    expect(arcoAnello(-1)).toBeCloseTo(giro);
  });
});

describe('stile birretta: la birra cala', () => {
  it('piena a inizio pausa, vuota alla fine, il fondo non si muove', () => {
    const piena = misureBirretta(0);
    const meta = misureBirretta(0.5);
    const vuota = misureBirretta(1);
    expect(piena.altezzaBirra).toBeGreaterThan(0);
    expect(meta.altezzaBirra).toBeCloseTo(piena.altezzaBirra / 2, 0);
    expect(vuota.altezzaBirra).toBe(0);
    expect(misureBirretta(2).altezzaBirra).toBe(0);
    expect(misureBirretta(-1)).toEqual(piena);
    for (const m of [piena, meta, vuota]) expect(m.yBirra + m.altezzaBirra).toBeCloseTo(piena.yBirra + piena.altezzaBirra);
  });
});
