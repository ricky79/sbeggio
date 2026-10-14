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
