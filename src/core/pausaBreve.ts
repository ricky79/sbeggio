// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { StilePausaBreve } from './tipi';

/**
 * Nome ed emoji di ogni stile della pausa breve: tutti i testi dell'app che parlano della pausa li
 * prendono da qui. Per aggiungere uno stile: una voce qui e un disegno in src/ui/sigarettaDisegni.ts.
 */
const STILI: Record<StilePausaBreve, { nome: string; emoji: string }> = {
  base: { nome: 'Pausa breve', emoji: '☕' },
  sigaretta: { nome: 'Pausa sigaretta', emoji: '🚬' },
  birretta: { nome: 'Pausa birretta', emoji: '🍺' },
};

/** Gli stili nell'ordine in cui compaiono nelle impostazioni. */
export const STILI_PAUSA_BREVE: readonly StilePausaBreve[] = ['base', 'sigaretta', 'birretta'];

/** "Pausa breve", "Pausa sigaretta", "Pausa birretta". */
export function nomePausa(stile: StilePausaBreve): string {
  return STILI[stile].nome;
}

/** Il nome dentro una frase: "pausa breve". */
export function nomePausaMinuscolo(stile: StilePausaBreve): string {
  return STILI[stile].nome.toLowerCase();
}

export function emojiPausa(stile: StilePausaBreve): string {
  return STILI[stile].emoji;
}

/** Emoji e nome, per bottoni e timbrature: "🍺 Pausa birretta". */
export function etichettaPausa(stile: StilePausaBreve): string {
  return `${emojiPausa(stile)} ${nomePausa(stile)}`;
}
