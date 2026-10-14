import { EMAIL_CONTATTO, linkSegnalazione, type ContestoApp, type TipoSegnalazione } from '../core/segnalazione';
import { inApp } from '../native/app';
import { store } from '../storage/store';
import { filtraAiuto, pezziRiga, SEZIONI_AIUTO, vociAiuto, type VoceAiuto } from './aiutoTesti';
import { el } from './dom';
import { inModalitaApp } from './installa';
import { preferenzaTema } from './tema';
import { pulsanteNovita } from './novita';

export const EVENTO_APRI_AIUTO = 'apri-aiuto';

/** Apre la scheda Aiuto, eventualmente su una voce precisa (id) o una sezione. */
export function apriAiuto(destinazione?: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO_APRI_AIUTO, { detail: destinazione }));
}

/** Link "?" contestuale da affiancare a un elemento dell'interfaccia. */
export function linkAiuto(testo: string, destinazione: string): HTMLElement {
  return el('button', { type: 'button', class: 'link-aiuto', onclick: () => apriAiuto(destinazione) }, el('span', { class: 'icona-aiuto', 'aria-hidden': 'true' }, '?'), testo);
}

let ricerca = '';

export function vistaAiuto(destinazione: string | null): HTMLElement {
  const voci = vociAiuto(store.impostazioni);
  const elenco = el('div', { class: 'elenco-aiuto' });

  const disegna = () => {
    const trovate = filtraAiuto(voci, ricerca);
    if (ricerca.trim()) {
      elenco.replaceChildren(
        trovate.length === 0
          ? el('p', { class: 'vuoto' }, 'Nessun risultato. Prova con altre parole, per esempio "permesso" o "pausa".')
          : el('div', { class: 'scheda' }, trovate.map((v) => voce(v, true))),
      );
      return;
    }
    elenco.replaceChildren(
      ...SEZIONI_AIUTO.map((s) =>
        el(
          'div',
          { class: 'scheda', id: `aiuto-sezione-${slug(s)}` },
          el('h2', { class: 'titolo-sezione' }, s),
          voci.filter((v) => v.sezione === s).map((v) => voce(v, v.id === destinazione)),
        ),
      ),
    );
  };

  const campo = el('input', {
    type: 'search',
    class: 'ricerca-aiuto',
    placeholder: 'Cerca: permesso, pausa, backup…',
    'aria-label': 'Cerca nell\'aiuto',
    value: ricerca,
    enterkeyhint: 'search',
  });
  campo.addEventListener('input', () => {
    ricerca = campo.value;
    disegna();
  });

  if (destinazione) ricerca = '';
  campo.value = ricerca;
  disegna();

  if (destinazione) {
    // Dopo il montaggio: porta in vista la voce (o la sezione) richiesta.
    requestAnimationFrame(() => {
      const bersaglio = document.getElementById(`aiuto-${destinazione}`) ?? document.getElementById(`aiuto-sezione-${slug(destinazione)}`);
      bersaglio?.scrollIntoView({ block: 'start' });
    });
  }

  return el(
    'section',
    { class: 'vista' },
    el('header', { class: 'intestazione' }, el('h1', {}, 'Aiuto'), el('p', { class: 'sottotitolo' }, 'Risposte ai dubbi più comuni')),
    campo,
    elenco,
    el('div', { class: 'scheda' }, el('h2', { class: 'titolo-sezione' }, 'Novità'), el('p', { class: 'nota' }, 'Cosa è cambiato in ogni versione di Sbeggio.'), pulsanteNovita()),
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
