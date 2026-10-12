import { calcolaGiornata } from './calcolo';
import { haContenuto } from './giornata';
import { straordinarioABlocchi } from './permessi';
import type { Giornata, Impostazioni, RisultatoGiornata } from './tipi';

/** Ripartizione di una giornata in ore ordinarie, straordinario e permesso (minuti). */
export interface OreGiorno {
  /** Lavoro ordinario: le ore lavorate fino alle dovute, al netto del permesso. */
  lavoro: number;
  /** Straordinario conteggiato: solo blocchi interi da 30 minuti (20 min extra non contano). */
  straordinario: number;
  /** Permesso usato (a blocchi da 30 minuti). */
  permesso: number;
}

/**
 * Ore di lavoro, straordinario e permesso di una giornata.
 * Lavoro + permesso arrivano al massimo alle ore dovute; il lavoro oltre le dovute
 * è straordinario, conteggiato a blocchi da 30 minuti per difetto.
 */
export function oreGiorno(r: RisultatoGiornata): OreGiorno {
  const lavoro = Math.max(0, Math.min(r.lavorati, r.dovuti - r.permesso));
  return { lavoro, straordinario: straordinarioABlocchi(r.saldo), permesso: r.permesso };
}

export interface GiornoRiepilogo {
  data: string;
  /** Giornata lavorata da casa. */
  smart: boolean;
  /** Giornata di ferie. */
  ferie: boolean;
  /** Orario di uscita reale (ultima uscita) e quello a cui si sarebbe dovuti uscire, se noti. */
  uscita: number | null;
  uscitaPrevista: number | null;
  risultato: RisultatoGiornata;
  ore: OreGiorno;
}

export interface RiepilogoMese {
  mese: string;
  giorni: GiornoRiepilogo[];
  /** Somma del lavoro ordinario dei giorni registrati. */
  lavoro: number;
  /** Somma dello straordinario conteggiato (blocchi da 30 minuti). */
  straordinario: number;
  permesso: number;
  /** Saldo esatto del mese (coperte − dovute), senza arrotondamenti. */
  saldo: number;
  giorniDaCorreggere: number;
  /** Giornate del mese lavorate da casa (smart working). */
  giorniSmart: number;
  /** Giornate di ferie del mese e ore di ferie (minuti). */
  giorniFerie: number;
  ferie: number;
}

/**
 * Riepilogo di un mese ('YYYY-MM'). Solo i giorni registrati contano.
 * `oggi` serve a calcolare la giornata in corso con l'orario attuale.
 */
export function riepilogoMese(
  giornate: Record<string, Giornata>,
  imp: Impostazioni,
  mese: string,
  oggi: { data: string; minuti: number },
): RiepilogoMese {
  const giorni = Object.values(giornate)
    .filter((g) => g.data.startsWith(mese + '-') && haContenuto(g))
    .sort((a, b) => b.data.localeCompare(a.data))
    .map((g) => ({
      data: g.data,
      smart: g.luogo === 'smart' && g.ferie !== true,
      ferie: g.ferie === true,
      uscita: uscitaReale(g),
      risultato: calcolaGiornata(g, imp, g.data === oggi.data ? oggi.minuti : null),
    }))
    .map((x) => ({
      ...x,
      ore: oreGiorno(x.risultato),
      // Giornata in corso: quella calcolata adesso; chiusa: quella salvata alla chiusura.
      uscitaPrevista: x.risultato.stato === 'CHIUSA' ? (giornate[x.data]!.uscitaPrevista ?? null) : x.risultato.uscitaPrevista,
    }));

  let lavoro = 0;
  let straordinario = 0;
  let permesso = 0;
  let saldo = 0;
  let giorniDaCorreggere = 0;
  let giorniSmart = 0;
  let giorniFerie = 0;
  let ferie = 0;
  for (const { data, smart, risultato, ore } of giorni) {
    lavoro += ore.lavoro;
    straordinario += ore.straordinario;
    permesso += ore.permesso;
    // La giornata in corso non è ancora chiusa: il suo saldo non entra nel mese.
    if (data !== oggi.data || risultato.stato === 'CHIUSA') saldo += risultato.saldo;
    if (risultato.daCorreggere) giorniDaCorreggere++;
    if (smart) giorniSmart++;
    if (risultato.ferie > 0) {
      giorniFerie++;
      ferie += risultato.ferie;
    }
  }
  return { mese, giorni, lavoro, straordinario, permesso, saldo, giorniDaCorreggere, giorniSmart, giorniFerie, ferie };
}

/** Orario dell'ultima uscita (normale o anticipata) della giornata, se c'è. */
export function uscitaReale(g: Giornata): number | null {
  const uscite = g.eventi.filter((e) => e.tipo === 'USCITA' || e.tipo === 'USCITA_ANTICIPATA');
  return uscite.length > 0 ? Math.max(...uscite.map((e) => e.minuti)) : null;
}

export { haContenuto, haTimbrature } from './giornata';
