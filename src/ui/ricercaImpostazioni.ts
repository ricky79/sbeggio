// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { corrisponde } from '../core/testi';

/**
 * Ricerca nelle impostazioni, come quella dell'iPhone: l'elenco delle voci con i loro sinonimi.
 * L'id è quello della riga nella pagina (`imp-<id>`, vedi impostazioni.ts): aggiungendo
 * un'impostazione, aggiungi qui la sua voce. La sezione è il titolo della scheda.
 */
export interface VoceImpostazione {
  id: string;
  nome: string;
  sezione: string;
  /** Altre parole con cui cercarla. */
  sinonimi?: string;
  /** Solo nell'app Android. */
  soloApp?: boolean;
}

export const VOCI_IMPOSTAZIONI: readonly VoceImpostazione[] = [
  { id: 'ore-predefinite', nome: 'Ore dovute predefinite', sezione: 'Ore dovute', sinonimi: 'orario giornaliero ore al giorno contratto' },
  { id: 'ore-per-giorno', nome: 'Ore per giorno della settimana', sezione: 'Ore dovute', sinonimi: 'lunedì martedì mercoledì giovedì venerdì sabato domenica giorno libero part time' },
  { id: 'inizio-pranzo', nome: 'Inizio fascia pranzo', sezione: 'Pausa pranzo', sinonimi: 'orario mensa' },
  { id: 'fine-pranzo', nome: 'Fine fascia pranzo', sezione: 'Pausa pranzo', sinonimi: 'orario mensa' },
  { id: 'pausa-scalare', nome: 'Pausa da scalare', sezione: 'Pausa pranzo', sinonimi: 'permesso minuti trattenuta' },
  { id: 'pausa-minima', nome: 'Pausa minima', sezione: 'Pausa pranzo', sinonimi: 'obbligatoria minuti' },
  { id: 'tipo-sigaretta', nome: 'Tipo di sigaretta', sezione: 'Pausa sigaretta', sinonimi: 'normale elettronica svapo disegno fumo' },
  { id: 'tolleranza-sigaretta', nome: 'Tolleranza', sezione: 'Pausa sigaretta', sinonimi: 'minuti fumo' },
  { id: 'posizione-ufficio', nome: 'Posizione dell\'ufficio', sezione: 'Sede di lavoro', sinonimi: 'gps luogo casa smart working sede ufficio' },
  { id: 'permessi-avvisi', nome: 'Permesso per le notifiche', sezione: 'Avvisi', sinonimi: 'notifiche autorizza' },
  { id: 'avviso-uscita', nome: 'Uscita prevista', sezione: 'Avvisi', sinonimi: 'notifiche andare via' },
  { id: 'avviso-pranzo', nome: 'Rientro dal pranzo', sezione: 'Avvisi', sinonimi: 'notifiche pausa' },
  { id: 'durata-pranzo', nome: 'Durata del pranzo', sezione: 'Avvisi', sinonimi: 'notifiche pausa minuti' },
  { id: 'avviso-sigaretta', nome: 'Rientro dalla sigaretta', sezione: 'Avvisi', sinonimi: 'notifiche pausa fumo' },
  { id: 'anticipo-sigaretta', nome: 'Anticipo sigaretta', sezione: 'Avvisi', sinonimi: 'notifiche pausa fumo minuti' },
  { id: 'tag-nfc', nome: 'Tag NFC', sezione: 'Tag NFC', sinonimi: 'tornelli timbrare', soloApp: true },
  { id: 'inizio-conteggio', nome: 'Inizio conteggio', sezione: 'Conteggio', sinonimi: 'orario minimo entrata presto' },
  { id: 'ripristina', nome: 'Ripristina valori predefiniti', sezione: 'Conteggio', sinonimi: 'reset azzera' },
  { id: 'tema', nome: 'Tema', sezione: 'Aspetto', sinonimi: 'chiaro scuro automatico dark colori notte' },
  { id: 'esporta-excel', nome: 'Esporta Excel', sezione: 'Dati e backup', sinonimi: 'xlsx foglio di calcolo scarica' },
  { id: 'esporta-csv', nome: 'Esporta CSV', sezione: 'Dati e backup', sinonimi: 'scarica' },
  { id: 'backup-json', nome: 'Esporta backup completo', sezione: 'Dati e backup', sinonimi: 'json salva copia' },
  { id: 'collega-computer', nome: 'Collega al computer', sezione: 'Dati e backup', sinonimi: 'pc qr web sito ufficio scarica' },
  { id: 'importa', nome: 'Importa CSV o backup', sezione: 'Dati e backup', sinonimi: 'json ripristina carica' },
];

/** Voci che corrispondono alla ricerca, nell'ordine della pagina. Ricerca vuota: nessuna. */
export function cercaImpostazioni(query: string, opzioni: { app: boolean }): VoceImpostazione[] {
  if (!query.trim()) return [];
  return VOCI_IMPOSTAZIONI.filter(
    (v) => (opzioni.app || !v.soloApp) && corrisponde(`${v.nome} ${v.sezione} ${v.sinonimi ?? ''}`, query),
  );
}
