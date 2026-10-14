// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { el } from './dom';

export type Scheda = 'oggi' | 'storico' | 'impostazioni' | 'aiuto';

export const SCHEDE: readonly Scheda[] = ['oggi', 'storico', 'impostazioni', 'aiuto'];

/**
 * Icone 24×24 in stile iOS: a tratto quando la scheda non è attiva, piene quando lo è (come in
 * WhatsApp). I dettagli delle icone piene sono "ritagliati" col colore della barra.
 * Ingranaggio e punto di domanda dalle icone Feather (licenza MIT).
 */
const INGRANAGGIO =
  'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z';
const RITAGLIO = 'class="ritaglio"';

const ICONE: Record<Scheda, { vuota: string; piena: string }> = {
  oggi: {
    vuota: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    piena: `<circle cx="12" cy="12" r="9.6" fill="currentColor"/><path ${RITAGLIO} d="M12 7v5l3.2 2"/>`,
  },
  storico: {
    vuota: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    piena: `<rect x="2.6" y="4.6" width="18.8" height="16.8" rx="3.4" fill="currentColor"/><path ${RITAGLIO} d="M3 10h18"/><path d="M8 3v4M16 3v4"/><path ${RITAGLIO} d="M7.5 14h.01M12 14h.01M16.5 14h.01M7.5 17.5h.01M12 17.5h.01"/>`,
  },
  impostazioni: {
    vuota: `<circle cx="12" cy="12" r="3"/><path d="${INGRANAGGIO}"/>`,
    piena: `<path d="${INGRANAGGIO}" fill="currentColor"/><circle ${RITAGLIO} cx="12" cy="12" r="3" fill="none"/>`,
  },
  aiuto: {
    vuota: '<circle cx="12" cy="12" r="9.5"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    piena: `<circle cx="12" cy="12" r="10" fill="currentColor"/><path ${RITAGLIO} d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>`,
  },
};

const ETICHETTE: Record<Scheda, string> = {
  oggi: 'Oggi',
  storico: 'Storico',
  impostazioni: 'Impostazioni',
  aiuto: 'Aiuto',
};

function icona(scheda: Scheda): HTMLElement {
  const svg = (forma: string, classe: string) =>
    `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${forma}</svg>`;
  const span = el('span', { class: 'tab-icona', 'aria-hidden': 'true' });
  // Markup costante (nessun dato dell'utente): sicuro da inserire così.
  span.innerHTML = svg(ICONE[scheda].vuota, 'icona-vuota') + svg(ICONE[scheda].piena, 'icona-piena');
  return span;
}

export interface Tabbar {
  elemento: HTMLElement;
  /** Segna la scheda attiva; la capsula scorre fin lì. */
  aggiorna(attiva: Scheda): void;
}

/** Barra delle schede: creata una volta sola, così la capsula della scheda attiva può scorrere. */
export function creaTabbar(vai: (s: Scheda) => void): Tabbar {
  const pulsanti = SCHEDE.map((s) =>
    el('button', { type: 'button', class: 'tab', onclick: () => vai(s) }, icona(s), el('span', { class: 'tab-testo' }, ETICHETTE[s])),
  );
  const elemento = el(
    'nav',
    { class: 'tabbar', 'aria-label': 'Sezioni' },
    el('div', { class: 'tabbar-vetro' }, el('span', { class: 'tab-capsula', 'aria-hidden': 'true' }), pulsanti),
  );
  return {
    elemento,
    aggiorna(attiva) {
      elemento.style.setProperty('--indice', String(SCHEDE.indexOf(attiva)));
      SCHEDE.forEach((s, i) => {
        const p = pulsanti[i]!;
        p.classList.toggle('attiva', s === attiva);
        if (s === attiva) p.setAttribute('aria-current', 'page');
        else p.removeAttribute('aria-current');
      });
    },
  };
}

export type Direzione = 'avanti' | 'indietro';

/**
 * Cambia schermata con una transizione (View Transitions API): il contenuto scorre verso sinistra
 * andando avanti e verso destra tornando indietro. Senza supporto o con "riduci movimento"
 * aggiorna e basta.
 */
export function conTransizione(direzione: Direzione, aggiorna: () => void): void {
  const doc = document as Document & { startViewTransition?: (f: () => void) => unknown };
  const ridotto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || ridotto) {
    aggiorna();
    return;
  }
  document.documentElement.dataset.direzione = direzione;
  doc.startViewTransition(aggiorna);
}
