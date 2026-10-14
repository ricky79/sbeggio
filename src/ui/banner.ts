// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { el } from './dom';

/**
 * Banner in basso, sopra la barra delle schede: l'invito a installare nella PWA (installa.ts) e la
 * nuova versione nell'app Android (aggiornamento.ts). Uno alla volta: ognuno prende il posto del precedente.
 */
let corrente: HTMLElement | null = null;
let misura: ResizeObserver | null = null;

export function creaBanner(b: {
  etichetta: string;
  titolo: string;
  testo: string;
  azione: HTMLElement;
  /** Etichetta del pulsante ✕ per i lettori di schermo. */
  chiudi: string;
  onChiudi: () => void;
}): HTMLElement {
  return el(
    'aside',
    { class: 'banner', 'aria-label': b.etichetta },
    el('p', { class: 'banner-testo' }, el('strong', {}, b.titolo), el('span', {}, b.testo)),
    b.azione,
    el('button', { type: 'button', class: 'banner-chiudi', 'aria-label': b.chiudi, onclick: b.onChiudi }, '✕'),
  );
}

/** Mostra il banner al posto di quello precedente, o lo toglie con null. */
export function mostraBanner(banner: HTMLElement | null): void {
  corrente?.remove();
  misura?.disconnect();
  document.documentElement.style.removeProperty('--altezza-banner');
  corrente = banner;
  if (!banner) return;
  // Pagina e toast si spostano in su dell'altezza del banner (vedi style.css).
  misura ??= new ResizeObserver(() => {
    if (corrente) document.documentElement.style.setProperty('--altezza-banner', `${corrente.offsetHeight + 8}px`);
  });
  document.body.append(banner);
  misura.observe(banner);
}
