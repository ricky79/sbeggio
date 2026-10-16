// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it, vi } from 'vitest';

// Lo store dell'app legge e scrive localStorage appena importato: sul sito non deve arrivare.
vi.mock('../src/storage/store', () => {
  throw new Error('lo storico del sito non deve importare lo store dell\'app');
});

describe('storico su web.sbeggio.app', () => {
  it('si carica senza lo store dell\'app', async () => {
    const { storicoSito } = await import('../src/sito/storico');
    expect(typeof storicoSito).toBe('function');
  });
});
