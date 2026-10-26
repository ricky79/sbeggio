// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { chiaveFesta, festaDelGiorno, type Festa } from '../core/festa';
import { adessoRoma } from '../core/tempo';
import { creaDecorazioni } from './festaDisegni';

/** Scelta dell'utente: 'auto' segue il tema del telefono. */
export type PreferenzaTema = 'auto' | 'chiaro' | 'scuro';
export type Tema = 'chiaro' | 'scuro';

/**
 * Chiave separata dai dati: il tema è una preferenza del dispositivo, non va nel
 * backup né viene toccato da "Ripristina valori predefiniti". Lo script inline
 * in index.html la legge prima del primo disegno.
 */
const CHIAVE = 'timbrature-tema';

/** Festa spenta dall'utente, come `halloween-2026` (vedi chiaveFesta). Anche questa è del dispositivo. */
const CHIAVE_FESTA = 'timbrature-festa-spenta';

/** Colore della barra di stato, uguale a --sfondo in style.css (anche con il tema della festa). */
const COLORE_BARRA: Record<Tema, string> = { chiaro: '#f2f2f7', scuro: '#000000' };
const COLORE_BARRA_FESTA: Record<Festa, Record<Tema, string>> = { halloween: { chiaro: '#f6f0fb', scuro: '#0d0814' } };

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

/** La festa di oggi, accesa o spenta che sia (null fuori dai suoi giorni). */
export const festaDiOggi = (): Festa | null => festaDelGiorno(adessoRoma().data);

function leggiFestaSpenta(): string | null {
  try {
    return localStorage.getItem(CHIAVE_FESTA);
  } catch {
    return null;
  }
}

/** La festa da mostrare adesso: quella di oggi, se l'utente non l'ha spenta quest'anno. */
export function festaAccesa(): Festa | null {
  const festa = festaDiOggi();
  return festa && leggiFestaSpenta() !== chiaveFesta(festa, adessoRoma().data) ? festa : null;
}

export function impostaFesta(accesa: boolean): void {
  const festa = festaDiOggi();
  if (!festa) return;
  try {
    if (accesa) localStorage.removeItem(CHIAVE_FESTA);
    else localStorage.setItem(CHIAVE_FESTA, chiaveFesta(festa, adessoRoma().data));
  } catch {
    /* resta com'è */
  }
  applica();
}

function applica(): void {
  const tema = temaEffettivo(preferenza, mediaScuro().matches);
  const festa = festaAccesa();
  const radice = document.documentElement;
  radice.dataset.tema = tema;
  if (festa) radice.dataset.festa = festa;
  else delete radice.dataset.festa;
  // La strega è un elemento vero (le ragnatele e i pipistrelli bastano col CSS).
  const decorazioni = document.querySelector('.festa-decorazioni');
  if (festa && !decorazioni) document.body.append(creaDecorazioni());
  else if (!festa) decorazioni?.remove();
  const barra = festa ? COLORE_BARRA_FESTA[festa][tema] : COLORE_BARRA[tema];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barra);
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
  // La festa dipende dal giorno: si ricontrolla quando l'app torna in primo piano.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') applica();
  });
}
