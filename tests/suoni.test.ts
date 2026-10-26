// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { suonoPerAzione } from '../src/ui/suoni';

describe('suoni', () => {
  it('chi chiude la giornata sente l\'uscita, le altre timbrature il suono breve', () => {
    expect(suonoPerAzione('ENTRATA')).toBe('timbra');
    expect(suonoPerAzione('INIZIO_PAUSA')).toBe('timbra');
    expect(suonoPerAzione('PAUSA_SIGARETTA')).toBe('timbra');
    expect(suonoPerAzione('USCITA')).toBe('uscita');
    expect(suonoPerAzione('USCITA_ANTICIPATA')).toBe('uscita');
    expect(suonoPerAzione('NON_RIENTRO')).toBe('uscita');
    expect(suonoPerAzione('RIAPRI')).toBeNull();
  });
});
