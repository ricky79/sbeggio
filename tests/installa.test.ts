// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { piattaforma, propostaInstallazione } from '../src/ui/installa';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  // iPadOS si presenta come un Mac: lo distingue solo lo schermo touch.
  ipadOMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

describe('piattaforma', () => {
  it('riconosce iPhone, iPad e Android', () => {
    expect(piattaforma(UA.iphone, 5)).toBe('ios');
    expect(piattaforma(UA.ipadOMac, 5)).toBe('ios');
    expect(piattaforma(UA.android, 5)).toBe('android');
  });

  it('i computer non sono telefoni', () => {
    expect(piattaforma(UA.ipadOMac, 0)).toBe('altro');
    expect(piattaforma(UA.windows, 0)).toBe('altro');
  });
});

describe('proposta di installazione', () => {
  const android = { piattaforma: 'android', installata: false, chiuso: false, promptPronto: true } as const;
  const ios = { piattaforma: 'ios', installata: false, chiuso: false, promptPronto: false } as const;

  it('su Android offre il pulsante solo quando il browser permette l\'installazione', () => {
    expect(propostaInstallazione(android)).toBe('pulsante');
    expect(propostaInstallazione({ ...android, promptPronto: false })).toBe('nessuna');
  });

  it('su iPhone mostra le istruzioni', () => {
    expect(propostaInstallazione(ios)).toBe('istruzioni');
  });

  it('niente banner se l\'app è già installata', () => {
    expect(propostaInstallazione({ ...android, installata: true })).toBe('nessuna');
    expect(propostaInstallazione({ ...ios, installata: true })).toBe('nessuna');
  });

  it('niente banner se l\'utente l\'ha chiuso', () => {
    expect(propostaInstallazione({ ...android, chiuso: true })).toBe('nessuna');
    expect(propostaInstallazione({ ...ios, chiuso: true })).toBe('nessuna');
  });

  it('sul computer niente banner anche se il browser permette l\'installazione', () => {
    expect(propostaInstallazione({ ...android, piattaforma: 'altro' })).toBe('nessuna');
  });
});
