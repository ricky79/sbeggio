// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { riepilogoMese } from '../core/riepilogo';
import { adessoRoma, nomeMese, spostaMese } from '../core/tempo';
import type { DatiSalvati } from '../storage/migrazioni';
import { el, monta } from '../ui/dom';
import { schedeMese } from '../ui/storicoMese';

/** Mesi che si possono vedere, rispetto a quello corrente. */
const SCELTE = [
  { etichetta: 'Mese scorso', delta: -1 },
  { etichetta: 'Questo mese', delta: 0 },
] as const;

/**
 * Storico su web.sbeggio.app: lo stesso riepilogo e lo stesso elenco dei giorni dell'app, solo da leggere,
 * per il mese corrente o quello precedente. Niente store: i dati sono quelli ricevuti dal telefono.
 */
export function storicoSito(dati: DatiSalvati): HTMLElement {
  const corpo = el('div');
  const pulsanti = SCELTE.map(({ etichetta, delta }) =>
    el('button', { type: 'button', class: 'sito-segmento', onclick: () => mostra(delta) }, etichetta),
  );

  function mostra(delta: number): void {
    const adesso = adessoRoma();
    const mese = spostaMese(adesso.data.slice(0, 7), delta);
    pulsanti.forEach((p, i) => p.setAttribute('aria-pressed', String(SCELTE[i]!.delta === delta)));
    monta(
      corpo,
      el('h3', { class: 'sito-storico-mese' }, nomeMese(mese)),
      ...schedeMese(riepilogoMese(dati.giornate, dati.impostazioni, mese, adesso), adesso.data),
    );
  }
  mostra(0);

  return el(
    'section',
    { class: 'sito-storico', 'aria-labelledby': 'sito-storico-titolo' },
    el(
      'div',
      { class: 'sito-storico-testata' },
      el('h2', { id: 'sito-storico-titolo' }, 'Storico'),
      el('div', { class: 'sito-segmenti', role: 'group', 'aria-label': 'Mese da vedere' }, pulsanti),
    ),
    corpo,
  );
}
