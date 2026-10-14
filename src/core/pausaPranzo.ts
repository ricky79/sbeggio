// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata, minutiDovuti } from './calcolo';
import { pausaObbligatoria } from './pausaObbligatoria';
import { analizzaGiornata } from './statoGiornata';
import type { Giornata, Impostazioni } from './tipi';

/** La pausa proposta inizia 15 minuti dopo l'inizio della fascia pranzo e dura 30 minuti (12:15–12:45). */
export const OFFSET_PAUSA_PROPOSTA = 15;
export const DURATA_PAUSA_PROPOSTA = 30;

/**
 * Pausa pranzo da proporre per la giornata di oggi (`adesso` non null), passata la fascia pranzo
 * senza pausa: null se non serve o se a quell'ora non si era al lavoro.
 */
export function pausaDaProporre(
  giornata: Giornata,
  imp: Impostazioni,
  adesso: number | null,
): { inizio: number; fine: number } | null {
  if (adesso === null || adesso < imp.pranzo.fine) return null;
  const inizio = imp.pranzo.inizio + OFFSET_PAUSA_PROPOSTA;
  const fine = inizio + DURATA_PAUSA_PROPOSTA;
  if (fine > imp.pranzo.fine) return null;
  const analisi = analizzaGiornata(giornata);
  if (analisi.idScartati.size > 0) return null;
  // Uscita entro la fine della fascia pranzo: come per l'uscita prevista, la pausa non era dovuta.
  const ultimo = analisi.eventiValidi[analisi.eventiValidi.length - 1];
  if (analisi.stato === 'CHIUSA' && ultimo && ultimo.minuti <= imp.pranzo.fine) return null;
  if (calcolaGiornata(giornata, imp, adesso).pausaFatta) return null;
  const conPausa: Giornata = {
    ...giornata,
    eventi: [
      ...giornata.eventi,
      { id: '__pausa_inizio__', tipo: 'INIZIO_PAUSA', minuti: inizio },
      { id: '__pausa_fine__', tipo: 'FINE_PAUSA', minuti: fine },
    ],
  };
  return analizzaGiornata(conPausa).idScartati.size === 0 ? { inizio, fine } : null;
}

/** "No, l'ho saltata" si offre solo se la pausa non è obbligatoria (meno di 6 ore dovute). */
export function pausaSaltabile(giornata: Giornata, imp: Impostazioni): boolean {
  return !pausaObbligatoria(minutiDovuti(giornata.data, imp));
}
