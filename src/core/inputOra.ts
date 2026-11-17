// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Caselle ore e minuti scritte col tastierino (src/ui/campi.ts). A ogni `input` si rilegge tutto il valore
 * della casella invece della singola cifra: alcune tastiere (es. Gboard) compongono il testo o ne scrivono
 * più caratteri per volta, e incollare "08:47" deve funzionare lo stesso.
 */

export interface Casella {
  /** Cosa mostrare nella casella: '', una cifra o due. */
  testo: string;
  /** La casella non può avere altre cifre: si passa oltre. */
  completa: boolean;
  /** Cifre scritte dopo la chiusura, per la casella successiva. */
  resto: string;
}

/**
 * Tiene solo le cifre e le aggiunge una alla volta: quella che porterebbe oltre `massimo` è scartata, una
 * prima cifra che non ammette una seconda (es. 8 per le ore) chiude subito come "08".
 */
export function normalizza(scritto: string, massimo: number): Casella {
  const cifre = scritto.replace(/\D/g, '');
  let testo = '';
  for (let i = 0; i < cifre.length; i++) {
    const d = Number(cifre[i]);
    if (testo === '') {
      if (d > massimo) continue;
      if (d * 10 > massimo) return { testo: `0${d}`, completa: true, resto: cifre.slice(i + 1) };
      testo = String(d);
    } else {
      if (Number(testo) * 10 + d > massimo) continue;
      return { testo: testo + d, completa: true, resto: cifre.slice(i + 1) };
    }
  }
  return { testo, completa: false, resto: '' };
}

/** Valore all'uscita dalla casella: vuota torna a quello di prima, altrimenti il numero scritto. */
export function chiudi(testo: string, precedente: number): number {
  return testo === '' ? precedente : Number(testo);
}
