// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { haContenuto, riepilogoMese, type GiornoRiepilogo } from './riepilogo';
import { formattaOra, giornoSettimana, nomeMese, NOMI_GIORNI } from './tempo';
import type { Evento, Giornata, Impostazioni, StatoGiornata, TipoEvento } from './tipi';
import { cartella, type Cella, type Foglio } from './xlsx';

/**
 * Esportazione in Excel: un foglio per mese, una riga per giorno con timbrature, uscita prevista e
 * ore, e una riga di totale. Le ore vengono da riepilogoMese, quindi sono quelle dello Storico.
 */

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const INTESTAZIONE_EXCEL = [
  'Data',
  'Giorno',
  'Luogo',
  'Entrata',
  'Inizio pausa',
  'Fine pausa',
  'Uscita',
  'Permessi',
  'Uscita prevista',
  'Ore dovute',
  'Ore lavorate',
  'Straordinario',
  'Permesso',
  'Ferie',
  'Saldo',
  'Note',
] as const;

const LARGHEZZE = [11, 11, 8, 8, 12, 11, 8, 36, 15, 11, 12, 13, 10, 8, 8, 40];

const IN_CORSO: ReadonlySet<StatoGiornata> = new Set(['AL_LAVORO', 'IN_PAUSA', 'IN_PERMESSO']);

/** 75 → "1:15". */
export function oreMinuti(minuti: number): string {
  const v = Math.abs(Math.round(minuti));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/** Saldo con il segno: "+0:15", "−0:30", "0:00". È testo: Excel non mostra le durate negative. */
export function saldoOreMinuti(minuti: number): string {
  const r = Math.round(minuti);
  return r === 0 ? '0:00' : `${r > 0 ? '+' : '−'}${oreMinuti(r)}`;
}

const positivo = (n: number) => Number.isFinite(n) && n > 0;

/** "inizio giornata 1:00 · 10:00–10:30 · in uscita 1:00". Le pause sigaretta non compaiono. */
export function testoPermessi(g: Giornata): string {
  const voci: string[] = [];
  if (positivo(g.permessoInizioMinuti)) voci.push(`inizio giornata ${oreMinuti(g.permessoInizioMinuti)}`);
  const ordinati = [...g.eventi].sort((a, b) => a.minuti - b.minuti);
  ordinati.forEach((e, i) => {
    if (e.tipo !== 'USCITA_PERMESSO' || e.sigaretta) return;
    // Il rientro è il primo evento di permesso che segue; un'altra uscita vuol dire che manca.
    const dopo = ordinati.slice(i + 1).find((x) => x.tipo === 'USCITA_PERMESSO' || x.tipo === 'RIENTRO_PERMESSO');
    voci.push(`${formattaOra(e.minuti)}–${dopo?.tipo === 'RIENTRO_PERMESSO' ? formattaOra(dopo.minuti) : ''}`);
  });
  if (positivo(g.permessoUscitaMinuti)) voci.push(`in uscita ${oreMinuti(g.permessoUscitaMinuti)}`);
  return voci.join(' · ');
}

function primo(eventi: readonly Evento[], tipo: TipoEvento): number | null {
  const m = eventi.filter((e) => e.tipo === tipo).map((e) => e.minuti);
  return m.length > 0 ? Math.min(...m) : null;
}

const testo = (s: string): Cella => (s ? { testo: s } : null);
const orario = (m: number | null): Cella => (m === null ? null : { orario: m });

function rigaGiorno(x: GiornoRiepilogo, g: Giornata, oggi: { data: string }): Cella[] {
  const r = x.risultato;
  const note = x.data === oggi.data && IN_CORSO.has(r.stato) ? 'In corso' : r.daCorreggere ? r.problemi.join(' · ') : '';
  return [
    { data: x.data },
    testo(NOMI_GIORNI[giornoSettimana(x.data)]!),
    testo(x.ferie ? 'Ferie' : x.smart ? 'Smart' : 'Sede'),
    orario(primo(g.eventi, 'ENTRATA')),
    orario(primo(g.eventi, 'INIZIO_PAUSA')),
    orario(primo(g.eventi, 'FINE_PAUSA')),
    orario(x.uscita),
    testo(testoPermessi(g)),
    orario(x.uscitaPrevista),
    { durata: r.dovuti },
    { durata: x.ore.lavoro },
    { durata: x.ore.straordinario },
    { durata: x.ore.permesso },
    { durata: r.ferie },
    testo(saldoOreMinuti(r.saldo)),
    testo(note),
  ];
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function foglioDelMese(
  giornate: Record<string, Giornata>,
  imp: Impostazioni,
  mese: string,
  oggi: { data: string; minuti: number },
): Foglio {
  const riepilogo = riepilogoMese(giornate, imp, mese, oggi);
  const giorni = [...riepilogo.giorni].reverse(); // riepilogoMese li dà dal più recente
  const totale: Cella[] = INTESTAZIONE_EXCEL.map(() => null);
  totale[0] = { testo: 'Totale' };
  totale[9] = { durata: giorni.reduce((s, x) => s + x.risultato.dovuti, 0) };
  totale[10] = { durata: riepilogo.lavoro };
  totale[11] = { durata: riepilogo.straordinario };
  totale[12] = { durata: riepilogo.permesso };
  totale[13] = { durata: riepilogo.ferie };
  totale[14] = { testo: saldoOreMinuti(riepilogo.saldo) };
  const righe: Cella[][] = [
    INTESTAZIONE_EXCEL.map((t) => ({ testo: t })),
    ...giorni.map((x) => rigaGiorno(x, giornate[x.data]!, oggi)),
    [],
    totale,
  ];
  return { nome: maiuscola(nomeMese(mese)), colonne: LARGHEZZE, righe, grassetto: [righe.length - 1] };
}

/** File .xlsx con un foglio per ogni mese che ha giornate, dal più vecchio. Serve almeno una giornata. */
export function esportaExcel(
  giornate: Record<string, Giornata>,
  imp: Impostazioni,
  oggi: { data: string; minuti: number },
): Uint8Array<ArrayBuffer> {
  const mesi = [...new Set(Object.values(giornate).filter(haContenuto).map((g) => g.data.slice(0, 7)))].sort();
  return cartella(mesi.map((mese) => foglioDelMese(giornate, imp, mese, oggi)));
}
