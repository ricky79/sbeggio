// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { INIZIO_PAUSA_OBBLIGATORIA, pausaObbligatoria } from './pausaObbligatoria';
import { permessoABlocchi } from './permessi';
import { permessoSigaretta } from './sigaretta';
import { haTimbrature } from './giornata';
import { analizzaGiornata } from './statoGiornata';
import { giornoSettimana } from './tempo';
import type { Giornata, Impostazioni, PermessoABlocchi, PermessoSigaretta, Ripartizione, RisultatoGiornata } from './tipi';

type TipoIntervallo = 'lavoro' | 'pausa' | 'permesso';

interface Intervallo {
  tipo: TipoIntervallo;
  da: number;
  a: number;
  aperto: boolean;
  /** Per i permessi chiusi: evento di rientro. */
  rientroId?: string;
  pausaConfermata?: number;
  /** Per i permessi: aperto da una pausa sigaretta. */
  sigaretta?: boolean;
  /** Per i permessi chiusi: orario reale del rientro (prima del minimo di conteggio). */
  rientroReale?: number;
}

/** Minuti dovuti per la data indicata secondo le impostazioni. */
export function minutiDovuti(data: string, imp: Impostazioni): number {
  const v = imp.minutiDovuti.perGiorno[giornoSettimana(data)];
  return v ?? imp.minutiDovuti.predefinito;
}

function sovrapposizione(da: number, a: number, inizio: number, fine: number): number {
  return Math.max(0, Math.min(a, fine) - Math.max(da, inizio));
}

/**
 * Calcola i totali di una giornata. Funzione pura.
 *
 * @param adesso minuti correnti (Europe/Rome) se la giornata è oggi; null per
 *   giornate passate, nel qual caso un intervallo rimasto aperto non viene
 *   conteggiato e la giornata è segnalata da correggere.
 */
export function calcolaGiornata(
  giornata: Giornata,
  imp: Impostazioni,
  adesso: number | null,
): RisultatoGiornata {
  const analisi = analizzaGiornata(giornata);
  const problemi = [...analisi.problemi];
  const minimo = imp.orarioMinimoConteggio;
  const conta = (t: number) => Math.max(t, minimo);

  // 1. Intervalli dagli eventi validi, con orari "contati" (mai prima delle 08:30).
  const intervalli: Intervallo[] = [];
  let aperto: { tipo: TipoIntervallo; da: number; sigaretta?: boolean } | null = null;
  let anticipata = false;
  let uscitaNormale = false;
  let pausaRegistrata = false;
  /** Orario reale dell'uscita che chiude la giornata. */
  let uscitaReale: number | null = null;

  const chiudi = (a: number, extra: Partial<Intervallo> = {}) => {
    if (aperto) {
      intervalli.push({ tipo: aperto.tipo, da: aperto.da, a: Math.max(a, aperto.da), aperto: false, sigaretta: aperto.sigaretta, ...extra });
    }
    aperto = null;
  };

  for (const e of analisi.eventiValidi) {
    const t = conta(e.minuti);
    switch (e.tipo) {
      case 'ENTRATA':
        aperto = { tipo: 'lavoro', da: t };
        break;
      case 'INIZIO_PAUSA':
        pausaRegistrata = true;
        chiudi(t);
        aperto = { tipo: 'pausa', da: t };
        break;
      case 'FINE_PAUSA':
        chiudi(t);
        aperto = { tipo: 'lavoro', da: t };
        break;
      case 'USCITA_PERMESSO':
        chiudi(t);
        aperto = { tipo: 'permesso', da: t, sigaretta: e.sigaretta === true };
        break;
      case 'RIENTRO_PERMESSO':
        chiudi(t, { rientroId: e.id, rientroReale: e.minuti, pausaConfermata: e.pausaConfermata });
        aperto = { tipo: 'lavoro', da: t };
        break;
      case 'USCITA':
        chiudi(t);
        uscitaNormale = true;
        uscitaReale = e.minuti;
        break;
      case 'USCITA_ANTICIPATA':
        chiudi(t);
        anticipata = true;
        uscitaReale = e.minuti;
        break;
    }
  }

  const apertoFinale = aperto as { tipo: TipoIntervallo; da: number; sigaretta?: boolean } | null;
  if (apertoFinale) {
    if (adesso !== null) {
      intervalli.push({
        tipo: apertoFinale.tipo,
        da: apertoFinale.da,
        a: Math.max(conta(adesso), apertoFinale.da),
        aperto: true,
        sigaretta: apertoFinale.sigaretta,
      });
    } else {
      problemi.push('Manca la timbratura di uscita.');
    }
  }

  // 2. Lavoro e pause (pausa minima applicata solo alle pause concluse).
  let lavoroLordo = 0;
  let pausaRegistrataMin = 0;
  let penalitaPausa = 0;
  for (const i of intervalli) {
    const d = i.a - i.da;
    if (i.tipo === 'lavoro') lavoroLordo += d;
    if (i.tipo === 'pausa') {
      if (!i.aperto && d < imp.pausaMinima) {
        penalitaPausa += imp.pausaMinima - d;
        pausaRegistrataMin += imp.pausaMinima;
      } else {
        pausaRegistrataMin += d;
      }
    }
  }

  // 3. Permessi intermedi, con eventuale quota di pausa se coprono il pranzo. Ogni permesso
  //    concluso vale blocchi da 30 min: l'eccedenza sul tempo reale passa dalle lavorate al
  //    permesso (ore coperte invariate).
  const ripartizioni: Ripartizione[] = [];
  const sigarette: PermessoSigaretta[] = [];
  const permessiIntermedi: PermessoABlocchi[] = [];
  let permessoIntermedio = 0;
  let pausaScalata = 0;
  let residuoDaScalare = imp.pausaDaScalare;
  let eccedenza = 0;
  for (const i of intervalli) {
    if (i.tipo !== 'permesso') continue;
    const d = i.a - i.da;
    if (i.sigaretta) {
      // Mai pausa pranzo; conclusa vale almeno un blocco.
      if (i.aperto) {
        permessoIntermedio += d;
      } else {
        // Tutta prima dell'inizio conteggio: quel tempo non conta, quindi nemmeno il permesso.
        const primaDelConteggio = i.rientroReale !== undefined && i.rientroReale <= minimo;
        const permesso = primaDelConteggio ? 0 : permessoSigaretta(d);
        permessoIntermedio += permesso;
        eccedenza += permesso - d;
        sigarette.push({ eventoRientroId: i.rientroId, da: i.da, a: i.a, durata: d, permesso });
      }
      continue;
    }
    let pausa = 0;
    const overlap = pausaRegistrata ? 0 : sovrapposizione(i.da, i.a, imp.pranzo.inizio, imp.pranzo.fine);
    if (overlap > 0) {
      const proposta = Math.min(residuoDaScalare, overlap);
      const confermata = i.pausaConfermata !== undefined;
      pausa = Math.min(d, Math.max(0, confermata ? i.pausaConfermata! : proposta));
      residuoDaScalare = Math.max(0, residuoDaScalare - pausa);
      pausaScalata += pausa;
      ripartizioni.push({
        eventoRientroId: i.rientroId,
        da: i.da,
        a: i.a,
        proposta,
        pausa,
        permesso: d - pausa,
        confermata,
      });
    }
    const parte = d - pausa;
    if (i.aperto) {
      permessoIntermedio += parte;
    } else {
      const permesso = permessoABlocchi(parte);
      permessoIntermedio += permesso;
      eccedenza += permesso - parte;
      permessiIntermedi.push({ eventoRientroId: i.rientroId, da: i.da, a: i.a, durata: parte, permesso });
    }
  }

  // Permesso a inizio giornata, anch'esso a blocchi.
  const permessoInizioDichiarato =
    Number.isFinite(giornata.permessoInizioMinuti) && giornata.permessoInizioMinuti > 0
      ? giornata.permessoInizioMinuti
      : 0;
  let permessoInizio = permessoABlocchi(permessoInizioDichiarato);
  eccedenza += permessoInizio - permessoInizioDichiarato;

  // Pausa obbligatoria non fatta (né registrata né scalata da un permesso) e uscita dopo la fascia
  // pranzo: si scala la pausa minima, così saltarla non fa guadagnare tempo.
  const dovuti = minutiDovuti(giornata.data, imp);
  const obbligatoria = pausaObbligatoria(dovuti);
  const pausaAutomatica =
    obbligatoria &&
    giornata.data >= INIZIO_PAUSA_OBBLIGATORIA &&
    uscitaReale !== null &&
    uscitaReale > imp.pranzo.fine &&
    !pausaRegistrata &&
    pausaScalata === 0
      ? imp.pausaMinima
      : 0;

  // L'eccedenza si toglie solo dal lavoro che c'è: le coperte non superano mai il tempo trascorso.
  const lavoroNetto = Math.max(0, lavoroLordo - penalitaPausa - pausaAutomatica);
  const eccedenzaApplicata = Math.min(eccedenza, lavoroNetto);
  let nonAssorbita = eccedenza - eccedenzaApplicata;
  const riduci = (v: number) => {
    const t = Math.min(v, nonAssorbita);
    nonAssorbita -= t;
    return v - t;
  };
  permessoIntermedio = riduci(permessoIntermedio);
  permessoInizio = riduci(permessoInizio);
  let lavorati = lavoroNetto - eccedenzaApplicata;

  // 4. Totali. Uscita anticipata, o uscita normale con un permesso pianificato: il permesso in
  //    uscita è quello che manca davvero, a blocchi (l'eccedenza esce dalle lavorate rimaste,
  //    le coperte arrivano alle dovute).
  const pianificato =
    Number.isFinite(giornata.permessoUscitaMinuti) && giornata.permessoUscitaMinuti > 0
      ? giornata.permessoUscitaMinuti
      : 0;
  let permessoUscita = 0;
  if (anticipata || (uscitaNormale && pianificato > 0)) {
    const mancante = Math.max(0, dovuti - (lavorati + permessoInizio + permessoIntermedio));
    const eccedenzaUscita = Math.min(permessoABlocchi(mancante) - mancante, lavorati);
    permessoUscita = mancante + eccedenzaUscita;
    lavorati -= eccedenzaUscita;
  }
  // Ferie: coprono quello che manca alle ore dovute. Con delle timbrature la giornata non torna.
  const lavoroEPermessi = lavorati + permessoInizio + permessoIntermedio + permessoUscita;
  const ferie = giornata.ferie ? Math.max(0, dovuti - lavoroEPermessi) : 0;
  if (giornata.ferie && haTimbrature(giornata)) {
    problemi.push('Giornata di ferie con delle timbrature: togli le ferie o le timbrature.');
  }
  const coperti = lavoroEPermessi + ferie;
  const pausaFatta = pausaRegistrata || pausaScalata > 0;

  // 5. Uscita prevista (anticipata dal permesso in uscita pianificato).
  let uscitaPrevista: number | null = null;
  let uscitaPrevistaConPausa = false;
  if (adesso !== null && analisi.stato === 'AL_LAVORO') {
    const ora = conta(adesso);
    uscitaPrevista = ora + (dovuti - coperti - pianificato);
    // Pausa obbligatoria ancora da fare: a qualunque ora, se l'uscita cade dopo la fascia pranzo.
    if (obbligatoria && !pausaFatta && uscitaPrevista > imp.pranzo.fine) {
      uscitaPrevista += imp.pausaMinima;
      uscitaPrevistaConPausa = true;
    }
  } else if (adesso !== null && analisi.stato === 'IN_PAUSA') {
    const pausaInCorso = intervalli.find((i) => i.tipo === 'pausa' && i.aperto);
    const ora = conta(adesso);
    const rientro = pausaInCorso ? Math.max(ora, pausaInCorso.da + imp.pausaMinima) : ora;
    uscitaPrevista = rientro + (dovuti - coperti - pianificato);
  }
  const uscitaPrevistaConPermesso = uscitaPrevista !== null && pianificato > 0;

  return {
    stato: analisi.stato,
    daCorreggere: problemi.length > 0,
    problemi,
    dovuti,
    lavorati,
    pausa: pausaRegistrataMin + pausaScalata + pausaAutomatica,
    pausaAggiuntaMinima: penalitaPausa,
    pausaAutomatica,
    permessoInizio,
    permessoInizioDichiarato,
    permessoIntermedio,
    permessoUscita,
    permesso: permessoInizio + permessoIntermedio + permessoUscita,
    ferie,
    coperti,
    saldo: coperti - dovuti,
    uscitaPrevista,
    uscitaPrevistaConPausa,
    uscitaPrevistaConPermesso,
    permessoUscitaPianificato: pianificato,
    pausaFatta,
    ripartizioni,
    sigarette,
    permessiIntermedi,
  };
}

/**
 * Proposta di ripartizione per un rientro da permesso alle `minuti` indicati,
 * prima di registrarlo. Null se il permesso non tocca la fascia pranzo.
 */
export function propostaRientro(
  giornata: Giornata,
  imp: Impostazioni,
  minuti: number,
): Ripartizione | null {
  const simulata: Giornata = {
    ...giornata,
    eventi: [...giornata.eventi, { id: '__simulato__', tipo: 'RIENTRO_PERMESSO', minuti }],
  };
  const r = calcolaGiornata(simulata, imp, minuti);
  return r.ripartizioni.find((x) => x.eventoRientroId === '__simulato__') ?? null;
}

/**
 * Permesso che verrebbe conteggiato rientrando alle `minuti` dalla pausa sigaretta
 * in corso. Null se la giornata non è in una pausa sigaretta.
 */
export function anteprimaSigaretta(
  giornata: Giornata,
  imp: Impostazioni,
  minuti: number,
): PermessoSigaretta | null {
  const simulata: Giornata = {
    ...giornata,
    eventi: [...giornata.eventi, { id: '__simulato__', tipo: 'RIENTRO_PERMESSO', minuti }],
  };
  const r = calcolaGiornata(simulata, imp, minuti);
  return r.sigarette.find((x) => x.eventoRientroId === '__simulato__') ?? null;
}
