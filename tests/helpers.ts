// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { parseOra } from '../src/core/tempo';
import { IMPOSTAZIONI_PREDEFINITE, type Evento, type Giornata, type Impostazioni, type TipoEvento } from '../src/core/tipi';
import { clonaImpostazioni } from '../src/storage/migrazioni';

/** Giovedì: 8h dovute con le impostazioni predefinite. */
export const GIOVEDI = '2026-10-01';
export const SABATO = '2026-10-03';

export const h = (ore: string): number => {
  const m = parseOra(ore);
  if (m === null) throw new Error(`Ora non valida: ${ore}`);
  return m;
};

let n = 0;
export function giornata(
  eventi: [TipoEvento, string, number?][],
  opz: { permessoInizio?: number; permessoUscita?: number; data?: string } = {},
): Giornata {
  return {
    data: opz.data ?? GIOVEDI,
    permessoInizioMinuti: opz.permessoInizio ?? 0,
    permessoUscitaMinuti: opz.permessoUscita ?? 0,
    eventi: eventi.map(([tipo, ora, pausaConfermata]): Evento => {
      const e: Evento = { id: `e${++n}`, tipo, minuti: h(ora) };
      if (pausaConfermata !== undefined) e.pausaConfermata = pausaConfermata;
      return e;
    }),
  };
}

/**
 * 8h dovute, pausa da scalare 60 min, fascia pranzo 12:00–14:30, avviso sigaretta 1 min prima: valori
 * fissi su cui sono scritti gli scenari dei test, indipendenti dai predefiniti dell'app (30 min, 12:15, 2 min).
 */
export function impostazioni(modifiche: Partial<Impostazioni> = {}): Impostazioni {
  const base = clonaImpostazioni(IMPOSTAZIONI_PREDEFINITE);
  return {
    ...base,
    pausaDaScalare: 60,
    pranzo: { inizio: 720, fine: 870 },
    avvisi: { ...base.avvisi, sigarettaAnticipo: 1 },
    ...modifiche,
  };
}
