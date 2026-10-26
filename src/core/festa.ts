// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Temi delle feste: si accendono da soli nei giorni della festa (data di Roma) e l'utente li può
 * spegnere da Impostazioni → Aspetto. Per ora solo Halloween.
 */
export type Festa = 'halloween';

/** Halloween: dal 24 ottobre a Ognissanti (1 novembre) compresi. */
const HALLOWEEN = { da: '10-24', a: '11-01' };

/** La festa del giorno `data` ('YYYY-MM-DD'), o null. */
export function festaDelGiorno(data: string): Festa | null {
  const mmgg = data.slice(5);
  return mmgg >= HALLOWEEN.da && mmgg <= HALLOWEEN.a ? 'halloween' : null;
}

/** Chiave dello spegnimento: vale per la festa di quell'anno, l'anno dopo il tema torna da solo. */
export function chiaveFesta(festa: Festa, data: string): string {
  return `${festa}-${data.slice(0, 4)}`;
}
