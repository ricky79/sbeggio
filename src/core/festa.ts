// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Temi delle feste: si accendono da soli nei giorni della festa (data di Roma) e l'utente li può
 * spegnere da Impostazioni → Aspetto. Halloween e Natale.
 */
export type Festa = 'halloween' | 'natale';

/** Halloween: dal 24 ottobre a Ognissanti (1 novembre) compresi. */
const HALLOWEEN = { da: '10-24', a: '11-01' };

/** Natale: dall'8 dicembre all'Epifania (6 gennaio) compresi, a cavallo d'anno. */
const NATALE = { da: '12-08', a: '01-06' };

/** La festa del giorno `data` ('YYYY-MM-DD'), o null. */
export function festaDelGiorno(data: string): Festa | null {
  const mmgg = data.slice(5);
  if (mmgg >= HALLOWEEN.da && mmgg <= HALLOWEEN.a) return 'halloween';
  if (mmgg >= NATALE.da || mmgg <= NATALE.a) return 'natale';
  return null;
}

/**
 * Chiave dello spegnimento: vale per la festa di quell'anno, l'anno dopo il tema torna da solo.
 * Natale è a cavallo d'anno: fino all'Epifania la stagione è quella iniziata a dicembre prima.
 */
export function chiaveFesta(festa: Festa, data: string): string {
  const anno = Number(data.slice(0, 4));
  const stagione = festa === 'natale' && data.slice(5) <= NATALE.a ? anno - 1 : anno;
  return `${festa}-${stagione}`;
}
