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

  it('gli avvisi dichiarano anche tipo, codice del dispositivo e registri del server', () => {
    expect(html).toContain('tipo di avviso');
    expect(html).toContain('codice casuale del dispositivo');
    expect(html).toContain('registri tecnici');
  });

  it('i dati locali non sono "mai su un server": ci sono gli invii scelti e il backup di Android', () => {
    expect(html).not.toContain('Nessun server li riceve');
    expect(html).toContain('backup');
  });

  it('dichiara fotocamera e NFC, e come chiedere di cancellare le mail', () => {
    expect(html).toContain('fotocamera');
    expect(html).toContain('NFC');
    expect(html).toMatch(/cancellar[le]/);
  });

  it('la mail personale non compare', () => {
    expect(html).not.toMatch(/@gmail\.com/i);
  });
});

describe('metadati delle pagine', () => {
  it.each(['index.html', 'web.html', 'informazioni.html'])('%s dichiara autore e licenza', (file) => {
    const sorgente = readFileSync(file, 'utf8');
    expect(sorgente).toContain('<meta name="author" content="Riccardo Oliosi"');
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(sorgente)?.[1];
    const dati = JSON.parse(json!);
    expect(dati['@type']).toBe('SoftwareApplication');
    expect(dati.name).toBe('Sbeggio');
    expect(dati.author).toEqual({ '@type': 'Person', name: 'Riccardo Oliosi', url: 'https://github.com/ricky79' });
    expect(dati.license).toBe('https://www.gnu.org/licenses/gpl-3.0.html');
  });
});
