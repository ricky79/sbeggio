# Esportazione in Excel (.xlsx) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un file Excel (.xlsx) con timbrature, uscita prevista e totali, da scaricare dall'app (Impostazioni → Dati e backup) e dal sito web.sbeggio.app, leggibile in Excel di qualunque lingua.

**Architecture:** Tre moduli puri in `src/core/`: `zip.ts` (archivio zip "stored" + CRC32), `xlsx.ts` (cartella di lavoro generica con celle tipizzate) ed `excel.ts` (i fogli di Sbeggio, un foglio per mese, costruiti da `riepilogoMese`). L'interfaccia passa i byte a `scaricaFile`/`condividiFile`; su Android il plugin nativo `File` riceve il binario in base64.

**Tech Stack:** TypeScript 5.9, Vite, Vitest (ambiente Node), Capacitor 8 (Java per il plugin Android). Nessuna nuova dipendenza.

**Spec:** `docs/superpowers/specs/2026-10-14-esportazione-excel-design.md`

## Global Constraints

- Nessuna nuova dipendenza npm o Gradle (software libero GPL-3.0-or-later: il generatore è scritto a mano).
- Ogni file sorgente nuovo inizia con `// SPDX-License-Identifier: GPL-3.0-or-later` e `// Copyright (C) 2026 Riccardo Oliosi`.
- Codice, nomi e commenti in italiano, come il resto del progetto; testi per l'utente semplici, senza dettagli tecnici.
- Tipo MIME del file: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Formati Excel: data `dd/mm/yyyy`, orario `h:mm`, durata `[h]:mm`; il saldo è testo (`+0:15`, `−0:30` con il meno tipografico U+2212, `0:00`).
- Colonne nell'ordine: Data, Giorno, Luogo, Entrata, Inizio pausa, Fine pausa, Uscita, Permessi, Uscita prevista, Ore dovute, Ore lavorate, Straordinario, Permesso, Ferie, Saldo, Note.
- Le pause sigaretta non compaiono nella colonna Permessi (il loro tempo resta nelle ore di Permesso).
- Il CSV non cambia formato; il suo pulsante diventa "Esporta CSV" (app) e "CSV" (sito).
- Comandi: `npm test`, `npm run typecheck`, `npm run build` dalla radice del repository.
- Le righe dei file di testo vanno a capo con LF nel repository (git converte da sé in CRLF nella copia di lavoro).

## Review Focus

1. Testi con caratteri speciali (`&`, `<`, virgolette, caratteri di controllo) nei problemi di una giornata o nei nomi: il file deve restare un XML valido che Excel apre → test in Task 2.
2. Valori non finiti (dati vecchi o corrotti con `NaN` nei minuti): la cella resta vuota invece di rompere il file → test in Task 2.
3. Giornata in permesso non ancora rientrato (uscita in permesso senza rientro): la colonna Permessi mostra `15:00–` → test in Task 3.
4. Esportazione grande ("Tutto" con molti mesi) dall'app Android: la conversione in base64 non deve sforare lo stack con file da centinaia di KB → test in Task 4.
5. Giornata di ferie inserita per oggi: non è "In corso" (non ha timbrature), mentre una giornata al lavoro oggi lo è → test in Task 3.

---

### Task 1: Archivio zip (`src/core/zip.ts`)

**Files:**
- Create: `src/core/zip.ts`
- Create: `tests/leggiXlsx.ts` (lettore di zip e utilità XML solo per i test)
- Test: `tests/zip.test.ts`

**Interfaces:**
- Produces: `crc32(dati: Uint8Array): number`; `interface FileZip { nome: string; dati: Uint8Array }`; `zip(file: readonly FileZip[]): Uint8Array<ArrayBuffer>`.
- Produces (test): `leggiZip(dati: Uint8Array): Map<string, string>` in `tests/leggiXlsx.ts` (nome → contenuto decodificato UTF-8).

- [ ] **Step 1: Scrivi il lettore di zip per i test**

`tests/leggiXlsx.ts`:

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Letture minime per i test dell'esportazione Excel: un lettore di zip "stored" (senza compressione)
 * e qualche estrazione dall'XML di un foglio. Non sono un parser completo: bastano per i file che
 * genera src/core/xlsx.ts.
 */

/** Nome del file → contenuto come testo UTF-8. Controlla anche la central directory. */
export function leggiZip(dati: Uint8Array): Map<string, string> {
  const v = new DataView(dati.buffer, dati.byteOffset, dati.byteLength);
  const dec = new TextDecoder();
  const file = new Map<string, string>();
  let p = 0;
  while (v.getUint32(p, true) === 0x04034b50) {
    if (v.getUint16(p + 8, true) !== 0) throw new Error('compressione inattesa');
    const dimensione = v.getUint32(p + 18, true);
    const lunghezzaNome = v.getUint16(p + 26, true);
    const lunghezzaExtra = v.getUint16(p + 28, true);
    const nome = dec.decode(dati.subarray(p + 30, p + 30 + lunghezzaNome));
    const inizio = p + 30 + lunghezzaNome + lunghezzaExtra;
    file.set(nome, dec.decode(dati.subarray(inizio, inizio + dimensione)));
    p = inizio + dimensione;
  }
  const fine = dati.length - 22;
  if (v.getUint32(fine, true) !== 0x06054b50) throw new Error('end of central directory mancante');
  if (v.getUint16(fine + 10, true) !== file.size) throw new Error('numero di file non coerente');
  if (v.getUint32(fine + 16, true) !== p) throw new Error('offset della central directory errato');
  return file;
}
```

- [ ] **Step 2: Scrivi i test che falliscono**

`tests/zip.test.ts`:

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { crc32, zip } from '../src/core/zip';
import { leggiZip } from './leggiXlsx';

const testo = (s: string) => new TextEncoder().encode(s);

describe('crc32', () => {
  it('dà i valori di riferimento', () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(testo('123456789'))).toBe(0xcbf43926);
    expect(crc32(testo('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });
});

describe('zip', () => {
  it('contiene i file con nomi e contenuti', () => {
    const z = zip([
      { nome: 'a.txt', dati: testo('ciao') },
      { nome: 'cartella/b.xml', dati: testo('<x>Giovedì</x>') },
    ]);
    const file = leggiZip(z);
    expect([...file.keys()]).toEqual(['a.txt', 'cartella/b.xml']);
    expect(file.get('a.txt')).toBe('ciao');
    expect(file.get('cartella/b.xml')).toBe('<x>Giovedì</x>');
  });

  it('scrive il CRC di ogni file nell\'header locale', () => {
    const dati = testo('ciao');
    const z = zip([{ nome: 'a.txt', dati }]);
    expect(new DataView(z.buffer).getUint32(14, true)).toBe(crc32(dati));
  });

  it('funziona anche senza file', () => {
    expect(leggiZip(zip([])).size).toBe(0);
  });
});
```

- [ ] **Step 3: Esegui i test per vederli fallire**

Run: `npx vitest run tests/zip.test.ts`
Expected: FAIL, `Failed to resolve import "../src/core/zip"`.

- [ ] **Step 4: Implementa `src/core/zip.ts`**

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Archivio zip minimo per l'esportazione Excel (un .xlsx è uno zip di file XML). Solo file "stored",
 * cioè senza compressione: i file sono piccoli e Excel li apre lo stesso. Niente ZIP64 (sotto i 4 GB).
 */

const TABELLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(dati: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of dati) c = TABELLA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface FileZip {
  nome: string;
  dati: Uint8Array;
}

/** Data DOS fissa (1/1/2026, 00:00): lo stesso contenuto dà sempre lo stesso file. */
const DATA_DOS = ((2026 - 1980) << 9) | (1 << 5) | 1;
/** Bit 11: nomi dei file in UTF-8. */
const NOMI_UTF8 = 0x0800;

export function zip(file: readonly FileZip[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const parti: Uint8Array[] = [];
  const centrali: Uint8Array[] = [];
  let offset = 0;
  for (const f of file) {
    const nome = enc.encode(f.nome);
    const crc = crc32(f.dati);
    const locale = new Uint8Array(30 + nome.length);
    const l = new DataView(locale.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // versione necessaria
    l.setUint16(6, NOMI_UTF8, true);
    l.setUint16(8, 0, true); // stored
    l.setUint16(10, 0, true); // ora
    l.setUint16(12, DATA_DOS, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, f.dati.length, true);
    l.setUint32(22, f.dati.length, true);
    l.setUint16(26, nome.length, true);
    l.setUint16(28, 0, true);
    locale.set(nome, 30);

    const centrale = new Uint8Array(46 + nome.length);
    const c = new DataView(centrale.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // creato con
    c.setUint16(6, 20, true); // versione necessaria
    c.setUint16(8, NOMI_UTF8, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, DATA_DOS, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.dati.length, true);
    c.setUint32(24, f.dati.length, true);
    c.setUint16(28, nome.length, true);
    // 30 extra, 32 commento, 34 disco, 36 attributi interni, 38 attributi esterni: zero.
    c.setUint32(42, offset, true);
    centrale.set(nome, 46);

    parti.push(locale, f.dati);
    centrali.push(centrale);
    offset += locale.length + f.dati.length;
  }
  const dimensioneCentrale = centrali.reduce((s, x) => s + x.length, 0);
  const fine = new Uint8Array(22);
  const e = new DataView(fine.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, file.length, true);
  e.setUint16(10, file.length, true);
  e.setUint32(12, dimensioneCentrale, true);
  e.setUint32(16, offset, true);
  return concatena([...parti, ...centrali, fine]);
}

function concatena(parti: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parti.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const x of parti) {
    out.set(x, p);
    p += x.length;
  }
  return out;
}
```

- [ ] **Step 5: Esegui i test**

Run: `npx vitest run tests/zip.test.ts`
Expected: PASS (5 test).

- [ ] **Step 6: Commit**

```bash
git add src/core/zip.ts tests/zip.test.ts tests/leggiXlsx.ts
git commit -m "Esportazione Excel: archivio zip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cartella di lavoro xlsx (`src/core/xlsx.ts`)

**Files:**
- Create: `src/core/xlsx.ts`
- Modify: `tests/leggiXlsx.ts` (aggiunge `celle`, `nomiDeiFogli`, `xmlBenFormato`)
- Test: `tests/xlsx.test.ts`

**Interfaces:**
- Consumes: `zip(file: readonly FileZip[]): Uint8Array<ArrayBuffer>` da `src/core/zip.ts`.
- Produces:
  ```ts
  export type Cella =
    | null
    | { testo: string }
    | { numero: number }
    | { data: string }    // 'YYYY-MM-DD'
    | { orario: number }  // minuti dalla mezzanotte
    | { durata: number }; // minuti
  export interface Foglio { nome: string; colonne: number[]; righe: Cella[][]; grassetto?: number[] }
  export const STILE: { normale: 0; data: 1; orario: 2; durata: 3; grassetto: 4 }; // grassetto si somma
  export function cartella(fogli: readonly Foglio[]): Uint8Array<ArrayBuffer>;
  export function nomiFogli(nomi: readonly string[]): string[];
  export function seriale(data: string): number;
  ```
- Produces (test): in `tests/leggiXlsx.ts`
  `celle(xml: string): Map<string, { stile: number; valore: string; testo: boolean }>`,
  `nomiDeiFogli(file: Map<string, string>): string[]`, `xmlBenFormato(xml: string): boolean`.

- [ ] **Step 1: Aggiungi le utilità di lettura dell'XML ai test**

In fondo a `tests/leggiXlsx.ts`:

```ts
const ENTITA: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const togliEscape = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (e) => ENTITA[e]!);

/** Celle di un foglio: riferimento ("D2") → stile, valore (numero come testo, o il testo) e se è testo. */
export function celle(xml: string): Map<string, { stile: number; valore: string; testo: boolean }> {
  const out = new Map<string, { stile: number; valore: string; testo: boolean }>();
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)" s="(\d+)"( t="inlineStr")?>(.*?)<\/c>/g)) {
    const testo = m[3] !== undefined;
    const valore = testo ? /<t[^>]*>(.*?)<\/t>/.exec(m[4]!)![1]! : /<v>(.*?)<\/v>/.exec(m[4]!)![1]!;
    out.set(m[1]!, { stile: Number(m[2]), valore: testo ? togliEscape(valore) : valore, testo });
  }
  return out;
}

/** Nomi dei fogli nell'ordine di xl/workbook.xml. */
export function nomiDeiFogli(file: Map<string, string>): string[] {
  return [...file.get('xl/workbook.xml')!.matchAll(/<sheet name="([^"]*)"/g)].map((m) => togliEscape(m[1]!));
}

/** Controllo semplice: dichiarazione iniziale, tag aperti e chiusi in ordine, niente & non escapati. */
export function xmlBenFormato(xml: string): boolean {
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')) return false;
  if (/&(?!(amp|lt|gt|quot|apos);)/.test(xml)) return false;
  const pila: string[] = [];
  for (const m of xml.replace(/^<\?xml[^>]*\?>/, '').matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
    if (m[1]) {
      if (pila.pop() !== m[2]) return false;
    } else if (!m[3]) pila.push(m[2]!);
  }
  return pila.length === 0;
}
```

- [ ] **Step 2: Scrivi i test che falliscono**

`tests/xlsx.test.ts`:

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { cartella, nomiFogli, seriale, STILE, type Foglio } from '../src/core/xlsx';
import { celle, leggiZip, nomiDeiFogli, xmlBenFormato } from './leggiXlsx';

const foglio = (modifiche: Partial<Foglio> = {}): Foglio => ({
  nome: 'Ottobre 2026',
  colonne: [12, 8],
  righe: [[{ testo: 'Data' }, { testo: 'Entrata' }], [{ data: '2026-10-14' }, { orario: 510 }]],
  ...modifiche,
});

describe('cartella', () => {
  it('contiene tutti i file di un .xlsx, ben formati', () => {
    const file = leggiZip(cartella([foglio(), foglio({ nome: 'Novembre 2026' })]));
    expect([...file.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    for (const [nome, xml] of file) expect(xmlBenFormato(xml), nome).toBe(true);
    expect(file.get('[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml');
    expect(file.get('xl/_rels/workbook.xml.rels')).toContain('Target="worksheets/sheet2.xml"');
    expect(nomiDeiFogli(file)).toEqual(['Ottobre 2026', 'Novembre 2026']);
  });

  it('scrive date, orari e durate come numeri con il loro stile', () => {
    const f = foglio({
      righe: [
        [{ testo: 'Data' }, { testo: 'Entrata' }, { testo: 'Ore' }, { testo: 'N' }],
        [{ data: '2026-10-14' }, { orario: 510 }, { durata: 1800 }, { numero: 3 }],
      ],
    });
    const c = celle(leggiZip(cartella([f])).get('xl/worksheets/sheet1.xml')!);
    expect(c.get('A2')).toEqual({ stile: STILE.data, valore: '46309', testo: false });
    expect(c.get('B2')).toEqual({ stile: STILE.orario, valore: String(510 / 1440), testo: false });
    expect(c.get('C2')).toEqual({ stile: STILE.durata, valore: String(1800 / 1440), testo: false });
    expect(c.get('D2')).toEqual({ stile: STILE.normale, valore: '3', testo: false });
  });

  it('mette in grassetto l\'intestazione e le righe indicate, e la blocca', () => {
    const f = foglio({ righe: [[{ testo: 'Data' }], [{ testo: 'x' }], [{ durata: 60 }]], grassetto: [2] });
    const xml = leggiZip(cartella([f])).get('xl/worksheets/sheet1.xml')!;
    const c = celle(xml);
    expect(c.get('A1')!.stile).toBe(STILE.normale + STILE.grassetto);
    expect(c.get('A2')!.stile).toBe(STILE.normale);
    expect(c.get('A3')!.stile).toBe(STILE.durata + STILE.grassetto);
    expect(xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('<col min="1" max="1" width="12" customWidth="1"/>');
  });

  it('salta le celle vuote e quelle con numeri non validi', () => {
    const f = foglio({ righe: [[{ testo: 'a' }, null, { orario: Number.NaN }, { durata: Infinity }, { testo: '' }]] });
    const c = celle(leggiZip(cartella([f])).get('xl/worksheets/sheet1.xml')!);
    expect([...c.keys()]).toEqual(['A1']);
  });

  it('fa l\'escape dei caratteri speciali e toglie quelli di controllo', () => {
    const f = foglio({ nome: 'R&D <1>', righe: [[{ testo: 'a & b < c > "d" \'e\' Giovedì\u0007' }]] });
    const file = leggiZip(cartella([f]));
    const xml = file.get('xl/worksheets/sheet1.xml')!;
    expect(xmlBenFormato(xml)).toBe(true);
    expect(xmlBenFormato(file.get('xl/workbook.xml')!)).toBe(true);
    expect(celle(xml).get('A1')!.valore).toBe('a & b < c > "d" \'e\' Giovedì');
    expect(nomiDeiFogli(file)).toEqual(['R&D <1>']);
  });

  it('con zero fogli lancia un errore', () => {
    expect(() => cartella([])).toThrow();
  });
});

describe('nomiFogli', () => {
  it('toglie i caratteri vietati, tronca a 31 e rende unici', () => {
    expect(nomiFogli(['a/b:c?d*e[f]g\\h', "'citato'", '', 'x'.repeat(40), 'Mese', 'mese'])).toEqual([
      'abcdefgh',
      'citato',
      'Foglio',
      'x'.repeat(31),
      'Mese',
      'mese (2)',
    ]);
  });
});

describe('seriale', () => {
  it('conta i giorni come Excel', () => {
    expect(seriale('1900-03-01')).toBe(61);
    expect(seriale('2026-01-01')).toBe(46023);
    expect(seriale('2026-10-14')).toBe(46309);
  });
});
```

- [ ] **Step 3: Esegui i test per vederli fallire**

Run: `npx vitest run tests/xlsx.test.ts`
Expected: FAIL, `Failed to resolve import "../src/core/xlsx"`.

- [ ] **Step 4: Implementa `src/core/xlsx.ts`**

```ts
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
```

Nota: `xmlBenFormato` nei test richiede che ogni file inizi con la dichiarazione `<?xml ...?>`, per questo anche `RELS` e `STILI` la includono.

- [ ] **Step 5: Esegui i test**

Run: `npx vitest run tests/xlsx.test.ts tests/zip.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck e commit**

Run: `npm run typecheck`
Expected: nessun errore.

```bash
git add src/core/xlsx.ts tests/xlsx.test.ts tests/leggiXlsx.ts
git commit -m "Esportazione Excel: cartella di lavoro xlsx

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: I fogli di Sbeggio (`src/core/excel.ts`)

**Files:**
- Create: `src/core/excel.ts`
- Test: `tests/excel.test.ts`

**Interfaces:**
- Consumes: `cartella`, `Cella`, `Foglio` da `src/core/xlsx.ts`; `riepilogoMese`, `haContenuto`, `GiornoRiepilogo` da `src/core/riepilogo.ts`; `formattaOra`, `giornoSettimana`, `nomeMese`, `NOMI_GIORNI` da `src/core/tempo.ts`.
- Produces:
  ```ts
  export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  export const INTESTAZIONE_EXCEL: readonly string[];
  export function oreMinuti(minuti: number): string;        // 75 → "1:15"
  export function saldoOreMinuti(minuti: number): string;   // 15 → "+0:15", -30 → "−0:30", 0 → "0:00"
  export function testoPermessi(g: Giornata): string;
  export function esportaExcel(giornate: Record<string, Giornata>, imp: Impostazioni, oggi: { data: string; minuti: number }): Uint8Array<ArrayBuffer>;
  ```

- [ ] **Step 1: Scrivi i test che falliscono**

`tests/excel.test.ts`:

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { esportaExcel, INTESTAZIONE_EXCEL, oreMinuti, saldoOreMinuti, testoPermessi } from '../src/core/excel';
import { riepilogoMese } from '../src/core/riepilogo';
import type { Giornata } from '../src/core/tipi';
import { STILE } from '../src/core/xlsx';
import { celle, leggiZip, nomiDeiFogli } from './leggiXlsx';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const oggi = { data: '2026-10-05', minuti: h('10:00') };

/** Giovedì 1/10: pausa pranzo e una sigaretta oltre la tolleranza. */
function conSigaretta(): Giornata {
  const g = giornata(
    [
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:15'],
      ['USCITA_PERMESSO', '15:00'],
      ['RIENTRO_PERMESSO', '15:20'],
      ['USCITA', '17:30'],
    ],
    { data: '2026-10-01' },
  );
  g.eventi[3]!.sigaretta = true;
  return g;
}

/** Venerdì 2/10: permesso a inizio giornata e un permesso intermedio. */
function conPermessi(): Giornata {
  return giornata(
    [
      ['ENTRATA', '09:30'],
      ['USCITA_PERMESSO', '10:00'],
      ['RIENTRO_PERMESSO', '10:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA', '18:00'],
    ],
    { data: '2026-10-02', permessoInizio: 60 },
  );
}

function perData(...g: Giornata[]): Record<string, Giornata> {
  return Object.fromEntries(g.map((x) => [x.data, x]));
}

function foglio(giornate: Record<string, Giornata>, n = 1, quando = oggi) {
  const file = leggiZip(esportaExcel(giornate, imp, quando));
  return { file, c: celle(file.get(`xl/worksheets/sheet${n}.xml`)!) };
}

const minuti = (valore: string) => Math.round(Number(valore) * 1440);

describe('formati', () => {
  it('ore e saldo in h:mm', () => {
    expect(oreMinuti(0)).toBe('0:00');
    expect(oreMinuti(75)).toBe('1:15');
    expect(oreMinuti(600)).toBe('10:00');
    expect(saldoOreMinuti(0)).toBe('0:00');
    expect(saldoOreMinuti(15)).toBe('+0:15');
    expect(saldoOreMinuti(-90)).toBe('−1:30');
  });
});

describe('testoPermessi', () => {
  it('elenca inizio giornata, permessi intermedi e uscita, senza le sigarette', () => {
    const g = conPermessi();
    g.permessoUscitaMinuti = 60;
    expect(testoPermessi(g)).toBe('inizio giornata 1:00 · 10:00–10:30 · in uscita 1:00');
    expect(testoPermessi(conSigaretta())).toBe('');
  });

  it('mostra un permesso non ancora rientrato', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '15:00'],
    ]);
    expect(testoPermessi(g)).toBe('15:00–');
  });
});

describe('esportaExcel', () => {
  it('intestazione nell\'ordine concordato', () => {
    const { c } = foglio(perData(conSigaretta()));
    expect(INTESTAZIONE_EXCEL).toEqual([
      'Data', 'Giorno', 'Luogo', 'Entrata', 'Inizio pausa', 'Fine pausa', 'Uscita', 'Permessi',
      'Uscita prevista', 'Ore dovute', 'Ore lavorate', 'Straordinario', 'Permesso', 'Ferie', 'Saldo', 'Note',
    ]);
    expect(c.get('A1')!.valore).toBe('Data');
    expect(c.get('P1')!.valore).toBe('Note');
  });

  it('una giornata: timbrature, permessi senza sigarette e ore come nel riepilogo', () => {
    const g = conSigaretta();
    g.uscitaPrevista = h('17:10');
    const giornate = perData(g);
    const { c } = foglio(giornate);
    const giorno = riepilogoMese(giornate, imp, '2026-10', oggi).giorni[0]!;
    expect(c.get('A2')).toMatchObject({ stile: STILE.data, valore: '46296' });
    expect(c.get('B2')!.valore).toBe('Giovedì');
    expect(c.get('C2')!.valore).toBe('Sede');
    expect(minuti(c.get('D2')!.valore)).toBe(h('08:30'));
    expect(c.get('D2')!.stile).toBe(STILE.orario);
    expect(minuti(c.get('E2')!.valore)).toBe(h('12:30'));
    expect(minuti(c.get('F2')!.valore)).toBe(h('13:15'));
    expect(minuti(c.get('G2')!.valore)).toBe(h('17:30'));
    expect(c.has('H2')).toBe(false); // solo la sigaretta: nessun permesso elencato
    expect(minuti(c.get('I2')!.valore)).toBe(h('17:10'));
    expect(minuti(c.get('J2')!.valore)).toBe(giorno.risultato.dovuti);
    expect(c.get('J2')!.stile).toBe(STILE.durata);
    expect(minuti(c.get('K2')!.valore)).toBe(giorno.ore.lavoro);
    expect(minuti(c.get('L2')!.valore)).toBe(giorno.ore.straordinario);
    expect(minuti(c.get('M2')!.valore)).toBe(giorno.ore.permesso);
    expect(giorno.ore.permesso).toBeGreaterThan(0); // la sigaretta oltre la tolleranza resta nelle ore
    expect(minuti(c.get('N2')!.valore)).toBe(0);
    expect(c.get('O2')!.valore).toBe(saldoOreMinuti(giorno.risultato.saldo));
    expect(c.has('P2')).toBe(false);
  });

  it('riga Totale in grassetto con le somme e il saldo del mese', () => {
    const giornate = perData(conSigaretta(), conPermessi());
    const { c } = foglio(giornate);
    const r = riepilogoMese(giornate, imp, '2026-10', oggi);
    // Righe: 1 intestazione, 2–3 giorni, 4 vuota, 5 totale.
    expect(c.has('A4')).toBe(false);
    expect(c.get('A5')).toEqual({ stile: STILE.normale + STILE.grassetto, valore: 'Totale', testo: true });
    const dovuti = r.giorni.reduce((s, x) => s + x.risultato.dovuti, 0);
    expect(minuti(c.get('J5')!.valore)).toBe(dovuti);
    expect(minuti(c.get('K5')!.valore)).toBe(r.lavoro);
    expect(minuti(c.get('L5')!.valore)).toBe(r.straordinario);
    expect(minuti(c.get('M5')!.valore)).toBe(r.permesso);
    expect(minuti(c.get('N5')!.valore)).toBe(r.ferie);
    expect(c.get('J5')!.stile).toBe(STILE.durata + STILE.grassetto);
    expect(c.get('O5')!.valore).toBe(saldoOreMinuti(r.saldo));
    expect(c.get('H3')!.valore).toBe('inizio giornata 1:00 · 10:00–10:30');
    expect(c.get('B3')!.valore).toBe('Venerdì');
  });

  it('la giornata in corso ha la nota e non entra nel saldo del totale', () => {
    const inCorso = giornata([['ENTRATA', '08:00']], { data: oggi.data });
    const giornate = perData(conSigaretta(), inCorso);
    const { c } = foglio(giornate);
    expect(c.get('P3')!.valore).toBe('In corso');
    const chiuse = riepilogoMese(perData(conSigaretta()), imp, '2026-10', oggi);
    expect(c.get('O5')!.valore).toBe(saldoOreMinuti(chiuse.saldo));
  });

  it('una giornata di ferie oggi non è "In corso"', () => {
    const ferie: Giornata = { data: oggi.data, permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [], ferie: true };
    const { c } = foglio(perData(ferie));
    expect(c.get('C2')!.valore).toBe('Ferie');
    expect(c.has('D2')).toBe(false);
    expect(minuti(c.get('N2')!.valore)).toBe(minuti(c.get('J2')!.valore));
    expect(c.has('P2')).toBe(false);
  });

  it('una giornata da correggere riporta i problemi nelle note', () => {
    const errata = giornata([['USCITA', '17:00']], { data: '2026-10-01' });
    const giornate = perData(errata);
    const { c } = foglio(giornate);
    const problemi = riepilogoMese(giornate, imp, '2026-10', oggi).giorni[0]!.risultato.problemi;
    expect(problemi.length).toBeGreaterThan(0);
    expect(c.get('P2')!.valore).toBe(problemi.join(' · '));
  });

  it('smart working nella colonna Luogo', () => {
    const g = conSigaretta();
    g.luogo = 'smart';
    expect(foglio(perData(g)).c.get('C2')!.valore).toBe('Smart');
  });

  it('un foglio per mese, dal più vecchio', () => {
    const ottobre = conSigaretta();
    const settembre = giornata([['ENTRATA', '08:30'], ['USCITA', '16:30']], { data: '2026-09-30' });
    const { file } = foglio(perData(ottobre, settembre));
    expect(nomiDeiFogli(file)).toEqual(['Settembre 2026', 'Ottobre 2026']);
    expect(celle(file.get('xl/worksheets/sheet1.xml')!).get('A2')!.valore).toBe('46295');
  });

  it('ignora le giornate senza contenuto', () => {
    const vuota: Giornata = { data: '2026-08-03', permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [] };
    const { file } = foglio(perData(conSigaretta(), vuota));
    expect(nomiDeiFogli(file)).toEqual(['Ottobre 2026']);
  });
});
```

Nota sui seriali: `2026-10-01` → 46296, `2026-09-30` → 46295 (46309 è il 14/10, Task 2).

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npx vitest run tests/excel.test.ts`
Expected: FAIL, `Failed to resolve import "../src/core/excel"`.

- [ ] **Step 3: Implementa `src/core/excel.ts`**

```ts
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
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run tests/excel.test.ts`
Expected: PASS. Se il test "da correggere" trova `problemi` vuoto, l'evento scelto non basta a rendere la giornata errata: usa un'altra combinazione già presente in `tests/statoGiornata.test.ts` o `tests/calcolo.test.ts` che produce `daCorreggere: true` (per esempio due `ENTRATA` di fila) e aggiorna il test, non il codice.

- [ ] **Step 5: Typecheck e commit**

Run: `npm run typecheck`
Expected: nessun errore.

```bash
git add src/core/excel.ts tests/excel.test.ts
git commit -m "Esportazione Excel: un foglio per mese con timbrature e totali

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Salvare file binari (browser e Android)

**Files:**
- Modify: `src/ui/scarica.ts`
- Modify: `src/native/file.ts`
- Modify: `android/app/src/main/java/app/sbeggio/FilePlugin.java`
- Test: `tests/nativeFile.test.ts`

**Interfaces:**
- Produces: `scaricaFile(nome: string, contenuto: BlobPart, tipo: string): void`; `salvaFile(nome: string, contenuto: string | Uint8Array, tipo: string): Promise<boolean>`; `inBase64(dati: Uint8Array): string` (esportata da `src/native/file.ts` per i test).
- Contratto col plugin: `File.salva({ nome, tipo, contenuto, codifica?: 'base64' })`.

- [ ] **Step 1: Scrivi i test che falliscono**

`tests/nativeFile.test.ts`:

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Il plugin è finto: si verifica solo cosa il ponte manda ad Android.
const plugin = vi.hoisted(() => ({ salva: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin }));

import { inBase64, salvaFile } from '../src/native/file';

beforeEach(() => {
  plugin.salva.mockReset();
  plugin.salva.mockResolvedValue({ salvato: true });
});

describe('salvaFile', () => {
  it('manda il testo così com\'è', async () => {
    expect(await salvaFile('a.csv', 'Data;Giorno', 'text/csv')).toBe(true);
    expect(plugin.salva).toHaveBeenCalledWith({ nome: 'a.csv', tipo: 'text/csv', contenuto: 'Data;Giorno' });
  });

  it('manda i byte in base64', async () => {
    await salvaFile('a.xlsx', new Uint8Array([80, 75, 3, 4, 255]), 'application/x');
    expect(plugin.salva).toHaveBeenCalledWith({ nome: 'a.xlsx', tipo: 'application/x', contenuto: 'UEsDBP8=', codifica: 'base64' });
  });

  it('riporta l\'annullamento', async () => {
    plugin.salva.mockResolvedValue({ salvato: false });
    expect(await salvaFile('a.xlsx', new Uint8Array([1]), 'application/x')).toBe(false);
  });
});

describe('inBase64', () => {
  it('regge file grandi senza sforare lo stack', () => {
    const dati = new Uint8Array(300_000).map((_, i) => i % 256);
    expect(Buffer.from(inBase64(dati), 'base64').equals(Buffer.from(dati))).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npx vitest run tests/nativeFile.test.ts`
Expected: FAIL (`inBase64` non esportata / argomenti diversi).

- [ ] **Step 3: Aggiorna `src/native/file.ts`**

Sostituisci interfaccia e funzione (le prime righe con licenza e `registerPlugin` restano):

```ts
interface PluginFile {
  salva(opzioni: { nome: string; tipo: string; contenuto: string; codifica?: 'base64' }): Promise<{ salvato: boolean }>;
}

const FileNativo = registerPlugin<PluginFile>('File');

/** Byte → base64, a pezzi: String.fromCharCode con troppi argomenti sfora lo stack. */
export function inBase64(dati: Uint8Array): string {
  let s = '';
  for (let i = 0; i < dati.length; i += 0x8000) s += String.fromCharCode(...dati.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * True se l'utente ha salvato il file, false se ha annullato. Lancia un errore se la scrittura fallisce.
 * Il testo passa com'è; i file binari (Excel) passano in base64 e il plugin li decodifica.
 */
export async function salvaFile(nome: string, contenuto: string | Uint8Array, tipo: string): Promise<boolean> {
  const opzioni =
    typeof contenuto === 'string'
      ? { nome, tipo, contenuto }
      : { nome, tipo, contenuto: inBase64(contenuto), codifica: 'base64' as const };
  const { salvato } = await FileNativo.salva(opzioni);
  return salvato;
}
```

- [ ] **Step 4: Aggiorna `src/ui/scarica.ts`**

```ts
/** Scarica un file con un link temporaneo (browser e PWA; nell'app Android serve il plugin nativo). */
export function scaricaFile(nome: string, contenuto: BlobPart, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
```

(il resto della funzione non cambia).

- [ ] **Step 5: Esegui i test**

Run: `npx vitest run tests/nativeFile.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Aggiorna `FilePlugin.java`**

Aggiungi l'import `import android.util.Base64;` dopo `import android.net.Uri;`. In `fileScelto` sostituisci la riga di scrittura e il `catch`:

```java
            out.write(dati(call));
            risolvi(call, true);
        } catch (IOException | SecurityException | IllegalArgumentException e) {
```

e aggiungi il metodo prima di `risolvi`:

```java
    /** Il contenuto da scrivere: testo in UTF-8, oppure byte in base64 (file Excel) se codifica = "base64". */
    private static byte[] dati(PluginCall call) {
        String contenuto = call.getString("contenuto", "");
        if ("base64".equals(call.getString("codifica"))) return Base64.decode(contenuto, Base64.DEFAULT);
        return contenuto.getBytes(StandardCharsets.UTF_8);
    }
```

Aggiorna anche il commento della classe, se cita solo il testo, aggiungendo: "I file binari (Excel) arrivano in base64 con `codifica: \"base64\"`."

- [ ] **Step 7: Compila il Java contro android.jar con stub di Capacitor**

Su questo PC `gradlew` non parte (solo JDK 25): si verifica con `javac` della JBR. In una cartella temporanea fuori dal repository (`$S` = scratchpad della sessione) crea gli stub:

```bash
S="<scratchpad>/javac-file"; mkdir -p "$S/stub/com/getcapacitor/annotation" "$S/stub/androidx/activity/result" "$S/out"
cat > "$S/stub/com/getcapacitor/JSObject.java" <<'EOF'
package com.getcapacitor; public class JSObject { public JSObject put(String k, boolean v) { return this; } }
EOF
cat > "$S/stub/com/getcapacitor/Bridge.java" <<'EOF'
package com.getcapacitor; public class Bridge { public void releaseCall(PluginCall c) {} }
EOF
cat > "$S/stub/com/getcapacitor/PluginCall.java" <<'EOF'
package com.getcapacitor; public class PluginCall {
  public String getString(String k) { return null; } public String getString(String k, String d) { return d; }
  public void reject(String m) {} public void resolve(JSObject o) {} }
EOF
cat > "$S/stub/com/getcapacitor/Plugin.java" <<'EOF'
package com.getcapacitor; public class Plugin {
  public android.content.Context getContext() { return null; } public Bridge getBridge() { return null; }
  public void startActivityForResult(PluginCall c, android.content.Intent i, String cb) {} }
EOF
cat > "$S/stub/com/getcapacitor/PluginMethod.java" <<'EOF'
package com.getcapacitor; public @interface PluginMethod {}
EOF
cat > "$S/stub/com/getcapacitor/annotation/ActivityCallback.java" <<'EOF'
package com.getcapacitor.annotation; public @interface ActivityCallback {}
EOF
cat > "$S/stub/com/getcapacitor/annotation/CapacitorPlugin.java" <<'EOF'
package com.getcapacitor.annotation; public @interface CapacitorPlugin { String name(); }
EOF
cat > "$S/stub/androidx/activity/result/ActivityResult.java" <<'EOF'
package androidx.activity.result; public class ActivityResult {
  public int getResultCode() { return 0; } public android.content.Intent getData() { return null; } }
EOF
"/c/Program Files/Android/Android Studio/jbr/bin/javac.exe" -d "$S/out" \
  -cp "$LOCALAPPDATA/Android/Sdk/platforms/android-37.0/android.jar" \
  $(find "$S/stub" -name '*.java') android/app/src/main/java/app/sbeggio/FilePlugin.java
```

Expected: nessun errore di compilazione (gli avvisi sulle annotazioni vanno bene). La build vera la fa il workflow "App Android" sulla PR.

- [ ] **Step 8: Typecheck e commit**

Run: `npm run typecheck && npm test`
Expected: tutto verde.

```bash
git add src/native/file.ts src/ui/scarica.ts android/app/src/main/java/app/sbeggio/FilePlugin.java tests/nativeFile.test.ts
git commit -m "Salvataggio di file binari: base64 verso il plugin Android, Blob nel browser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pulsanti nell'app e sul sito, Aiuto e README

**Files:**
- Modify: `src/ui/dati.ts`
- Modify: `src/ui/impostazioni.ts` (scheda "Dati e backup")
- Modify: `src/core/esportazioni.ts` (`nomeFile` accetta `'xlsx'`, commento in testa)
- Modify: `src/sito/main.ts` (`scarica`, `pulsanti`)
- Modify: `src/ui/aiutoTesti.ts` (voci `backup` e `computer`)
- Modify: `README.md` (sezioni "Scaricare le timbrature dal computer" ed "Export CSV")
- Test: `tests/esportazioni.test.ts`

**Interfaces:**
- Consumes: `esportaExcel`, `TIPO_XLSX` da `src/core/excel.ts`; `salvaFile(nome, contenuto: string | Uint8Array, tipo)`; `scaricaFile(nome, contenuto: BlobPart, tipo)`.
- Produces: `esportaExcelCondividi(adesso: Adesso): Promise<void>` in `src/ui/dati.ts`; `nomeFile(periodo: string, oggi: string, estensione: 'csv' | 'json' | 'xlsx'): string`.

- [ ] **Step 1: Test per il nome del file Excel**

In `tests/esportazioni.test.ts`, nel test che verifica `nomeFile` (riga ~57), aggiungi:

```ts
    expect(nomeFile('2026-10', '2026-10-13', 'xlsx')).toBe('sbeggio-2026-10.xlsx');
    expect(nomeFile(TUTTO, '2026-10-13', 'xlsx')).toBe('sbeggio-tutto-2026-10-13.xlsx');
```

Run: `npm run typecheck`
Expected: FAIL, `Argument of type '"xlsx"' is not assignable to parameter of type '"csv" | "json"'` (vitest non controlla i tipi: qui il test che fallisce è il typecheck).

- [ ] **Step 2: `nomeFile` e commento in `src/core/esportazioni.ts`**

```ts
/** Esportazioni del sito web.sbeggio.app: un mese a scelta o tutto, in Excel (excel.ts), CSV (csv.ts) o JSON leggibile. */
```

```ts
export function nomeFile(periodo: string, oggi: string, estensione: 'csv' | 'json' | 'xlsx'): string {
```

- [ ] **Step 3: `src/ui/dati.ts`**

Aggiungi l'import:

```ts
import { esportaExcel, TIPO_XLSX } from '../core/excel';
```

Cambia la firma di `condividiFile` (il corpo resta uguale: `Blob` e `salvaFile` accettano già entrambi):

```ts
async function condividiFile(nome: string, contenuto: string | Uint8Array<ArrayBuffer>, tipo: string): Promise<void> {
```

Sostituisci `esportaCsvCondividi` con le due esportazioni e un controllo comune:

```ts
/** False (dopo averlo detto) se non c'è ancora nessuna giornata da esportare. */
async function ciSonoGiornate(): Promise<boolean> {
  if (contaGiornate() > 0) return true;
  await avviso('Niente da esportare', 'Non ci sono ancora giornate registrate.');
  return false;
}

export async function esportaExcelCondividi(adesso: Adesso): Promise<void> {
  if (!(await ciSonoGiornate())) return;
  await condividiFile(`sbeggio-${adesso.data}.xlsx`, esportaExcel(store.giornate, store.impostazioni, adesso), TIPO_XLSX);
}

export async function esportaCsvCondividi(adesso: Adesso): Promise<void> {
  if (!(await ciSonoGiornate())) return;
  await condividiFile(`sbeggio-${adesso.data}.csv`, esportaCsv(store.giornate, store.impostazioni, adesso), 'text/csv');
}
```

- [ ] **Step 4: Scheda "Dati e backup" in `src/ui/impostazioni.ts`**

Import: `import { esportaBackupJson, esportaCsvCondividi, esportaExcelCondividi, importaFile } from './dati';`

Nella `pila-pulsanti` della scheda "Dati e backup", al posto del pulsante "Esporta CSV (Excel)":

```ts
        el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void esportaExcelCondividi(adesso) }, 'Esporta Excel'),
        el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void esportaCsvCondividi(adesso) }, 'Esporta CSV'),
```

Nota: la PR #67 (impostazioni richiudibili) cambia l'involucro della stessa scheda; se viene unita prima, al merge tieni il suo `sezione('Dati e backup', …)` e questi pulsanti.

- [ ] **Step 5: Sito, `src/sito/main.ts`**

Import: `import { esportaExcel, TIPO_XLSX } from '../core/excel';`

```ts
type Formato = 'xlsx' | 'csv' | 'json';

function scarica(dati: DatiSalvati, periodo: string, formato: Formato): void {
  const ora = adessoRoma();
  const giornate = periodo === TUTTO ? dati.giornate : giornateDelMese(dati.giornate, periodo);
  const nome = nomeFile(periodo, ora.data, formato);
  if (formato === 'xlsx') scaricaFile(nome, esportaExcel(giornate, dati.impostazioni, ora), TIPO_XLSX);
  else if (formato === 'csv') scaricaFile(nome, esportaCsv(giornate, dati.impostazioni, ora), 'text/csv');
  else scaricaFile(nome, esportaJson(giornate, dati.impostazioni, ora, periodo, __VERSIONE_APP__), 'application/json');
}

function pulsanti(azione: (formato: Formato) => void): HTMLElement {
  return el(
    'div',
    { class: 'riga-pulsanti' },
    el('button', { type: 'button', class: 'btn btn-primario', onclick: () => azione('xlsx') }, 'Excel'),
    el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => azione('csv') }, 'CSV'),
    el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => azione('json') }, 'JSON'),
  );
}
```

I pulsanti compaiono solo quando `meseIniziale` non è `null`, cioè con almeno una giornata: `esportaExcel` riceve sempre almeno un mese. Per un mese scelto dal selettore, `mesiPresenti` garantisce che abbia giornate con contenuto.

- [ ] **Step 6: Aiuto, `src/ui/aiutoTesti.ts`**

Voce `backup`, il primo punto diventa due:

```ts
        '• Esporta Excel: un foglio per mese, una riga per giorno con entrata, pausa, uscita, permessi, uscita prevista e le ore (dovute, lavorate, straordinario, permesso, ferie, saldo), con i totali in fondo. Si apre in Excel in qualunque lingua.',
        '• Esporta CSV: le stesse giornate in un file di testo (separatore ";"), da reimportare in Sbeggio.',
```

Voce `computer`:

```ts
        'Dal computer scarichi il file Excel, il CSV o il JSON di un mese a scelta o di tutte le timbrature.',
```

- [ ] **Step 7: README**

Nella sezione "Scaricare le timbrature dal computer", punto 3:

```markdown
3. Sul computer scegli il mese e scarica **Excel**, **CSV** (lo stesso dell'app) o **JSON**, oppure scarica tutto.
```

Prima di "## Export CSV" aggiungi:

```markdown
## Export Excel

*Impostazioni → Esporta Excel* (e il pulsante **Excel** del sito) genera un vero file `.xlsx`, che si apre
uguale in Excel di qualunque lingua. Un foglio per mese e una riga per giorno: data, giorno, luogo
(Sede/Smart/Ferie), entrata, inizio e fine pausa, uscita, permessi (a inizio giornata, intermedi, in uscita;
senza le pause sigaretta), uscita prevista, ore dovute, lavorate, straordinario, permesso, ferie (durate
`h:mm` sommabili), saldo e note (giornata in corso o da correggere). In fondo la riga *Totale*. Il file è
generato a mano (`src/core/zip.ts`, `src/core/xlsx.ts`, `src/core/excel.ts`), senza dipendenze.
```

E nella sezione "Export CSV" sostituisci la prima frase con:

```markdown
Il CSV usa `;` come separatore e la virgola per i decimali, con BOM UTF-8: si apre
direttamente con Excel in italiano (per un Excel in un'altra lingua usa l'export Excel) e serve
soprattutto a reimportare le giornate.
```

- [ ] **Step 8: Verifica e commit**

Run: `npm run typecheck && npm test && npm run build`
Expected: tutto verde, build completata.

```bash
git add src/ui/dati.ts src/ui/impostazioni.ts src/core/esportazioni.ts src/sito/main.ts src/ui/aiutoTesti.ts README.md tests/esportazioni.test.ts
git commit -m "Esporta Excel nell'app e sul sito; Aiuto e README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verifica del file vero

**Files:** nessun file del progetto (solo file temporanei nello scratchpad, e un test temporaneo cancellato alla fine).

- [ ] **Step 1: Genera un file di prova**

Crea `tests/zz-genera-xlsx.test.ts` (temporaneo, NON va committato):

```ts
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { esportaExcel } from '../src/core/excel';
import { giornata, h, impostazioni } from './helpers';

it('genera un file di prova', () => {
  const g1 = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:15'], ['USCITA_PERMESSO', '15:00'], ['RIENTRO_PERMESSO', '15:20'], ['USCITA', '17:30']], { data: '2026-10-01' });
  g1.eventi[3]!.sigaretta = true;
  g1.uscitaPrevista = h('17:10');
  const g2 = giornata([['ENTRATA', '09:30'], ['USCITA_PERMESSO', '10:00'], ['RIENTRO_PERMESSO', '10:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '18:00']], { data: '2026-10-02', permessoInizio: 60 });
  const g3 = giornata([['ENTRATA', '08:00'], ['USCITA', '16:00']], { data: '2026-09-30' });
  const g4 = { data: '2026-10-05', permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [], ferie: true };
  const giornate = Object.fromEntries([g1, g2, g3, g4].map((g) => [g.data, g]));
  writeFileSync(process.env.XLSX_PROVA!, esportaExcel(giornate, impostazioni(), { data: '2026-10-14', minuti: h('10:00') }));
});
```

Run (Git Bash): `XLSX_PROVA="<scratchpad>/prova.xlsx" npx vitest run tests/zz-genera-xlsx.test.ts`
Expected: PASS e il file `prova.xlsx` nello scratchpad.

- [ ] **Step 2: Rileggi il file con openpyxl, in un ambiente temporaneo**

```bash
python -m venv "<scratchpad>/venv" && "<scratchpad>/venv/Scripts/python" -m pip install -q openpyxl
cat > "<scratchpad>/leggi.py" <<'EOF'
import sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
for ws in wb.worksheets:
    print('==', ws.title, '| bloccata:', ws.freeze_panes)
    for row in ws.iter_rows():
        print([(c.value, c.number_format) if c.value is not None else None for c in row])
EOF
"<scratchpad>/venv/Scripts/python" -I "<scratchpad>/leggi.py" "<scratchpad>/prova.xlsx"
```

Expected: due fogli, "Settembre 2026" e "Ottobre 2026"; `freeze_panes` = `A2`; le date sono `datetime` con formato `dd/mm/yyyy`; gli orari sono `time`/frazioni con `h:mm`; le durate con `[h]:mm`; in ottobre la colonna Permessi del 2/10 è `inizio giornata 1:00 · 10:00–10:30`, quella dell'1/10 vuota; il 5/10 ha Luogo "Ferie"; la riga Totale c'è. Se openpyxl rifiuta il file, correggi `xlsx.ts` (e aggiungi un test che copra il caso) prima di proseguire.

- [ ] **Step 3: Pulisci**

```bash
rm tests/zz-genera-xlsx.test.ts
git status --short   # non deve comparire niente di nuovo oltre ai file non tracciati già presenti
```

- [ ] **Step 4: Verifica finale**

Run: `npm run typecheck && npm test && npm run build`
Expected: tutto verde. Il file `prova.xlsx` si può dare all'utente per provarlo sull'Excel aziendale.
