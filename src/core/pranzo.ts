// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { analizzaGiornata } from './statoGiornata';
import type { Evento, Giornata } from './tipi';

/**
 * Schermata della pausa pranzo: un cronometro che conta in avanti e un cibo che si consuma fino alla
 * pausa minima, quando arriva il caffè.
 */

/** I cibi della schermata: uno a sorpresa per ogni pausa. */
export const CIBI = ['spaghetti', 'pizza', 'panino', 'mela'] as const;
export type Cibo = (typeof CIBI)[number];

/**
 * Cibo della pausa iniziata a `inizio` (ms): a caso da una pausa all'altra, ma sempre lo stesso per la
 * stessa pausa, anche chiudendo e riaprendo l'app. Si usano i minuti: l'inizio salvato e quello ricavato
 * dalla timbratura danno lo stesso cibo.
 */
export function ciboDellaPausa(inizio: number): Cibo {
  return CIBI[Math.abs(Math.floor(inizio / 60_000)) % CIBI.length]!;
}

export interface Avanzamento {
  /** Quanto cibo è mangiato, da 0 a 1 (1 alla pausa minima). */
  mangiato: number;
  /** True dalla pausa minima in poi: arriva il caffè. */
  minimaFatta: boolean;
}

export function avanzamentoPranzo(trascorsiMs: number, pausaMinima: number): Avanzamento {
  const totale = pausaMinima * 60_000;
  const t = Math.max(0, trascorsiMs);
  return { mangiato: totale > 0 ? Math.min(1, t / totale) : 1, minimaFatta: t >= totale };
}

const dueCifre = (n: number) => String(n).padStart(2, '0');

/** Cronometro: "07:42", e da un'ora in su "1:07:42". */
export function testoCronometro(trascorsiMs: number): string {
  const s = Math.floor(Math.max(0, trascorsiMs) / 1000);
  const ore = Math.floor(s / 3600);
  const mmss = `${dueCifre(Math.floor((s % 3600) / 60))}:${dueCifre(s % 60)}`;
  return ore > 0 ? `${ore}:${mmss}` : mmss;
}

/** L'inizio della pausa pranzo in corso (giornata in pausa), o null. */
export function pranzoInCorso(giornata: Giornata): Evento | null {
  const a = analizzaGiornata(giornata);
  if (a.stato !== 'IN_PAUSA') return null;
  const inizio = a.eventiValidi[a.eventiValidi.length - 1];
  return inizio?.tipo === 'INIZIO_PAUSA' ? inizio : null;
}

/**
 * Pausa pranzo da ripresentare da sola (app riaperta, nuovo render): solo se la giornata è coerente.
 * Con timbrature incoerenti l'utente sta correggendo e la schermata non deve bloccarlo.
 */
export function pranzoDaRiprendere(giornata: Giornata): Evento | null {
  return analizzaGiornata(giornata).idScartati.size === 0 ? pranzoInCorso(giornata) : null;
}
