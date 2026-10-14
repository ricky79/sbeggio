// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { BLOCCO_PERMESSO, permessoABlocchi } from './permessi';
import { analizzaGiornata } from './statoGiornata';
import { adessoRoma } from './tempo';
import type { Evento, Giornata, SigarettaNonConteggiata } from './tipi';

/** Oltre la tolleranza la pausa sigaretta diventa permesso a blocchi di questa durata (minuti). */
export const BLOCCO_PERMESSO_SIGARETTA = BLOCCO_PERMESSO;

/** Negli ultimi secondi prima dello scadere la schermata lampeggia di rosso. */
export const SECONDI_AVVISO = 30;

/** accesa → ultimi (lampeggio) → scaduta (oltre la tolleranza: rientrando diventa permesso). */
export type FaseSigaretta = 'accesa' | 'ultimi' | 'scaduta';

/** Permesso conteggiato per una pausa sigaretta di `durata` minuti: blocchi da 30, almeno uno. */
export function permessoSigaretta(durata: number): number {
  return Math.max(BLOCCO_PERMESSO, permessoABlocchi(durata));
}

export type EsitoRientroSigaretta = 'annulla' | 'permesso';

/** Entro la tolleranza (confronto al secondo) la pausa si cancella, oltre diventa permesso. */
export function esitoRientroSigaretta(trascorsiMs: number, tolleranzaMinuti: number): EsitoRientroSigaretta {
  return trascorsiMs <= tolleranzaMinuti * 60_000 ? 'annulla' : 'permesso';
}

export interface Countdown {
  /** Millisecondi alla fine della tolleranza (0 se scaduta). */
  residuoMs: number;
  /** Millisecondi oltre la tolleranza (0 se non scaduta). */
  oltreMs: number;
  /** Quanta sigaretta è consumata, da 0 a 1. */
  consumata: number;
  /** True se rientrando adesso la pausa diventerebbe permesso. */
  scaduta: boolean;
  /** Fase della schermata; con tolleranza 0 è sempre 'scaduta' (sigaretta già consumata). */
  fase: FaseSigaretta;
}

export function countdown(trascorsiMs: number, tolleranzaMinuti: number): Countdown {
  const totale = tolleranzaMinuti * 60_000;
  const t = Math.max(0, trascorsiMs);
  const residuoMs = Math.max(0, totale - t);
  const scaduta = esitoRientroSigaretta(t, tolleranzaMinuti) === 'permesso';
  return {
    residuoMs,
    oltreMs: Math.max(0, t - totale),
    consumata: totale > 0 ? Math.min(1, t / totale) : 1,
    scaduta,
    fase: scaduta || totale === 0 ? 'scaduta' : residuoMs <= SECONDI_AVVISO * 1000 ? 'ultimi' : 'accesa',
  };
}

const dueCifre = (n: number) => String(n).padStart(2, '0');
const mmss = (secondi: number) => `${dueCifre(Math.floor(secondi / 60))}:${dueCifre(secondi % 60)}`;

/** "10:42" mentre scorre (per eccesso: parte da 11:00), "+02:30" oltre la tolleranza. */
export function testoTimer(c: Countdown): string {
  return c.scaduta ? `+${mmss(Math.floor(c.oltreMs / 1000))}` : mmss(Math.ceil(c.residuoMs / 1000));
}

/**
 * La sequenza del posacenere parte solo se la pausa scade con la schermata aperta:
 * aprendola già scaduta (`precedente` null) si vede subito lo stato finale.
 */
export function spegnimentoDaAnimare(precedente: FaseSigaretta | null, attuale: FaseSigaretta): boolean {
  return attuale === 'scaduta' && precedente !== null && precedente !== 'scaduta';
}

/**
 * Istante (epoch ms) della timbratura delle `minutiEvento` di oggi, ricavato dall'ora attuale:
 * serve quando manca l'istante preciso salvato all'avvio della pausa.
 */
export function istanteDaMinuti(minutiEvento: number, ora: Date): number {
  const { minuti } = adessoRoma(ora);
  return ora.getTime() - ((minuti - minutiEvento) * 60 + ora.getSeconds()) * 1000 - ora.getMilliseconds();
}

/** Durata in minuti di una pausa sigaretta non conteggiata: arrotondata, almeno 1. */
export function durataSigaretta(trascorsiMs: number): number {
  return Math.max(1, Math.round(trascorsiMs / 60_000));
}

/**
 * Rientro entro la tolleranza: l'uscita sparisce dalle timbrature (la pausa non conta)
 * e la sigaretta resta tra quelle non conteggiate, per il riepilogo del giorno.
 */
export function annullaSigarettaNonConteggiata(giornata: Giornata, uscita: Evento, trascorsiMs: number): void {
  giornata.eventi = giornata.eventi.filter((e) => e.id !== uscita.id);
  giornata.sigaretteNonConteggiate = [
    ...(giornata.sigaretteNonConteggiate ?? []),
    { minuti: uscita.minuti, durata: durataSigaretta(trascorsiMs) },
  ];
}

/**
 * Sigaretta non conteggiata inserita o corretta a mano: si mostra tra le timbrature ma, salvata
 * fuori dagli eventi, non entra mai nel calcolo, qualunque sia la durata. Resta in ordine di orario.
 */
export function aggiungiSigarettaNonConteggiata(giornata: Giornata, minuti: number, durata: number): void {
  salvaSigarette(giornata, [...(giornata.sigaretteNonConteggiate ?? []), { minuti, durata: Math.max(1, durata) }]);
}

/** Cambia orario e durata della sigaretta in posizione `indice`; un indice inesistente non fa niente. */
export function modificaSigarettaNonConteggiata(giornata: Giornata, indice: number, minuti: number, durata: number): void {
  const sigarette = giornata.sigaretteNonConteggiate ?? [];
  if (!sigarette[indice]) return;
  salvaSigarette(giornata, sigarette.map((s, i) => (i === indice ? { minuti, durata: Math.max(1, durata) } : s)));
}

/** Toglie la sigaretta in posizione `indice`; senza più sigarette il campo sparisce. */
export function eliminaSigarettaNonConteggiata(giornata: Giornata, indice: number): void {
  const sigarette = giornata.sigaretteNonConteggiate ?? [];
  if (!sigarette[indice]) return;
  salvaSigarette(giornata, sigarette.filter((_, i) => i !== indice));
}

function salvaSigarette(giornata: Giornata, sigarette: SigarettaNonConteggiata[]): void {
  if (sigarette.length === 0) delete giornata.sigaretteNonConteggiate;
  else giornata.sigaretteNonConteggiate = [...sigarette].sort((a, b) => a.minuti - b.minuti);
}

/** L'uscita della pausa sigaretta in corso (giornata in permesso aperto da una sigaretta), o null. */
export function sigarettaInCorso(giornata: Giornata): Evento | null {
  const a = analizzaGiornata(giornata);
  if (a.stato !== 'IN_PERMESSO') return null;
  const uscita = a.eventiValidi[a.eventiValidi.length - 1];
  return uscita?.tipo === 'USCITA_PERMESSO' && uscita.sigaretta === true ? uscita : null;
}

/**
 * Pausa sigaretta da ripresentare da sola (app riaperta, nuovo render): solo se la giornata
 * è coerente. Con timbrature incoerenti l'utente sta correggendo e la schermata non deve bloccarlo.
 */
export function sigarettaDaRiprendere(giornata: Giornata): Evento | null {
  return analizzaGiornata(giornata).idScartati.size === 0 ? sigarettaInCorso(giornata) : null;
}
