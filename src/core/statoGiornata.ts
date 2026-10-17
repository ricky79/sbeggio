// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { formattaOra, MINUTI_GIORNO } from './tempo';
import { ETICHETTE_EVENTO, type Evento, type Giornata, type StatoGiornata, type TipoEvento } from './tipi';

export const ETICHETTE_STATO: Record<StatoGiornata, string> = {
  NON_INIZIATA: 'Non iniziata',
  AL_LAVORO: 'Al lavoro',
  IN_PAUSA: 'In pausa',
  IN_PERMESSO: 'In permesso',
  CHIUSA: 'Giornata chiusa',
};

/** Transizioni ammesse: stato corrente → tipo evento → stato successivo. */
const TRANSIZIONI: Record<StatoGiornata, Partial<Record<TipoEvento, StatoGiornata>>> = {
  NON_INIZIATA: { ENTRATA: 'AL_LAVORO' },
  AL_LAVORO: {
    INIZIO_PAUSA: 'IN_PAUSA',
    USCITA_PERMESSO: 'IN_PERMESSO',
    USCITA: 'CHIUSA',
    USCITA_ANTICIPATA: 'CHIUSA',
  },
  IN_PAUSA: { FINE_PAUSA: 'AL_LAVORO' },
  IN_PERMESSO: { RIENTRO_PERMESSO: 'AL_LAVORO' },
  CHIUSA: {},
};

export interface AnalisiGiornata {
  stato: StatoGiornata;
  problemi: string[];
  /** Eventi ordinati per orario che rispettano la macchina a stati. */
  eventiValidi: Evento[];
  /** Tutti gli eventi ordinati per orario (stabile a parità di orario). */
  eventiOrdinati: Evento[];
  /** Id degli eventi scartati perché incoerenti. */
  idScartati: Set<string>;
}

export function ordinaEventi(eventi: readonly Evento[]): Evento[] {
  return eventi
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.minuti - b.e.minuti || a.i - b.i)
    .map((x) => x.e);
}

/**
 * Percorre gli eventi con la macchina a stati. Non lancia mai eccezioni:
 * un evento incoerente viene scartato e segnalato in `problemi`.
 */
export function analizzaGiornata(giornata: Giornata): AnalisiGiornata {
  const problemi: string[] = [];
  const eventiValidi: Evento[] = [];
  const idScartati = new Set<string>();
  const eventi = Array.isArray(giornata.eventi) ? giornata.eventi : [];
  const eventiOrdinati = ordinaEventi(eventi.filter((e) => e && typeof e.minuti === 'number'));
  let stato: StatoGiornata = 'NON_INIZIATA';

  if (!Number.isFinite(giornata.permessoInizioMinuti) || giornata.permessoInizioMinuti < 0) {
    problemi.push('Il permesso a inizio giornata non è valido.');
  }

  for (const e of eventiOrdinati) {
    const etichetta = ETICHETTE_EVENTO[e.tipo] ?? String(e.tipo);
    if (!Number.isInteger(e.minuti) || e.minuti < 0 || e.minuti >= MINUTI_GIORNO) {
      problemi.push(`${etichetta}: orario non valido.`);
      idScartati.add(e.id);
      continue;
    }
    const prossimo: StatoGiornata | undefined = TRANSIZIONI[stato][e.tipo];
    if (prossimo === undefined) {
      problemi.push(descriviIncoerenza(stato, e, etichetta));
      idScartati.add(e.id);
      continue;
    }
    eventiValidi.push(e);
    stato = prossimo;
  }

  return { stato, problemi, eventiValidi, eventiOrdinati, idScartati };
}

function descriviIncoerenza(stato: StatoGiornata, e: Evento, etichetta: string): string {
  const ora = formattaOra(e.minuti);
  switch (stato) {
    case 'NON_INIZIATA':
      return `${etichetta} alle ${ora} senza un'entrata precedente.`;
    case 'CHIUSA':
      return `${etichetta} alle ${ora} dopo la fine della giornata.`;
    case 'IN_PAUSA':
      return `${etichetta} alle ${ora} durante la pausa (manca la fine pausa?).`;
    case 'IN_PERMESSO':
      return `${etichetta} alle ${ora} durante il permesso (manca il rientro?).`;
    case 'AL_LAVORO':
      if (e.tipo === 'ENTRATA') return `Entrata doppia alle ${ora}.`;
      if (e.tipo === 'FINE_PAUSA') return `Fine pausa pranzo alle ${ora} senza inizio pausa pranzo.`;
      if (e.tipo === 'RIENTRO_PERMESSO') return `Rientro da permesso alle ${ora} senza uscita in permesso.`;
      return `${etichetta} alle ${ora} non è coerente.`;
  }
}

/** Azioni proponibili in UI. */
export type Azione =
  | TipoEvento
  | 'PAUSA_SIGARETTA'
  | 'PERMESSO_INIZIO_GIORNATA'
  | 'NON_RIENTRO'
  | 'RIAPRI';

export const ETICHETTE_AZIONE: Record<Azione, string> = {
  ENTRATA: 'Entrata',
  INIZIO_PAUSA: 'Inizio pausa pranzo',
  FINE_PAUSA: 'Fine pausa pranzo',
  USCITA_PERMESSO: 'Esco in permesso',
  RIENTRO_PERMESSO: 'Rientro da permesso',
  USCITA: 'Uscita',
  USCITA_ANTICIPATA: 'Uscita anticipata',
  PAUSA_SIGARETTA: 'Pausa sigaretta',
  PERMESSO_INIZIO_GIORNATA: 'Entro dopo (permesso a inizio giornata)',
  NON_RIENTRO: 'Non rientro (chiudi in permesso)',
  RIAPRI: 'Riapri giornata',
};

export interface AzioniDisponibili {
  /** Pulsanti grandi: di solito uno, due affiancati prima della fascia pranzo, nessuno a giornata chiusa. */
  principali: Azione[];
  secondarie: Azione[];
}

/**
 * Azioni principali e secondarie in base allo stato.
 * `pausaFatta` include la pausa scalata da un permesso a ridosso del pranzo.
 * `primaDelPranzo`: la fascia pranzo non è ancora iniziata, quindi si esce solo in permesso (o in sigaretta).
 */
export function azioniDisponibili(stato: StatoGiornata, pausaFatta: boolean, primaDelPranzo = false): AzioniDisponibili {
  switch (stato) {
    case 'NON_INIZIATA':
      return { principali: ['ENTRATA'], secondarie: ['PERMESSO_INIZIO_GIORNATA'] };
    case 'AL_LAVORO':
      if (pausaFatta) return { principali: ['USCITA'], secondarie: ['PAUSA_SIGARETTA', 'USCITA_PERMESSO', 'USCITA_ANTICIPATA'] };
      return primaDelPranzo
        ? { principali: ['PAUSA_SIGARETTA', 'USCITA_PERMESSO'], secondarie: ['USCITA_ANTICIPATA', 'USCITA'] }
        : { principali: ['INIZIO_PAUSA'], secondarie: ['PAUSA_SIGARETTA', 'USCITA_PERMESSO', 'USCITA_ANTICIPATA', 'USCITA'] };
    case 'IN_PAUSA':
      return { principali: ['FINE_PAUSA'], secondarie: [] };
    case 'IN_PERMESSO':
      return { principali: ['RIENTRO_PERMESSO'], secondarie: ['NON_RIENTRO'] };
    case 'CHIUSA':
      return { principali: [], secondarie: ['RIAPRI'] };
  }
}
