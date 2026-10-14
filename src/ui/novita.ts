// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { dataNovita, NOVITA, novitaDopo, type Novita } from '../core/novita';
import { apriFoglio } from './dialoghi';
import { el } from './dom';

/** Ultima versione di cui l'utente ha visto le novità (per mostrarle una volta dopo l'aggiornamento). */
const CHIAVE = 'timbrature-versione-vista';

/** Elenco delle novità, dalla versione più recente (usato anche dal sito web.sbeggio.app/novita). */
export function elencoNovita(elenco: readonly Novita[]): HTMLElement {
  return el(
    'div',
    { class: 'elenco-novita' },
    elenco.map((n) =>
      el(
        'section',
        { class: 'novita' },
        el('h3', {}, `Versione ${n.versione}`, el('span', { class: 'novita-data' }, dataNovita(n.data))),
        el('ul', {}, n.voci.map((v) => el('li', {}, v))),
      ),
    ),
  );
}

/** Foglio con le novità: quelle indicate, o tutta la cronologia. */
export function apriNovita(elenco: readonly Novita[] = NOVITA, titolo = '🎉 Novità'): Promise<void> {
  return apriFoglio(titolo, elencoNovita(elenco), [{ etichetta: 'Ok', stile: 'primario' }]);
}

/** Pulsante "Novità" (Impostazioni, Aiuto). */
export function pulsanteNovita(classe = 'btn btn-secondario'): HTMLButtonElement {
  return el('button', { type: 'button', class: classe, onclick: () => void apriNovita() }, '🎉 Novità delle versioni');
}

function leggi(): string | null {
  try {
    return localStorage.getItem(CHIAVE);
  } catch {
    return null;
  }
}

function salva(versione: string): void {
  try {
    localStorage.setItem(CHIAVE, versione);
  } catch {
    /* senza memoria si rivedranno alla prossima apertura: pazienza */
  }
}

/**
 * All'avvio: se l'app è stata aggiornata mostra una volta le novità uscite da allora. Alla prima
 * installazione non mostra nulla (non c'è niente di "nuovo" per chi inizia).
 */
export function avviaNovita(versione: string, attesa = 800): void {
  const vista = leggi();
  if (vista === versione) return;
  salva(versione);
  if (vista === null) return;
  const nuove = novitaDopo(vista, versione);
  if (nuove.length === 0) return;
  const titolo = nuove.length === 1 ? `🎉 Novità della versione ${versione}` : '🎉 Novità dall\'ultimo aggiornamento';
  // Non sopra un altro foglio o la pausa sigaretta: aspetta che si chiudano.
  const mostra = () => {
    if (document.querySelector('dialog[open]')) setTimeout(mostra, 2000);
    else void apriNovita(nuove, titolo);
  };
  setTimeout(mostra, attesa);
}
