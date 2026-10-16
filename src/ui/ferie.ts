// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { pianoFerie, prossimaSettimana } from '../core/ferie';
import { formattaDataBreve, formattaDurata } from '../core/tempo';
import type { RisultatoGiornata } from '../core/tipi';
import { store } from '../storage/store';
import { apriFoglio, toast } from './dialoghi';
import { el } from './dom';
import { ICONA_FERIE } from './simboli';

/** Segna o toglie le ferie in un giorno. */
export function impostaFerie(data: string, ferie: boolean): void {
  store.modificaGiornata(data, (g) => {
    if (ferie) g.ferie = true;
    else delete g.ferie;
  });
  toast(ferie ? `${ICONA_FERIE} ${formattaDataBreve(data)} in ferie` : `Ferie tolte da ${formattaDataBreve(data)}`, () =>
    store.modificaGiornata(data, (g) => {
      if (ferie) delete g.ferie;
      else g.ferie = true;
    }),
  );
}

/** Scheda di una giornata di ferie senza timbrature, al posto del riepilogo e dei pulsanti. */
export function schedaFerie(data: string, r: RisultatoGiornata, oggi: boolean): HTMLElement {
  return el(
    'div',
    { class: 'scheda scheda-principale scheda-ferie' },
    el('p', { class: 'etichetta' }, oggi ? 'Oggi sei in ferie' : 'Giornata di ferie'),
    el('p', { class: 'grande', 'aria-hidden': 'true' }, ICONA_FERIE),
    el('p', { class: 'nota' }, r.ferie > 0 ? `${formattaDurata(r.ferie)} di ferie` : 'Nessuna ora dovuta in questo giorno'),
    el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => impostaFerie(data, false) }, 'Togli le ferie'),
  );
}

/**
 * Foglio per segnare (o togliere) le ferie su un intervallo di date, anche future: propone la
 * prossima settimana, da lunedì a venerdì. Salta i giorni senza ore dovute e quelli già timbrati.
 */
export async function editorFerie(oggi: string): Promise<void> {
  const proposta = prossimaSettimana(oggi);
  const dal = el('input', { type: 'date', value: proposta.dal, required: true });
  const al = el('input', { type: 'date', value: proposta.al, required: true });
  const riepilogo = el('p', { class: 'nota' });
  const errore = el('p', { class: 'nota negativo', role: 'alert' });
  const leggi = () => (dal.value && al.value ? pianoFerie(dal.value, al.value, store.giornate, store.impostazioni) : null);
  const aggiorna = () => {
    // "Al" non può essere prima di "Dal": lo si sposta insieme.
    if (dal.value && al.value && al.value < dal.value) al.value = dal.value;
    al.min = dal.value;
    const piano = leggi();
    errore.textContent = '';
    riepilogo.textContent = piano ? descrivi(piano.date.length, piano.liberi, piano.conTimbrature.length) : '';
  };
  dal.addEventListener('change', aggiorna);
  al.addEventListener('change', aggiorna);
  aggiorna();

  let scelta: { segna: boolean; date: string[]; saltati: number } | null = null;
  const conferma = (segna: boolean) => () => {
    const piano = leggi();
    if (!piano) {
      errore.textContent = 'Controlla le date: al massimo un anno alla volta.';
      return false;
    }
    if (piano.date.length === 0) {
      errore.textContent = 'Nessun giorno lavorativo libero in queste date.';
      return false;
    }
    scelta = { segna, date: piano.date, saltati: piano.conTimbrature.length };
  };
  await apriFoglio(
    `${ICONA_FERIE} Ferie`,
    el(
      'div',
      { class: 'modulo' },
      el('label', { class: 'campo' }, el('span', {}, 'Dal'), dal),
      el('label', { class: 'campo' }, el('span', {}, 'Al (compreso)'), al),
      riepilogo,
      errore,
    ),
    [
      { etichetta: 'Segna le ferie', stile: 'primario', azione: conferma(true) },
      { etichetta: 'Togli le ferie', azione: conferma(false) },
      { etichetta: 'Annulla' },
    ],
  );
  const s = scelta as { segna: boolean; date: string[]; saltati: number } | null;
  if (!s) return;
  const prima = new Set(s.date.filter((d) => store.giornata(d).ferie === true));
  store.modificaGiornate(s.date, (g) => {
    if (s.segna) g.ferie = true;
    else delete g.ferie;
  });
  const giorni = `${s.date.length} ${s.date.length === 1 ? 'giorno' : 'giorni'}`;
  const saltati = s.saltati > 0 ? ` (${s.saltati} già timbrati lasciati com'erano)` : '';
  toast(s.segna ? `${ICONA_FERIE} Ferie segnate: ${giorni}${saltati}` : `Ferie tolte: ${giorni}${saltati}`, () =>
    store.modificaGiornate(s.date, (g) => {
      if (prima.has(g.data)) g.ferie = true;
      else delete g.ferie;
    }),
  );
}

function descrivi(lavorativi: number, liberi: number, timbrati: number): string {
  const parti = [`${lavorativi} ${lavorativi === 1 ? 'giorno lavorativo' : 'giorni lavorativi'}`];
  if (liberi > 0) parti.push(`${liberi} senza ore dovute (es. weekend) saltati`);
  if (timbrati > 0) parti.push(`${timbrati} già timbrati lasciati com'erano`);
  return parti.join(' · ');
}
