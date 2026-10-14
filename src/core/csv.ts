// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata } from './calcolo';
import { haContenuto } from './riepilogo';
import { statoLeggibile } from './testi';
import { dataValida, formattaOra, NOMI_GIORNI, giornoSettimana, oreDecimali, parseOra } from './tempo';
import { ETICHETTE_EVENTO, TIPI_EVENTO, type Evento, type Giornata, type Impostazioni, type TipoEvento } from './tipi';
import { nuovoId } from './id';

export const SEPARATORE = ';';

const INTESTAZIONE = [
  'Data',
  'Giorno',
  'Ore dovute',
  'Ore lavorate',
  'Ore permesso',
  'Saldo',
  'Stato',
  'Permesso inizio giornata (min)',
  'Permesso in uscita (min)',
  'Luogo',
  'Ferie',
  'Uscita prevista',
  'Eventi',
];

function quota(campo: string): string {
  return /[";\r\n]/.test(campo) ? `"${campo.replace(/"/g, '""')}"` : campo;
}

/** "08:30 Entrata, 10:05 Uscita in permesso (sigaretta), 14:30 Rientro da permesso (pausa 60)" */
export function eventiInTesto(eventi: readonly Evento[]): string {
  return [...eventi]
    .sort((a, b) => a.minuti - b.minuti)
    .map((e) => {
      const base = `${formattaOra(e.minuti)} ${ETICHETTE_EVENTO[e.tipo]}`;
      if (e.pausaConfermata !== undefined) return `${base} (pausa ${e.pausaConfermata})`;
      return e.sigaretta ? `${base} (sigaretta)` : base;
    })
    .join(', ');
}

/** CSV con separatore `;`, decimali con virgola e BOM UTF-8 per Excel. */
export function esportaCsv(
  giornate: Record<string, Giornata>,
  imp: Impostazioni,
  oggi: { data: string; minuti: number },
): string {
  const righe = [INTESTAZIONE.join(SEPARATORE)];
  const ordinate = Object.values(giornate)
    .filter(haContenuto)
    .sort((a, b) => a.data.localeCompare(b.data));
  for (const g of ordinate) {
    const r = calcolaGiornata(g, imp, g.data === oggi.data ? oggi.minuti : null);
    righe.push(
      [
        g.data,
        NOMI_GIORNI[giornoSettimana(g.data)]!,
        oreDecimali(r.dovuti),
        oreDecimali(r.lavorati),
        oreDecimali(r.permesso),
        oreDecimali(r.saldo),
        statoLeggibile(r),
        String(g.permessoInizioMinuti),
        String(g.permessoUscitaMinuti),
        g.luogo === 'smart' ? 'Smart' : 'Sede',
        g.ferie ? 'Sì' : '',
        g.uscitaPrevista !== undefined ? formattaOra(g.uscitaPrevista) : '',
        eventiInTesto(g.eventi),
      ]
        .map(quota)
        .join(SEPARATORE),
    );
  }
  return '\uFEFF' + righe.join('\r\n') + '\r\n';
}

/** Parser CSV minimale con supporto ai campi tra virgolette. */
export function parseCsv(testo: string, sep = SEPARATORE): string[][] {
  const righe: string[][] = [];
  let riga: string[] = [];
  let campo = '';
  let virgolette = false;
  const t = testo.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (virgolette) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else virgolette = false;
      } else campo += c;
    } else if (c === '"') virgolette = true;
    else if (c === sep) {
      riga.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || riga.length > 0) {
    riga.push(campo);
    righe.push(riga);
  }
  return righe.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Etichette dei CSV esportati dalle versioni precedenti, ancora importabili. */
const ETICHETTE_PRECEDENTI: [string, TipoEvento][] = [
  ['inizio pausa', 'INIZIO_PAUSA'],
  ['fine pausa', 'FINE_PAUSA'],
];

const TIPO_DA_ETICHETTA = new Map<string, TipoEvento>([
  ...TIPI_EVENTO.flatMap((t): [string, TipoEvento][] => [
    [ETICHETTE_EVENTO[t].toLowerCase(), t],
    [t.toLowerCase(), t],
  ]),
  ...ETICHETTE_PRECEDENTI,
]);

export class ErroreImportazione extends Error {}

/** Ricostruisce le giornate da un CSV esportato da questa app. */
export function importaCsv(testo: string): Record<string, Giornata> {
  const righe = parseCsv(testo);
  if (righe.length === 0) throw new ErroreImportazione('Il file è vuoto.');
  const intest = righe[0]!.map((c) => c.trim().toLowerCase());
  const iData = intest.indexOf('data');
  const iEventi = intest.indexOf('eventi');
  const iPermesso = intest.findIndex((c) => c.startsWith('permesso inizio giornata'));
  const iPermessoUscita = intest.findIndex((c) => c.startsWith('permesso in uscita'));
  const iLuogo = intest.indexOf('luogo');
  const iFerie = intest.indexOf('ferie');
  if (iData < 0 || iEventi < 0) {
    throw new ErroreImportazione('Intestazione non riconosciuta: servono almeno le colonne "Data" ed "Eventi".');
  }
  const giornate: Record<string, Giornata> = {};
  righe.slice(1).forEach((r, n) => {
    const data = (r[iData] ?? '').trim();
    if (!dataValida(data)) throw new ErroreImportazione(`Riga ${n + 2}: data "${data}" non valida.`);
    const permesso = iPermesso >= 0 ? Number((r[iPermesso] ?? '0').trim() || '0') : 0;
    if (!Number.isFinite(permesso) || permesso < 0) {
      throw new ErroreImportazione(`Riga ${n + 2}: permesso a inizio giornata non valido.`);
    }
    const permessoUscita = iPermessoUscita >= 0 ? Number((r[iPermessoUscita] ?? '0').trim() || '0') : 0;
    if (!Number.isFinite(permessoUscita) || permessoUscita < 0) {
      throw new ErroreImportazione(`Riga ${n + 2}: permesso in uscita non valido.`);
    }
    const eventi: Evento[] = [];
    for (const pezzo of (r[iEventi] ?? '').split(',')) {
      const p = pezzo.trim();
      if (!p) continue;
      const m = /^(\d{1,2}[:.]\d{2})\s+(.+?)(?:\s*\((?:pausa\s+(\d+)|(sigaretta))\))?$/i.exec(p);
      const minuti = m ? parseOra(m[1]!) : null;
      const tipo = m ? TIPO_DA_ETICHETTA.get(m[2]!.trim().toLowerCase()) : undefined;
      if (!m || minuti === null || !tipo) {
        throw new ErroreImportazione(`Riga ${n + 2}: evento "${p}" non riconosciuto.`);
      }
      const ev: Evento = { id: nuovoId(), tipo, minuti };
      if (m[3] !== undefined && tipo === 'RIENTRO_PERMESSO') ev.pausaConfermata = Number(m[3]);
      if (m[4] !== undefined && tipo === 'USCITA_PERMESSO') ev.sigaretta = true;
      eventi.push(ev);
    }
    const g: Giornata = { data, permessoInizioMinuti: permesso, permessoUscitaMinuti: permessoUscita, eventi };
    const luogo = iLuogo >= 0 ? (r[iLuogo] ?? '').trim().toLowerCase() : '';
    if (luogo === 'smart' || luogo === 'sede') g.luogo = luogo;
    const ferie = iFerie >= 0 ? (r[iFerie] ?? '').trim().toLowerCase() : '';
    if (ferie === 'sì' || ferie === 'si') g.ferie = true;
    giornate[data] = g;
  });
  return giornate;
}
