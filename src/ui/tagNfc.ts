// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata } from '../core/calcolo';
import { sigarettaInCorso } from '../core/sigaretta';
import { azioneTag, esitoLettura } from '../core/tagNfc';
import { adessoRoma } from '../core/tempo';
import { ascoltaTag, vibra } from '../native/nfc';
import { store } from '../storage/store';
import { apriFoglio, toast } from './dialoghi';
import { el } from './dom';
import { eseguiAzione } from './giorno';
import { inizioSigarettaSalvato, salvaInizioSigaretta } from './inizioSigaretta';
import { rientroSigarettaDaTag } from './sigaretta';

/** Istante dell'ultima lettura che ha cambiato la giornata (per ignorare il tag tenuto appoggiato). */
let ultimaTimbratura: number | null = null;

/** App Android: a ogni lettura di un tag di Sbeggio timbra come il pulsante principale di Oggi. */
export function avviaTagNfc(mostraOggi: () => void): void {
  ascoltaTag(() => void gestisciTag(mostraOggi));
}

export async function gestisciTag(mostraOggi: () => void): Promise<void> {
  const { data, minuti } = adessoRoma();
  const giornata = store.giornata(data);
  const r = calcolaGiornata(giornata, store.impostazioni, minuti);
  const azione = azioneTag(r, sigarettaInCorso(giornata) !== null, minuti, store.impostazioni.pranzo);
  const esito = esitoLettura({
    azione,
    // Le schermate della sigaretta e della pausa pranzo non contano: il tag serve proprio a chiuderle.
    finestraAperta: document.querySelector('dialog[open]:not(.sigaretta):not(.pranzo:not(.riepilogo))') !== null,
    ora: Date.now(),
    ultimaTimbratura,
  });
  if (esito === 'gia-letto') return toast('Tag già letto: riavvicinalo tra un minuto');
  // Non si chiude nulla al posto dell'utente: potrebbe perdere una modifica.
  if (esito === 'finestra-aperta') return toast('Chiudi la finestra aperta e riavvicina il tag');
  mostraOggi();
  if (esito === 'chiusa' || azione === null) return toast('Giornata già chiusa');

  const prima = structuredClone(giornata);
  const sigaretta = sigarettaInCorso(prima);
  const inizio = sigaretta ? inizioSigarettaSalvato(data, sigaretta.id) : null;
  const annulla = () => {
    // Prima l'inizio: la modifica allo store ridisegna e riapre la schermata della sigaretta, che lo legge.
    if (sigaretta && inizio !== null) salvaInizioSigaretta({ data, eventoId: sigaretta.id, inizio });
    store.modificaGiornata(data, (g) => {
      g.eventi = structuredClone(prima.eventi);
      // Annullare il rientro da una sigaretta breve la toglie anche dalle non conteggiate.
      if (prima.sigaretteNonConteggiate) g.sigaretteNonConteggiate = structuredClone(prima.sigaretteNonConteggiate);
      else delete g.sigaretteNonConteggiate;
    });
    ultimaTimbratura = null;
    toast('Timbratura annullata');
  };

  if (azione === 'RIENTRO_SIGARETTA') rientroSigarettaDaTag(data, annulla);
  else if (azione === 'SIGARETTA_O_PERMESSO' || azione === 'PAUSA_O_USCITA') {
    const scelta = await (azione === 'SIGARETTA_O_PERMESSO' ? sceltaSigarettaOPermesso() : sceltaPausaOUscita());
    if (scelta) await eseguiAzione(scelta, data, annulla);
  } else await eseguiAzione(azione, data, annulla);

  // La vibrazione conferma la timbratura: solo se la giornata è cambiata davvero (non dopo un foglio
  // lasciato a metà, che altrimenti farebbe credere di aver timbrato).
  if (JSON.stringify(store.giornata(data).eventi) !== JSON.stringify(prima.eventi)) {
    ultimaTimbratura = Date.now();
    void vibra();
  }
}

/** Prima della fascia pranzo si esce solo in sigaretta o in permesso: il tag chiede quale. */
async function sceltaSigarettaOPermesso(): Promise<'PAUSA_SIGARETTA' | 'USCITA_PERMESSO' | null> {
  let scelta: 'PAUSA_SIGARETTA' | 'USCITA_PERMESSO' | null = null;
  await apriFoglio('Cosa timbri?', el('p', { class: 'testo-foglio' }, 'La fascia pranzo non è ancora iniziata.'), [
    { etichetta: '🚬 Pausa sigaretta', stile: 'primario', azione: () => void (scelta = 'PAUSA_SIGARETTA') },
    { etichetta: 'Esco in permesso', stile: 'primario', azione: () => void (scelta = 'USCITA_PERMESSO') },
    { etichetta: 'Annulla' },
  ]);
  return scelta;
}

/** Fascia pranzo finita senza pausa: il tag non indovina, chiede. */
async function sceltaPausaOUscita(): Promise<'INIZIO_PAUSA' | 'USCITA' | null> {
  let scelta: 'INIZIO_PAUSA' | 'USCITA' | null = null;
  await apriFoglio('Cosa timbri?', el('p', { class: 'testo-foglio' }, 'La fascia pranzo è finita e la pausa non è registrata.'), [
    { etichetta: 'Inizio pausa pranzo', stile: 'primario', azione: () => void (scelta = 'INIZIO_PAUSA') },
    { etichetta: 'Uscita', azione: () => void (scelta = 'USCITA') },
    { etichetta: 'Annulla' },
  ]);
  return scelta;
}
