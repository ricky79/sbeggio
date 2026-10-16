// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata, propostaRientro } from '../core/calcolo';
import { nuovoId } from '../core/id';
import { analizzaGiornata, azioniDisponibili, ETICHETTE_AZIONE, type Azione } from '../core/statoGiornata';
import { formattaDataLunga, formattaDurata, formattaOra, formattaSaldo } from '../core/tempo';
import { dettaglioSigarettaNonConteggiata, testoPausa } from '../core/testi';
import { ETICHETTE_EVENTO, type Evento, type Giornata, type RisultatoGiornata } from '../core/tipi';
import { store } from '../storage/store';
import { conferma, toast } from './dialoghi';
import { el } from './dom';
import { linkAiuto } from './aiuto';
import { controlloLuogo } from './luogo';
import { ICONA_FERIE, impostaFerie, schedaFerie } from './ferie';
import { haTimbrature } from '../core/giornata';
import {
  confermaRipartizione,
  editorEvento,
  editorPermessoInizio,
  editorPermessoUscita,
  editorSigarettaNonConteggiata,
} from './editor';
import { riquadroPausaSaltata } from './pausaSaltata';
import { avviaPausaPranzo, finePausaPranzo } from './pranzo';
import { avviaPausaSigaretta } from './sigaretta';

export interface Adesso {
  data: string;
  minuti: number;
}

/** Vista di una giornata: oggi con i pulsanti di timbratura, i giorni passati solo in modifica. */
export function vistaGiorno(data: string, adesso: Adesso, onIndietro: (() => void) | null): HTMLElement {
  const oggi = data === adesso.data;
  const giornata = store.giornata(data);
  const r = calcolaGiornata(giornata, store.impostazioni, oggi ? adesso.minuti : null);
  const analisi = analizzaGiornata(giornata);
  // In ferie senza timbrature: solo la scheda delle ferie, niente pulsanti di timbratura.
  const soloFerie = giornata.ferie === true && !haTimbrature(giornata);

  return el(
    'section',
    { class: 'vista vista-giorno' },
    el(
      'header',
      { class: 'intestazione' },
      onIndietro ? el('button', { type: 'button', class: 'link-indietro', onclick: onIndietro }, '‹ Storico') : null,
      el(
        'div',
        { class: 'intestazione-riga' },
        el('div', {}, el('h1', {}, oggi ? 'Oggi' : 'Giornata'), el('p', { class: 'sottotitolo' }, formattaDataLunga(data))),
        giornata.ferie ? null : controlloLuogo(data),
      ),
    ),
    soloFerie ? schedaFerie(data, r, oggi) : schedaRiepilogo(r, giornata, oggi, adesso.minuti),
    r.daCorreggere ? boxProblemi(r.problemi) : null,
    oggi && !soloFerie ? pulsantiAzione(data, r, adesso.minuti) : null,
    oggi && !soloFerie ? riquadroPausaSaltata(data, adesso.minuti) : null,
    soloFerie ? null : timeline(data, giornata, analisi.idScartati, r, oggi ? adesso.minuti : 9 * 60),
    // In una giornata di sole ferie basta "Togli le ferie": un secondo pulsante farebbe la stessa cosa.
    data in store.giornate && !soloFerie ? pulsanteElimina(data) : null,
  );
}

/** Elimina tutta la giornata: timbrature, permessi, ferie e luogo (con conferma e Annulla). */
function pulsanteElimina(data: string): HTMLElement {
  const elimina = async () => {
    const ok = await conferma(
      'Eliminare la giornata?',
      `Tutto quello che c'è il ${formattaDataLunga(data)} (timbrature, permessi, ferie, casa o ufficio) verrà eliminato.`,
      'Elimina',
      true,
    );
    if (!ok) return;
    const copia = store.giornata(data);
    store.eliminaGiornata(data);
    toast('Giornata eliminata', () => store.ripristinaGiornata(copia));
  };
  return el(
    'div',
    { class: 'riga-pulsanti' },
    el('button', { type: 'button', class: 'btn btn-pericolo', onclick: () => void elimina() }, 'Elimina la giornata'),
  );
}

function schedaRiepilogo(r: RisultatoGiornata, giornata: Giornata, oggi: boolean, adesso: number): HTMLElement {
  let etichetta: string;
  let valore: string;
  let nota: string | null = null;

  const ultimo = [...giornata.eventi].sort((a, b) => b.minuti - a.minuti)[0];
  if (r.uscitaPrevista !== null) {
    const passata = r.uscitaPrevista <= adesso;
    etichetta = passata ? 'Ore completate alle' : 'Uscita prevista';
    valore = formattaOra(r.uscitaPrevista);
    nota = notaUscitaPrevista(r, passata);
  } else if (r.stato === 'CHIUSA') {
    etichetta = 'Saldo della giornata';
    valore = formattaSaldo(r.saldo);
    if (ultimo) nota = `uscita alle ${formattaOra(ultimo.minuti)}`;
    if (ultimo && giornata.uscitaPrevista !== undefined) nota += ` · prevista alle ${formattaOra(giornata.uscitaPrevista)}`;
  } else if (r.stato === 'IN_PERMESSO') {
    etichetta = 'In permesso dalle';
    valore = ultimo ? formattaOra(ultimo.minuti) : '—';
  } else if (r.stato === 'NON_INIZIATA') {
    etichetta = oggi ? 'Ore dovute oggi' : 'Ore dovute';
    valore = formattaDurata(r.dovuti);
  } else {
    etichetta = 'Giornata non chiusa';
    valore = '—';
  }

  const percentuale = r.dovuti > 0 ? Math.min(100, Math.round((r.coperti / r.dovuti) * 100)) : 100;
  // Sotto il valore, in piccolo, la pausa fatta davvero se è scattata la pausa minima.
  const testo = testoPausa(r);
  const pausa = stat('Pausa pranzo', testo.valore);
  if (testo.nota) pausa.querySelector('dd')!.append(el('small', { class: 'stat-nota' }, testo.nota));
  return el(
    'div',
    { class: 'scheda scheda-principale' },
    el('p', { class: 'etichetta' }, etichetta),
    el('p', { class: `grande ${r.stato === 'CHIUSA' ? (r.saldo >= 0 ? 'positivo' : 'negativo') : ''}` }, valore),
    nota ? el('p', { class: 'nota' }, nota) : null,
    el('div', { class: 'barra', role: 'progressbar', 'aria-valuenow': percentuale, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('div', { class: 'barra-riempimento', style: `width:${percentuale}%` })),
    el(
      'dl',
      { class: 'statistiche' },
      stat('Coperte', `${formattaDurata(r.coperti)} / ${formattaDurata(r.dovuti)}`),
      statSaldo(r),
      pausa,
      stat('Permesso', formattaDurata(r.permesso)),
    ),
  );
}

/** Nota sotto l'uscita prevista: pausa minima, permesso in uscita, pausa pranzo inclusa, straordinario. */
function notaUscitaPrevista(r: RisultatoGiornata, passata: boolean): string | null {
  const permesso = r.uscitaPrevistaConPermesso
    ? `con ${formattaDurata(r.permessoUscitaPianificato)} di permesso in uscita`
    : null;
  const unisci = (...parti: (string | null)[]) => parti.filter((p) => p !== null).join(', ');
  if (r.stato === 'IN_PAUSA') return unisci('se rientri ora (pausa minima inclusa)', permesso);
  if (r.uscitaPrevistaConPausa) {
    return unisci(permesso, `inclusa pausa pranzo di ${formattaDurata(store.impostazioni.pausaMinima)}`);
  }
  if (permesso) return permesso;
  return passata ? 'stai facendo straordinario' : null;
}

/** Saldo a fine giornata; mentre è in corso mostra quanto manca. */
export function statSaldo(r: RisultatoGiornata): HTMLElement {
  if (r.stato !== 'CHIUSA' && !r.daCorreggere && r.saldo < 0) return stat('Mancano', formattaDurata(-r.saldo));
  return stat('Saldo', formattaSaldo(r.saldo), r.saldo > 0 ? 'positivo' : r.saldo < 0 ? 'negativo' : '');
}

function stat(nome: string, valore: string, classe = ''): HTMLElement {
  return el('div', { class: 'stat' }, el('dt', {}, nome), el('dd', { class: classe }, valore));
}

function boxProblemi(problemi: string[]): HTMLElement {
  return el(
    'div',
    { class: 'scheda avviso-problemi', role: 'alert' },
    el('p', { class: 'etichetta' }, '⚠︎ Giornata da correggere'),
    el('ul', {}, problemi.map((p) => el('li', {}, p))),
    el('p', { class: 'nota' }, 'Tocca una timbratura per modificarla o eliminarla.'),
    linkAiuto('Cosa significa?', 'da-correggere'),
  );
}

function pulsantiAzione(data: string, r: RisultatoGiornata, adesso: number): HTMLElement {
  const primaDelPranzo = adesso < store.impostazioni.pranzo.inizio;
  const { principali, secondarie } = azioniDisponibili(r.stato, r.pausaFatta, primaDelPranzo);
  const tutte = [...principali, ...secondarie];
  const etichetta = (a: Azione) => (a === 'PAUSA_SIGARETTA' ? `🚬 ${ETICHETTE_AZIONE[a]}` : ETICHETTE_AZIONE[a]);
  const grandi = principali.map((a) =>
    el(
      'button',
      { type: 'button', class: `btn-principale azione-${a.toLowerCase()}`, onclick: () => void eseguiAzione(a, data) },
      el('span', { class: 'btn-principale-testo' }, etichetta(a)),
      el('span', { class: 'btn-principale-ora' }, formattaOra(adesso)),
    ),
  );
  return el(
    'div',
    { class: 'azioni' },
    // Prima della fascia pranzo i pulsanti grandi sono due, affiancati e uguali.
    grandi.length > 1 ? el('div', { class: 'azioni-principali' }, grandi) : grandi,
    secondarie.length > 0
      ? el(
          'div',
          { class: 'azioni-secondarie' },
          secondarie.map((a) => el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void eseguiAzione(a, data) }, etichetta(a))),
        )
      : null,
    tutte.length > 0
      ? tutte.includes('USCITA_PERMESSO') && tutte.includes('USCITA_ANTICIPATA')
        ? linkAiuto('Esco in permesso o uscita anticipata?', 'permesso-vs-anticipata')
        : linkAiuto('Quale bottone uso?', 'i-bottoni')
      : null,
  );
}

/** Orario corrente letto al momento del tocco (non quello del rendering). */
let leggiAdesso: () => Adesso = () => ({ data: '', minuti: 0 });
export function impostaOrologio(f: () => Adesso): void {
  leggiAdesso = f;
}

/** Esegue un'azione di Oggi; `annulla` (timbratura col tag) aggiunge Annulla al messaggio finale. */
export async function eseguiAzione(azione: Azione, data: string, annulla?: () => void): Promise<void> {
  const { minuti } = leggiAdesso();
  const aggiungi = (tipo: Evento['tipo'], pausaConfermata?: number) =>
    store.modificaGiornata(data, (g) => {
      const e: Evento = { id: nuovoId(), tipo, minuti };
      if (pausaConfermata !== undefined) e.pausaConfermata = pausaConfermata;
      g.eventi.push(e);
    });

  switch (azione) {
    case 'PAUSA_SIGARETTA':
      avviaPausaSigaretta(data, minuti);
      return;
    case 'INIZIO_PAUSA':
      avviaPausaPranzo(data, minuti);
      return;
    case 'FINE_PAUSA':
      finePausaPranzo(data, minuti, annulla);
      return;
    case 'PERMESSO_INIZIO_GIORNATA':
      await editorPermessoInizio(data, store.giornata(data).eventi.length === 0 ? minuti : null);
      return;
    case 'RIENTRO_PERMESSO': {
      const proposta = propostaRientro(store.giornata(data), store.impostazioni, minuti);
      if (proposta && proposta.proposta > 0) {
        const pausa = await confermaRipartizione(proposta);
        if (pausa === null) return;
        aggiungi('RIENTRO_PERMESSO', pausa);
      } else aggiungi('RIENTRO_PERMESSO');
      break;
    }
    case 'USCITA_ANTICIPATA': {
      const g = store.giornata(data);
      const mancante = Math.max(0, -calcolaGiornata(g, store.impostazioni, minuti).saldo);
      const prova = calcolaGiornata(
        { ...g, eventi: [...g.eventi, { id: 'prova', tipo: 'USCITA_ANTICIPATA', minuti }] },
        store.impostazioni,
        minuti,
      );
      const dettaglio = mancante !== prova.permessoUscita ? ` (mancano ${formattaDurata(mancante)})` : '';
      const ok = await conferma(
        'Uscita anticipata',
        `Esci alle ${formattaOra(minuti)}: ${formattaDurata(prova.permessoUscita)} di permesso${dettaglio} per completare la giornata.`,
        'Conferma uscita',
      );
      if (!ok) return;
      aggiungi('USCITA_ANTICIPATA');
      break;
    }
    case 'USCITA': {
      aggiungi('USCITA');
      const g = store.giornata(data);
      if (g.permessoUscitaMinuti > 0) {
        const r = calcolaGiornata(g, store.impostazioni, minuti);
        const permesso = r.permessoUscita > 0 ? `${formattaDurata(r.permessoUscita)} di permesso` : 'nessun permesso';
        toast(`Uscita alle ${formattaOra(minuti)} · ${permesso}`, annulla);
        return;
      }
      break;
    }
    case 'NON_RIENTRO': {
      const ok = await conferma(
        'Non rientri?',
        'L\'uscita in permesso diventa un\'uscita anticipata: le ore mancanti saranno conteggiate come permesso.',
        'Chiudi la giornata',
      );
      if (!ok) return;
      store.modificaGiornata(data, (g) => {
        const ultima = [...g.eventi].sort((a, b) => b.minuti - a.minuti).find((e) => e.tipo === 'USCITA_PERMESSO');
        if (ultima) {
          ultima.tipo = 'USCITA_ANTICIPATA';
          delete ultima.sigaretta;
        }
      });
      break;
    }
    case 'RIAPRI': {
      const ok = await conferma('Riaprire la giornata?', 'L\'ultima uscita verrà eliminata.', 'Riapri', true);
      if (!ok) return;
      store.modificaGiornata(data, (g) => {
        const ultima = [...g.eventi]
          .sort((a, b) => b.minuti - a.minuti)
          .find((e) => e.tipo === 'USCITA' || e.tipo === 'USCITA_ANTICIPATA');
        if (ultima) g.eventi = g.eventi.filter((e) => e !== ultima);
      });
      return;
    }
    default:
      aggiungi(azione);
  }
  toast(`${ETICHETTE_AZIONE[azione]} alle ${formattaOra(minuti)}`, annulla);
}

function timeline(
  data: string,
  giornata: Giornata,
  scartati: Set<string>,
  r: RisultatoGiornata,
  minutiProposti: number,
): HTMLElement {
  const ordinati = [...giornata.eventi].sort((a, b) => a.minuti - b.minuti);
  const voci: HTMLElement[] = [];
  const vocePermesso = (testo: string, dettaglio: string, onclick: () => void) =>
    el(
      'li',
      {},
      el(
        'button',
        { type: 'button', class: 'voce voce-permesso', onclick },
        el('span', { class: 'voce-ora' }, '—'),
        el('span', { class: 'voce-testo' }, testo, el('small', {}, dettaglio)),
        el('span', { class: 'voce-freccia', 'aria-hidden': 'true' }, '›'),
      ),
    );
  if (giornata.permessoInizioMinuti > 0) {
    const dichiarati =
      r.permessoInizioDichiarato !== r.permessoInizio ? ` (dichiarati ${formattaDurata(r.permessoInizioDichiarato)})` : '';
    voci.push(
      vocePermesso('Permesso a inizio giornata', `${formattaDurata(r.permessoInizio)}${dichiarati}`, () => void editorPermessoInizio(data, null)),
    );
  }
  // Timbrature e sigarette non conteggiate insieme, in ordine di orario.
  const conOrario: { minuti: number; voce: HTMLElement }[] = [];
  for (const e of ordinati) {
    const rip = r.ripartizioni.find((x) => x.eventoRientroId === e.id);
    const sig = r.sigarette.find((x) => x.eventoRientroId === e.id);
    const pi = r.permessiIntermedi.find((x) => x.eventoRientroId === e.id);
    const dettaglio = rip
      ? `${formattaDurata(rip.pausa)} pausa + ${formattaDurata(pi?.permesso ?? rip.permesso)} permesso${rip.confermata ? '' : ' (proposta)'}`
      : sig
        ? `${formattaDurata(sig.permesso)} di permesso (pausa sigaretta di ${formattaDurata(sig.durata)})`
        : pi
          ? `${formattaDurata(pi.permesso)} di permesso${pi.permesso !== pi.durata ? ` (assenza di ${formattaDurata(pi.durata)})` : ''}`
          : scartati.has(e.id)
            ? 'non coerente: da correggere'
            : e.tipo === 'USCITA_PERMESSO' && e.sigaretta
              ? '🚬 pausa sigaretta'
              : null;
    conOrario.push({
      minuti: e.minuti,
      voce: el(
        'li',
        {},
        el(
          'button',
          {
            type: 'button',
            class: `voce voce-${e.tipo.toLowerCase()} ${scartati.has(e.id) ? 'voce-errata' : ''}`,
            onclick: () => void editorEvento(data, e, e.minuti),
          },
          el('span', { class: 'voce-ora' }, formattaOra(e.minuti)),
          el('span', { class: 'voce-testo' }, ETICHETTE_EVENTO[e.tipo], dettaglio ? el('small', {}, dettaglio) : null),
          el('span', { class: 'voce-freccia', 'aria-hidden': 'true' }, '›'),
        ),
      ),
    });
  }
  // Le pause sigaretta rientrate entro la tolleranza: si vedono qui ma non entrano nel calcolo.
  (giornata.sigaretteNonConteggiate ?? []).forEach((s, indice) =>
    conOrario.push({
      minuti: s.minuti,
      voce: el(
        'li',
        {},
        el(
          'button',
          { type: 'button', class: 'voce voce-sigaretta', onclick: () => void editorSigarettaNonConteggiata(data, indice) },
          el('span', { class: 'voce-ora' }, formattaOra(s.minuti)),
          el('span', { class: 'voce-testo' }, '🚬 Pausa sigaretta', el('small', {}, dettaglioSigarettaNonConteggiata(s))),
          el('span', { class: 'voce-freccia', 'aria-hidden': 'true' }, '›'),
        ),
      ),
    }),
  );
  voci.push(...conOrario.sort((a, b) => a.minuti - b.minuti).map((x) => x.voce));
  const pianificato = giornata.permessoUscitaMinuti;
  if (pianificato > 0) {
    const dettaglio =
      r.stato === 'CHIUSA'
        ? `${formattaDurata(r.permessoUscita)}${r.permessoUscita !== pianificato ? ` (pianificati ${formattaDurata(pianificato)})` : ''}`
        : formattaDurata(pianificato);
    voci.push(vocePermesso('Permesso in uscita', dettaglio, () => void editorPermessoUscita(data)));
  }
  return el(
    'div',
    { class: 'scheda' },
    el('h2', { class: 'titolo-sezione' }, 'Timbrature'),
    voci.length > 0 ? el('ol', { class: 'timeline' }, voci) : el('p', { class: 'vuoto' }, 'Nessuna timbratura.'),
    el(
      'div',
      { class: 'riga-pulsanti' },
      el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void editorEvento(data, null, minutiProposti) }, '+ Aggiungi timbratura'),
      giornata.permessoInizioMinuti === 0
        ? el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void editorPermessoInizio(data, null) }, '+ Permesso inizio giornata')
        : null,
      pianificato === 0 && r.stato !== 'CHIUSA'
        ? el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void editorPermessoUscita(data) }, '+ Permesso in uscita')
        : null,
      // Un giorno off: solo se non si è ancora timbrato (con le timbrature, per toglierle).
      giornata.ferie
        ? el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => impostaFerie(data, false) }, 'Togli le ferie')
        : !haTimbrature(giornata) && r.dovuti > 0
          ? el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => impostaFerie(data, true) }, `${ICONA_FERIE} In ferie questo giorno`)
          : null,
    ),
  );
}
