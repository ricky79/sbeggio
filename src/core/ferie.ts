// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { minutiDovuti } from './calcolo';
import { haTimbrature } from './giornata';
import { giornoSettimana, spostaData } from './tempo';
import type { Giornata, Impostazioni } from './tipi';

/** Ferie più lunghe di così si inseriscono in più volte (evita errori di battitura sull'anno). */
export const MASSIMO_GIORNI_FERIE = 366;

export interface PianoFerie {
  /** Giorni lavorativi dell'intervallo da segnare (o togliere). */
  date: string[];
  /** Giorni con delle timbrature: lasciati com'erano. */
  conTimbrature: string[];
  /** Giorni senza ore dovute (es. sabato e domenica): saltati. */
  liberi: number;
}

/**
 * Giorni di ferie tra `dal` e `al` compresi: solo quelli con ore dovute, esclusi quelli in cui
 * si è già timbrato. Null se l'intervallo non è valido.
 */
export function pianoFerie(dal: string, al: string, giornate: Record<string, Giornata>, imp: Impostazioni): PianoFerie | null {
  if (al < dal) return null;
  const piano: PianoFerie = { date: [], conTimbrature: [], liberi: 0 };
  let d = dal;
  for (let n = 0; d <= al; n++, d = spostaData(d, 1)) {
    if (n >= MASSIMO_GIORNI_FERIE) return null;
    const g = giornate[d];
    if (minutiDovuti(d, imp) === 0) piano.liberi++;
    else if (g && haTimbrature(g)) piano.conTimbrature.push(d);
    else piano.date.push(d);
  }
  return piano;
}

/** La prossima settimana lavorativa, da lunedì a venerdì (proposta per le ferie). */
export function prossimaSettimana(oggi: string): { dal: string; al: string } {
  const lunedi = spostaData(oggi, ((8 - giornoSettimana(oggi)) % 7) || 7);
  return { dal: lunedi, al: spostaData(lunedi, 4) };
}
