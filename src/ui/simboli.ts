// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { el } from './dom';

/** Emoji di casa, ufficio e ferie, a colori come nel resto dell'app (🚬). Senza store: le usa anche il sito. */
export const CASA = '🏠';
export const UFFICIO = '🏢';
export const ICONA_FERIE = '🏖️';

export function iconaLuogo(emoji: string, classe = 'icona-luogo'): HTMLElement {
  return el('span', { class: classe, 'aria-hidden': 'true' }, emoji);
}

export const iconaCasa = (classe?: string): HTMLElement => iconaLuogo(CASA, classe);
