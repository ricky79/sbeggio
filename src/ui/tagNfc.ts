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

/**
 * Istante dell'ultima lettura che ha cambiato la giornata (per ignorare il tag tenuto appoggiato). Sta
 * anche in localStorage: ogni ?timbra apre la pagina da capo e un doppio tocco sul comando timbrerebbe due volte.
 */
const CHIAVE_ULTIMA = 'timbrature-ultima-timbratura-rapida';
let ultimaTimbratura: number | null = null;

function leggiUltima(): number | null {
  if (ultimaTimbratura !== null) return ultimaTimbratura;
  try {
    const v = Number(localStorage.getItem(CHIAVE_ULTIMA));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

function salvaUltima(v: number | null): void {
  ultimaTimbratura = v;
  try {
    if (v === null) localStorage.removeItem(CHIAVE_ULTIMA);
    else localStorage.setItem(CHIAVE_ULTIMA, String(v));
  } catch {
    /* resta in memoria */
  }
}

/** Da dove arriva la timbratura rapida: cambiano solo i messaggi. */
export type Origine = 'tag' | 'indirizzo';

const MESSAGGI = {
  tag: { giaLetto: 'Tag già letto: riavvicinalo tra un minuto', finestra: 'Chiudi la finestra aperta e riavvicina il tag' },
  indirizzo: { giaLetto: 'Hai appena timbrato: riprova tra un minuto', finestra: 'Chiudi la finestra aperta e timbra di nuovo' },
};

/** App Android: a ogni lettura di un tag di Sbeggio timbra come il pulsante principale di Oggi. */
export function avviaTagNfc(mostraOggi: () => void): void {
  ascoltaTag(() => void gestisciTag(mostraOggi));
}

/** Timbra come il pulsante principale di Oggi: tag NFC dell'app Android o indirizzo ?timbra. */
export async function gestisciTag(mostraOggi: () => void, origine: Origine = 'tag'): Promise<void> {
  const { data, minuti } = adessoRoma();
  const giornata = store.giornata(data);
  const r = calcolaGiornata(giornata, store.impostazioni, minuti);
  const azione = azioneTag(r, sigarettaInCorso(giornata) !== null, minuti, store.impostazioni.pranzo.fine);
  const esito = esitoLettura({
    azione,
    // La schermata della sigaretta non conta: il tag serve proprio a chiuderla.
    finestraAperta: document.querySelector('dialog[open]:not(.sigaretta)') !== null,
    ora: Date.now(),
    ultimaTimbratura: leggiUltima(),
  });
  if (esito === 'gia-letto') return toast(MESSAGGI[origine].giaLetto);
  // Non si chiude nulla al posto dell'utente: potrebbe perdere una modifica.
  if (esito === 'finestra-aperta') return toast(MESSAGGI[origine].finestra);
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
    salvaUltima(null);
    toast('Timbratura annullata');
  };

  if (azione === 'RIENTRO_SIGARETTA') rientroSigarettaDaTag(data, annulla);
  else if (azione === 'PAUSA_O_USCITA') {
    const scelta = await sceltaPausaOUscita();
    if (scelta) await eseguiAzione(scelta, data, annulla);
  } else await eseguiAzione(azione, data, annulla);

  // La vibrazione conferma la timbratura: solo se la giornata è cambiata davvero (non dopo un foglio
  // lasciato a metà, che altrimenti farebbe credere di aver timbrato).
  if (JSON.stringify(store.giornata(data).eventi) !== JSON.stringify(prima.eventi)) {
    salvaUltima(Date.now());
    void vibra();
  }
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
