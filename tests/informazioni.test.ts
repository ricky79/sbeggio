// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// La pagina deve dire tutto anche a chi non esegue JavaScript (motori di ricerca, assistenti): si legge
// il sorgente così com'è.
const html = readFileSync('informazioni.html', 'utf8');

describe('pagina Informazioni', () => {
  it('il testo è già nell\'HTML, senza bisogno di JavaScript', () => {
    expect(html).toContain('Riccardo Oliosi');
    expect(html).toContain('https://github.com/ricky79');
    expect(html).toContain('mailto:supporto@sbeggio.app');
    expect(html).toContain('https://github.com/ricky79/sbeggio/blob/main/LICENSE');
    for (const id of ['autore', 'licenza', 'contatti', 'privacy']) expect(html).toContain(`id="${id}"`);
    expect(html).not.toMatch(/<script[^>]*type="module"/);
  });

  it('l\'informativa dice cosa parte dal telefono e cosa no', () => {
    for (const frase of ['notifiche.sbeggio.app', 'Cloudflare', 'GitHub', 'posizione', 'cifrat']) expect(html).toContain(frase);
  });

  it('la mail personale non compare', () => {
    expect(html).not.toMatch(/@gmail\.com/i);
  });
});
