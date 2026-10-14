// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import '../style.css';
import './sito.css';
import qrcode from 'qrcode-generator';
import { leggiFragment, urlQr, type Collegamento } from '../core/collega';
import { esportaCsv } from '../core/csv';
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

const titolo = () => el('h1', {}, 'Sbeggio sul computer');

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
    titolo(),
    el('p', { class: 'nota' }, 'Scarica le timbrature in CSV o JSON, del mese o tutte.'),
    el(
      'div',
      { class: 'scheda sito-attesa' },
      qr(urlQr(c)),
      el(
        'ol',
        { class: 'sito-passi' },
        el('li', {}, 'Apri Sbeggio sul telefono'),
        el('li', {}, 'Vai in Impostazioni → Collega al computer'),
        el('li', {}, 'Inquadra questo codice'),
      ),
      conto,
    ),
    el('p', { class: 'nota' }, 'Le timbrature arrivano cifrate e restano solo in questa scheda: chiudendola spariscono.'),
  ];
}

function scarica(dati: DatiSalvati, periodo: string, formato: 'csv' | 'json'): void {
  const ora = adessoRoma();
  const giornate = periodo === TUTTO ? dati.giornate : giornateDelMese(dati.giornate, periodo);
  const nome = nomeFile(periodo, ora.data, formato);
  if (formato === 'csv') scaricaFile(nome, esportaCsv(giornate, dati.impostazioni, ora), 'text/csv');
  else scaricaFile(nome, esportaJson(giornate, dati.impostazioni, ora, periodo, __VERSIONE_APP__), 'application/json');
}

function pulsanti(azione: (formato: 'csv' | 'json') => void): HTMLElement {
  return el(
    'div',
    { class: 'riga-pulsanti' },
    el('button', { type: 'button', class: 'btn btn-primario', onclick: () => azione('csv') }, 'CSV (Excel)'),
    el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => azione('json') }, 'JSON'),
  );
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function vistaCollegato(dati: DatiSalvati, ricevuti: number): Node[] {
  const n = Object.values(dati.giornate).filter(haContenuto).length;
  const quando = formattaOra(adessoRoma(new Date(ricevuti)).minuti);
  const scollega = el('button', { type: 'button', class: 'btn btn-neutro', onclick: () => sessione?.nuovo() }, 'Scollega');
  const intestazione = [
    titolo(),
    el('p', { class: 'nota' }, `Ricevute ${n} ${n === 1 ? 'giornata' : 'giornate'} alle ${quando}`),
  ];
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
    el('div', { class: 'scheda' }, el('h2', { class: 'titolo-sezione' }, 'Mese'), selettore, pulsanti((f) => scarica(dati, selettore.value, f))),
    el('div', { class: 'scheda' }, el('h2', { class: 'titolo-sezione' }, 'Tutto'), pulsanti((f) => scarica(dati, TUTTO, f))),
    el('div', { class: 'pila-pulsanti' }, scollega),
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
  // Così i lettori di feed e i browser trovano il feed partendo dall'indirizzo della pagina.
  document.head.append(el('link', { rel: 'alternate', type: 'application/atom+xml', title: 'Rilasci di Sbeggio', href: FEED_RILASCI }));
  monta(
    radice,
    el('h1', {}, 'Novità di Sbeggio'),
    el('p', { class: 'nota' }, 'Cosa è cambiato in ogni versione. ', el('a', { href: 'https://sbeggio.app' }, 'Apri Sbeggio')),
    el('div', { class: 'scheda' }, elencoNovita(NOVITA)),
    el(
      'p',
      { class: 'nota' },
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
    el('div', { class: 'scheda' }, el('p', {}, 'Questo codice va inquadrato dall\'app Sbeggio: Impostazioni → Collega al computer.')),
  );
} else {
  sessione = avviaSessione(location.origin, (url) => new WebSocket(url), mostra);
}
