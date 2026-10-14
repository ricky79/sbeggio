// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/** Scelta dell'utente: 'auto' segue il tema del telefono. */
export type PreferenzaTema = 'auto' | 'chiaro' | 'scuro';
export type Tema = 'chiaro' | 'scuro';

/**
 * Chiave separata dai dati: il tema è una preferenza del dispositivo, non va nel
 * backup né viene toccato da "Ripristina valori predefiniti". Lo script inline
 * in index.html la legge prima del primo disegno.
 */
const CHIAVE = 'timbrature-tema';

/** Colore della barra di stato, uguale a --sfondo in style.css. */
const COLORE_BARRA: Record<Tema, string> = { chiaro: '#f2f2f7', scuro: '#000000' };

export function normalizzaPreferenza(v: unknown): PreferenzaTema {
  return v === 'chiaro' || v === 'scuro' ? v : 'auto';
}

export function temaEffettivo(preferenza: PreferenzaTema, sistemaScuro: boolean): Tema {
  if (preferenza === 'auto') return sistemaScuro ? 'scuro' : 'chiaro';
  return preferenza;
}

let preferenza: PreferenzaTema = 'auto';

export const preferenzaTema = (): PreferenzaTema => preferenza;

const mediaScuro = () => window.matchMedia('(prefers-color-scheme: dark)');

function applica(): void {
  const tema = temaEffettivo(preferenza, mediaScuro().matches);
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORE_BARRA[tema]);
}

export function impostaPreferenza(p: PreferenzaTema): void {
  preferenza = p;
  try {
    localStorage.setItem(CHIAVE, p);
  } catch {
    /* resta valida solo per questa sessione */
  }
  applica();
}

/** Applica il tema salvato e lo aggiorna quando cambia quello del telefono. */
export function avviaTema(): void {
  try {
    preferenza = normalizzaPreferenza(localStorage.getItem(CHIAVE));
  } catch {
    /* memoria non accessibile: resta automatico */
  }
  applica();
  mediaScuro().addEventListener('change', applica);
}
