// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Scanner, dialoghi e store sono finti: si verifica cosa vede l'utente dopo "Invia".
const finto = vi.hoisted(() => ({ registro: [] as string[], invia: vi.fn() }));

vi.mock('../src/ui/scanner', () => ({
  ErroreFotocamera: class extends Error {},
  scansionaQr: async () => ({ origine: 'https://web.sbeggio.app', id: 'AAAAAAAAAAAAAAAAAAAAAA', chiave: 'x' }),
}));
vi.mock('../src/ui/dialoghi', () => ({
  conferma: async () => true,
  avviso: async (titolo: string, messaggio: string) => void finto.registro.push(`avviso: ${titolo} | ${messaggio}`),
  toast: (messaggio: string) => void finto.registro.push(`toast: ${messaggio}`),
}));
vi.mock('../src/storage/store', () => ({ store: { tutto: { version: 1 } } }));
vi.mock('../src/native/app', () => ({ inApp: () => false }));
vi.mock('../src/core/collega', async (originale) => ({
  ...(await originale<typeof import('../src/core/collega')>()),
  inviaCollegamento: (...argomenti: unknown[]) => finto.invia(...argomenti),
}));

import { collegaComputer } from '../src/ui/collega';

beforeEach(() => {
  finto.registro.length = 0;
  finto.invia.mockReset();
});

describe('Collega un dispositivo', () => {
  it('dice "Invio in corso…" prima dell\'invio e l\'esito dopo', async () => {
    finto.invia.mockImplementation(async () => {
      finto.registro.push('invio');
      return 'inviato';
    });
    await collegaComputer();
    expect(finto.registro).toEqual(['toast: Invio in corso…', 'invio', 'toast: Timbrature inviate al computer']);
  });

  it('un errore imprevisto dell\'invio mostra un avviso invece di non fare nulla', async () => {
    finto.invia.mockRejectedValue(new ReferenceError('CompressionStream is not defined'));
    await expect(collegaComputer()).resolves.toBeUndefined();
    expect(finto.registro).toContain(
      'avviso: Invio non riuscito | Qualcosa non ha funzionato durante l\'invio. Riprova; se succede ancora, aggiorna il sistema del telefono.',
    );
  });
});
