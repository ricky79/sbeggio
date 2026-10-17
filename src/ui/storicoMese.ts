// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { RiepilogoMese } from '../core/riepilogo';
import { statoLeggibile } from '../core/testi';
import { formattaDataBreve, formattaDurata, formattaOra, formattaSaldo } from '../core/tempo';
import { el } from './dom';
import { iconaCasa, ICONA_FERIE } from './simboli';

/**
 * Riepilogo del mese ed elenco dei giorni, come nello Storico. Senza store: li usa anche web.sbeggio.app.
 * Con `apriGiorno` ogni giorno è un pulsante che apre la giornata; senza, l'elenco è solo da leggere.
 */
export function schedeMese(rm: RiepilogoMese, oggi: string, apriGiorno?: (data: string) => void): HTMLElement[] {
  return [schedaRiepilogo(rm), schedaGiorni(rm, oggi, apriGiorno)];
}

function schedaRiepilogo(rm: RiepilogoMese): HTMLElement {
  return el(
    'div',
    { class: 'scheda' },
    el('h2', { class: 'titolo-sezione' }, 'Riepilogo del mese'),
    el(
      'dl',
      { class: 'statistiche tre' },
      stat('Lavoro', formattaDurata(rm.lavoro)),
      stat('Straordinario', formattaDurata(rm.straordinario), rm.straordinario > 0 ? 'positivo' : ''),
      stat('Permesso', formattaDurata(rm.permesso)),
    ),
    el(
      'p',
      { class: 'nota' },
      `${rm.giorni.length} ${rm.giorni.length === 1 ? 'giorno registrato' : 'giorni registrati'} · saldo esatto del mese `,
      el('strong', { class: rm.saldo > 0 ? 'positivo' : rm.saldo < 0 ? 'negativo' : '' }, formattaSaldo(rm.saldo)),
    ),
    el(
      'p',
      { class: 'nota riepilogo-smart' },
      iconaCasa(),
      rm.giorniSmart === 0
        ? 'Nessun giorno da casa'
        : `${rm.giorniSmart} ${rm.giorniSmart === 1 ? 'giorno' : 'giorni'} da casa (smart)`,
      rm.giorni.length - rm.giorniSmart - rm.giorniFerie > 0 ? ` · ${rm.giorni.length - rm.giorniSmart - rm.giorniFerie} in sede` : null,
    ),
    rm.giorniFerie > 0
      ? el(
          'p',
          { class: 'nota riepilogo-smart' },
          el('span', { class: 'icona-luogo', 'aria-hidden': 'true' }, ICONA_FERIE),
          `${rm.giorniFerie} ${rm.giorniFerie === 1 ? 'giorno' : 'giorni'} di ferie (${formattaDurata(rm.ferie)})`,
        )
      : null,
    rm.giorniDaCorreggere > 0
      ? el('p', { class: 'nota negativo' }, `⚠︎ ${rm.giorniDaCorreggere} ${rm.giorniDaCorreggere === 1 ? 'giornata da correggere' : 'giornate da correggere'}`)
      : null,
  );
}

function schedaGiorni(rm: RiepilogoMese, oggi: string, apriGiorno?: (data: string) => void): HTMLElement {
  return el(
    'div',
    { class: 'scheda' },
    rm.giorni.length === 0
      ? el('p', { class: 'vuoto' }, 'Nessuna giornata registrata in questo mese.')
      : el(
          'ul',
          { class: 'elenco-giorni' },
          rm.giorni.map(({ data, smart, risultato: r, ore, uscita, uscitaPrevista }) => {
            const ferie = r.ferie > 0 && !r.daCorreggere;
            const inCorso = !ferie && data === oggi && r.stato !== 'CHIUSA';
            const mancano = !inCorso && !r.daCorreggere && r.saldo < 0 ? -r.saldo : 0;
            const nota = r.daCorreggere
              ? 'Da correggere'
              : ferie
                ? `${ICONA_FERIE} Ferie · ${formattaDurata(r.ferie)}`
                : inCorso
                  ? 'In corso'
                  : r.stato !== 'CHIUSA'
                    ? statoLeggibile(r)
                    : null;
            const classe = `giorno ${r.daCorreggere ? 'giorno-errato' : ''}`;
            const contenuto = [
              el(
                'span',
                { class: 'giorno-data' },
                el('span', { class: 'giorno-data-testo' }, formattaDataBreve(data)),
                smart ? el('span', { class: 'giorno-smart', title: 'Da casa (smart)' }, iconaCasa(), 'Smart') : null,
              ),
              cella('Lavoro', ore.lavoro),
              cella('Straord.', ore.straordinario, 'positivo'),
              cella('Permesso', ore.permesso),
              nota || mancano > 0 || uscitaPrevista !== null
                ? el(
                    'span',
                    { class: 'giorno-note' },
                    nota ? el('span', { class: 'badge' }, nota) : null,
                    mancano > 0 ? el('span', { class: 'negativo' }, `Mancano ${formattaDurata(mancano)}`) : null,
                    uscitaPrevista !== null ? el('span', { class: 'giorno-uscita' }, testoUscita(uscita, uscitaPrevista, inCorso)) : null,
                  )
                : null,
            ];
            return el(
              'li',
              {},
              apriGiorno
                ? el('button', { type: 'button', class: classe, onclick: () => apriGiorno(data) }, contenuto)
                : el('div', { class: classe }, contenuto),
            );
          }),
        ),
  );
}

/** "Uscita 17:40 · prevista 17:25" (giornata chiusa) o "Uscita prevista 17:25" (in corso). */
function testoUscita(uscita: number | null, prevista: number, inCorso: boolean): string {
  if (inCorso || uscita === null) return `Uscita prevista ${formattaOra(prevista)}`;
  return `Uscita ${formattaOra(uscita)} · prevista ${formattaOra(prevista)}`;
}

/** Cella di una colonna del giorno: il valore, o un trattino se è zero. */
function cella(nome: string, minuti: number, classeSeAttiva = ''): HTMLElement {
  return el(
    'span',
    { class: 'giorno-cella' },
    el('span', { class: 'giorno-cella-nome' }, nome),
    el('span', { class: minuti > 0 ? classeSeAttiva : 'zero' }, minuti > 0 ? formattaDurata(minuti) : '–'),
  );
}

function stat(nome: string, valore: string, classe = ''): HTMLElement {
  return el('div', { class: 'stat' }, el('dt', {}, nome), el('dd', { class: classe }, valore));
}
