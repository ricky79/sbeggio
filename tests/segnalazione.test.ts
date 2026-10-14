// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { EMAIL_CONTATTO, linkSegnalazione, type ContestoApp } from '../src/core/segnalazione';
import { impostazioni } from './helpers';

const imp = impostazioni({ pausaDaScalare: 30 });
const contesto: ContestoApp = {
  versione: '1.7.1',
  piattaforma: 'app Android',
  dispositivo: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
  schermo: '412×915',
  tema: 'scuro (automatico)',
  dataOra: '05/10/2026 10:32',
};

function leggi(link: string) {
  expect(link.startsWith('mailto:')).toBe(true);
  const [indirizzo, query] = link.slice('mailto:'.length).split('?');
  const p = new URLSearchParams(query);
  return { indirizzo, oggetto: p.get('subject'), testo: p.get('body') ?? '' };
}

describe('link di segnalazione', () => {
  it('l\'indirizzo è quello dei contatti', () => {
    expect(EMAIL_CONTATTO).toBe('supporto@sbeggio.app');
  });

  it('suggerimento: oggetto, spazio per il testo, versione e piattaforma, senza impostazioni', () => {
    const { indirizzo, oggetto, testo } = leggi(linkSegnalazione('suggerimento', contesto, imp));
    expect(indirizzo).toBe('supporto@sbeggio.app');
    expect(oggetto).toBe('Sbeggio: suggerimento');
    expect(testo).toContain('Il tuo suggerimento:');
    expect(testo).toContain('Versione: Sbeggio v1.7.1');
    expect(testo).toContain('Piattaforma: app Android');
    expect(testo).not.toContain('Pausa da scalare');
  });

  it('problema: spazi da riempire, dati tecnici e impostazioni', () => {
    const { oggetto, testo } = leggi(linkSegnalazione('problema', contesto, imp));
    expect(oggetto).toBe('Sbeggio: segnalazione di un problema');
    for (const atteso of [
      'Cosa è successo:',
      'Cosa ti aspettavi:',
      'Come riprodurlo:',
      'Dati tecnici (puoi cancellarli)',
      'Versione: Sbeggio v1.7.1',
      'Piattaforma: app Android',
      'Dispositivo: Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      'Schermo: 412×915',
      'Tema: scuro (automatico)',
      'Data e ora: 05/10/2026 10:32',
      'Ore dovute: lun 8h, mar 8h, mer 8h, gio 8h, ven 8h, sab 0 min, dom 0 min',
      'Fascia pranzo: 12:00–14:30',
      'Pausa da scalare: 30 min',
      'Pausa minima: 30 min',
      'Inizio conteggio: 08:30',
      'Pausa sigaretta: tolleranza 11 min, normale',
      'Avvisi: uscita sì, sigaretta sì (1 min prima), pranzo sì (dopo 30 min)',
    ]) {
      expect(testo, atteso).toContain(atteso);
    }
  });

  it('righe separate da CRLF e nessuno spazio o a capo non codificato nel link', () => {
    const link = linkSegnalazione('problema', contesto, imp);
    expect(link).not.toMatch(/[\s]/);
    expect(leggi(link).testo).toContain('\r\n');
  });

  it('resta sotto i 2000 caratteri anche con un dispositivo dal nome lungo', () => {
    const lungo = { ...contesto, dispositivo: 'Mozilla/5.0 '.repeat(20) };
    expect(linkSegnalazione('problema', lungo, imp).length).toBeLessThan(2000);
  });
});
