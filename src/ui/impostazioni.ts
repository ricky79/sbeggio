// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { NOMI_GIORNI } from '../core/tempo';
import { selettoreOra } from './campi';
import { IMPOSTAZIONI_PREDEFINITE, type TipoSigaretta } from '../core/tipi';
import { clonaImpostazioni } from '../storage/migrazioni';
import { store } from '../storage/store';
import { conferma, toast } from './dialoghi';
import { el } from './dom';
import { linkAiuto } from './aiuto';
import { collegaComputer } from './collega';
import { esportaBackupJson, esportaCsvCondividi, esportaExcelCondividi, importaFile } from './dati';
import type { Adesso } from './giorno';
import { impostaSuoni, sbloccaAudio, suona, suoniAttivi, type Suono } from './suoni';
import { festaAccesa, festaDiOggi, impostaFesta, impostaPreferenza, preferenzaTema, type PreferenzaTema } from './tema';
import { inApp } from '../native/app';
import * as avvisiApp from '../native/avvisi';
import * as avvisiPwa from '../web/avvisi';
import type { StatoPermessi } from '../core/avvisi';
import { apriImpostazioniNfc, statoNfc, type StatoNfc } from '../native/nfc';
import { PRECISIONE_MASSIMA, RAGGIO_UFFICIO } from '../core/posizione';
import { leggiPosizione } from './posizione';
import { apriNovita } from './novita';
import { cercaImpostazioni, PAGINE_IMPOSTAZIONI, titoloPagina, type IdPagina, type PaginaImpostazioni } from './ricercaImpostazioni';
import { elencoRisultati, mostraVoce } from './sezioni';
import { filtraAiuto, vociAiuto } from './aiutoTesti';

/** Lunedì → domenica, come in un calendario italiano. */
const ORDINE_GIORNI = [1, 2, 3, 4, 5, 6, 0];

/** Selettore "ore:minuti" 24h (usato anche per le durate). */
function inputHHMM(minuti: number, onCambio: (v: number) => void, aria: string): HTMLElement {
  return selettoreOra(minuti, { aria, onChange: onCambio }).elemento;
}

function inputMinuti(valore: number, onCambio: (v: number) => void, aria: string, max = 600, step = 5, min = 0): HTMLInputElement {
  const i = el('input', { type: 'number', inputmode: 'numeric', min, max, step, value: String(valore), 'aria-label': aria });
  i.addEventListener('change', () => {
    const v = Math.round(Number(i.value));
    if (!Number.isFinite(v) || v < min || v > max) {
      i.value = String(valore);
      return;
    }
    valore = v;
    onCambio(v);
  });
  return i;
}

/** Riga etichetta + controllo; `voce` è l'id della ricerca (ricercaImpostazioni.ts). */
function riga(etichetta: string, controllo: HTMLElement, nota?: string, voce?: string): HTMLElement {
  return el(
    'div',
    { class: 'riga-impostazione', id: voce ? `imp-${voce}` : undefined },
    el('div', {}, el('span', { class: 'riga-etichetta' }, etichetta), nota ? el('small', {}, nota) : null),
    controllo,
  );
}

const salvato = () => toast('Impostazioni salvate');

/** Scheda di una pagina delle impostazioni, con il titolo dell'argomento se la pagina ne ha più d'uno. */
const scheda = (titolo: string | null, ...contenuto: (Node | Node[] | null)[]) =>
  el('div', { class: 'scheda', 'data-sezione': titolo ?? undefined }, titolo ? el('h2', { class: 'titolo-sezione' }, titolo) : null, ...contenuto);

/** Testo della ricerca: resta tra un ridisegno e l'altro, come le sezioni aperte. */
let ricerca = '';

/** Casella di spunta delle impostazioni. */
function interruttore(valore: boolean, onCambio: (v: boolean) => void, aria: string): HTMLInputElement {
  const i = el('input', { type: 'checkbox', checked: valore, 'aria-label': aria, class: 'interruttore' });
  i.addEventListener('change', () => onCambio(i.checked));
  return i;
}

const TESTO_PERMESSI_APP: Record<StatoPermessi, string> = {
  concessi: 'Notifiche autorizzate.',
  negati: 'Notifiche bloccate: abilitale dalle impostazioni di Android (App → Sbeggio → Notifiche).',
  'da-chiedere': 'Per ricevere gli avvisi serve il permesso di mostrare notifiche.',
  // Solo PWA: nell'app non capitano.
  'da-attivare': 'Per ricevere gli avvisi serve il permesso di mostrare notifiche.',
  'da-installare': 'Per ricevere gli avvisi serve il permesso di mostrare notifiche.',
  'non-disponibili': 'Avvisi non disponibili su questo telefono.',
};

const TESTO_PERMESSI_PWA: Record<StatoPermessi, string> = {
  concessi: 'Notifiche autorizzate. Gli avvisi arrivano tramite internet, con fino a un minuto di ritardo.',
  'da-chiedere': 'Per ricevere gli avvisi serve il permesso di mostrare notifiche.',
  'da-attivare': 'Notifiche permesse, ma gli avvisi non sono attivi su questo dispositivo: tocca «Autorizza gli avvisi» (serve internet).',
  negati: 'Notifiche bloccate: abilitale nelle impostazioni del browser per questo sito.',
  'da-installare': 'Su iPhone gli avvisi arrivano solo con l\'app aggiunta alla schermata Home.',
  'non-disponibili': 'Questo browser non supporta le notifiche push.',
};

/** Sezione Avvisi: scelta degli avvisi, durata del pranzo e stato dei permessi (app Android o PWA). */
function sezioneAvvisi(): HTMLElement {
  const avvisi = store.impostazioni.avvisi;
  const nativa = inApp();
  const piattaforma = nativa ? avvisiApp : avvisiPwa;
  const testi = nativa ? TESTO_PERMESSI_APP : TESTO_PERMESSI_PWA;
  const stato = el('small', { class: 'nota', id: 'imp-permessi-avvisi' }, 'Controllo dei permessi…');
  const pulsante = el('button', { type: 'button', class: 'btn btn-secondario', hidden: true }, 'Autorizza gli avvisi');
  const comeInstallare = linkAiuto('Come aggiungo l\'app alla schermata Home?', 'installazione');
  comeInstallare.hidden = true;
  const mostra = (s: StatoPermessi) => {
    stato.textContent = testi[s];
    // Nell'app Android si può richiedere anche dopo un rifiuto; nel browser un rifiuto è definitivo.
    pulsante.hidden = nativa ? s === 'concessi' || s === 'non-disponibili' : s !== 'da-chiedere' && s !== 'da-attivare';
    comeInstallare.hidden = s !== 'da-installare';
    pulsante.disabled = false;
  };
  void piattaforma.statoPermessi().then(mostra);
  pulsante.addEventListener('click', () => {
    pulsante.disabled = true; // niente richieste doppie mentre il browser chiede il permesso e si iscrive
    void piattaforma.richiediPermessi().then(mostra);
  });
  const cambia = (modifica: (a: typeof avvisi) => void) => {
    store.modificaImpostazioni((i) => modifica(i.avvisi));
    salvato();
  };
  return scheda(
    null,
    stato,
    pulsante,
    comeInstallare,
    riga('Uscita prevista', interruttore(avvisi.uscita, (v) => cambia((a) => void (a.uscita = v)), 'Avviso di uscita prevista'), 'quando puoi andare via', 'avviso-uscita'),
    riga('Rientro dal pranzo', interruttore(avvisi.pranzo, (v) => cambia((a) => void (a.pranzo = v)), 'Avviso di rientro dalla pausa pranzo'), 'dopo la durata qui sotto', 'avviso-pranzo'),
    riga('Durata del pranzo (min)', inputMinuti(avvisi.pranzoMinuti, (v) => cambia((a) => void (a.pranzoMinuti = v)), 'Durata della pausa pranzo in minuti', 240, 5, 1), 'di quanto avvisare dopo l\'inizio della pausa', 'durata-pranzo'),
    riga('Rientro dalla sigaretta', interruttore(avvisi.sigaretta, (v) => cambia((a) => void (a.sigaretta = v)), 'Avviso di rientro dalla pausa sigaretta'), 'prima della fine della tolleranza, vedi sotto', 'avviso-sigaretta'),
    riga('Anticipo sigaretta (min)', inputMinuti(avvisi.sigarettaAnticipo, (v) => cambia((a) => void (a.sigarettaAnticipo = v)), 'Anticipo dell\'avviso della pausa sigaretta in minuti', 30, 1), '0 = allo scadere della tolleranza', 'anticipo-sigaretta'),
    linkAiuto('Come funzionano gli avvisi?', 'avvisi'),
  );
}

/** Sezione Sede di lavoro: posizione dell'ufficio per proporre 🏠 o 🏢 all'apertura. */
function sezioneSede(): HTMLElement {
  const ufficio = store.impostazioni.ufficio;
  const salva = el(
    'button',
    { type: 'button', class: 'btn btn-secondario' },
    ufficio ? '📍 Aggiorna con la posizione attuale' : '📍 Sono in ufficio: salva la posizione',
  );
  salva.addEventListener('click', () => {
    salva.disabled = true;
    leggiPosizione()
      .then((p) => {
        if (p.precisione > PRECISIONE_MASSIMA) {
          toast(`Posizione troppo imprecisa (±${Math.round(p.precisione)} m): riprova all'aperto o con il GPS attivo`);
          return;
        }
        store.modificaImpostazioni((i) => void (i.ufficio = { lat: p.lat, lon: p.lon }));
        toast(`Posizione dell'ufficio salvata (±${Math.round(p.precisione)} m)`);
      })
      .catch((e: Error) => toast(e.message))
      .finally(() => (salva.disabled = false));
  });
  return scheda(
    null,
    el(
      'p',
      { class: 'nota' },
      ufficio
        ? `Posizione dell'ufficio salvata. Quando apri l'app, se per oggi non hai ancora scelto, Sbeggio propone 🏢 entro ${RAGGIO_UFFICIO} m dall'ufficio e 🏠 altrove.`
        : 'Salva la posizione mentre sei in ufficio: quando apri l\'app Sbeggio proporrà da solo 🏠 o 🏢. La posizione resta solo su questo telefono.',
    ),
    el(
      'div',
      { class: 'riga-pulsanti', id: 'imp-posizione-ufficio' },
      salva,
      ufficio
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn btn-secondario',
              onclick: () => {
                store.modificaImpostazioni((i) => void (i.ufficio = null));
                toast('Posizione dell\'ufficio eliminata');
              },
            },
            'Elimina la posizione',
          )
        : null,
    ),
    linkAiuto('Come funziona?', 'smart'),
  );
}

/** Ultimo stato letto: la sezione ridisegnata compare subito, senza aspettare il plugin. */
let ultimoStatoNfc: StatoNfc = 'assente';

/** Sezione Tag NFC (solo app Android): stato dell'NFC. Nascosta sui telefoni senza NFC. */
function sezioneTagNfc(): HTMLElement {
  const nota = el('small', { class: 'nota' });
  const apri = el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void apriImpostazioniNfc() }, 'Apri impostazioni NFC');
  const blocco = scheda(
    null,
    el('p', { class: 'nota', id: 'imp-tag-nfc' }, 'Avvicina il tag NFC di Sbeggio (per esempio quello ai tornelli) per timbrare l\'azione del pulsante principale, anche ad app chiusa.'),
    nota,
    apri,
    linkAiuto('Come funziona il tag NFC?', 'tag-nfc'),
  );
  const mostra = (s: StatoNfc) => {
    ultimoStatoNfc = s;
    blocco.hidden = s === 'assente';
    nota.textContent = s === 'attivo' ? 'NFC attivo.' : 'NFC disattivato: attivalo per usare il tag.';
    apri.hidden = s !== 'spento';
  };
  mostra(ultimoStatoNfc);
  void statoNfc().then(mostra);
  // Di ritorno dalle impostazioni di Android si rilegge lo stato, finché la sezione è nella pagina.
  const alRitorno = () => {
    if (!blocco.isConnected) return document.removeEventListener('visibilitychange', alRitorno);
    if (document.visibilityState === 'visible') void statoNfc().then(mostra);
  };
  document.addEventListener('visibilitychange', alRitorno);
  return blocco;
}

const OPZIONI_TEMA: [PreferenzaTema, string][] = [
  ['auto', 'Automatico'],
  ['chiaro', 'Chiaro'],
  ['scuro', 'Scuro'],
];

/** Pulsanti Automatico / Chiaro / Scuro: il tema cambia subito, senza ridisegnare la vista. */
function selettoreTema(): HTMLElement {
  const pulsanti = OPZIONI_TEMA.map(([valore, testo]) =>
    el(
      'button',
      {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(preferenzaTema() === valore),
        onclick: () => {
          impostaPreferenza(valore);
          pulsanti.forEach((b, i) => b.setAttribute('aria-pressed', String(OPZIONI_TEMA[i]![0] === valore)));
        },
      },
      testo,
    ),
  );
  return el('div', { class: 'preset', role: 'group', 'aria-label': 'Tema', id: 'imp-tema' }, pulsanti);
}

const PROVE_SUONI: [Suono, string][] = [
  ['timbra', 'Timbra'],
  ['uscita', 'Uscita'],
  ['minima', 'Pausa'],
];

/** Suoni accesi o spenti, con i pulsanti per sentirli (nella versione di Halloween, se il tema è acceso). */
function schedaSuoni(): HTMLElement {
  const prove = el(
    'div',
    { class: 'preset', role: 'group', 'aria-label': 'Prova i suoni', hidden: !suoniAttivi() },
    PROVE_SUONI.map(([suono, testo]) =>
      el(
        'button',
        {
          type: 'button',
          class: 'chip',
          onclick: () => {
            sbloccaAudio();
            // Al primo tocco l'audio si sta ancora avviando: si aspetta un attimo.
            setTimeout(() => suona(suono), 60);
          },
        },
        `▶︎ ${testo}`,
      ),
    ),
  );
  return scheda(
    null,
    riga(
      'Suoni',
      interruttore(
        suoniAttivi(),
        (v) => {
          impostaSuoni(v);
          prove.hidden = !v;
        },
        'Suoni',
      ),
      'Un suono breve quando timbri, quando esci e quando la pausa pranzo arriva alla minima.',
      'suoni',
    ),
    prove,
  );
}

const OPZIONI_SIGARETTA: [TipoSigaretta, string][] = [
  ['normale', 'Normale'],
  ['elettronica', 'Elettronica'],
];

/** Pulsanti Normale / Elettronica: cambiano solo il disegno della schermata della pausa. */
function selettoreSigaretta(attuale: TipoSigaretta): HTMLElement {
  return el(
    'div',
    { class: 'preset', role: 'group', 'aria-label': 'Tipo di sigaretta' },
    OPZIONI_SIGARETTA.map(([valore, testo]) =>
      el(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(attuale === valore),
          onclick: () => {
            // Il salvataggio ridisegna la vista: i pulsanti si aggiornano da soli.
            store.modificaImpostazioni((i) => void (i.tipoSigaretta = valore));
            salvato();
          },
        },
        testo,
      ),
    ),
  );
}

/** Navigazione tra l'elenco e le pagine, gestita da main.ts (che la ricorda tra un ridisegno e l'altro). */
export interface NavImpostazioni {
  /** Pagina aperta; null = l'elenco. */
  pagina: IdPagina | null;
  /** Voce da mostrare nella pagina (id della ricerca), o destinazione nell'Aiuto. */
  voce: string | null;
  apri(pagina: IdPagina, voce?: string): void;
  /** "‹ Impostazioni", o la schermata da cui si è arrivati con un link "?" all'Aiuto. */
  indietro: { etichetta: string; azione: () => void };
}

export function vistaImpostazioni(adesso: Adesso, nav: NavImpostazioni): HTMLElement {
  const imp = store.impostazioni;

  const righeGiorni = ORDINE_GIORNI.map((g) => {
    const valore = imp.minutiDovuti.perGiorno[g] ?? null;
    const usaPredefinito = el('input', { type: 'checkbox', checked: valore === null, 'aria-label': `${NOMI_GIORNI[g]}: usa le ore predefinite` });
    const ore = selettoreOra(valore ?? imp.minutiDovuti.predefinito, {
      aria: `Ore dovute ${NOMI_GIORNI[g]}`,
      onChange: (v) => {
        store.modificaImpostazioni((i) => void (i.minutiDovuti.perGiorno[g] = v));
        salvato();
      },
    });
    ore.abilita(valore !== null);
    usaPredefinito.addEventListener('change', () => {
      store.modificaImpostazioni((i) => {
        i.minutiDovuti.perGiorno[g] = usaPredefinito.checked ? null : ore.leggi();
      });
      salvato();
    });
    return el(
      'div',
      { class: 'riga-impostazione riga-giorno' },
      el('span', { class: 'riga-etichetta' }, NOMI_GIORNI[g]!),
      el('label', { class: 'campo-check piccolo' }, usaPredefinito, ' predefinito'),
      ore.elemento,
    );
  });

  const fileInput = el('input', { type: 'file', accept: '.csv,.json,text/csv,application/json', hidden: true });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) void importaFile(f);
  });

  const pagine: Record<Exclude<IdPagina, 'aiuto' | 'novita'>, () => (Node | null)[]> = {
    dispositivi: () => [
      scheda(
        null,
        el('p', { class: 'nota' }, 'Collega il computer (web.sbeggio.app) per scaricare le timbrature in Excel, CSV o JSON.'),
        el(
          'div',
          { class: 'pila-pulsanti' },
          el('button', { type: 'button', class: 'btn btn-secondario', id: 'imp-collega-dispositivo', onclick: () => void collegaComputer() }, '+ Collega un dispositivo'),
        ),
      ),
    ],
    orario: () => [
      scheda(
        'Ore dovute',
        riga(
          'Predefinite',
          inputHHMM(imp.minutiDovuti.predefinito, (v) => {
            store.modificaImpostazioni((i) => void (i.minutiDovuti.predefinito = v));
            salvato();
          }, 'Ore dovute predefinite'),
          'ore:minuti al giorno',
          'ore-predefinite',
        ),
        el('p', { class: 'nota', id: 'imp-ore-per-giorno' }, 'Per giorno della settimana (togli "predefinito" per un valore diverso, 00:00 = giorno libero):'),
        righeGiorni,
      ),
      scheda(
        'Inizio conteggio',
        riga('Inizio conteggio', inputHHMM(imp.orarioMinimoConteggio, (v) => {
          store.modificaImpostazioni((i) => void (i.orarioMinimoConteggio = v));
          salvato();
        }, 'Orario di inizio conteggio'), 'le timbrature precedenti contano da quest\'ora', 'inizio-conteggio'),
      ),
      linkAiuto('Come vengono usati questi valori?', 'come-si-calcola'),
    ],
    pause: () => [
      scheda(
        'Pausa pranzo',
        riga('Inizio fascia pranzo', inputHHMM(imp.pranzo.inizio, (v) => {
          if (v >= store.impostazioni.pranzo.fine) return void toast('L\'inizio deve precedere la fine');
          store.modificaImpostazioni((i) => void (i.pranzo.inizio = v));
          salvato();
        }, 'Inizio fascia pranzo'), undefined, 'inizio-pranzo'),
        riga('Fine fascia pranzo', inputHHMM(imp.pranzo.fine, (v) => {
          if (v <= store.impostazioni.pranzo.inizio) return void toast('La fine deve seguire l\'inizio');
          store.modificaImpostazioni((i) => void (i.pranzo.fine = v));
          salvato();
        }, 'Fine fascia pranzo'), undefined, 'fine-pranzo'),
        riga('Pausa da scalare (min)', inputMinuti(imp.pausaDaScalare, (v) => {
          store.modificaImpostazioni((i) => void (i.pausaDaScalare = v));
          salvato();
        }, 'Pausa da scalare in minuti'), 'se un permesso copre la fascia pranzo senza pausa registrata', 'pausa-scalare'),
        riga('Pausa minima (min)', inputMinuti(imp.pausaMinima, (v) => {
          store.modificaImpostazioni((i) => void (i.pausaMinima = v));
          salvato();
        }, 'Pausa minima in minuti'), 'una pausa più breve conta come questa durata', 'pausa-minima'),
      ),
      scheda(
        'Pausa sigaretta',
        riga('Tipo', selettoreSigaretta(imp.tipoSigaretta), undefined, 'tipo-sigaretta'),
        riga('Tolleranza (min)', inputMinuti(imp.tolleranzaSigaretta, (v) => {
          store.modificaImpostazioni((i) => void (i.tolleranzaSigaretta = v));
          salvato();
        }, 'Tolleranza della pausa sigaretta in minuti', 60, 1), 'entro questo tempo la pausa non viene conteggiata', 'tolleranza-sigaretta'),
        linkAiuto('Come funziona la pausa sigaretta?', 'pausa-sigaretta'),
      ),
    ],
    sede: () => [sezioneSede()],
    avvisi: () => [sezioneAvvisi()],
    nfc: () => [sezioneTagNfc()],
    aspetto: () => [
      scheda(null, selettoreTema(), el('p', { class: 'nota' }, 'Automatico segue il tema chiaro o scuro del telefono.')),
      // Solo nei giorni della festa: fuori stagione non c'è niente da accendere.
      festaDiOggi() === 'halloween'
        ? scheda(
            null,
            riga(
              'Tema di Halloween 🎃',
              interruttore(festaAccesa() !== null, (v) => impostaFesta(v), 'Tema di Halloween'),
              'Fino a Ognissanti, poi torna da solo il tema normale.',
              'halloween',
            ),
          )
        : null,
      schedaSuoni(),
    ],
    dati: () => [
      scheda(
        null,
        el('p', { class: 'nota' }, 'I dati restano solo su questo iPhone. Esporta un backup ogni tanto.'),
        el(
          'div',
          { class: 'pila-pulsanti' },
          el('button', { type: 'button', class: 'btn btn-secondario', id: 'imp-esporta-excel', onclick: () => void esportaExcelCondividi(adesso) }, 'Esporta Excel'),
          el('button', { type: 'button', class: 'btn btn-secondario', id: 'imp-esporta-csv', onclick: () => void esportaCsvCondividi(adesso) }, 'Esporta CSV'),
          el('button', { type: 'button', class: 'btn btn-secondario', id: 'imp-backup-json', onclick: () => void esportaBackupJson(adesso) }, 'Esporta backup completo (JSON)'),
          el('button', { type: 'button', class: 'btn btn-secondario', id: 'imp-importa', onclick: () => fileInput.click() }, 'Importa CSV o backup JSON…'),
          fileInput,
        ),
      ),
      scheda(
        'Valori predefiniti',
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn-secondario',
            id: 'imp-ripristina',
            onclick: async () => {
              if (await conferma('Ripristinare le impostazioni?', 'Tornano i valori predefiniti (8h lun–ven, pranzo 12:15–14:30, 30 min da scalare, tolleranza sigaretta 11 min, sigaretta normale, avvisi attivi con pranzo da 30 min e sigaretta 2 min prima). Le timbrature non vengono toccate.', 'Ripristina', true)) {
                store.modificaImpostazioni((i) => Object.assign(i, clonaImpostazioni(IMPOSTAZIONI_PREDEFINITE)));
                salvato();
              }
            },
          },
          'Ripristina valori predefiniti',
        ),
      ),
    ],
  };

  // L'Aiuto (vistaAiuto) lo monta main.ts; Novità è un foglio, non una pagina.
  if (nav.pagina && nav.pagina !== 'aiuto' && nav.pagina !== 'novita') {
    const vista = el(
      'section',
      { class: 'vista' },
      el(
        'header',
        { class: 'intestazione' },
        el('button', { type: 'button', class: 'link-indietro', onclick: nav.indietro.azione }, `‹ ${nav.indietro.etichetta}`),
        el('h1', {}, titoloPagina(nav.pagina)),
      ),
      ...pagine[nav.pagina](),
    );
    // Arrivati da una ricerca: porta in vista la voce e la evidenzia.
    if (nav.voce) mostraVoce(vista, vista.querySelector<HTMLElement>(`#imp-${CSS.escape(nav.voce)}`), '');
    return vista;
  }
  return elencoImpostazioni(nav);
}

/** Simbolo bianco su quadratino colorato, come nelle Impostazioni dell'iPhone. */
function iconaPagina(p: PaginaImpostazioni): HTMLElement {
  const quadrato = el('span', { class: 'icona-menu', style: `background:${p.colore}`, 'aria-hidden': 'true' });
  // Markup costante (nessun dato dell'utente): sicuro da inserire così.
  quadrato.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p.icona}</svg>`;
  return quadrato;
}

/** Elenco a gruppi delle pagine, con la ricerca unica (impostazioni e Aiuto) in cima. */
function elencoImpostazioni(nav: NavImpostazioni): HTMLElement {
  const visibili = PAGINE_IMPOSTAZIONI.filter((p) => inApp() || !p.soloApp);
  const gruppi = [...new Set(visibili.map((p) => p.gruppo))].map((g) =>
    el(
      'div',
      { class: 'gruppo-menu' },
      visibili
        .filter((p) => p.gruppo === g)
        .map((p) =>
          el(
            'button',
            {
              type: 'button',
              class: 'voce-menu',
              id: `menu-${p.id}`,
              onclick: () => (p.id === 'novita' ? void apriNovita() : nav.apri(p.id)),
            },
            iconaPagina(p),
            el('span', { class: 'voce-menu-testo' }, p.titolo),
            el('span', { class: 'voce-menu-freccia', 'aria-hidden': 'true' }, '›'),
          ),
        ),
    ),
  );
  const menu = el('div', { class: 'menu-impostazioni' }, gruppi, el('p', { class: 'versione' }, `Sbeggio v${__VERSIONE_APP__}`));

  // Ricerca unica, come sull'iPhone: mentre scrivi, al posto dell'elenco compaiono le impostazioni e
  // le domande dell'Aiuto che corrispondono.
  const risultati = el('div', {});
  const campo = el('input', {
    type: 'search',
    class: 'ricerca-aiuto',
    placeholder: 'Cerca nelle impostazioni e nell\'aiuto',
    'aria-label': 'Cerca nelle impostazioni e nell\'aiuto',
    value: ricerca,
    enterkeyhint: 'search',
  });
  const disegna = () => {
    const attiva = ricerca.trim() !== '';
    menu.hidden = attiva;
    if (!attiva) return void risultati.replaceChildren();
    const impostazioni = cercaImpostazioni(ricerca, { app: inApp(), festa: festaDiOggi() }).map((v) => ({
      nome: v.nome,
      sezione: v.sezione,
      scegli: () => {
        ricerca = '';
        nav.apri(v.pagina, v.id);
      },
    }));
    const aiuto = filtraAiuto(vociAiuto(store.impostazioni), ricerca).map((v) => ({
      nome: v.domanda,
      sezione: `Aiuto · ${v.sezione}`,
      scegli: () => {
        ricerca = '';
        nav.apri('aiuto', v.id);
      },
    }));
    risultati.replaceChildren(
      elencoRisultati([...impostazioni, ...aiuto], 'Nessun risultato. Prova con altre parole, per esempio "pausa", "notifiche" o "permesso".'),
    );
  };
  campo.addEventListener('input', () => {
    ricerca = campo.value;
    disegna();
  });
  disegna();

  return el('section', { class: 'vista' }, el('header', { class: 'intestazione' }, el('h1', {}, 'Impostazioni')), campo, risultati, menu);
}
