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
