// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { calcolaGiornata } from '../src/core/calcolo';
import { INIZIO_PAUSA_OBBLIGATORIA, pausaObbligatoria } from '../src/core/pausaObbligatoria';
import { formattaOra } from '../src/core/tempo';
import { giornata, h, impostazioni } from './helpers';

// Pausa minima 30 min, pausa da scalare 60 (helpers): l'uscita prevista usa la minima.
const imp = impostazioni();
/** Lunedì dal quale la pausa obbligatoria si scala all'uscita; 8h dovute. */
const DAL = INIZIO_PAUSA_OBBLIGATORIA;
/** Venerdì precedente, 8h dovute: la regola non vale ancora. */
const PRIMA = '2026-10-09';
const conDovuti = (minuti: number) =>
  impostazioni({ minutiDovuti: { predefinito: minuti, perGiorno: [null, null, null, null, null, null, null] } });

describe('quando la pausa pranzo è obbligatoria', () => {
  it('con almeno 6 ore dovute', () => {
    expect(pausaObbligatoria(359)).toBe(false);
    expect(pausaObbligatoria(360)).toBe(true);
    expect(pausaObbligatoria(480)).toBe(true);
  });

  it('la regola vale dal 12 ottobre 2026', () => {
    expect(INIZIO_PAUSA_OBBLIGATORIA).toBe('2026-10-12');
  });
});

describe('uscita prevista con la pausa obbligatoria', () => {
  const uscita = (g: ReturnType<typeof giornata>, adesso: string, i = imp) => {
    const r = calcolaGiornata(g, i, h(adesso));
    return { ora: r.uscitaPrevista === null ? null : formattaOra(r.uscitaPrevista), conPausa: r.uscitaPrevistaConPausa };
  };

  it('prima del pranzo include la pausa minima', () => {
    expect(uscita(giornata([['ENTRATA', '08:30']], { data: DAL }), '10:00')).toEqual({ ora: '17:00', conPausa: true });
  });

  it('anche dopo la fascia pranzo, se la pausa non è fatta', () => {
    expect(uscita(giornata([['ENTRATA', '08:30']], { data: DAL }), '15:00')).toEqual({ ora: '17:00', conPausa: true });
  });

  it('con le ore dovute contate prima dei permessi (decisione B): 2h di permesso, pausa ancora inclusa', () => {
    const g = giornata([['ENTRATA', '10:30']], { data: DAL, permessoInizio: 120 });
    expect(uscita(g, '10:30')).toEqual({ ora: '17:00', conPausa: true });
  });

  it('sotto le 6 ore dovute non aggiunge nessuna pausa', () => {
    const g = giornata([['ENTRATA', '08:30']], { data: DAL });
    expect(uscita(g, '10:00', conDovuti(359))).toEqual({ ora: '14:29', conPausa: false });
    expect(uscita(giornata([['ENTRATA', '10:00']], { data: DAL }), '10:00', conDovuti(300))).toEqual({
      ora: '15:00',
      conPausa: false,
    });
  });

  it('se si esce entro la fine della fascia pranzo la pausa non serve', () => {
    const g = giornata([['ENTRATA', '08:30']], { data: DAL, permessoInizio: 240 });
    expect(uscita(g, '09:00')).toEqual({ ora: '12:30', conPausa: false });
  });

  it('con la pausa fatta non aggiunge nulla', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:00']], { data: DAL });
    expect(uscita(g, '13:00')).toEqual({ ora: '17:00', conPausa: false });
  });
});

describe('giornata chiusa senza pausa', () => {
  it('toglie la pausa minima dalle ore lavorate', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA', '17:00']], { data: DAL });
    const r = calcolaGiornata(g, imp, null);
    expect(r.pausaAutomatica).toBe(30);
    expect(r.pausa).toBe(30);
    expect(r.lavorati).toBe(480);
    expect(r.saldo).toBe(0);
  });

  it('con l\'uscita anticipata il permesso copre anche la pausa scalata', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_ANTICIPATA', '15:00']], { data: DAL });
    const r = calcolaGiornata(g, imp, null);
    expect(r.pausaAutomatica).toBe(30);
    expect(r.lavorati).toBe(360);
    expect(r.permessoUscita).toBe(120);
    expect(r.saldo).toBe(0);
  });

  it('uscendo entro la fine della fascia pranzo non scala nulla', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_ANTICIPATA', '14:30']], { data: DAL });
    expect(calcolaGiornata(g, imp, null).pausaAutomatica).toBe(0);
  });

  it('sotto le 6 ore dovute non scala nulla', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA', '14:45']], { data: DAL });
    const r = calcolaGiornata(g, conDovuti(300), null);
    expect(r.pausaAutomatica).toBe(0);
    expect(r.lavorati).toBe(375);
  });

  it('una pausa registrata, anche corta, non viene scalata di nuovo', () => {
    const g = giornata(
      [['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '12:45'], ['USCITA', '17:00']],
      { data: DAL },
    );
    const r = calcolaGiornata(g, imp, null);
    expect(r.pausaAutomatica).toBe(0);
    expect(r.pausa).toBe(30);
  });

  it('un permesso che copre il pranzo vale come pausa fatta', () => {
    const g = giornata(
      [['ENTRATA', '08:30'], ['USCITA_PERMESSO', '12:00'], ['RIENTRO_PERMESSO', '13:30'], ['USCITA', '17:30']],
      { data: DAL },
    );
    expect(calcolaGiornata(g, imp, null).pausaAutomatica).toBe(0);
  });

  it('a giornata ancora aperta non scala nulla (la pausa si può ancora aggiungere)', () => {
    const g = giornata([['ENTRATA', '08:30']], { data: DAL });
    expect(calcolaGiornata(g, imp, h('16:00')).pausaAutomatica).toBe(0);
  });

  it('le giornate prima del 12 ottobre 2026 restano come erano', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA', '17:00']], { data: PRIMA });
    const r = calcolaGiornata(g, imp, null);
    expect(r.pausaAutomatica).toBe(0);
    expect(r.lavorati).toBe(510);
    expect(r.saldo).toBe(30);
  });
});
