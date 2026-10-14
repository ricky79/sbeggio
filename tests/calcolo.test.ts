// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { anteprimaSigaretta, calcolaGiornata, propostaRientro } from '../src/core/calcolo';
import { formattaOra } from '../src/core/tempo';
import { giornata, h, impostazioni, SABATO } from './helpers';
import type { Giornata, TipoEvento } from '../src/core/tipi';

const imp = impostazioni();
const uscita = (r: { uscitaPrevista: number | null }) =>
  r.uscitaPrevista === null ? null : formattaOra(r.uscitaPrevista);

describe('test obbligatori (8h dovute, pausa da scalare 60 min)', () => {
  it('1. normale: entrata 08:30, pausa 12:30–13:30 → uscita 17:30', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
    ]);
    for (const adesso of ['13:30', '14:00', '16:45']) {
      expect(uscita(calcolaGiornata(g, imp, h(adesso)))).toBe('17:30');
    }
  });

  it('2. ingresso posticipato: permesso 2h, entrata 10:30, pausa 12:30–13:30 → uscita 17:30', () => {
    const g = giornata(
      [
        ['ENTRATA', '10:30'],
        ['INIZIO_PAUSA', '12:30'],
        ['FINE_PAUSA', '13:30'],
      ],
      { permessoInizio: 120 },
    );
    const r = calcolaGiornata(g, imp, h('14:00'));
    expect(uscita(r)).toBe('17:30');
    expect(r.permessoInizio).toBe(120);
  });

  it('3. uscita anticipata 15:30 → lavorate 6h, permesso 2h, saldo 0', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA_ANTICIPATA', '15:30'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.stato).toBe('CHIUSA');
    expect(r.daCorreggere).toBe(false);
    expect(r.lavorati).toBe(360);
    expect(r.permesso).toBe(120);
    expect(r.permessoUscita).toBe(120);
    expect(r.saldo).toBe(0);
  });

  it('4. permesso a metà mattina 10:00–11:00 → uscita 17:30', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
      ['RIENTRO_PERMESSO', '11:00'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
    ]);
    const r = calcolaGiornata(g, imp, h('14:00'));
    expect(uscita(r)).toBe('17:30');
    expect(r.permessoIntermedio).toBe(60);
    expect(r.ripartizioni).toEqual([]);
  });

  it('5. permesso 12:00–14:30 senza pausa → 1h pausa + 1h30 permesso, uscita 17:30', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '14:30'],
    ]);
    const r = calcolaGiornata(g, imp, h('15:00'));
    expect(r.ripartizioni).toHaveLength(1);
    expect(r.ripartizioni[0]).toMatchObject({ proposta: 60, pausa: 60, permesso: 90, confermata: false });
    expect(r.permessoIntermedio).toBe(90);
    expect(r.pausaFatta).toBe(true);
    expect(uscita(r)).toBe('17:30');
  });

  it('6. straordinario: entrata 08:00 (conta 08:30), pausa 12:00–13:00, uscita 18:00 → saldo +30 min', () => {
    const g = giornata([
      ['ENTRATA', '08:00'],
      ['INIZIO_PAUSA', '12:00'],
      ['FINE_PAUSA', '13:00'],
      ['USCITA', '18:00'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.lavorati).toBe(510);
    expect(r.saldo).toBe(30);
  });

  it('6b. straordinario: entrata 08:30, pausa 12:00–13:00, uscita 18:30 → saldo +1h', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:00'],
      ['FINE_PAUSA', '13:00'],
      ['USCITA', '18:30'],
    ]);
    expect(calcolaGiornata(g, imp, null).saldo).toBe(60);
  });
});

describe('orario minimo 08:30', () => {
  it('entrata 07:45 conta come 08:30 anche per l\'uscita prevista', () => {
    const g = giornata([
      ['ENTRATA', '07:45'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
    ]);
    expect(uscita(calcolaGiornata(g, imp, h('14:00')))).toBe('17:30');
  });

  it('prima delle 08:30 il lavoro in corso vale 0', () => {
    const g = giornata([['ENTRATA', '08:00']]);
    const r = calcolaGiornata(g, imp, h('08:15'));
    expect(r.lavorati).toBe(0);
    expect(uscita(r)).toBe('17:00'); // 08:30 + 8h + 30 min di pausa minima
  });

  it('l\'orario minimo è configurabile', () => {
    const g = giornata([
      ['ENTRATA', '08:00'],
      ['INIZIO_PAUSA', '12:00'],
      ['FINE_PAUSA', '13:00'],
      ['USCITA', '17:00'],
    ]);
    expect(calcolaGiornata(g, impostazioni({ orarioMinimoConteggio: h('07:30') }), null).saldo).toBe(0);
  });
});

describe('pausa minima 30 min', () => {
  it('una pausa di 15 minuti conta come 30', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '12:45'],
    ]);
    const r = calcolaGiornata(g, imp, h('13:00'));
    expect(r.lavorati).toBe(240 + 15 - 15); // 4h + 15 min dopo la pausa − 15 min di penalità
    expect(r.pausa).toBe(30);
    expect(r.pausaAggiuntaMinima).toBe(15);
    expect(uscita(r)).toBe('17:00');
  });

  it('una pausa lunga almeno il minimo non aggiunge nulla, anche se in corso', () => {
    const fatta = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:15'],
    ]);
    const r = calcolaGiornata(fatta, imp, h('14:00'));
    expect(r.pausa).toBe(45);
    expect(r.pausaAggiuntaMinima).toBe(0);
    const inCorso = calcolaGiornata(giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']]), imp, h('12:40'));
    expect(inCorso.pausa).toBe(10);
    expect(inCorso.pausaAggiuntaMinima).toBe(0);
  });

  it('pausa di 15 minuti con uscita: il saldo tiene conto del minimo', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '12:45'],
      ['USCITA', '17:00'],
    ]);
    expect(calcolaGiornata(g, imp, null).saldo).toBe(0);
  });

  it('durante la pausa l\'uscita prevista considera il rientro dopo almeno 30 min', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
    ]);
    const r = calcolaGiornata(g, imp, h('12:40'));
    expect(r.stato).toBe('IN_PAUSA');
    expect(uscita(r)).toBe('17:00');
    expect(uscita(calcolaGiornata(g, imp, h('13:30')))).toBe('17:30');
  });
});

describe('uscita prevista prima della pausa', () => {
  it('include la pausa minima se l\'uscita cade dopo la fascia pranzo', () => {
    const g = giornata([['ENTRATA', '08:30']]);
    const r = calcolaGiornata(g, imp, h('10:00'));
    expect(uscita(r)).toBe('17:00');
    expect(r.uscitaPrevistaConPausa).toBe(true);
  });

  it('test 2 prima della pausa: 10:30 con 2h di permesso → 17:00 (pausa minima)', () => {
    const g = giornata([['ENTRATA', '10:30']], { permessoInizio: 120 });
    expect(uscita(calcolaGiornata(g, imp, h('10:30')))).toBe('17:00');
  });

  it('non aggiunge la pausa se si esce prima della fascia pranzo', () => {
    const g = giornata([['ENTRATA', '08:30']], { permessoInizio: 240 });
    const r = calcolaGiornata(g, imp, h('09:00'));
    expect(uscita(r)).toBe('12:30');
    expect(r.uscitaPrevistaConPausa).toBe(false);
  });

  it('aggiunge la pausa minima anche a fascia pranzo passata, se non è fatta', () => {
    const g = giornata([['ENTRATA', '10:00']]);
    const r = calcolaGiornata(g, imp, h('15:00'));
    expect(uscita(r)).toBe('18:30');
    expect(r.uscitaPrevistaConPausa).toBe(true);
  });

  it('ore già completate: uscita prevista nel passato, saldo positivo', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
    ]);
    const r = calcolaGiornata(g, imp, h('18:00'));
    expect(uscita(r)).toBe('17:30');
    expect(r.saldo).toBe(30);
  });
});

describe('permesso a ridosso del pranzo', () => {
  it('sovrapposizione parziale minore della pausa da scalare', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '11:00'],
      ['RIENTRO_PERMESSO', '12:30'],
    ]);
    const r = calcolaGiornata(g, imp, h('13:00'));
    expect(r.ripartizioni[0]).toMatchObject({ proposta: 30, pausa: 30, permesso: 60 });
  });

  it('nessuna ripartizione se la pausa è registrata', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '13:00'],
      ['INIZIO_PAUSA', '13:00'],
      ['FINE_PAUSA', '14:00'],
    ]);
    const r = calcolaGiornata(g, imp, h('14:30'));
    expect(r.ripartizioni).toEqual([]);
    expect(r.permessoIntermedio).toBe(60);
  });

  it('ripartizione modificata dall\'utente', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '14:30', 30],
    ]);
    const r = calcolaGiornata(g, imp, h('15:00'));
    expect(r.ripartizioni[0]).toMatchObject({ proposta: 60, pausa: 30, permesso: 120, confermata: true });
    expect(uscita(r)).toBe('17:00');
  });

  it('ripartizione confermata a 0: tutto permesso', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '14:30', 0],
    ]);
    const r = calcolaGiornata(g, imp, h('15:00'));
    expect(r.permessoIntermedio).toBe(150);
    expect(r.pausaFatta).toBe(false);
  });

  it('la pausa scalata non supera il totale configurato su più permessi', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '12:45'],
      ['USCITA_PERMESSO', '13:00'],
      ['RIENTRO_PERMESSO', '14:00'],
    ]);
    const r = calcolaGiornata(g, imp, h('15:00'));
    expect(r.ripartizioni.map((x) => x.pausa)).toEqual([45, 15]);
    // Seconda uscita: 45 min di permesso reale → 1h (blocchi).
    expect(r.permessoIntermedio).toBe(0 + 60);
  });

  it('propostaRientro simula il rientro prima di registrarlo', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
    ]);
    expect(propostaRientro(g, imp, h('14:30'))).toMatchObject({ pausa: 60, permesso: 90 });
    const mattina = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
    ]);
    expect(propostaRientro(mattina, imp, h('11:00'))).toBeNull();
  });

  it('fascia pranzo e pausa da scalare configurabili', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '14:30'],
    ]);
    const r = calcolaGiornata(g, impostazioni({ pranzo: { inizio: h('13:00'), fine: h('14:00') }, pausaDaScalare: 45 }), h('15:00'));
    expect(r.ripartizioni[0]).toMatchObject({ pausa: 45, permesso: 105 });
  });
});

describe('uscita anticipata', () => {
  it('prima della pausa: tutte le ore mancanti sono permesso', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_ANTICIPATA', '11:30'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.lavorati).toBe(180);
    expect(r.permesso).toBe(300);
    expect(r.saldo).toBe(0);
  });

  it('con permesso a inizio giornata', () => {
    const g = giornata(
      [
        ['ENTRATA', '10:30'],
        ['USCITA_ANTICIPATA', '12:30'],
      ],
      { permessoInizio: 120 },
    );
    const r = calcolaGiornata(g, imp, null);
    expect(r.permesso).toBe(360);
    expect(r.saldo).toBe(0);
  });

  it('se le ore sono già coperte non genera permesso', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA_ANTICIPATA', '18:00'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.permessoUscita).toBe(0);
    expect(r.saldo).toBe(30);
  });
});

describe('ore dovute per giorno della settimana', () => {
  it('sabato con 0 ore dovute: tutto straordinario', () => {
    const g = giornata(
      [
        ['ENTRATA', '09:00'],
        ['USCITA', '12:00'],
      ],
      { data: SABATO },
    );
    const r = calcolaGiornata(g, imp, null);
    expect(r.dovuti).toBe(0);
    expect(r.saldo).toBe(180);
  });

  it('venerdì corto (6h)', () => {
    const imp6 = impostazioni({ minutiDovuti: { predefinito: 480, perGiorno: [0, null, null, null, null, 360, 0] } });
    const g = giornata(
      [
        ['ENTRATA', '08:30'],
        ['INIZIO_PAUSA', '12:30'],
        ['FINE_PAUSA', '13:00'],
      ],
      { data: '2026-10-02' },
    );
    expect(uscita(calcolaGiornata(g, imp6, h('13:00')))).toBe('15:00');
  });
});

describe('eventi incoerenti', () => {
  it('fine pausa senza inizio pausa: da correggere, nessun crash', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA', '17:30'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.daCorreggere).toBe(true);
    expect(r.problemi[0]).toMatch(/Fine pausa pranzo alle 13:30 senza inizio pausa pranzo/);
    expect(r.lavorati).toBe(540); // calcolo comunque "migliore possibile"
  });

  it('doppia entrata', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['ENTRATA', '09:00'],
    ]);
    const r = calcolaGiornata(g, imp, h('10:00'));
    expect(r.daCorreggere).toBe(true);
    expect(r.problemi[0]).toMatch(/Entrata doppia/);
  });

  it('eventi dopo l\'uscita', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA', '17:30'],
      ['INIZIO_PAUSA', '18:00'],
    ]);
    expect(calcolaGiornata(g, imp, null).problemi[0]).toMatch(/dopo la fine della giornata/);
  });

  it('uscita durante la pausa (fine pausa dimenticata)', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['USCITA', '17:30'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.daCorreggere).toBe(true);
    expect(r.problemi.join(' ')).toMatch(/durante la pausa/);
  });

  it('giornata passata senza uscita', () => {
    const g = giornata([['ENTRATA', '08:30']]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.daCorreggere).toBe(true);
    expect(r.problemi).toContain('Manca la timbratura di uscita.');
  });

  it('dati corrotti (orari fuori scala, eventi nulli) non lanciano eccezioni', () => {
    const g = giornata([['ENTRATA', '08:30']]);
    g.eventi.push({ id: 'x', tipo: 'USCITA', minuti: 5000 });
    (g.eventi as unknown[]).push(null);
    g.permessoInizioMinuti = Number.NaN;
    expect(() => calcolaGiornata(g, imp, h('10:00'))).not.toThrow();
    expect(calcolaGiornata(g, imp, h('10:00')).daCorreggere).toBe(true);
  });

  it('eventi inseriti fuori ordine vengono ordinati per orario', () => {
    const g = giornata([
      ['FINE_PAUSA', '13:30'],
      ['ENTRATA', '08:30'],
      ['USCITA', '17:30'],
      ['INIZIO_PAUSA', '12:30'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.daCorreggere).toBe(false);
    expect(r.saldo).toBe(0);
  });
});

describe('giornata vuota', () => {
  it('nessun evento', () => {
    const r = calcolaGiornata(giornata([]), imp, h('09:00'));
    expect(r.stato).toBe('NON_INIZIATA');
    expect(r.coperti).toBe(0);
    expect(r.uscitaPrevista).toBeNull();
    expect(r.daCorreggere).toBe(false);
  });
});

describe('pausa sigaretta', () => {
  /** Marca come sigaretta tutte le uscite in permesso. */
  const conSigaretta = (g: Giornata): Giornata => {
    for (const e of g.eventi) if (e.tipo === 'USCITA_PERMESSO') e.sigaretta = true;
    return g;
  };
  const conPausa = (altri: Parameters<typeof giornata>[0]) =>
    giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ...altri]);

  it('15 min → 30 min di permesso, lavorate −15, coperte invariate', () => {
    const eventi: Parameters<typeof giornata>[0] = [['USCITA_PERMESSO', '15:00'], ['RIENTRO_PERMESSO', '15:15'], ['USCITA', '17:30']];
    const normale = calcolaGiornata(conPausa(eventi), imp, null);
    const r = calcolaGiornata(conSigaretta(conPausa(eventi)), imp, null);
    // Anche un permesso normale vale blocchi da 30 (#12): stesso conteggio della sigaretta.
    expect(normale.permesso).toBe(30);
    expect(r.permesso).toBe(30);
    // Lavoro reale 465 min (08:30–12:30, 13:30–15:00, 15:15–17:30), meno l'eccedenza di 15.
    expect(r.lavorati).toBe(465 - 15);
    expect(r.coperti).toBe(normale.coperti);
    expect(r.saldo).toBe(0);
    expect(r.sigarette).toEqual([
      { eventoRientroId: r.sigarette[0]!.eventoRientroId, da: h('15:00'), a: h('15:15'), durata: 15, permesso: 30 },
    ]);
    expect(r.sigarette[0]!.eventoRientroId).toBeTruthy();
  });

  it('42 min → 1h di permesso', () => {
    const r = calcolaGiornata(
      conSigaretta(conPausa([['USCITA_PERMESSO', '15:00'], ['RIENTRO_PERMESSO', '15:42'], ['USCITA', '17:30']])),
      imp,
      null,
    );
    expect(r.permesso).toBe(60);
    expect(r.lavorati).toBe(420);
    expect(r.coperti).toBe(480);
  });

  it('l\'uscita prevista non cambia', () => {
    const r = calcolaGiornata(conSigaretta(conPausa([['USCITA_PERMESSO', '15:00'], ['RIENTRO_PERMESSO', '15:15']])), imp, h('16:00'));
    expect(uscita(r)).toBe('17:30');
  });

  it('in fascia pranzo senza pausa registrata non diventa pausa pranzo', () => {
    const r = calcolaGiornata(
      conSigaretta(giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '12:30'], ['RIENTRO_PERMESSO', '12:45']])),
      imp,
      h('13:00'),
    );
    expect(r.ripartizioni).toEqual([]);
    expect(r.permesso).toBe(30);
    expect(r.pausaFatta).toBe(false);
    expect(r.uscitaPrevistaConPausa).toBe(true);
  });

  it('in corso conta la durata reale', () => {
    const r = calcolaGiornata(conSigaretta(giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']])), imp, h('10:08'));
    expect(r.stato).toBe('IN_PERMESSO');
    expect(r.permesso).toBe(8);
    expect(r.sigarette).toEqual([]);
  });

  it('sigaretta a inizio giornata: le coperte non superano il tempo trascorso', () => {
    const g = conSigaretta(giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '08:35'], ['RIENTRO_PERMESSO', '08:40']]));
    const presto = calcolaGiornata(g, imp, h('08:41'));
    expect(presto.coperti).toBe(11);
    expect(presto.lavorati).toBe(0);
    expect(presto.permesso).toBe(11);
    const dopo = calcolaGiornata(g, imp, h('09:30'));
    expect(dopo.coperti).toBe(60);
    expect(dopo.lavorati).toBe(30);
    expect(dopo.permesso).toBe(30);
  });

  it('interamente prima dell’inizio conteggio non costa permesso', () => {
    const g = conSigaretta(
      giornata([
        ['ENTRATA', '08:00'],
        ['USCITA_PERMESSO', '08:10'],
        ['RIENTRO_PERMESSO', '08:25'],
        ['INIZIO_PAUSA', '12:30'],
        ['FINE_PAUSA', '13:30'],
        ['USCITA', '17:30'],
      ]),
    );
    const r = calcolaGiornata(g, imp, null);
    expect(r.permesso).toBe(0);
    expect(r.lavorati).toBe(480);
    expect(r.sigarette.map((x) => x.permesso)).toEqual([0]);
    const inCorso = conSigaretta(giornata([['ENTRATA', '08:00'], ['USCITA_PERMESSO', '08:10']]));
    expect(anteprimaSigaretta(inCorso, imp, h('08:25'))?.permesso).toBe(0);
  });

  it('a cavallo dell’inizio conteggio vale il blocco', () => {
    const r = calcolaGiornata(
      conSigaretta(giornata([['ENTRATA', '08:00'], ['USCITA_PERMESSO', '08:20'], ['RIENTRO_PERMESSO', '08:40'], ['USCITA', '17:30']])),
      imp,
      null,
    );
    expect(r.permesso).toBe(30);
  });

  it('anteprima del permesso rientrando adesso', () => {
    const g = conSigaretta(giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']]));
    expect(anteprimaSigaretta(g, imp, h('10:20'))).toMatchObject({ durata: 20, permesso: 30 });
    expect(anteprimaSigaretta(g, imp, h('10:31'))).toMatchObject({ durata: 31, permesso: 60 });
    expect(anteprimaSigaretta(giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']]), imp, h('10:20'))).toBeNull();
  });
});

describe('permessi a blocchi da 30 min', () => {
  it('uscita anticipata con 1h23 mancanti → 1h30 di permesso, lavorate −7, saldo 0', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA_ANTICIPATA', '16:07'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.permessoUscita).toBe(90);
    expect(r.lavorati).toBe(397 - 7);
    expect(r.coperti).toBe(480);
    expect(r.saldo).toBe(0);
  });

  it('permesso intermedio di 40 min → 1h, lavorate −20, coperte invariate', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
      ['RIENTRO_PERMESSO', '10:40'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA', '17:30'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.permessoIntermedio).toBe(60);
    expect(r.lavorati).toBe(440 - 20);
    expect(r.coperti).toBe(480);
    expect(r.saldo).toBe(0);
    expect(r.permessiIntermedi).toEqual([
      { eventoRientroId: g.eventi[2]!.id, da: h('10:00'), a: h('10:40'), durata: 40, permesso: 60 },
    ]);
  });

  it('due permessi da 20 min valgono 30 + 30', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
      ['RIENTRO_PERMESSO', '10:20'],
      ['USCITA_PERMESSO', '11:00'],
      ['RIENTRO_PERMESSO', '11:20'],
    ]);
    const r = calcolaGiornata(g, imp, h('12:00'));
    expect(r.permessoIntermedio).toBe(60);
    expect(r.permessiIntermedi.map((p) => p.permesso)).toEqual([30, 30]);
    expect(r.lavorati).toBe(170 - 20);
  });

  it('permesso a inizio giornata di 40 min → 1h, lavorate −20, uscita invariata', () => {
    const g = giornata(
      [
        ['ENTRATA', '09:10'],
        ['INIZIO_PAUSA', '12:30'],
        ['FINE_PAUSA', '13:30'],
      ],
      { permessoInizio: 40 },
    );
    const r = calcolaGiornata(g, imp, h('14:00'));
    expect(r.permessoInizio).toBe(60);
    expect(r.permessoInizioDichiarato).toBe(40);
    expect(r.lavorati).toBe(230 - 20);
    expect(uscita(r)).toBe('17:30');
  });

  it('permesso a inizio giornata con poco lavoro: le coperte non superano tempo + dichiarato', () => {
    const g = giornata([['ENTRATA', '09:10']], { permessoInizio: 40 });
    const r = calcolaGiornata(g, imp, h('09:15'));
    expect(r.lavorati).toBe(0);
    expect(r.coperti).toBe(45);
  });

  it('con la pausa pranzo di mezzo si arrotonda la sola parte di permesso', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '14:10'],
    ]);
    const r = calcolaGiornata(g, imp, h('15:00'));
    expect(r.ripartizioni[0]).toMatchObject({ pausa: 60, permesso: 70 });
    expect(r.permessiIntermedi[0]).toMatchObject({ durata: 70, permesso: 90 });
    expect(r.permessoIntermedio).toBe(90);
    expect(r.lavorati).toBe(210 + 50 - 20);
  });

  it('un permesso in corso conta il tempo reale', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
    ]);
    const r = calcolaGiornata(g, imp, h('10:40'));
    expect(r.permessoIntermedio).toBe(40);
    expect(r.permessiIntermedi).toEqual([]);
  });

  it('se il lavoro non basta ad assorbire l\'eccedenza le coperte non superano il tempo trascorso', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '08:35'],
      ['RIENTRO_PERMESSO', '08:45'],
    ]);
    const r = calcolaGiornata(g, imp, h('08:50'));
    expect(r.lavorati).toBe(0);
    expect(r.coperti).toBe(20);
  });

  it('con ore dovute non multiple di 30 l\'uscita anticipata non supera le dovute', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_ANTICIPATA', '08:30'],
    ]);
    const r = calcolaGiornata(g, impostazioni({ minutiDovuti: { predefinito: 432, perGiorno: [0, null, null, null, null, null, 0] } }), null);
    expect(r.permessoUscita).toBe(432);
    expect(r.saldo).toBe(0);
  });
});

describe('permesso in uscita pianificato', () => {
  const pausaFatta = (): [TipoEvento, string][] => [
    ['ENTRATA', '08:30'],
    ['INIZIO_PAUSA', '12:30'],
    ['FINE_PAUSA', '13:30'],
  ];

  it('anticipa l\'uscita prevista', () => {
    const r = calcolaGiornata(giornata(pausaFatta(), { permessoUscita: 30 }), imp, h('14:00'));
    expect(uscita(r)).toBe('17:00');
    expect(r.uscitaPrevistaConPermesso).toBe(true);
    expect(r.permessoUscitaPianificato).toBe(30);
  });

  it('con la pausa ancora da fare la pausa si aggiunge dopo la sottrazione', () => {
    const r = calcolaGiornata(giornata([['ENTRATA', '08:30']], { permessoUscita: 30 }), imp, h('10:00'));
    expect(uscita(r)).toBe('16:30');
    expect(r.uscitaPrevistaConPausa).toBe(true);
  });

  it('in pausa: uscita se rientri ora, meno il pianificato', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']], { permessoUscita: 30 });
    expect(uscita(calcolaGiornata(g, imp, h('12:40')))).toBe('16:30');
  });

  it('uscendo con Uscita conta il permesso che manca davvero, a blocchi', () => {
    const casi: [string, number, number][] = [
      ['17:00', 30, 0],
      ['16:45', 60, 0],
      ['17:15', 30, 0],
      ['17:45', 0, 15],
    ];
    for (const [ora, permesso, saldo] of casi) {
      const r = calcolaGiornata(giornata([...pausaFatta(), ['USCITA', ora]], { permessoUscita: 30 }), imp, null);
      expect(r.permessoUscita, ora).toBe(permesso);
      expect(r.saldo, ora).toBe(saldo);
    }
  });

  it('senza permesso pianificato l\'uscita normale non genera permesso', () => {
    const r = calcolaGiornata(giornata([...pausaFatta(), ['USCITA', '17:00']]), imp, null);
    expect(r.permessoUscita).toBe(0);
    expect(r.saldo).toBe(-30);
    expect(r.uscitaPrevistaConPermesso).toBe(false);
  });

  it('con uscita anticipata il pianificato non conta', () => {
    const r = calcolaGiornata(giornata([...pausaFatta(), ['USCITA_ANTICIPATA', '16:45']], { permessoUscita: 30 }), imp, null);
    expect(r.permessoUscita).toBe(60);
  });

  it('pianificato più lungo delle ore rimaste: uscita prevista già passata, all\'uscita conta il mancante reale', () => {
    expect(uscita(calcolaGiornata(giornata(pausaFatta(), { permessoUscita: 240 }), imp, h('14:00')))).toBe('13:30');
    const r = calcolaGiornata(giornata([...pausaFatta(), ['USCITA', '14:00']], { permessoUscita: 240 }), imp, null);
    expect(r.permessoUscita).toBe(210);
    expect(r.saldo).toBe(0);
  });
});
