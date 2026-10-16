// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { azioniDisponibili, type Azione } from './statoGiornata';
import type { RisultatoGiornata } from './tipi';

/**
 * Cosa registra una lettura del tag NFC: l'azione del pulsante principale, il rientro dalla pausa
 * sigaretta, oppure una scelta quando i pulsanti possibili sono due: sigaretta o permesso prima della
 * fascia pranzo, pausa o uscita quando la fascia pranzo è finita senza pausa.
 */
export type AzioneTag = Azione | 'RIENTRO_SIGARETTA' | 'SIGARETTA_O_PERMESSO' | 'PAUSA_O_USCITA';

/** Dopo una timbratura col tag, le letture entro questo tempo vengono ignorate (millisecondi). */
export const PAUSA_LETTURE_MS = 60_000;

export function azioneTag(
  r: RisultatoGiornata,
  sigaretta: boolean,
  minuti: number,
  pranzo: { inizio: number; fine: number },
): AzioneTag | null {
  if (sigaretta) return 'RIENTRO_SIGARETTA';
  const { principali } = azioniDisponibili(r.stato, r.pausaFatta, minuti < pranzo.inizio);
  if (principali.length > 1) return 'SIGARETTA_O_PERMESSO';
  const primaria = principali[0] ?? null;
  // Alle 17:30 senza pausa il pulsante dice ancora "Inizio pausa": col tag non si indovina, si chiede.
  if (primaria === 'INIZIO_PAUSA' && minuti >= pranzo.fine) return 'PAUSA_O_USCITA';
  return primaria;
}

export type EsitoLettura = 'timbra' | 'gia-letto' | 'finestra-aperta' | 'chiusa';

/**
 * `ultimaTimbratura` è l'istante (epoch ms) dell'ultima lettura che ha cambiato la giornata, o null.
 * Una lettura troppo vicina vince su tutto: è quasi sempre il tag tenuto appoggiato.
 */
export function esitoLettura(p: {
  azione: AzioneTag | null;
  finestraAperta: boolean;
  ora: number;
  ultimaTimbratura: number | null;
}): EsitoLettura {
  if (p.ultimaTimbratura !== null && p.ora - p.ultimaTimbratura < PAUSA_LETTURE_MS) return 'gia-letto';
  if (p.finestraAperta) return 'finestra-aperta';
  if (p.azione === null) return 'chiusa';
  return 'timbra';
}
