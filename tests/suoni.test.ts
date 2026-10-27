// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it, vi } from 'vitest';
import { creaPassaggio, fileSuono } from '../src/core/suoni';

/** Lascia girare le promesse già pronte. */
const svuota = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('fileSuono', () => {
  it('tutto l\'anno: ding e doppio ding, nessun passaggio', () => {
    expect(fileSuono('timbratura', null)).toBe('ding.mp3');
    expect(fileSuono('finePausa', null)).toBe('ding-doppio.mp3');
    expect(fileSuono('passaggio', null)).toBeNull();
  });
  it('Natale e Halloween a tema', () => {
    expect(fileSuono('timbratura', 'natale')).toBe('natale-campanellino.mp3');
    expect(fileSuono('finePausa', 'natale')).toBe('natale-ohoh.mp3');
    expect(fileSuono('passaggio', 'natale')).toBe('natale-campanelle.mp3');
    expect(fileSuono('timbratura', 'halloween')).toBe('halloween-campana.mp3');
    expect(fileSuono('finePausa', 'halloween')).toBe('halloween-ululato.mp3');
    expect(fileSuono('passaggio', 'halloween')).toBe('halloween-risata.mp3');
  });
});

describe('creaPassaggio', () => {
  it('suona solo al primo passaggio', async () => {
    const suona = vi.fn(async () => true);
    const p = creaPassaggio(suona);
    for (let i = 0; i < 3; i++) {
      p.alPassaggio();
      await svuota();
    }
    expect(suona).toHaveBeenCalledTimes(1);
  });
  it('se il browser lo blocca riprova al passaggio dopo, una volta sola', async () => {
    const suona = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const p = creaPassaggio(suona);
    for (let i = 0; i < 3; i++) {
      p.alPassaggio();
      await svuota();
    }
    expect(suona).toHaveBeenCalledTimes(2);
  });
  it('se la promessa viene rifiutata riprova al passaggio dopo', async () => {
    const suona = vi.fn().mockRejectedValueOnce(new Error('no')).mockResolvedValue(true);
    const p = creaPassaggio(suona);
    for (let i = 0; i < 3; i++) {
      p.alPassaggio();
      await svuota();
    }
    expect(suona).toHaveBeenCalledTimes(2);
  });
  it('al ritorno in primo piano si riparte da capo', async () => {
    const suona = vi.fn(async () => true);
    const p = creaPassaggio(suona);
    p.alPassaggio();
    await svuota();
    p.allaRiapertura();
    p.alPassaggio();
    await svuota();
    expect(suona).toHaveBeenCalledTimes(2);
  });
  it('un passaggio mentre il primo sta ancora provando non suona due volte', async () => {
    let finisci: (v: boolean) => void = () => {};
    const suona = vi.fn(() => new Promise<boolean>((r) => (finisci = r)));
    const p = creaPassaggio(suona);
    p.alPassaggio();
    p.alPassaggio();
    await svuota();
    finisci(true);
    await svuota();
    expect(suona).toHaveBeenCalledTimes(1);
  });
});
