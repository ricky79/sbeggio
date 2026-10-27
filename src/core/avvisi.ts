// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata } from './calcolo';
import { sigarettaInCorso } from './sigaretta';
import { analizzaGiornata } from './statoGiornata';
import { formattaDurata, formattaOra, MINUTI_GIORNO } from './tempo';
import type { Giornata, Impostazioni } from './tipi';

/** Avvisi della giornata: al massimo uno per tipo, ognuno con un id numerico fisso (serve ad Android). */
export type TipoAvviso = 'uscita' | 'pausa' | 'sigaretta';

export const ID_AVVISO: Record<TipoAvviso, number> = { uscita: 1, pausa: 2, sigaretta: 3 };

/**
 * Evento sul `document` per riprogrammare gli avvisi quando cambia qualcosa che non sta nelle
 * impostazioni salvate, come l'interruttore dei suoni (preferenza del dispositivo).
 */
export const EVENTO_RICALCOLA_AVVISI = 'sbeggio:ricalcola-avvisi';

/**
 * Stato dei permessi di notifica. Solo nella PWA: 'da-installare' su iPhone, dove le notifiche
 * arrivano soltanto con l'app aggiunta alla schermata Home; 'da-attivare' con il permesso concesso
 * ma senza un'iscrizione push valida (iscrizione fallita, persa o fatta con una chiave vecchia).
 */
export type StatoPermessi = 'concessi' | 'negati' | 'da-chiedere' | 'da-attivare' | 'da-installare' | 'non-disponibili';

export interface Avviso {
  tipo: TipoAvviso;
  /** Minuti dalla mezzanotte di oggi (Europe/Rome) in cui l'avviso deve suonare. */
  minuti: number;
  /** Istante esatto (epoch ms), quando è noto al secondo: prevale su `minuti`. */
  istante?: number;
  titolo: string;
  testo: string;
}

export interface OpzioniAvvisi {
  /** Ora attuale (epoch ms): serve per gli avvisi al secondo. */
  ora?: number;
  /** Istante preciso di inizio della pausa sigaretta aperta dall'evento indicato, se salvato. */
  inizioSigaretta?: (eventoId: string) => number | null;
}

/**
 * Avvisi da programmare per la giornata di oggi, dato lo stato delle timbrature. Funzione pura:
 * chi la chiama cancella i vecchi avvisi e programma esattamente questi.
 *
 * - Al lavoro: avviso all'uscita prevista (che non cambia finché si lavora: se la pausa non è
 *   ancora fatta, la include già). In pausa o in permesso l'uscita prevista non è affidabile,
 *   quindi si riprogramma al rientro.
 * - In pausa pranzo: avviso dopo `avvisi.pranzoMinuti` dall'inizio della pausa.
 * - In pausa sigaretta: avviso `avvisi.sigarettaAnticipo` minuti prima della fine della tolleranza
 *   (0 = alla fine). Se l'anticipo non è minore della tolleranza non c'è nulla da avvisare.
 *   Con l'istante preciso di inizio (salvato dalla schermata della sigaretta) l'avviso è al
 *   secondo; senza, parte dal minuto della timbratura e arriva fino a 59 secondi prima.
 *
 * Niente avvisi per giornate di altri giorni, da correggere, chiuse o non iniziate, né per
 * orari già passati.
 */
export function pianificaAvvisi(
  giornata: Giornata,
  imp: Impostazioni,
  adesso: { data: string; minuti: number },
  opz: OpzioniAvvisi = {},
): Avviso[] {
  if (giornata.data !== adesso.data) return [];
  const r = calcolaGiornata(giornata, imp, adesso.minuti);
  if (r.daCorreggere) return [];

  const { eventiValidi } = analizzaGiornata(giornata);
  const ultimo = eventiValidi[eventiValidi.length - 1];
  const avvisi: Avviso[] = [];
  const aggiungi = (a: Avviso) => {
    if (a.minuti > adesso.minuti && a.minuti < MINUTI_GIORNO) avvisi.push(a);
  };

  if (r.stato === 'AL_LAVORO' && imp.avvisi.uscita && r.uscitaPrevista !== null) {
    aggiungi({
      tipo: 'uscita',
      minuti: r.uscitaPrevista,
      titolo: 'Puoi andare via',
      testo: `Le ore sono completate: uscita prevista alle ${formattaOra(r.uscitaPrevista)}.`,
    });
  } else if (r.stato === 'IN_PAUSA' && imp.avvisi.pranzo && ultimo?.tipo === 'INIZIO_PAUSA') {
    aggiungi({
      tipo: 'pausa',
      minuti: ultimo.minuti + imp.avvisi.pranzoMinuti,
      titolo: 'Fine pausa pranzo',
      testo: `Sono passati ${formattaDurata(imp.avvisi.pranzoMinuti)}: è ora di rientrare.`,
    });
  } else if (r.stato === 'IN_PERMESSO' && imp.avvisi.sigaretta) {
    const uscita = sigarettaInCorso(giornata);
    const anticipo = imp.avvisi.sigarettaAnticipo;
    const dopo = imp.tolleranzaSigaretta - anticipo; // minuti dall'inizio della pausa
    if (uscita && dopo > 0) {
      const avviso: Avviso = {
        tipo: 'sigaretta',
        minuti: uscita.minuti + dopo,
        titolo: anticipo > 0 ? 'Pausa sigaretta quasi finita' : 'Pausa sigaretta finita',
        testo:
          anticipo > 0
            ? `Mancano ${formattaDurata(anticipo)}: oltre la tolleranza la pausa diventa permesso.`
            : 'Rientra ora: oltre la tolleranza la pausa diventa permesso.',
      };
      const inizio = opz.inizioSigaretta?.(uscita.id) ?? null;
      if (inizio !== null && opz.ora !== undefined) {
        const istante = inizio + dopo * 60_000;
        if (istante > opz.ora) avvisi.push({ ...avviso, istante });
      } else {
        aggiungi(avviso);
      }
    }
  }
  return avvisi;
}
