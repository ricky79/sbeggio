// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { corrisponde } from '../core/testi';

/** Pagine delle Impostazioni, nell'ordine dell'elenco; `gruppo` separa i blocchi come sull'iPhone. */
export type IdPagina = 'dispositivi' | 'orario' | 'pause' | 'sede' | 'avvisi' | 'nfc' | 'aspetto' | 'dati' | 'aiuto' | 'novita';

export interface PaginaImpostazioni {
  id: IdPagina;
  titolo: string;
  gruppo: number;
  /** Colore del quadratino dell'icona. */
  colore: string;
  /** Simbolo bianco (SVG 24×24 a tratto). Icone Feather (licenza MIT, vedi THIRD_PARTY_LICENSES.md). */
  icona: string;
  soloApp?: boolean;
}

export const PAGINE_IMPOSTAZIONI: readonly PaginaImpostazioni[] = [
  { id: 'dispositivi', titolo: 'Dispositivi collegati', gruppo: 1, colore: '#0a84ff', icona: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>' },
  { id: 'orario', titolo: 'Orario di lavoro', gruppo: 2, colore: '#ff9500', icona: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  { id: 'pause', titolo: 'Pause', gruppo: 2, colore: '#a2845e', icona: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/>' },
  { id: 'sede', titolo: 'Sede di lavoro', gruppo: 2, colore: '#34c759', icona: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
  { id: 'avvisi', titolo: 'Avvisi', gruppo: 3, colore: '#ff3b30', icona: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
  { id: 'nfc', titolo: 'Tag NFC', gruppo: 3, colore: '#5856d6', icona: '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>', soloApp: true },
  { id: 'aspetto', titolo: 'Aspetto', gruppo: 3, colore: '#5ac8fa', icona: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' },
  { id: 'dati', titolo: 'Dati e backup', gruppo: 4, colore: '#8e8e93', icona: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>' },
  { id: 'aiuto', titolo: 'Aiuto', gruppo: 5, colore: '#30b0c7', icona: '<circle cx="12" cy="12" r="9.5"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>' },
  { id: 'novita', titolo: 'Novità', gruppo: 5, colore: '#ff2d55', icona: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' },
];

export function titoloPagina(id: IdPagina): string {
  return PAGINE_IMPOSTAZIONI.find((p) => p.id === id)!.titolo;
}

/**
 * Ricerca nelle impostazioni, come quella dell'iPhone: l'elenco delle voci con i loro sinonimi.
 * L'id è quello della riga nella pagina (`imp-<id>`, vedi impostazioni.ts): aggiungendo
 * un'impostazione, aggiungi qui la sua voce. `pagina` è la pagina che la contiene; `sezione` è il
 * testo mostrato sotto il risultato.
 */
export interface VoceImpostazione {
  id: string;
  nome: string;
  pagina: IdPagina;
  sezione: string;
  /** Altre parole con cui cercarla. */
  sinonimi?: string;
  /** Solo nell'app Android. */
  soloApp?: boolean;
}

type Voce = Omit<VoceImpostazione, 'sezione'>;

const VOCI: readonly Voce[] = [
  { id: 'collega-dispositivo', nome: 'Collega un dispositivo', pagina: 'dispositivi', sinonimi: 'computer pc qr web sito ufficio scarica collega' },
  { id: 'ore-predefinite', nome: 'Ore dovute predefinite', pagina: 'orario', sinonimi: 'orario giornaliero ore al giorno contratto' },
  { id: 'ore-per-giorno', nome: 'Ore per giorno della settimana', pagina: 'orario', sinonimi: 'lunedì martedì mercoledì giovedì venerdì sabato domenica giorno libero part time' },
  { id: 'inizio-conteggio', nome: 'Inizio conteggio', pagina: 'orario', sinonimi: 'orario minimo entrata presto' },
  { id: 'inizio-pranzo', nome: 'Inizio fascia pranzo', pagina: 'pause', sinonimi: 'pausa orario mensa' },
  { id: 'fine-pranzo', nome: 'Fine fascia pranzo', pagina: 'pause', sinonimi: 'pausa orario mensa' },
  { id: 'pausa-scalare', nome: 'Pausa da scalare', pagina: 'pause', sinonimi: 'permesso minuti trattenuta pranzo' },
  { id: 'pausa-minima', nome: 'Pausa minima', pagina: 'pause', sinonimi: 'obbligatoria minuti pranzo' },
  { id: 'tipo-sigaretta', nome: 'Tipo di sigaretta', pagina: 'pause', sinonimi: 'pausa normale elettronica svapo disegno fumo' },
  { id: 'tolleranza-sigaretta', nome: 'Tolleranza', pagina: 'pause', sinonimi: 'pausa sigaretta minuti fumo' },
  { id: 'posizione-ufficio', nome: 'Posizione dell\'ufficio', pagina: 'sede', sinonimi: 'gps luogo casa smart working sede ufficio' },
  { id: 'permessi-avvisi', nome: 'Permesso per le notifiche', pagina: 'avvisi', sinonimi: 'notifiche autorizza' },
  { id: 'avviso-uscita', nome: 'Uscita prevista', pagina: 'avvisi', sinonimi: 'notifiche andare via' },
  { id: 'avviso-pranzo', nome: 'Rientro dal pranzo', pagina: 'avvisi', sinonimi: 'notifiche pausa' },
  { id: 'durata-pranzo', nome: 'Durata del pranzo', pagina: 'avvisi', sinonimi: 'notifiche pausa minuti' },
  { id: 'avviso-sigaretta', nome: 'Rientro dalla sigaretta', pagina: 'avvisi', sinonimi: 'notifiche pausa fumo' },
  { id: 'anticipo-sigaretta', nome: 'Anticipo sigaretta', pagina: 'avvisi', sinonimi: 'notifiche pausa fumo minuti' },
  { id: 'tag-nfc', nome: 'Tag NFC', pagina: 'nfc', sinonimi: 'tornelli timbrare', soloApp: true },
  { id: 'tema', nome: 'Tema', pagina: 'aspetto', sinonimi: 'chiaro scuro automatico dark colori notte' },
  { id: 'esporta-excel', nome: 'Esporta Excel', pagina: 'dati', sinonimi: 'xlsx foglio di calcolo scarica' },
  { id: 'esporta-csv', nome: 'Esporta CSV', pagina: 'dati', sinonimi: 'scarica' },
  { id: 'backup-json', nome: 'Esporta backup completo', pagina: 'dati', sinonimi: 'json salva copia' },
  { id: 'importa', nome: 'Importa CSV o backup', pagina: 'dati', sinonimi: 'json ripristina carica' },
  { id: 'ripristina', nome: 'Ripristina valori predefiniti', pagina: 'dati', sinonimi: 'reset azzera impostazioni' },
];

export const VOCI_IMPOSTAZIONI: readonly VoceImpostazione[] = VOCI.map((v) => ({ ...v, sezione: titoloPagina(v.pagina) }));

/** Voci che corrispondono alla ricerca, nell'ordine della pagina. Ricerca vuota: nessuna. */
export function cercaImpostazioni(query: string, opzioni: { app: boolean }): VoceImpostazione[] {
  if (!query.trim()) return [];
  return VOCI_IMPOSTAZIONI.filter(
    (v) => (opzioni.app || !v.soloApp) && corrisponde(`${v.nome} ${v.sezione} ${v.sinonimi ?? ''}`, query),
  );
}
