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
