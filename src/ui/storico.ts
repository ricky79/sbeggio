// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { riepilogoMese } from '../core/riepilogo';
import { nomeMese, spostaMese } from '../core/tempo';
import { store } from '../storage/store';
import { apriFoglio } from './dialoghi';
import { el } from './dom';
import type { Adesso } from './giorno';
import { esportaCsvCondividi } from './dati';
import { editorFerie } from './ferie';
import { ICONA_FERIE } from './simboli';
import { schedeMese } from './storicoMese';

export function vistaStorico(mese: string, adesso: Adesso, cambiaMese: (m: string) => void, apriGiorno: (data: string) => void): HTMLElement {
  const rm = riepilogoMese(store.giornate, store.impostazioni, mese, adesso);
  const meseCorrente = adesso.data.slice(0, 7);
  // Si va avanti fino al mese corrente, o fino all'ultimo con delle ferie già segnate.
  const ultimoMese = Object.keys(store.giornate).reduce((m, d) => (d.slice(0, 7) > m ? d.slice(0, 7) : m), meseCorrente);

  return el(
    'section',
    { class: 'vista' },
    el('header', { class: 'intestazione' }, el('h1', {}, 'Storico')),
    el(
      'div',
      { class: 'selettore-mese' },
      el('button', { type: 'button', class: 'btn-tondo', 'aria-label': 'Mese precedente', onclick: () => cambiaMese(spostaMese(mese, -1)) }, '‹'),
      el('h2', {}, nomeMese(mese)),
      el(
        'button',
        { type: 'button', class: 'btn-tondo', 'aria-label': 'Mese successivo', disabled: mese >= ultimoMese, onclick: () => cambiaMese(spostaMese(mese, 1)) },
        '›',
      ),
    ),
    ...schedeMese(rm, adesso.data, apriGiorno),
    el(
      'div',
      { class: 'riga-pulsanti' },
      el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void scegliGiorno(adesso.data, apriGiorno) }, '+ Giornata dimenticata'),
      el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void editorFerie(adesso.data) }, `${ICONA_FERIE} Ferie`),
      el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void esportaCsvCondividi(adesso) }, 'Esporta CSV'),
    ),
  );
}

async function scegliGiorno(oggi: string, apriGiorno: (data: string) => void): Promise<void> {
  const input = el('input', { type: 'date', value: oggi, max: oggi });
  let scelta: string | null = null;
  await apriFoglio('Scegli il giorno', el('label', { class: 'campo' }, el('span', {}, 'Data'), input), [
    { etichetta: 'Apri', stile: 'primario', azione: () => { if (!input.value) return false; scelta = input.value; } },
    { etichetta: 'Annulla' },
  ]);
  if (scelta) apriGiorno(scelta);
}
