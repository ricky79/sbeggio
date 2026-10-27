// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata } from '../core/calcolo';
import { nuovoId } from '../core/id';
import { avanzamentoPranzo, ciboDellaPausa, pranzoDaRiprendere, pranzoInCorso, testoCronometro } from '../core/pranzo';
import { istanteDaMinuti } from '../core/sigaretta';
import { adessoRoma, formattaDataLunga, formattaDurata, formattaOra } from '../core/tempo';
import type { Evento } from '../core/tipi';
import { store } from '../storage/store';
import { avviso, conferma, toast } from './dialoghi';
import { el } from './dom';
import { cancellaInizioPranzo, inizioPranzoSalvato, salvaInizioPranzo } from './inizioPranzo';
import { creaDisegnoPranzo } from './pranzoDisegni';
import { suona } from './suoni';

/**
 * Pausa pranzo a tutto schermo, come la sigaretta: cronometro in avanti, un cibo a sorpresa che si
 * consuma fino alla pausa minima, Fine pausa pranzo con la durata ben in vista.
 */

function leggiInizio(data: string, inizio: Evento): number {
  return inizioPranzoSalvato(data, inizio.id) ?? istanteDaMinuti(inizio.minuti, new Date());
}

let aperta = false;

/** Il tasto Fine pausa pranzo della schermata aperta, per il tag NFC (null a schermata chiusa). */
let fineSchermata: (() => void) | null = null;

/** Registra l'inizio della pausa pranzo e apre la schermata. */
export function avviaPausaPranzo(data: string, minuti: number): void {
  const inizio: Evento = { id: nuovoId(), tipo: 'INIZIO_PAUSA', minuti };
  salvaInizioPranzo({ data, eventoId: inizio.id, inizio: Date.now() });
  store.modificaGiornata(data, (g) => void g.eventi.push({ ...inizio }));
  void suona('timbratura');
  if (!aperta) apriSchermata(data, inizio);
}

/**
 * Fine pausa pranzo (bottone di Oggi o tag): con la schermata aperta passa da lì e ne mostra la durata,
 * altrimenti la registra con un messaggio che riporta la durata. `annulla` (tag) aggiunge Annulla al messaggio.
 */
export function finePausaPranzo(data: string, minuti: number, annulla?: () => void): void {
  if (fineSchermata) return fineSchermata();
  const inizio = pranzoInCorso(store.giornata(data));
  store.modificaGiornata(data, (g) => void g.eventi.push({ id: nuovoId(), tipo: 'FINE_PAUSA', minuti }));
  void suona('timbratura');
  cancellaInizioPranzo();
  const durata = inizio ? ` · pausa di ${formattaDurata(Math.max(0, minuti - inizio.minuti))}` : '';
  toast(`Fine pausa pranzo alle ${formattaOra(minuti)}${durata}`, annulla);
}

/** Riapre la schermata se nella giornata c'è una pausa pranzo in corso (e non è già aperta). */
export function riprendiPausaPranzo(data: string): void {
  if (aperta) return;
  const inizio = pranzoDaRiprendere(store.giornata(data));
  if (inizio) apriSchermata(data, inizio);
}

function apriSchermata(data: string, evento: Evento): void {
  aperta = true;
  const inizio = leggiInizio(data, evento);
  // La pausa minima si legge all'apertura: con la schermata aperta le impostazioni non sono raggiungibili.
  const pausaMinima = store.impostazioni.pausaMinima;
  const minimaAlle = formattaOra(adessoRoma(new Date(inizio + pausaMinima * 60_000)).minuti);
  const disegno = creaDisegnoPranzo(ciboDellaPausa(inizio));

  const titolo = el('h2', {}, 'Pausa pranzo');
  const sottotitolo = el('p', { class: 'pranzo-sottotitolo' }, `iniziata alle ${formattaOra(evento.minuti)}`);
  const timer = el('p', { class: 'pranzo-timer', role: 'timer' });
  const nota = el('p', { class: 'pranzo-nota' });
  /** Uscita prevista se rientrassi adesso: con la schermata aperta Oggi non si vede. */
  const uscita = el('p', { class: 'pranzo-uscita' });
  const azioni = el('div', { class: 'pranzo-azioni' });

  let chiusaDaNoi = false;
  /** Evento Fine pausa registrato dalla schermata: c'è mentre si mostra il riepilogo. */
  let fine: Evento | null = null;

  const termina = () => {
    chiusaDaNoi = true;
    dlg.close();
  };
  /** Il giorno è cambiato a pausa aperta: non si scrive nulla, la giornata va corretta dallo Storico. */
  const giornoCambiato = (): boolean => {
    if (chiusaDaNoi) return true;
    if (adessoRoma().data === data) return false;
    termina();
    cancellaInizioPranzo();
    void avviso(
      'Pausa pranzo non chiusa',
      `La fine della pausa di ${formattaDataLunga(data)} non è stata registrata: correggi la giornata dallo Storico.`,
    );
    return true;
  };

  const btnFine = el('button', { type: 'button', class: 'btn btn-primario', onclick: () => chiudiPausa() }, 'Fine pausa pranzo');
  const btnAnnullaPausa = el(
    'button',
    {
      type: 'button',
      class: 'pranzo-link',
      onclick: async () => {
        if (giornoCambiato()) return;
        const ok = await conferma(
          'Annullare la pausa?',
          'L\'inizio della pausa pranzo verrà eliminato, come se non l\'avessi registrato.',
          'Annulla pausa',
          true,
        );
        if (!ok || giornoCambiato()) return;
        termina();
        cancellaInizioPranzo();
        store.modificaGiornata(data, (g) => void (g.eventi = g.eventi.filter((e) => e.id !== evento.id)));
        toast('Pausa pranzo annullata');
      },
    },
    'Annulla pausa',
  );

  const mostraCronometro = () => {
    fine = null;
    dlg.classList.remove('riepilogo');
    titolo.textContent = 'Pausa pranzo';
    sottotitolo.textContent = `iniziata alle ${formattaOra(evento.minuti)}`;
    azioni.replaceChildren(btnFine, btnAnnullaPausa);
    fineSchermata = chiudiPausa;
    aggiorna();
  };

  /** Fine pausa: registra la timbratura e mostra la durata, con Annulla per tornare al cronometro. */
  const chiudiPausa = () => {
    if (fine || giornoCambiato()) return;
    const { minuti } = adessoRoma();
    const registrato: Evento = { id: nuovoId(), tipo: 'FINE_PAUSA', minuti };
    fine = registrato;
    store.modificaGiornata(data, (g) => void g.eventi.push({ ...registrato }));
    void suona('timbratura');
    fineSchermata = null;

    const durata = Math.max(0, minuti - evento.minuti);
    dlg.classList.add('riepilogo');
    titolo.textContent = 'Pausa pranzo finita';
    sottotitolo.textContent = `dalle ${formattaOra(evento.minuti)} alle ${formattaOra(minuti)}`;
    timer.textContent = formattaDurata(durata);
    nota.textContent = durata < pausaMinima ? `Conta come ${formattaDurata(pausaMinima)}: è la pausa minima` : 'Buon rientro!';
    const prevista = calcolaGiornata(store.giornata(data), store.impostazioni, minuti).uscitaPrevista;
    uscita.textContent = prevista !== null ? `Uscita prevista alle ${formattaOra(prevista)}` : '';
    azioni.replaceChildren(
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-primario',
          onclick: () => {
            termina();
            cancellaInizioPranzo();
          },
        },
        'Fatto',
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'pranzo-link',
          onclick: () => {
            store.modificaGiornata(data, (g) => void (g.eventi = g.eventi.filter((e) => e.id !== registrato.id)));
            mostraCronometro();
          },
        },
        'Annulla, sono ancora in pausa',
      ),
    );
  };

  const dlg = el(
    'dialog',
    { class: 'pranzo', 'aria-label': 'Pausa pranzo' },
    el('header', {}, titolo, sottotitolo),
    el('div', { class: 'pranzo-scena' }, disegno.elemento),
    timer,
    nota,
    uscita,
    azioni,
  );

  /** minimaFatta al giro prima: null finché non si è letta, così aprendo a pausa già fatta non suona. */
  let minimaPrima: boolean | null = null;
  function aggiorna(): void {
    if (fine || giornoCambiato()) return;
    // Pausa tolta altrove (Annulla del tag, un'altra scheda): la schermata non ha più senso.
    if (pranzoInCorso(store.giornata(data))?.id !== evento.id) {
      termina();
      return;
    }
    const trascorsi = Date.now() - inizio;
    const a = avanzamentoPranzo(trascorsi, pausaMinima);
    disegno.aggiorna(a.mangiato);
    dlg.classList.toggle('finito', a.minimaFatta);
    if (minimaPrima === false && a.minimaFatta) void suona('finePausa');
    minimaPrima = a.minimaFatta;
    timer.textContent = testoCronometro(trascorsi);
    nota.textContent = a.minimaFatta ? '✓ Pausa minima fatta' : `Pausa minima di ${formattaDurata(pausaMinima)}: alle ${minimaAlle}`;
    const prevista = calcolaGiornata(store.giornata(data), store.impostazioni, adessoRoma().minuti).uscitaPrevista;
    uscita.textContent = prevista !== null ? `Se rientri adesso esci alle ${formattaOra(prevista)}` : '';
  }
  const intervallo = setInterval(aggiorna, 1000);

  // Si esce solo con Fine pausa pranzo, Annulla pausa o Fatto.
  dlg.addEventListener('cancel', (ev) => ev.preventDefault());
  dlg.addEventListener('close', () => {
    clearInterval(intervallo);
    dlg.remove();
    aperta = false;
    fineSchermata = null;
    // Chiusa dal sistema (Esc, tasto Indietro): la pausa è ancora in corso, si riapre.
    if (!chiusaDaNoi) {
      if (fine) cancellaInizioPranzo();
      else riprendiPausaPranzo(data);
    }
  });
  document.body.append(dlg);
  dlg.showModal();
  mostraCronometro();
}
