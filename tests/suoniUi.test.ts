// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_RICALCOLA_AVVISI } from '../src/core/avvisi';

// Niente jsdom: modulo nativo, tema e globali (memoria, Audio, document) sono finti.
const finto = vi.hoisted(() => ({
  silenzioso: false,
  memoria: new Map<string, string>(),
  audio: [] as { src: string; currentTime: number; play: () => Promise<void> }[],
  play: (): Promise<void> => Promise.resolve(),
  eventi: [] as string[],
}));

vi.mock('../src/native/nfc', () => ({ telefonoSilenzioso: async () => finto.silenzioso }));
vi.mock('../src/ui/tema', () => ({ festaAccesa: () => null }));

class AudioFinto {
  currentTime = 5;
  constructor(public src: string) {
    finto.audio.push(this);
  }
  play() {
    return finto.play();
  }
}

async function carica() {
  vi.resetModules();
  return import('../src/ui/suoni');
}

beforeEach(() => {
  finto.silenzioso = false;
  finto.memoria = new Map();
  finto.audio = [];
  finto.play = () => Promise.resolve();
  finto.eventi = [];
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => finto.memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void finto.memoria.set(k, v),
    removeItem: (k: string) => void finto.memoria.delete(k),
  });
  vi.stubGlobal('Audio', AudioFinto);
  vi.stubGlobal('document', { dispatchEvent: (e: Event) => finto.eventi.push(e.type) });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('suoni', () => {
  it('all\'inizio sono spenti e non suona nulla', async () => {
    const { suoniAccesi, suona } = await carica();
    expect(suoniAccesi()).toBe(false);
    await expect(suona('timbratura')).resolves.toBe(false);
    expect(finto.audio).toEqual([]);
  });

  it('accesi suonano il file del momento, riusando lo stesso lettore da capo', async () => {
    const { impostaSuoni, suoniAccesi, suona } = await carica();
    impostaSuoni(true);
    expect(suoniAccesi()).toBe(true);
    await expect(suona('timbratura')).resolves.toBe(true);
    await expect(suona('timbratura')).resolves.toBe(true);
    expect(finto.audio).toHaveLength(1);
    expect(finto.audio[0]!.src).toBe('/suoni/ding.mp3');
    expect(finto.audio[0]!.currentTime).toBe(0);
  });

  it('fuori festa il passaggio non ha suono', async () => {
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    await expect(suona('passaggio')).resolves.toBe(false);
    expect(finto.audio).toEqual([]);
  });

  it('col telefono in silenzioso non suona', async () => {
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    finto.silenzioso = true;
    await expect(suona('timbratura')).resolves.toBe(false);
    expect(finto.audio).toEqual([]);
  });

  it('se il browser blocca il suono risolve false senza lanciare', async () => {
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    finto.play = () => Promise.reject(new Error('NotAllowedError'));
    await expect(suona('finePausa')).resolves.toBe(false);
  });

  it('cambiare l\'interruttore chiede di ricalcolare gli avvisi', async () => {
    const { impostaSuoni, suoniAccesi } = await carica();
    impostaSuoni(true);
    impostaSuoni(false);
    expect(suoniAccesi()).toBe(false);
    expect(finto.eventi).toEqual([EVENTO_RICALCOLA_AVVISI, EVENTO_RICALCOLA_AVVISI]);
  });
});
