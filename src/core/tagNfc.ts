// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { azioniDisponibili, type Azione } from './statoGiornata';
import type { RisultatoGiornata } from './tipi';

/**
 * Cosa registra una lettura del tag NFC: l'azione del pulsante principale, il rientro dalla pausa
 * sigaretta, oppure la scelta tra pausa e uscita quando la fascia pranzo è finita senza pausa.
 */
export type AzioneTag = Azione | 'RIENTRO_SIGARETTA' | 'PAUSA_O_USCITA';

/** Dopo una timbratura col tag, le letture entro questo tempo vengono ignorate (millisecondi). */
export const PAUSA_LETTURE_MS = 60_000;

export function azioneTag(
  r: RisultatoGiornata,
  sigaretta: boolean,
  minuti: number,
  fineFasciaPranzo: number,
): AzioneTag | null {
  if (sigaretta) return 'RIENTRO_SIGARETTA';
  const { primaria } = azioniDisponibili(r.stato, r.pausaFatta);
  // Alle 17:30 senza pausa il pulsante dice ancora "Inizio pausa": col tag non si indovina, si chiede.
  if (primaria === 'INIZIO_PAUSA' && minuti >= fineFasciaPranzo) return 'PAUSA_O_USCITA';
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

/**
 * Indirizzo che timbra all'apertura, come il tag: https://sbeggio.app/?timbra (Comandi Rapidi di iPhone,
 * scorciatoia "Timbra" sull'icona della PWA). Restituisce l'indirizzo senza il parametro, da mettere al
 * posto di quello aperto perché ricaricare la pagina non timbri di nuovo; null se non c'è ?timbra.
 */
export function indirizzoTimbra(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has('timbra')) return null;
  url.searchParams.delete('timbra');
  return url.href;
}
