// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { zip } from './zip';

/**
 * Cartella di lavoro Excel (.xlsx) minima, scritta a mano: fogli di celle tipizzate, stili fissi,
 * larghezze delle colonne, intestazione in grassetto e bloccata. Un vero file Excel non dipende dalla
 * lingua di Excel come un CSV (separatore, decimali, codifica).
 */

export type Cella =
  | null
  | { testo: string }
  | { numero: number }
  /** 'YYYY-MM-DD'. */
  | { data: string }
  /** Minuti dalla mezzanotte, formato h:mm. */
  | { orario: number }
  /** Minuti, formato [h]:mm (anche oltre le 24 ore). */
  | { durata: number };

export interface Foglio {
  nome: string;
  /** Larghezze delle colonne, in caratteri. */
  colonne: number[];
  /** La prima riga è l'intestazione: in grassetto e bloccata. */
  righe: Cella[][];
  /** Altre righe in grassetto (indici in `righe`), per esempio il totale. */
  grassetto?: number[];
}

/** Indici degli stili in styles.xml; `grassetto` si somma a uno degli altri. */
export const STILE = { normale: 0, data: 1, orario: 2, durata: 3, grassetto: 4 } as const;

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';

const formatoXf = (numFmtId: number, fontId: number) =>
  `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="0" borderId="0" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}/>`;

const STILI =
  `${XML}<styleSheet xmlns="${NS}">` +
  '<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="h:mm"/><numFmt numFmtId="166" formatCode="[h]:mm"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  `<cellXfs count="8">${[0, 1].map((font) => [0, 164, 165, 166].map((fmt) => formatoXf(fmt, font)).join('')).join('')}</cellXfs>` +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

const RELS =
  `${XML}<Relationships xmlns="${NS_PKG}">` +
  `<Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/>` +
  '</Relationships>';

function escapa(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Giorni dal 30/12/1899, come conta Excel (sistema di date 1900). */
export function seriale(data: string): number {
  const [y, m, d] = data.split('-').map(Number);
  return (Date.UTC(y!, m! - 1, d!) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** 0 → "A", 25 → "Z", 26 → "AA". */
function nomeColonna(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nomi validi per Excel: niente : \ / ? * [ ], niente apostrofi ai bordi, al massimo 31 caratteri, unici. */
export function nomiFogli(nomi: readonly string[]): string[] {
  const usati = new Set<string>();
  return nomi.map((n) => {
    const base =
      n
        .replace(/[:\\/?*[\]]/g, '')
        .replace(/^'+|'+$/g, '')
        .trim()
        .slice(0, 31) || 'Foglio';
    let nome = base;
    for (let k = 2; usati.has(nome.toLowerCase()); k++) {
      const suffisso = ` (${k})`;
      nome = base.slice(0, 31 - suffisso.length) + suffisso;
    }
    usati.add(nome.toLowerCase());
    return nome;
  });
}

function xmlCella(c: Cella, ref: string, grassetto: boolean): string {
  if (c === null) return '';
  const s = (stile: number) => stile + (grassetto ? STILE.grassetto : 0);
  if ('testo' in c) {
    if (c.testo === '') return '';
    return `<c r="${ref}" s="${s(STILE.normale)}" t="inlineStr"><is><t xml:space="preserve">${escapa(c.testo)}</t></is></c>`;
  }
  let valore: number;
  let stile: number;
  if ('numero' in c) [valore, stile] = [c.numero, STILE.normale];
  else if ('data' in c) [valore, stile] = [seriale(c.data), STILE.data];
  else if ('orario' in c) [valore, stile] = [c.orario / 1440, STILE.orario];
  else [valore, stile] = [c.durata / 1440, STILE.durata];
  if (!Number.isFinite(valore)) return '';
  return `<c r="${ref}" s="${s(stile)}"><v>${valore}</v></c>`;
}

function xmlFoglio(f: Foglio): string {
  const grassetto = new Set([0, ...(f.grassetto ?? [])]);
  const colonne = f.colonne.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('');
  const righe = f.righe
    .map((riga, i) => `<row r="${i + 1}">${riga.map((c, j) => xmlCella(c, `${nomeColonna(j)}${i + 1}`, grassetto.has(i))).join('')}</row>`)
    .join('');
  return (
    `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}">` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (colonne ? `<cols>${colonne}</cols>` : '') +
    `<sheetData>${righe}</sheetData></worksheet>`
  );
}

export function cartella(fogli: readonly Foglio[]): Uint8Array<ArrayBuffer> {
  if (fogli.length === 0) throw new Error('Una cartella di lavoro ha almeno un foglio.');
  const nomi = nomiFogli(fogli.map((f) => f.nome));
  const numeri = fogli.map((_, i) => i + 1);
  const tipi =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    numeri.map((n) => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '</Types>';
  const workbook =
    `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>` +
    numeri.map((n) => `<sheet name="${escapa(nomi[n - 1]!)}" sheetId="${n}" r:id="rId${n}"/>`).join('') +
    '</sheets></workbook>';
  const relazioni =
    `${XML}<Relationships xmlns="${NS_PKG}">` +
    numeri.map((n) => `<Relationship Id="rId${n}" Type="${NS_R}/worksheet" Target="worksheets/sheet${n}.xml"/>`).join('') +
    `<Relationship Id="rId${fogli.length + 1}" Type="${NS_R}/styles" Target="styles.xml"/>` +
    '</Relationships>';
  const enc = new TextEncoder();
  const file: [string, string][] = [
    ['[Content_Types].xml', tipi],
    ['_rels/.rels', RELS],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', relazioni],
    ['xl/styles.xml', STILI],
    ...fogli.map((f, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, xmlFoglio(f)]),
  ];
  return zip(file.map(([nome, xml]) => ({ nome, dati: enc.encode(xml) })));
}
