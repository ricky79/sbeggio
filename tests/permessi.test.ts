// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { BLOCCO_PERMESSO, permessoABlocchi } from '../src/core/permessi';
import { permessoSigaretta } from '../src/core/sigaretta';

describe('permessi a blocchi', () => {
  it('arrotonda per eccesso alla mezz\'ora', () => {
    expect(BLOCCO_PERMESSO).toBe(30);
    expect(permessoABlocchi(1)).toBe(30);
    expect(permessoABlocchi(30)).toBe(30);
    expect(permessoABlocchi(31)).toBe(60);
    expect(permessoABlocchi(83)).toBe(90);
  });

  it('nessun permesso resta nessun permesso', () => {
    expect(permessoABlocchi(0)).toBe(0);
    expect(permessoABlocchi(-5)).toBe(0);
  });

  it('la pausa sigaretta vale sempre almeno un blocco', () => {
    expect(permessoSigaretta(0)).toBe(30);
    expect(permessoSigaretta(42)).toBe(60);
  });
});
