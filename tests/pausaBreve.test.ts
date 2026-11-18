// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { emojiPausa, etichettaPausa, nomePausa, nomePausaMinuscolo, STILI_PAUSA_BREVE } from '../src/core/pausaBreve';

describe('stili della pausa breve', () => {
  it('tre stili, nell\'ordine delle impostazioni', () => {
    expect(STILI_PAUSA_BREVE).toEqual(['base', 'sigaretta', 'birretta']);
  });

  it.each([
    ['base', 'Pausa breve', '☕', 'pausa breve'],
    ['sigaretta', 'Pausa sigaretta', '🚬', 'pausa sigaretta'],
    ['birretta', 'Pausa birretta', '🍺', 'pausa birretta'],
  ] as const)('%s: nome, emoji ed etichetta', (stile, nome, emoji, minuscolo) => {
    expect(nomePausa(stile)).toBe(nome);
    expect(emojiPausa(stile)).toBe(emoji);
    expect(etichettaPausa(stile)).toBe(`${emoji} ${nome}`);
    expect(nomePausaMinuscolo(stile)).toBe(minuscolo);
  });
});
