// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { ID_AVVISO, pianificaAvvisi } from '../src/core/avvisi';
import { formattaOra } from '../src/core/tempo';
import { IMPOSTAZIONI_PREDEFINITE } from '../src/core/tipi';
import { GIOVEDI, giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const piano = (g: ReturnType<typeof giornata>, ora: string, i = imp) =>
  pianificaAvvisi(g, i, { data: GIOVEDI, minuti: h(ora) }).map((a) => `${a.tipo} ${formattaOra(a.minuti)}`);

function conAvvisi(modifiche: Partial<typeof imp.avvisi>) {
  return impostazioni({ avvisi: { ...imp.avvisi, ...modifiche } });
}

const sigaretta = () => {
  const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']]);
  g.eventi[1]!.sigaretta = true;
  return g;
};

describe('avviso di uscita prevista', () => {
  it('al lavoro prima della pausa: include la pausa minima', () => {
    expect(piano(giornata([['ENTRATA', '08:30']]), '09:00')).toEqual(['uscita 17:00']);
  });

  it('dopo la pausa: uscita prevista dalle timbrature', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30']]);
    expect(piano(g, '14:00')).toEqual(['uscita 17:30']);
  });

  it('non cambia mentre si lavora', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30']]);
    expect(piano(g, '13:30')).toEqual(piano(g, '16:59'));
  });

  it('nessun avviso se l\'uscita prevista è già passata', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30']]);
    expect(piano(g, '18:00')).toEqual([]);
  });

  it('tiene conto del permesso a inizio giornata', () => {
    const g = giornata([['ENTRATA', '10:30']], { permessoInizio: 120 });
    expect(piano(g, '10:30')).toEqual(['uscita 17:00']);
  });

  it('disattivato nelle impostazioni', () => {
    expect(piano(giornata([['ENTRATA', '08:30']]), '09:00', conAvvisi({ uscita: false }))).toEqual([]);
  });
});

describe('avviso di rientro dalla pausa pranzo', () => {
  const inPausa = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']]);

  it('30 minuti dopo l\'inizio della pausa, e niente avviso di uscita', () => {
    expect(piano(inPausa, '12:30')).toEqual(['pausa 13:00']);
  });

  it('durata configurabile', () => {
    expect(piano(inPausa, '12:30', conAvvisi({ pranzoMinuti: 45 }))).toEqual(['pausa 13:15']);
    expect(piano(inPausa, '12:30', conAvvisi({ pranzoMinuti: 60 }))).toEqual(['pausa 13:30']);
  });

  it('parte dall\'inizio reale della pausa, anche se la si apre più tardi', () => {
    expect(piano(inPausa, '12:50')).toEqual(['pausa 13:00']);
  });

  it('nessun avviso se la durata è già trascorsa', () => {
    expect(piano(inPausa, '13:10')).toEqual([]);
  });

  it('disattivato nelle impostazioni', () => {
    expect(piano(inPausa, '12:30', conAvvisi({ pranzo: false }))).toEqual([]);
  });
});

describe('avviso di rientro dalla pausa sigaretta', () => {
  it('1 minuto prima della fine della tolleranza (11 minuti di default)', () => {
    expect(piano(sigaretta(), '10:00')).toEqual(['sigaretta 10:10']);
  });

  it('segue la tolleranza configurata', () => {
    expect(piano(sigaretta(), '10:00', impostazioni({ tolleranzaSigaretta: 5 }))).toEqual(['sigaretta 10:04']);
  });

  it('anticipo configurabile', () => {
    expect(piano(sigaretta(), '10:00', conAvvisi({ sigarettaAnticipo: 3 }))).toEqual(['sigaretta 10:08']);
  });

  it('anticipo 0: allo scadere della tolleranza', () => {
    const [a] = pianificaAvvisi(sigaretta(), conAvvisi({ sigarettaAnticipo: 0 }), { data: GIOVEDI, minuti: h('10:00') });
    expect(a).toMatchObject({ minuti: h('10:11'), titolo: 'Pausa sigaretta finita' });
  });

  it('anticipo pari o superiore alla tolleranza: niente avviso', () => {
    expect(piano(sigaretta(), '10:00', conAvvisi({ sigarettaAnticipo: 11 }))).toEqual([]);
    expect(piano(sigaretta(), '10:00', conAvvisi({ sigarettaAnticipo: 15 }))).toEqual([]);
  });

  it('con tolleranza di 1 minuto o meno non c\'è tempo per avvisare', () => {
    expect(piano(sigaretta(), '10:00', impostazioni({ tolleranzaSigaretta: 1 }))).toEqual([]);
    expect(piano(sigaretta(), '10:00', impostazioni({ tolleranzaSigaretta: 0 }))).toEqual([]);
  });

  it('nessun avviso se il minuto prima della fine è già passato', () => {
    expect(piano(sigaretta(), '10:10')).toEqual([]);
    expect(piano(sigaretta(), '10:20')).toEqual([]);
  });

  describe('con l\'istante preciso di inizio', () => {
    // 10:00:40 a Roma (UTC+2): la pausa è iniziata 40 secondi dopo il minuto della timbratura.
    const inizio = Date.parse('2026-10-01T08:00:40Z');
    const opz = (ora: string) => ({ ora: Date.parse(ora), inizioSigaretta: (id: string) => (id === g.eventi[1]!.id ? inizio : null) });
    const g = sigaretta();

    it('suona esattamente 1 minuto prima della fine, al secondo', () => {
      const [a] = pianificaAvvisi(g, imp, { data: GIOVEDI, minuti: h('10:01') }, opz('2026-10-01T08:01:00Z'));
      expect(a).toMatchObject({ tipo: 'sigaretta', istante: inizio + 10 * 60_000 }); // 10:10:40
    });

    it('nessun avviso se quell\'istante è già passato, anche nello stesso minuto', () => {
      expect(pianificaAvvisi(g, imp, { data: GIOVEDI, minuti: h('10:10') }, opz('2026-10-01T08:10:50Z'))).toEqual([]);
    });

    it('istante di un\'altra pausa: si torna al minuto della timbratura', () => {
      const [a] = pianificaAvvisi(g, imp, { data: GIOVEDI, minuti: h('10:01') }, { ora: Date.parse('2026-10-01T08:01:00Z'), inizioSigaretta: () => null });
      expect(a).toMatchObject({ tipo: 'sigaretta', minuti: h('10:10') });
      expect(a!.istante).toBeUndefined();
    });
  });

  it('un permesso normale non genera avvisi', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']]);
    expect(piano(g, '10:05')).toEqual([]);
  });

  it('disattivato nelle impostazioni', () => {
    expect(piano(sigaretta(), '10:00', conAvvisi({ sigaretta: false }))).toEqual([]);
  });
});

describe('quando non programmare avvisi', () => {
  it('giornata non iniziata o chiusa', () => {
    expect(piano(giornata([]), '09:00')).toEqual([]);
    const chiusa = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '17:30']]);
    expect(piano(chiusa, '17:31')).toEqual([]);
  });

  it('giornata da correggere', () => {
    const g = giornata([['ENTRATA', '08:30'], ['FINE_PAUSA', '13:30']]);
    expect(piano(g, '14:00')).toEqual([]);
  });

  it('giornata di un altro giorno', () => {
    const g = giornata([['ENTRATA', '08:30']], { data: '2026-09-30' });
    expect(pianificaAvvisi(g, imp, { data: GIOVEDI, minuti: h('09:00') })).toEqual([]);
  });

  it('niente avvisi oltre la mezzanotte', () => {
    const g = giornata([['ENTRATA', '20:00']]);
    expect(piano(g, '20:05')).toEqual([]); // 20:00 + 8h + pausa supera le 24:00
  });

  it('id numerici distinti per tipo', () => {
    expect(new Set(Object.values(ID_AVVISO)).size).toBe(3);
  });
});

describe('impostazioni degli avvisi', () => {
  it('predefiniti: tutti attivi, pausa pranzo 30 minuti, sigaretta 2 minuti prima', () => {
    expect(IMPOSTAZIONI_PREDEFINITE.avvisi).toEqual({ uscita: true, sigaretta: true, sigarettaAnticipo: 2, pranzo: true, pranzoMinuti: 30 });
  });
});

describe('notifica tolta quando coincide col suono dell\'app', () => {
  const inPausa = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']]);
  const al = (g: ReturnType<typeof giornata>, i: typeof imp, ora: string, aperte?: { sigaretta?: boolean; pranzo?: boolean }) =>
    pianificaAvvisi(g, i, { data: GIOVEDI, minuti: h(ora) }, aperte ? { schermateAperte: aperte } : {});
  const pausa30 = (pranzoMinuti: number) => impostazioni({ pausaMinima: 30, avvisi: { ...imp.avvisi, pranzoMinuti } });

  it('sigaretta con anticipo 0 e schermata aperta: niente avviso', () => {
    expect(al(sigaretta(), conAvvisi({ sigarettaAnticipo: 0 }), '10:00', { sigaretta: true })).toEqual([]);
  });
  it('sigaretta con anticipo 2: l\'avviso resta anche a schermata aperta', () => {
    expect(al(sigaretta(), conAvvisi({ sigarettaAnticipo: 2 }), '10:00', { sigaretta: true })).toHaveLength(1);
  });
  it('pranzo con avviso uguale alla pausa minima e schermata aperta: niente avviso', () => {
    expect(al(inPausa, pausa30(30), '12:30', { pranzo: true })).toEqual([]);
  });
  it('pranzo con avviso dopo 45 minuti: resta', () => {
    expect(al(inPausa, pausa30(45), '12:30', { pranzo: true })).toHaveLength(1);
  });
  it('senza schermateAperte tutto come prima', () => {
    expect(al(inPausa, pausa30(30), '12:30')).toHaveLength(1);
    expect(al(sigaretta(), conAvvisi({ sigarettaAnticipo: 0 }), '10:00')).toHaveLength(1);
  });
});
