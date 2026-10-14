// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confrontaVersioni, dataNovita, NOVITA, novitaDopo, noteRilascio } from '../src/core/novita';

const versione = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;

describe('elenco delle novità', () => {
  it('la versione di package.json ha la sua voce, in cima', () => {
    // Se fallisce: aggiungi in src/core/novita.ts le novità della nuova versione.
    expect(NOVITA[0]?.versione).toBe(versione);
  });

  it('versioni valide, uniche, dalla più recente; date valide e non decrescenti; voci non vuote', () => {
    for (const n of NOVITA) {
      expect(n.versione).toMatch(/^\d+\.\d+\.\d+$/);
      expect(n.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.voci.length).toBeGreaterThan(0);
      for (const v of n.voci) expect(v.trim()).not.toBe('');
    }
    for (let i = 1; i < NOVITA.length; i++) {
      expect(confrontaVersioni(NOVITA[i - 1]!.versione, NOVITA[i]!.versione)).toBe(1);
      expect(NOVITA[i - 1]!.data >= NOVITA[i]!.data).toBe(true);
    }
  });
});

describe('funzioni', () => {
  it('confronta le versioni come numeri, con o senza "v"', () => {
    expect(confrontaVersioni('2.10.0', '2.9.0')).toBe(1);
    expect(confrontaVersioni('v2.9.0', '2.9.0')).toBe(0);
    expect(confrontaVersioni('1.14.1', '2.0.0')).toBe(-1);
  });

  it('dopo un aggiornamento: le versioni nuove fino a quella installata', () => {
    const elenco = [
      { versione: '2.3.0', data: '2026-10-03', voci: ['c'] },
      { versione: '2.2.0', data: '2026-10-02', voci: ['b'] },
      { versione: '2.1.0', data: '2026-10-01', voci: ['a'] },
    ];
    expect(novitaDopo('2.1.0', '2.3.0', elenco).map((n) => n.versione)).toEqual(['2.3.0', '2.2.0']);
    expect(novitaDopo('2.1.0', '2.2.0', elenco).map((n) => n.versione)).toEqual(['2.2.0']);
    // Senza voce per la versione esatta (es. 2.2.1) valgono comunque quelle precedenti non viste.
    expect(novitaDopo('2.1.5', '2.2.1', elenco).map((n) => n.versione)).toEqual(['2.2.0']);
    expect(novitaDopo('2.3.0', '2.3.0', elenco)).toEqual([]);
  });

  it('note del rilascio in Markdown', () => {
    expect(noteRilascio('2.9.0')).toBe(`## Novità\n\n- ${NOVITA.find((n) => n.versione === '2.9.0')!.voci[0]}\n`);
    expect(noteRilascio('0.0.1')).toBeNull();
  });

  it('data in italiano', () => {
    expect(dataNovita('2026-10-14')).toBe('14 ottobre 2026');
    expect(dataNovita('2027-01-02')).toBe('2 gennaio 2027');
  });
});

// Foglio dopo l'aggiornamento: dom e dialoghi finti (i test girano senza DOM).
const finto = vi.hoisted(() => ({ fogli: [] as string[] }));
vi.mock('../src/ui/dialoghi', () => ({ apriFoglio: vi.fn(async (titolo: string) => void finto.fogli.push(titolo)) }));
vi.mock('../src/ui/dom', () => ({ el: () => ({}) }));

describe('novità dopo un aggiornamento', () => {
  let memoria: Map<string, string>;
  let dialogoAperto: boolean;
  beforeEach(() => {
    vi.useFakeTimers();
    finto.fogli.length = 0;
    memoria = new Map();
    dialogoAperto = false;
    vi.stubGlobal('localStorage', { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => void memoria.set(k, v) });
    vi.stubGlobal('document', { querySelector: () => (dialogoAperto ? {} : null) });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('alla prima installazione non mostra nulla, ma ricorda la versione', async () => {
    const { avviaNovita } = await import('../src/ui/novita');
    avviaNovita('2.10.0', 0);
    vi.runAllTimers();
    expect(finto.fogli).toEqual([]);
    expect(memoria.get('timbrature-versione-vista')).toBe('2.10.0');
  });

  it('dopo un aggiornamento le mostra una volta sola', async () => {
    const { avviaNovita } = await import('../src/ui/novita');
    memoria.set('timbrature-versione-vista', '2.9.0');
    avviaNovita('2.10.0', 0);
    vi.runAllTimers();
    expect(finto.fogli).toEqual(['🎉 Novità della versione 2.10.0']);
    avviaNovita('2.10.0', 0);
    vi.runAllTimers();
    expect(finto.fogli).toHaveLength(1);
  });

  it('più versioni saltate: un solo foglio con tutte', async () => {
    const { avviaNovita } = await import('../src/ui/novita');
    memoria.set('timbrature-versione-vista', '2.7.0');
    avviaNovita('2.10.0', 0);
    vi.runAllTimers();
    expect(finto.fogli).toEqual(['🎉 Novità dall\'ultimo aggiornamento']);
  });

  it('aspetta che si chiuda un altro foglio (es. la pausa sigaretta)', async () => {
    const { avviaNovita } = await import('../src/ui/novita');
    memoria.set('timbrature-versione-vista', '2.9.0');
    dialogoAperto = true;
    avviaNovita('2.10.0', 0);
    vi.advanceTimersByTime(5000);
    expect(finto.fogli).toEqual([]);
    dialogoAperto = false;
    vi.advanceTimersByTime(2000);
    expect(finto.fogli).toHaveLength(1);
  });
});
