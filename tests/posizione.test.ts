// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { distanzaMetri, luogoDaPosizione, RAGGIO_UFFICIO } from '../src/core/posizione';

// Piazza Castello, Torino; 1 m di latitudine ≈ 1/111195 di grado.
const ufficio = { lat: 45.0712, lon: 7.6855 };
const aNord = (metri: number, precisione = 20) => ({ lat: ufficio.lat + metri / 111_195, lon: ufficio.lon, precisione });

describe('posizione', () => {
  it('distanza in metri', () => {
    expect(distanzaMetri(ufficio, ufficio)).toBe(0);
    expect(distanzaMetri(ufficio, aNord(1000))).toBeCloseTo(1000, 0);
    // Torino → Milano (Duomo): circa 126 km in linea d'aria.
    expect(Math.round(distanzaMetri(ufficio, { lat: 45.4642, lon: 9.19 }) / 1000)).toBe(126);
  });

  it('vicino all\'ufficio propone la sede, lontano la casa', () => {
    expect(luogoDaPosizione(aNord(50), ufficio)).toBe('sede');
    expect(luogoDaPosizione(aNord(RAGGIO_UFFICIO - 1), ufficio)).toBe('sede');
    expect(luogoDaPosizione(aNord(5000), ufficio)).toBe('smart');
  });

  it('se la posizione è troppo imprecisa per decidere non propone nulla', () => {
    // 500 m dall'ufficio ma con 300 m di incertezza: potrebbe essere in ufficio.
    expect(luogoDaPosizione(aNord(500, 300), ufficio)).toBeNull();
    expect(luogoDaPosizione(aNord(5000, 3000), ufficio)).toBeNull();
    expect(luogoDaPosizione(aNord(5000, Number.NaN), ufficio)).toBeNull();
  });
});
