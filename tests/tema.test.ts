// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { normalizzaPreferenza, temaEffettivo } from '../src/ui/tema';

describe('tema', () => {
  it('automatico segue il tema del sistema', () => {
    expect(temaEffettivo('auto', false)).toBe('chiaro');
    expect(temaEffettivo('auto', true)).toBe('scuro');
  });

  it('chiaro e scuro ignorano il tema del sistema', () => {
    expect(temaEffettivo('chiaro', true)).toBe('chiaro');
    expect(temaEffettivo('scuro', false)).toBe('scuro');
  });

  it('accetta solo i valori salvati validi, altrimenti automatico', () => {
    expect(normalizzaPreferenza('chiaro')).toBe('chiaro');
    expect(normalizzaPreferenza('scuro')).toBe('scuro');
    expect(normalizzaPreferenza('auto')).toBe('auto');
    expect(normalizzaPreferenza(null)).toBe('auto');
    expect(normalizzaPreferenza('dark')).toBe('auto');
    expect(normalizzaPreferenza('')).toBe('auto');
  });
});
