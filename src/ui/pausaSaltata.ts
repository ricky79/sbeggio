// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { nuovoId } from '../core/id';
import { pausaDaProporre, pausaSaltabile } from '../core/pausaPranzo';
import { formattaDurata, formattaOra } from '../core/tempo';
import { store } from '../storage/store';
import { toast } from './dialoghi';
import { el } from './dom';

/** Data dell'ultimo "No, l'ho saltata": è uno stato del dispositivo, non dei dati (come tema e banner). */
const CHIAVE = 'timbrature-pausa-saltata';

function rifiutata(data: string): boolean {
  try {
    return localStorage.getItem(CHIAVE) === data;
  } catch {
    return false;
  }
}

function rifiuta(data: string): void {
  try {
    localStorage.setItem(CHIAVE, data);
  } catch {
    /* il riquadro ricomparirà al prossimo ridisegno */
  }
}

/** Riquadro "Non hai registrato la pausa pranzo" per la giornata di oggi, o null se non serve. */
export function riquadroPausaSaltata(data: string, adesso: number): HTMLElement | null {
  const giornata = store.giornata(data);
  // Pausa obbligatoria: niente "l'ho saltata", e un rifiuto di prima non vale.
  const saltabile = pausaSaltabile(giornata, store.impostazioni);
  if (saltabile && rifiutata(data)) return null;
  const p = pausaDaProporre(giornata, store.impostazioni, adesso);
  if (!p) return null;
  const orari = `dalle ${formattaOra(p.inizio)} alle ${formattaOra(p.fine)}`;
  const testo = saltabile
    ? `Non hai registrato la pausa pranzo: la aggiungo ${orari}?`
    : `La pausa pranzo è obbligatoria e non l'hai registrata: la aggiungo ${orari}? Se non la aggiungi, all'uscita conto ${formattaDurata(store.impostazioni.pausaMinima)} di pausa.`;
  const riquadro = el(
    'div',
    { class: 'scheda avviso-pausa', role: 'status' },
    el('p', {}, testo),
    el(
      'div',
      { class: 'riga-pulsanti' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-primario',
          onclick: () => {
            store.modificaGiornata(data, (g) => {
              g.eventi.push(
                { id: nuovoId(), tipo: 'INIZIO_PAUSA', minuti: p.inizio },
                { id: nuovoId(), tipo: 'FINE_PAUSA', minuti: p.fine },
              );
            });
            toast(`Pausa pranzo aggiunta (${formattaOra(p.inizio)}–${formattaOra(p.fine)})`);
          },
        },
        'Aggiungi pausa',
      ),
      saltabile
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn btn-secondario',
              onclick: () => {
                rifiuta(data);
                riquadro.remove();
              },
            },
            'No, l\'ho saltata',
          )
        : null,
    ),
  );
  return riquadro;
}
