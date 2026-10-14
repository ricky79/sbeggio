// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { el } from './dom';

/**
 * Pezzi comuni di Impostazioni e Aiuto: sezioni richiudibili, ricerca a elenco come sull'iPhone e
 * salto a una voce con evidenziazione.
 */

type Contenuto = Node | Node[] | null;

/**
 * Scheda richiudibile con il titolo dell'argomento; parte chiusa. `aperte` ricorda quali sono aperte:
 * ogni salvataggio ridisegna la vista, così restano come le ha lasciate l'utente.
 */
export function sezioneRichiudibile(
  titolo: string,
  aperte: Set<string>,
  contenuto: Contenuto[],
  id?: string,
): HTMLDetailsElement {
  const d = el(
    'details',
    { class: 'scheda sezione-richiudibile', id, 'data-sezione': titolo, open: aperte.has(titolo) },
    el('summary', {}, el('h2', { class: 'titolo-sezione' }, titolo)),
    ...contenuto,
  );
  d.addEventListener('toggle', () => (d.open ? aperte.add(titolo) : aperte.delete(titolo)));
  return d;
}

export interface Risultato {
  nome: string;
  sezione: string;
  scegli: () => void;
}

/** Elenco dei risultati di una ricerca: nome con la sezione sotto e la freccia, oppure il messaggio `vuoto`. */
export function elencoRisultati(risultati: readonly Risultato[], vuoto: string): HTMLElement {
  if (risultati.length === 0) return el('p', { class: 'vuoto' }, vuoto);
  return el(
    'div',
    { class: 'scheda elenco-risultati' },
    risultati.map((r) =>
      el(
        'button',
        { type: 'button', class: 'risultato-ricerca', onclick: r.scegli },
        el('span', { class: 'riga-etichetta' }, r.nome),
        el('small', {}, r.sezione),
      ),
    ),
  );
}

/**
 * Apre la sezione che contiene `elemento` (o, se manca, la sezione `titolo` dentro `pagina`), la porta
 * in vista e la evidenzia per un attimo.
 */
export function mostraVoce(pagina: HTMLElement, elemento: HTMLElement | null, titolo: string): void {
  const scheda = elemento?.closest('details.sezione-richiudibile') ?? pagina.querySelector<HTMLDetailsElement>(`details[data-sezione="${CSS.escape(titolo)}"]`);
  if (scheda instanceof HTMLDetailsElement) scheda.open = true;
  const bersaglio = elemento ?? scheda;
  if (!(bersaglio instanceof HTMLElement)) return;
  requestAnimationFrame(() => {
    bersaglio.scrollIntoView({ block: 'center', behavior: 'smooth' });
    bersaglio.classList.add('evidenziata');
    bersaglio.addEventListener('animationend', () => bersaglio.classList.remove('evidenziata'), { once: true });
  });
}
