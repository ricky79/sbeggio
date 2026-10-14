// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Giornata } from '../src/core/tipi';
import { giornata, impostazioni } from './helpers';

// Store, localStorage e GPS finti: si verifica quando la posizione viene letta e cosa propone.
const UFFICIO = { lat: 45.4642, lon: 9.19 };
const CASA = { lat: 45.55, lon: 9.3 };
const OGGI = '2026-10-01';

const finto = vi.hoisted(() => ({
  giornate: {} as Record<string, Giornata>,
  impostazioni: null as unknown,
}));

vi.mock('../src/storage/store', () => ({
  store: {
    giornata: (data: string) => finto.giornate[data] ?? { data, permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [] },
    get impostazioni() {
      return finto.impostazioni;
    },
  },
}));

let memoria: Map<string, string>;
let qui: { lat: number; lon: number };
let letture: number;

async function carica() {
  vi.resetModules();
  return import('../src/ui/posizione');
}

beforeEach(() => {
  finto.giornate = {};
  finto.impostazioni = impostazioni({ ufficio: UFFICIO });
  memoria = new Map();
  letture = 0;
  qui = CASA;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, String(v)),
  });
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (ok: (p: unknown) => void) => {
        letture++;
        ok({ coords: { latitude: qui.lat, longitude: qui.lon, accuracy: 20 } });
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('casa o ufficio dalla posizione', () => {
  it('senza timbrature rilegge la posizione: aperta a casa e poi in ufficio propone la sede', async () => {
    const { rilevaLuogo, luogoRilevato } = await carica();
    await rilevaLuogo(OGGI, () => {});
    expect(luogoRilevato(OGGI)).toBe('smart');
    qui = UFFICIO;
    await rilevaLuogo(OGGI, () => {});
    expect(letture).toBe(2);
    expect(luogoRilevato(OGGI)).toBe('sede');
  });

  it('dopo la prima timbratura (luogo fissato) non la legge più', async () => {
    finto.giornate[OGGI] = { ...giornata([['ENTRATA', '08:30']], { data: OGGI }), luogo: 'smart' };
    const { rilevaLuogo } = await carica();
    await rilevaLuogo(OGGI, () => {});
    expect(letture).toBe(0);
  });

  it('una lettura troppo imprecisa non cancella la proposta di prima', async () => {
    const { rilevaLuogo, luogoRilevato } = await carica();
    await rilevaLuogo(OGGI, () => {});
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: UFFICIO.lat, longitude: UFFICIO.lon, accuracy: 5000 } }),
      },
    });
    await rilevaLuogo(OGGI, () => {});
    expect(luogoRilevato(OGGI)).toBe('smart');
  });
});
