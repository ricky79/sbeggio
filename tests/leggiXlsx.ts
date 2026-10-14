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
