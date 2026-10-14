// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { controllaVersione, leggiVersione, ultimaVersione, versionCode } from '../scripts/versione';

const TAG = ['1.5.0', '1.6.0', '1.7.0', 'v1.8.0', 'prova'];

describe('versioni', () => {
  it('legge x.y.z con o senza la "v" dei tag', () => {
    expect(leggiVersione('1.8.0')).toEqual([1, 8, 0]);
    expect(leggiVersione('v1.8.0')).toEqual([1, 8, 0]);
    expect(leggiVersione('1.8')).toBeNull();
    expect(leggiVersione('v1.8.0-beta')).toBeNull();
  });

  it('l\'ultima versione tra i tag è la più alta in ordine numerico, non alfabetico', () => {
    expect(ultimaVersione(TAG)).toBe('1.8.0');
    expect(ultimaVersione(['1.9.0', 'v1.10.0'])).toBe('1.10.0');
    expect(ultimaVersione(['prova'])).toBeNull();
    expect(ultimaVersione([])).toBeNull();
  });

  it('versionCode di Android: major × 10000 + minor × 100 + patch', () => {
    expect(versionCode('1.8.0')).toBe(10800);
    expect(versionCode('2.0.1')).toBe(20001);
    expect(versionCode('1.10.0')).toBeGreaterThan(versionCode('1.9.99'));
  });

  it('versionCode rifiuta versioni non valide o con minor e patch oltre 99', () => {
    expect(() => versionCode('1.100.0')).toThrow(/99/);
    expect(() => versionCode('1.8')).toThrow();
  });
});

describe('controllo sulle PR verso main', () => {
  it('una versione più alta dell\'ultimo tag va bene', () => {
    const esito = controllaVersione('1.9.0', TAG);
    expect(esito.ok).toBe(true);
    expect(esito.messaggio).toContain('v1.9.0');
  });

  it('la stessa versione dell\'ultimo tag, o una più bassa, chiede di aggiornarla', () => {
    for (const v of ['1.8.0', '1.7.5']) {
      const esito = controllaVersione(v, TAG);
      expect(esito.ok, v).toBe(false);
      expect(esito.messaggio, v).toContain('1.8.0');
      expect(esito.messaggio, v).toContain('npm version');
    }
  });

  it('senza tag precedenti la prima versione va bene', () => {
    expect(controllaVersione('1.0.0', []).ok).toBe(true);
  });

  it('rifiuta versioni non valide o non convertibili in versionCode', () => {
    expect(controllaVersione('1.9', TAG).ok).toBe(false);
    expect(controllaVersione('1.100.0', TAG).ok).toBe(false);
  });
});
