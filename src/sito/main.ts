// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import '../style.css';
import './sito.css';
import qrcode from 'qrcode-generator';
import { leggiFragment, urlQr, type Collegamento } from '../core/collega';
import { esportaCsv } from '../core/csv';
import { esportaExcel, TIPO_XLSX } from '../core/excel';
import { esportaJson, giornateDelMese, meseIniziale, mesiPresenti, nomeFile, TUTTO } from '../core/esportazioni';
import { haContenuto } from '../core/giornata';
import { adessoRoma, formattaOra, nomeMese } from '../core/tempo';
import type { DatiSalvati } from '../storage/migrazioni';
import { el, monta } from '../ui/dom';
import { scaricaFile } from '../ui/scarica';
import { avviaSessione, type StatoSito } from './sessione';
import { NOVITA } from '../core/novita';
import { elencoNovita } from '../ui/novita';

/** Feed Atom dei rilasci su GitHub, per chi vuole essere avvisato delle nuove versioni. */
const FEED_RILASCI = 'https://github.com/ricky79/sbeggio/releases.atom';

/** Pagina web.sbeggio.app: QR da inquadrare con l'app, poi i download. I dati stanno solo in memoria. */
const radice = document.getElementById('sito')!;
let orologio: ReturnType<typeof setInterval> | undefined;
let sessione: { nuovo(): void } | undefined;

/** Apertura della pagina: titolo grande e una riga di spiegazione. */
const eroe = (titolo: string, sottotitolo: string | Node) =>
  el(
    'div',
    { class: 'sito-eroe' },
    el('img', { class: 'sito-eroe-logo', src: '/logo.svg', alt: '', width: '76', height: '76' }),
    el('h1', {}, titolo), el('p', { class: 'sito-sottotitolo' }, sottotitolo));
const titolo = () => eroe('Sbeggio sul computer', 'Le tue timbrature in Excel, CSV o JSON, senza cavi.');

/** Lucchetto dalle icone Feather (licenza MIT, vedi THIRD_PARTY_LICENSES.md). */
const LUCCHETTO =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

function riservatezza(): HTMLElement {
  const icona = el('span', { class: 'sito-riservatezza-icona' });
  icona.innerHTML = LUCCHETTO;
  return el(
    'p',
    { class: 'sito-riservatezza' },
    icona,
    el('span', {}, 'Le timbrature arrivano cifrate e restano solo in questa scheda: chiudendola spariscono.'),
  );
}

function qr(testo: string): HTMLElement {
  const codice = qrcode(0, 'M');
  codice.addData(testo);
  codice.make();
  // data-url: lo legge la prova end-to-end (tests/collegamento.e2e.test.ts); la chiave è già nel QR.
  const box = el('div', { class: 'sito-qr', role: 'img', 'aria-label': 'Codice QR da inquadrare con l\'app Sbeggio', 'data-url': testo });
  box.innerHTML = codice.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  return box;
}

function vistaAttesa(c: Collegamento, scadenza: number): Node[] {
  const conto = el('p', { class: 'nota' });
  const aggiorna = () => {
    const s = Math.max(0, Math.ceil((scadenza - Date.now()) / 1000));
    conto.textContent = `Nuovo codice tra ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  aggiorna();
  orologio = setInterval(aggiorna, 1000);
  return [
    eroe('Le tue timbrature, sul computer', 'Inquadra il codice con Sbeggio e scarica le timbrature in Excel, CSV o JSON, del mese o tutte.'),
    el(
      'div',
      { class: 'sito-griglia' },
      el('div', { class: 'scheda sito-attesa' }, qr(urlQr(c)), conto),
      el(
        'div',
        { class: 'scheda' },
        el('h2', { class: 'titolo-sezione' }, 'Come si fa'),
        el(
          'ol',
          { class: 'sito-passi' },
          el('li', {}, el('strong', {}, 'Apri Sbeggio'), ' sul telefono'),
          el('li', {}, 'Vai in ', el('strong', {}, 'Impostazioni → Dispositivi collegati'), ' e tocca ', el('strong', {}, '+ Collega un dispositivo')),
          el('li', {}, el('strong', {}, 'Inquadra il codice'), ': i download compaiono qui'),
        ),
        riservatezza(),
      ),
    ),
  ];
}

type Formato = 'xlsx' | 'csv' | 'json';

function scarica(dati: DatiSalvati, periodo: string, formato: Formato): void {
  const ora = adessoRoma();
  const giornate = periodo === TUTTO ? dati.giornate : giornateDelMese(dati.giornate, periodo);
  const nome = nomeFile(periodo, ora.data, formato);
  if (formato === 'xlsx') scaricaFile(nome, esportaExcel(giornate, dati.impostazioni, ora), TIPO_XLSX);
  else if (formato === 'csv') scaricaFile(nome, esportaCsv(giornate, dati.impostazioni, ora), 'text/csv');
  else scaricaFile(nome, esportaJson(giornate, dati.impostazioni, ora, periodo, __VERSIONE_APP__), 'application/json');
}

function pulsanti(azione: (formato: Formato) => void): HTMLElement {
  return el(
    'div',
    { class: 'riga-pulsanti' },
    el('button', { type: 'button', class: 'btn btn-primario', onclick: () => azione('xlsx') }, 'Excel'),
    el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => azione('csv') }, 'CSV'),
    el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => azione('json') }, 'JSON'),
  );
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function vistaCollegato(dati: DatiSalvati, ricevuti: number): Node[] {
  const n = Object.values(dati.giornate).filter(haContenuto).length;
  const quando = formattaOra(adessoRoma(new Date(ricevuti)).minuti);
  const scollega = el('button', { type: 'button', class: 'btn btn-neutro', onclick: () => sessione?.nuovo() }, 'Scollega');
  const intestazione = [eroe('Timbrature ricevute', `${n} ${n === 1 ? 'giornata ricevuta' : 'giornate ricevute'} alle ${quando}.`)];
  const mesi = mesiPresenti(dati.giornate);
  const iniziale = meseIniziale(mesi, adessoRoma().data);
  if (iniziale === null) {
    return [...intestazione, el('div', { class: 'scheda' }, el('p', {}, 'Non ci sono ancora giornate registrate.'), el('div', { class: 'pila-pulsanti' }, scollega))];
  }
  const selettore = el(
    'select',
    { class: 'sito-mese', 'aria-label': 'Mese' },
    mesi.map((m) => el('option', { value: m }, maiuscola(nomeMese(m)))),
  );
  selettore.value = iniziale;
  return [
    ...intestazione,
    el(
      'div',
      { class: 'sito-griglia' },
      el('div', { class: 'scheda' }, el('h2', { class: 'titolo-sezione' }, 'Un mese'), selettore, pulsanti((f) => scarica(dati, selettore.value, f))),
      el(
        'div',
        { class: 'scheda' },
        el('h2', { class: 'titolo-sezione' }, 'Tutto'),
        el('p', { class: 'nota sito-tutto' }, 'Tutte le giornate in un unico file.'),
        pulsanti((f) => scarica(dati, TUTTO, f)),
      ),
    ),
    riservatezza(),
    el('div', { class: 'pila-pulsanti sito-scollega' }, scollega),
  ];
}

function vistaErrore(motivo: 'connessione' | 'illeggibili' | 'versione'): Node[] {
  const testo = {
    connessione: 'Connessione persa',
    illeggibili: 'Dati ricevuti non leggibili',
    versione: 'Ricarica la pagina: l\'app è più aggiornata del sito',
  }[motivo];
  const azione =
    motivo === 'versione'
      ? el('button', { type: 'button', class: 'btn btn-primario', onclick: () => location.reload() }, 'Ricarica la pagina')
      : el('button', { type: 'button', class: 'btn btn-primario', onclick: () => sessione?.nuovo() }, 'Riprova');
  return [titolo(), el('div', { class: 'scheda' }, el('p', {}, testo), el('div', { class: 'pila-pulsanti' }, azione))];
}

function mostra(s: StatoSito): void {
  clearInterval(orologio);
  const viste = {
    apertura: () => [titolo(), el('div', { class: 'scheda' }, el('p', {}, 'Connessione in corso…'))],
    attesa: () => (s.tipo === 'attesa' ? vistaAttesa(s.collegamento, s.scadenza) : []),
    collegato: () => (s.tipo === 'collegato' ? vistaCollegato(s.dati, s.ricevuti) : []),
    errore: () => (s.tipo === 'errore' ? vistaErrore(s.motivo) : []),
  };
  monta(radice, ...viste[s.tipo]());
}

if (/^\/novita\/?$/.test(location.pathname)) {
  // web.sbeggio.app/novita: le novità di ogni versione, da condividere (stesso elenco dell'app).
  document.title = 'Novità di Sbeggio';
  document.querySelector('.sito-menu a[href="/novita"]')?.setAttribute('aria-current', 'page');
  // Così i lettori di feed e i browser trovano il feed partendo dall'indirizzo della pagina.
  document.head.append(el('link', { rel: 'alternate', type: 'application/atom+xml', title: 'Rilasci di Sbeggio', href: FEED_RILASCI }));
  monta(
    radice,
    eroe('Novità di Sbeggio', 'Cosa è cambiato in ogni versione.'),
    el('div', { class: 'scheda sito-novita' }, elencoNovita(NOVITA)),
    el(
      'p',
      { class: 'nota sito-feed' },
      'Vuoi saperlo appena esce una versione? Segui il ',
      el('a', { href: FEED_RILASCI, type: 'application/atom+xml' }, 'feed RSS dei rilasci'),
      ' con il tuo lettore di feed.',
    ),
  );
} else if (leggiFragment(location.hash)) {
  // Il QR inquadrato con la fotocamera del telefono apre questa pagina: va usata l'app.
  monta(
    radice,
    titolo(),
    el('div', { class: 'scheda' }, el('p', {}, 'Questo codice va inquadrato dall\'app Sbeggio: Impostazioni → Dispositivi collegati → + Collega un dispositivo.')),
  );
} else {
  sessione = avviaSessione(location.origin, (url) => new WebSocket(url), mostra);
}
