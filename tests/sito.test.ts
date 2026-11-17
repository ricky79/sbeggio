// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { PAGINE_DEL_SITO } from '../src/core/sito';

describe('pagine di sbeggio.app che stanno sul sito', () => {
  // Il service worker della PWA non deve rispondere con l'app a questi indirizzi: li rimanda il Worker.
  it.each(['/novita', '/novita/', '/informazioni', '/informazioni/', '/informazioni.html'])('%s va al sito', (percorso) => {
    expect(PAGINE_DEL_SITO.test(percorso)).toBe(true);
  });

  it.each(['/', '/index.html', '/novitaX', '/informazioni/altro', '/assets/informazioni.css'])('%s resta all\'app', (percorso) => {
    expect(PAGINE_DEL_SITO.test(percorso)).toBe(false);
  });
});
