// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata } from '../core/calcolo';
import { nuovoId } from '../core/id';
import { BLOCCO_PERMESSO, permessoABlocchi } from '../core/permessi';
import {
  aggiungiSigarettaNonConteggiata,
  eliminaSigarettaNonConteggiata,
  modificaSigarettaNonConteggiata,
} from '../core/sigaretta';
import { formattaDurata, formattaOra } from '../core/tempo';
import { ETICHETTE_EVENTO, TIPI_EVENTO, type Evento, type Ripartizione, type TipoEvento } from '../core/tipi';
import { store } from '../storage/store';
import { campoDurata, campoOra } from './campi';
import { apriFoglio, conferma, type PulsanteFoglio } from './dialoghi';
import { el } from './dom';

/** Voce del tipo, solo in aggiunta: la sigaretta non conteggiata non è un evento e non entra nel calcolo. */
const SIGARETTA = 'SIGARETTA';

/** Durata proposta per una sigaretta non conteggiata aggiunta a mano (minuti). */
const DURATA_SIGARETTA_PROPOSTA = 5;

/** Durata di una sigaretta non conteggiata: a passi di un minuto. */
const campoDurataSigaretta = (minuti: number) => campoDurata('Durata', minuti, { passo: 1, min: 1, max: 12 * 60 });

/** Aggiunge (evento = null) o modifica un evento della giornata. */
export async function editorEvento(data: string, evento: Evento | null, minutiProposti: number): Promise<void> {
  const nuovo = evento === null;
  const selTipo = el(
    'select',
    {},
    TIPI_EVENTO.map((t) => el('option', { value: t, selected: evento?.tipo === t }, ETICHETTE_EVENTO[t])),
    nuovo ? el('option', { value: SIGARETTA }, '🚬 Pausa sigaretta (non conteggiata)') : null,
  );
  if (nuovo) selTipo.value = 'ENTRATA';
  const ora = campoOra('Orario', evento?.minuti ?? minutiProposti);
  const durata = campoDurataSigaretta(DURATA_SIGARETTA_PROPOSTA);
  const aggiornaTipo = () => durata.elemento.toggleAttribute('hidden', selTipo.value !== SIGARETTA);
  selTipo.addEventListener('change', aggiornaTipo);
  aggiornaTipo();
  const errore = el('p', { class: 'errore', role: 'alert' });

  // Ripartizione pausa/permesso, solo per i rientri da permesso a ridosso del pranzo.
  const ripartizione = evento ? trovaRipartizione(data, evento.id) : undefined;
  const auto = el('input', { type: 'checkbox', checked: evento?.pausaConfermata === undefined });
  const pausa = campoDurata('Di cui pausa pranzo', ripartizione?.pausa ?? 0, {
    max: ripartizione ? ripartizione.a - ripartizione.da : 0,
  });
  const boxPausa = ripartizione
    ? el(
        'fieldset',
        { class: 'riquadro' },
        el('legend', {}, 'Permesso a ridosso del pranzo'),
        el('p', { class: 'nota' }, `Proposta automatica: ${formattaDurata(ripartizione.proposta)} di pausa.`),
        el('label', { class: 'campo-check' }, auto, ' Usa la proposta automatica'),
        pausa.elemento,
      )
    : null;
  const aggiornaAuto = () => pausa.elemento.classList.toggle('disabilitato', auto.checked);
  auto.addEventListener('change', aggiornaAuto);
  aggiornaAuto();

  const contenuto = el(
    'div',
    { class: 'modulo' },
    el('label', { class: 'campo' }, el('span', {}, 'Tipo'), selTipo),
    ora.elemento,
    durata.elemento,
    boxPausa,
    errore,
  );

  let elimina = false;
  const pulsanti: PulsanteFoglio[] = [
    {
      etichetta: nuovo ? 'Aggiungi' : 'Salva',
      stile: 'primario',
      azione: () => {
        const minuti = ora.leggi();
        if (minuti === null) {
          errore.textContent = 'Inserisci un orario valido.';
          return false;
        }
        if (selTipo.value === SIGARETTA) {
          store.modificaGiornata(data, (g) => aggiungiSigarettaNonConteggiata(g, minuti, durata.leggi()));
          return true;
        }
        const tipo = selTipo.value as TipoEvento;
        store.modificaGiornata(data, (g) => {
          if (nuovo) {
            g.eventi.push({ id: nuovoId(), tipo, minuti });
            return;
          }
          const e = g.eventi.find((x) => x.id === evento.id);
          if (!e) return;
          e.tipo = tipo;
          e.minuti = minuti;
          if (tipo !== 'USCITA_PERMESSO') delete e.sigaretta;
          if (tipo !== 'RIENTRO_PERMESSO' || !ripartizione || auto.checked) delete e.pausaConfermata;
          else e.pausaConfermata = pausa.leggi();
        });
        return true;
      },
    },
  ];
  if (!nuovo) {
    pulsanti.push({
      etichetta: 'Elimina',
      stile: 'pericolo',
      azione: () => void (elimina = true),
    });
  }
  pulsanti.push({ etichetta: 'Annulla' });
  await apriFoglio(nuovo ? 'Aggiungi timbratura' : 'Modifica timbratura', contenuto, pulsanti);
  if (elimina && evento) {
    const ok = await conferma('Eliminare la timbratura?', `${ETICHETTE_EVENTO[evento.tipo]} verrà eliminata.`, 'Elimina', true);
    if (ok) store.modificaGiornata(data, (g) => void (g.eventi = g.eventi.filter((x) => x.id !== evento.id)));
  }
}

/** Modifica o elimina la sigaretta non conteggiata in posizione `indice`: orario e durata, mai il tipo. */
export async function editorSigarettaNonConteggiata(data: string, indice: number): Promise<void> {
  const sigaretta = store.giornata(data).sigaretteNonConteggiate?.[indice];
  if (!sigaretta) return;
  const ora = campoOra('Orario', sigaretta.minuti);
  const durata = campoDurataSigaretta(sigaretta.durata);
  const contenuto = el(
    'div',
    { class: 'modulo' },
    el('p', { class: 'nota' }, 'Rientrata entro la tolleranza: si vede tra le timbrature ma non conta nelle ore.'),
    ora.elemento,
    durata.elemento,
  );
  let elimina = false;
  await apriFoglio('🚬 Pausa sigaretta', contenuto, [
    {
      etichetta: 'Salva',
      stile: 'primario',
      azione: () =>
        store.modificaGiornata(data, (g) => modificaSigarettaNonConteggiata(g, indice, ora.leggi() ?? sigaretta.minuti, durata.leggi())),
    },
    { etichetta: 'Elimina', stile: 'pericolo', azione: () => void (elimina = true) },
    { etichetta: 'Annulla' },
  ]);
  if (!elimina) return;
  const ok = await conferma(
    'Eliminare la pausa sigaretta?',
    `La pausa sigaretta delle ${formattaOra(sigaretta.minuti)} verrà eliminata.`,
    'Elimina',
    true,
  );
  if (ok) store.modificaGiornata(data, (g) => eliminaSigarettaNonConteggiata(g, indice));
}

function trovaRipartizione(data: string, eventoId: string): Ripartizione | undefined {
  const g = store.giornata(data);
  const r = calcolaGiornata(g, store.impostazioni, null);
  return r.ripartizioni.find((x) => x.eventoRientroId === eventoId);
}

/** Imposta il permesso a inizio giornata; opzionalmente registra anche l'entrata. */
export async function editorPermessoInizio(data: string, entrataAdesso: number | null): Promise<void> {
  const attuale = store.giornata(data).permessoInizioMinuti;
  const durata = campoDurata('Durata del permesso', attuale || 60, { passo: BLOCCO_PERMESSO, max: 12 * 60 });
  const preset = el(
    'div',
    { class: 'preset' },
    [60, 120, 180, 240].map((m) =>
      el('button', { type: 'button', class: 'chip', onclick: () => durata.imposta(m) }, formattaDurata(m)),
    ),
  );
  const conEntrata = el('input', { type: 'checkbox', checked: entrataAdesso !== null });
  const contenuto = el(
    'div',
    { class: 'modulo' },
    el('p', { class: 'nota' }, 'Ore di permesso per l\'ingresso posticipato: contano come ore coperte.'),
    preset,
    durata.elemento,
    entrataAdesso !== null ? el('label', { class: 'campo-check' }, conEntrata, ' Registra anche l\'entrata adesso') : null,
  );
  const pulsanti: PulsanteFoglio[] = [
    {
      etichetta: 'Salva',
      stile: 'primario',
      azione: () => {
        store.modificaGiornata(data, (g) => {
          g.permessoInizioMinuti = durata.leggi();
          if (entrataAdesso !== null && conEntrata.checked) {
            g.eventi.push({ id: nuovoId(), tipo: 'ENTRATA', minuti: entrataAdesso });
          }
        });
      },
    },
  ];
  if (attuale > 0) {
    pulsanti.push({
      etichetta: 'Rimuovi permesso',
      stile: 'pericolo',
      azione: () => store.modificaGiornata(data, (g) => void (g.permessoInizioMinuti = 0)),
    });
  }
  pulsanti.push({ etichetta: 'Annulla' });
  await apriFoglio('Entro dopo', contenuto, pulsanti);
}

/** Imposta il permesso in uscita pianificato: anticipa l'uscita prevista. */
export async function editorPermessoUscita(data: string): Promise<void> {
  const attuale = store.giornata(data).permessoUscitaMinuti;
  const durata = campoDurata('Durata del permesso', attuale || BLOCCO_PERMESSO, {
    passo: BLOCCO_PERMESSO,
    min: BLOCCO_PERMESSO,
    max: 12 * 60,
  });
  const preset = el(
    'div',
    { class: 'preset' },
    [30, 60, 90, 120].map((m) =>
      el('button', { type: 'button', class: 'chip', onclick: () => durata.imposta(m) }, formattaDurata(m)),
    ),
  );
  const contenuto = el(
    'div',
    { class: 'modulo' },
    el(
      'p',
      { class: 'nota' },
      'Ore di permesso per uscire prima: l\'uscita prevista si anticipa. All\'uscita conta il permesso che manca davvero, a blocchi di 30 min.',
    ),
    preset,
    durata.elemento,
  );
  const pulsanti: PulsanteFoglio[] = [
    {
      etichetta: 'Salva',
      stile: 'primario',
      azione: () => store.modificaGiornata(data, (g) => void (g.permessoUscitaMinuti = permessoABlocchi(durata.leggi()))),
    },
  ];
  if (attuale > 0) {
    pulsanti.push({
      etichetta: 'Rimuovi permesso',
      stile: 'pericolo',
      azione: () => store.modificaGiornata(data, (g) => void (g.permessoUscitaMinuti = 0)),
    });
  }
  pulsanti.push({ etichetta: 'Annulla' });
  await apriFoglio('Permesso in uscita', contenuto, pulsanti);
}

/**
 * Mostra la ripartizione proposta per un permesso a ridosso del pranzo e
 * restituisce i minuti di pausa confermati, oppure null se annullato.
 */
export async function confermaRipartizione(r: Ripartizione): Promise<number | null> {
  const totale = r.a - r.da;
  const riassunto = el('p', { class: 'ripartizione' });
  const aggiorna = (p: number) => {
    riassunto.replaceChildren(
      el('strong', {}, formattaDurata(p)),
      ' pausa + ',
      el('strong', {}, formattaDurata(totale - p)),
      ' permesso',
    );
  };
  const pausa = campoDurata('Pausa pranzo', r.proposta, { max: totale, onChange: aggiorna });
  let esito: number | null = null;
  await apriFoglio(
    'Rientro da permesso',
    el(
      'div',
      { class: 'modulo' },
      el('p', { class: 'nota' }, `Il permesso (${formattaDurata(totale)}) copre la fascia pranzo e oggi non hai registrato una pausa. Ripartizione proposta:`),
      riassunto,
      pausa.elemento,
    ),
    [
      { etichetta: 'Conferma rientro', stile: 'primario', azione: () => void (esito = pausa.leggi()) },
      { etichetta: 'Annulla' },
    ],
  );
  return esito;
}
