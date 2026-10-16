// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { Luogo } from '../core/tipi';
import { store } from '../storage/store';
import { el } from './dom';
import { CASA, iconaLuogo, UFFICIO } from './simboli';
import { luogoRilevato } from './posizione';

/** Segna la giornata come lavorata da casa (smart) o in sede: è una scelta, la posizione non la cambia più. */
export function impostaLuogo(data: string, luogo: Luogo): void {
  const g = store.giornata(data);
  if (g.luogo === luogo && !g.luogoAutomatico) return;
  store.modificaGiornata(data, (g) => {
    g.luogo = luogo;
    delete g.luogoAutomatico; // scelto a mano: resta anche senza timbrature
  });
}

/**
 * Controllo segmentato casa/ufficio. Mostra il luogo scelto; se non c'è, quello rilevato dalla
 * posizione; altrimenti la sede.
 */
export function controlloLuogo(data: string): HTMLElement {
  const scelto = store.giornata(data).luogo;
  const rilevato = scelto ? null : luogoRilevato(data);
  const attuale = scelto ?? rilevato ?? 'sede';
  const opzione = (valore: Luogo, etichetta: string, emoji: string) =>
    el(
      'button',
      {
        type: 'button',
        class: 'luogo-opzione',
        'aria-pressed': String(valore === attuale),
        'aria-label': etichetta,
        title: valore === rilevato ? `${etichetta}: rilevato dalla posizione` : etichetta,
        onclick: () => impostaLuogo(data, valore),
      },
      iconaLuogo(emoji),
    );
  return el(
    'div',
    { class: 'luogo-contenitore' },
    el(
      'div',
      { class: 'luogo', role: 'group', 'aria-label': 'Dove lavori' },
      opzione('smart', 'Da casa (smart)', CASA),
      opzione('sede', 'In sede', UFFICIO),
    ),
    rilevato ? el('small', { class: 'luogo-nota' }, '📍 dalla posizione') : null,
  );
}
