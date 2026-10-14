// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { analizzaGiornata, azioniDisponibili } from '../src/core/statoGiornata';
import { giornata } from './helpers';

describe('macchina a stati', () => {
  it('percorre una giornata completa', () => {
    const passi: [Parameters<typeof giornata>[0], string][] = [
      [[], 'NON_INIZIATA'],
      [[['ENTRATA', '08:30']], 'AL_LAVORO'],
      [[['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']], 'IN_PAUSA'],
      [[['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']], 'IN_PERMESSO'],
      [[['ENTRATA', '08:30'], ['USCITA', '17:30']], 'CHIUSA'],
      [[['ENTRATA', '08:30'], ['USCITA_ANTICIPATA', '15:00']], 'CHIUSA'],
    ];
    for (const [eventi, stato] of passi) expect(analizzaGiornata(giornata(eventi)).stato).toBe(stato);
  });

  it('scarta gli eventi incoerenti e prosegue', () => {
    const a = analizzaGiornata(
      giornata([
        ['RIENTRO_PERMESSO', '08:00'],
        ['ENTRATA', '08:30'],
      ]),
    );
    expect(a.stato).toBe('AL_LAVORO');
    expect(a.idScartati.size).toBe(1);
    expect(a.problemi[0]).toMatch(/senza un'entrata/);
  });
});

describe('azioni disponibili', () => {
  it('bottone principale secondo lo stato', () => {
    expect(azioniDisponibili('NON_INIZIATA', false)).toEqual({ primaria: 'ENTRATA', secondarie: ['PERMESSO_INIZIO_GIORNATA'] });
    expect(azioniDisponibili('AL_LAVORO', false).primaria).toBe('INIZIO_PAUSA');
    expect(azioniDisponibili('IN_PAUSA', false).primaria).toBe('FINE_PAUSA');
    expect(azioniDisponibili('AL_LAVORO', true).primaria).toBe('USCITA');
    expect(azioniDisponibili('IN_PERMESSO', false).primaria).toBe('RIENTRO_PERMESSO');
    expect(azioniDisponibili('CHIUSA', true).primaria).toBeNull();
  });

  it('azioni secondarie sensate', () => {
    expect(azioniDisponibili('AL_LAVORO', true).secondarie).toEqual(['PAUSA_SIGARETTA', 'USCITA_PERMESSO', 'USCITA_ANTICIPATA']);
    expect(azioniDisponibili('AL_LAVORO', false).secondarie).toEqual(['PAUSA_SIGARETTA', 'USCITA_PERMESSO', 'USCITA_ANTICIPATA', 'USCITA']);
    expect(azioniDisponibili('IN_PAUSA', false).secondarie).toEqual([]);
    expect(azioniDisponibili('IN_PERMESSO', false).secondarie).toContain('NON_RIENTRO');
  });
});
