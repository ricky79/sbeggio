// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata } from './calcolo';
import { haContenuto } from './giornata';
import { statoLeggibile } from './testi';
import { formattaOra, giornoSettimana, NOMI_GIORNI } from './tempo';
import { ETICHETTE_EVENTO, type Giornata, type Impostazioni, type TipoEvento } from './tipi';

/** Esportazioni del sito web.sbeggio.app: un mese a scelta o tutto, in CSV (csv.ts) o JSON leggibile. */
export const TUTTO = 'tutto';

export interface GiornataJson {
  data: string;
  giorno: string;
  dovutiMinuti: number;
  lavoratiMinuti: number;
  permessoMinuti: number;
  saldoMinuti: number;
  stato: string;
  permessoInizioMinuti: number;
  permessoUscitaMinuti: number;
  luogo: 'sede' | 'smart';
  ferie: boolean;
  eventi: { ora: string; tipo: TipoEvento; etichetta: string }[];
  sigaretteNonConteggiate: { ora: string; durataMinuti: number }[];
}

export interface EsportazioneJson {
  app: 'Sbeggio';
  versioneApp: string;
  /** Data e ora (Europe/Rome) in cui il file è stato generato: 'YYYY-MM-DDTHH:MM'. */
  generato: string;
  /** 'YYYY-MM' oppure 'tutto'. */
  periodo: string;
  giornate: GiornataJson[];
}

/** Mesi ('YYYY-MM') con almeno una giornata con contenuto, dal più recente. */
export function mesiPresenti(giornate: Record<string, Giornata>): string[] {
  const mesi = new Set<string>();
  for (const g of Object.values(giornate)) if (haContenuto(g)) mesi.add(g.data.slice(0, 7));
  return [...mesi].sort().reverse();
}

export function giornateDelMese(giornate: Record<string, Giornata>, mese: string): Record<string, Giornata> {
  return Object.fromEntries(Object.entries(giornate).filter(([, g]) => g.data.startsWith(`${mese}-`)));
}

/**
 * Il mese proposto dal selettore: il corrente se ha giornate, altrimenti il più recente non futuro
 * (le ferie si possono inserire in anticipo), altrimenti il futuro più vicino.
 * `mesi` è ordinato dal più recente, come lo restituisce mesiPresenti.
 */
export function meseIniziale(mesi: readonly string[], oggi: string): string | null {
  const corrente = oggi.slice(0, 7);
  if (mesi.includes(corrente)) return corrente;
  return mesi.find((m) => m < corrente) ?? mesi[mesi.length - 1] ?? null;
}

/** JSON con le stesse informazioni del CSV, tipizzate. Non è un backup: non si reimporta nell'app. */
export function esportaJson(
  giornate: Record<string, Giornata>,
  imp: Impostazioni,
  oggi: { data: string; minuti: number },
  periodo: string,
  versioneApp: string,
): string {
  const ordinate = Object.values(giornate)
    .filter(haContenuto)
    .sort((a, b) => a.data.localeCompare(b.data));
  const esportazione: EsportazioneJson = {
    app: 'Sbeggio',
    versioneApp,
    generato: `${oggi.data}T${formattaOra(oggi.minuti)}`,
    periodo,
    giornate: ordinate.map((g): GiornataJson => {
      const r = calcolaGiornata(g, imp, g.data === oggi.data ? oggi.minuti : null);
      return {
        data: g.data,
        giorno: NOMI_GIORNI[giornoSettimana(g.data)]!,
        dovutiMinuti: r.dovuti,
        lavoratiMinuti: r.lavorati,
        permessoMinuti: r.permesso,
        saldoMinuti: r.saldo,
        stato: statoLeggibile(r),
        permessoInizioMinuti: g.permessoInizioMinuti,
        permessoUscitaMinuti: g.permessoUscitaMinuti,
        luogo: g.luogo === 'smart' ? 'smart' : 'sede',
        ferie: g.ferie === true,
        eventi: [...g.eventi]
          .sort((a, b) => a.minuti - b.minuti)
          .map((e) => ({ ora: formattaOra(e.minuti), tipo: e.tipo, etichetta: ETICHETTE_EVENTO[e.tipo] })),
        sigaretteNonConteggiate: (g.sigaretteNonConteggiate ?? []).map((s) => ({ ora: formattaOra(s.minuti), durataMinuti: s.durata })),
      };
    }),
  };
  return JSON.stringify(esportazione, null, 2);
}

export function nomeFile(periodo: string, oggi: string, estensione: 'csv' | 'json'): string {
  return periodo === TUTTO ? `sbeggio-tutto-${oggi}.${estensione}` : `sbeggio-${periodo}.${estensione}`;
}
