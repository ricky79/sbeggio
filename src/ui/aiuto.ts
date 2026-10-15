// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { EMAIL_CONTATTO, linkSegnalazione, type ContestoApp, type TipoSegnalazione } from '../core/segnalazione';
import { inApp } from '../native/app';
import { store } from '../storage/store';
import { filtraAiuto, pezziRiga, SEZIONI_AIUTO, vociAiuto, type VoceAiuto } from './aiutoTesti';
import { el } from './dom';
import { elencoRisultati, mostraVoce, sezioneRichiudibile } from './sezioni';
import { inModalitaApp } from './installa';
import { preferenzaTema } from './tema';

export const EVENTO_APRI_AIUTO = 'apri-aiuto';

/** Apre Impostazioni → Aiuto, eventualmente su una voce precisa (id) o una sezione. */
export function apriAiuto(destinazione?: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO_APRI_AIUTO, { detail: destinazione }));
}

/** Link "?" contestuale da affiancare a un elemento dell'interfaccia. */
export function linkAiuto(testo: string, destinazione: string): HTMLElement {
  return el('button', { type: 'button', class: 'link-aiuto', onclick: () => apriAiuto(destinazione) }, el('span', { class: 'icona-aiuto', 'aria-hidden': 'true' }, '?'), testo);
}

let ricerca = '';
/** Sezioni aperte: restano come le ha lasciate l'utente tornando sull'Aiuto. */
const sezioniAperte = new Set<string>();

/** Pagina Aiuto (Impostazioni → Aiuto); `indietro` torna all'elenco o alla schermata del link "?". */
export function vistaAiuto(destinazione: string | null, indietro: { etichetta: string; azione: () => void }): HTMLElement {
  const voci = vociAiuto(store.impostazioni);
  const sezioni = el(
    'div',
    { class: 'elenco-aiuto' },
    SEZIONI_AIUTO.map((s) =>
      sezioneRichiudibile(
        s,
        sezioniAperte,
        voci.filter((v) => v.sezione === s).map((v) => voce(v, v.id === destinazione)),
        `aiuto-sezione-${slug(s)}`,
      ),
    ),
  );
  const risultati = el('div', {});

  const campo = el('input', {
    type: 'search',
    class: 'ricerca-aiuto',
    placeholder: 'Cerca: permesso, pausa, backup…',
    'aria-label': 'Cerca nell\'aiuto',
    enterkeyhint: 'search',
  });

  /** Apre la sezione e la risposta della voce, ci scorre e la evidenzia. */
  const apri = (id: string, sezione: string) => {
    const dettaglio = sezioni.querySelector<HTMLDetailsElement>(`#aiuto-${CSS.escape(id)}`);
    if (dettaglio) dettaglio.open = true;
    mostraVoce(sezioni, dettaglio, sezione);
  };

  // Ricerca come nelle impostazioni: mentre scrivi, al posto delle sezioni compare l'elenco delle domande.
  const disegna = () => {
    const attiva = ricerca.trim() !== '';
    sezioni.hidden = attiva;
    risultati.replaceChildren(
      ...(attiva
        ? [
            elencoRisultati(
              filtraAiuto(voci, ricerca).map((v) => ({
                nome: v.domanda,
                sezione: v.sezione,
                scegli: () => {
                  ricerca = '';
                  campo.value = '';
                  disegna();
                  apri(v.id, v.sezione);
                },
              })),
              'Nessun risultato. Prova con altre parole, per esempio "permesso" o "pausa".',
            ),
          ]
        : []),
    );
  };
  campo.addEventListener('input', () => {
    ricerca = campo.value;
    disegna();
  });

  if (destinazione) ricerca = '';
  campo.value = ricerca;
  disegna();

  if (destinazione) {
    // Una voce (link "?" dell'app), una sezione, oppure un'altra scheda della pagina (es. contatti).
    const v = voci.find((x) => x.id === destinazione);
    const s = SEZIONI_AIUTO.find((x) => slug(x) === slug(destinazione));
    if (v) apri(v.id, v.sezione);
    else if (s) mostraVoce(sezioni, null, s);
    else requestAnimationFrame(() => document.getElementById(`aiuto-${destinazione}`)?.scrollIntoView({ block: 'start' }));
  }

  return el(
    'section',
    { class: 'vista' },
    el(
      'header',
      { class: 'intestazione' },
      el('button', { type: 'button', class: 'link-indietro', onclick: indietro.azione }, `‹ ${indietro.etichetta}`),
      el('h1', {}, 'Aiuto'),
      el('p', { class: 'sottotitolo' }, 'Risposte ai dubbi più comuni'),
    ),
    campo,
    risultati,
    sezioni,
    schedaContatti(),
  );
}

/** Dati tecnici del momento, per il messaggio di segnalazione. */
function contestoApp(): ContestoApp {
  const tema = document.documentElement.dataset.tema ?? 'chiaro';
  return {
    versione: __VERSIONE_APP__,
    piattaforma: inApp() ? 'app Android' : inModalitaApp() ? 'app installata' : 'browser',
    dispositivo: navigator.userAgent,
    schermo: `${screen.width}×${screen.height}`,
    tema: preferenzaTema() === 'auto' ? `${tema} (automatico)` : tema,
    dataOra: new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
  };
}

/** Suggerimenti e segnalazioni: il messaggio si prepara al tocco, con data e ora del momento. */
function schedaContatti(): HTMLElement {
  const bottone = (tipo: TipoSegnalazione, testo: string) =>
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn-secondario',
        onclick: () => {
          window.location.href = linkSegnalazione(tipo, contestoApp(), store.impostazioni);
        },
      },
      testo,
    );
  return el(
    'div',
    { class: 'scheda', id: 'aiuto-contatti' },
    el('h2', { class: 'titolo-sezione' }, 'Suggerimenti e problemi'),
    el(
      'p',
      { class: 'nota' },
      `Si apre la tua app di posta con un messaggio già pronto per ${EMAIL_CONTATTO}: puoi rileggerlo e modificarlo prima di inviarlo.`,
    ),
    el('div', { class: 'pila-pulsanti' }, bottone('suggerimento', 'Invia un suggerimento'), bottone('problema', 'Segnala un problema')),
  );
}

function voce(v: VoceAiuto, aperta: boolean): HTMLElement {
  const corpo: HTMLElement[] = [];
  let lista: HTMLUListElement | null = null;
  for (const riga of v.testo) {
    if (riga.startsWith('• ')) {
      if (!lista) {
        lista = el('ul', {});
        corpo.push(lista);
      }
      lista.append(el('li', {}, contenutoRiga(riga.slice(2))));
    } else {
      lista = null;
      corpo.push(el('p', {}, contenutoRiga(riga)));
    }
  }
  return el(
    'details',
    { class: 'voce-aiuto', id: `aiuto-${v.id}`, open: aperta },
    el('summary', {}, v.domanda),
    el('div', { class: 'risposta' }, corpo),
  );
}

/** Testo di una riga con i link cliccabili. Nell'app Android Capacitor apre gli indirizzi esterni nel browser. */
function contenutoRiga(riga: string): (string | HTMLElement)[] {
  return pezziRiga(riga).map((p) => (typeof p === 'string' ? p : el('a', { href: p.url }, p.testo)));
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}
