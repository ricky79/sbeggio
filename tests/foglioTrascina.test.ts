// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trascinaPerChiudere } from '../src/ui/dialoghi';

/** Foglio finto: raccoglie i gestori e simula i tocchi con tempi esatti. */
function foglioFinto(scrollTop = 0) {
  const gestori = new Map<string, (e: unknown) => void>();
  const dlg = {
    scrollTop,
    style: { transform: '', transition: '' },
    addEventListener: (tipo: string, f: (e: unknown) => void) => gestori.set(tipo, f),
  };
  const chiudi = vi.fn();
  trascinaPerChiudere(dlg as unknown as HTMLDialogElement, chiudi);
  const evento = (y: number | null, t: number) => {
    const e = { touches: y === null ? [] : [{ clientY: y }], timeStamp: t, preventDefault: vi.fn() };
    return e;
  };
  /** Dito da y0 lungo i punti [y, t]; poi si stacca al tempo `fine`. */
  const gesto = (y0: number, punti: [number, number][], fine: number) => {
    gestori.get('touchstart')!(evento(y0, 0));
    const mosse = punti.map(([y, t]) => {
      const e = evento(y, t);
      gestori.get('touchmove')!(e);
      return e;
    });
    gestori.get('touchend')!(evento(null, fine));
    vi.advanceTimersByTime(300);
    return mosse;
  };
  return { dlg, chiudi, gesto };
}

describe('swipe verso il basso per chiudere un foglio', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('trascinato oltre la soglia si chiude', () => {
    const f = foglioFinto();
    f.gesto(100, [[150, 100], [250, 300], [260, 500]], 520);
    expect(f.chiudi).toHaveBeenCalledOnce();
  });

  it('un trascinamento corto e lento torna al suo posto', () => {
    const f = foglioFinto();
    f.gesto(100, [[120, 100], [160, 300]], 320);
    expect(f.chiudi).not.toHaveBeenCalled();
    expect(f.dlg.style.transform).toBe('');
  });

  it('uno scatto rapido chiude anche con poco spostamento', () => {
    const f = foglioFinto();
    // 70 px, l'ultimo tratto a 1,5 px/ms.
    f.gesto(100, [[115, 10], [145, 30], [170, 46]], 50);
    expect(f.chiudi).toHaveBeenCalledOnce();
  });

  it('se il dito si ferma prima di staccarsi non è uno scatto', () => {
    const f = foglioFinto();
    f.gesto(100, [[115, 10], [145, 30], [170, 46]], 400);
    expect(f.chiudi).not.toHaveBeenCalled();
  });

  it('con il contenuto scorso il gesto scorre, non chiude', () => {
    const f = foglioFinto(300);
    const mosse = f.gesto(100, [[200, 100], [400, 200]], 220);
    expect(f.chiudi).not.toHaveBeenCalled();
    expect(mosse.every((e) => e.preventDefault.mock.calls.length === 0)).toBe(true);
  });

  it('un tocco o uno scorrimento verso l\'alto non muove il foglio', () => {
    const f = foglioFinto();
    const mosse = f.gesto(300, [[295, 50], [200, 100]], 120);
    expect(f.chiudi).not.toHaveBeenCalled();
    expect(f.dlg.style.transform).toBe('');
    expect(mosse.every((e) => e.preventDefault.mock.calls.length === 0)).toBe(true);
  });
});
