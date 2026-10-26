// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { chiaveFesta, festaDelGiorno } from '../src/core/festa';
import { cercaImpostazioni } from '../src/ui/ricercaImpostazioni';

describe('tema delle feste', () => {
  it('Halloween dal 24 ottobre a Ognissanti compresi, ogni anno', () => {
    expect(festaDelGiorno('2026-10-23')).toBeNull();
    expect(festaDelGiorno('2026-10-24')).toBe('halloween');
    expect(festaDelGiorno('2026-10-31')).toBe('halloween');
    expect(festaDelGiorno('2026-11-01')).toBe('halloween');
    expect(festaDelGiorno('2026-11-02')).toBeNull();
    expect(festaDelGiorno('2027-10-28')).toBe('halloween');
    expect(festaDelGiorno('2027-03-15')).toBeNull();
  });

  it('spenta per un anno: l\'anno dopo torna da sola', () => {
    expect(chiaveFesta('halloween', '2026-10-26')).toBe('halloween-2026');
    expect(chiaveFesta('halloween', '2027-10-26')).not.toBe(chiaveFesta('halloween', '2026-10-26'));
  });

  it('l\'interruttore si trova con la ricerca solo nei giorni della festa', () => {
    const ids = (festa: 'halloween' | null) => cercaImpostazioni('zucca', { app: false, festa }).map((v) => v.id);
    expect(ids('halloween')).toContain('halloween');
    expect(ids(null)).not.toContain('halloween');
  });
});
