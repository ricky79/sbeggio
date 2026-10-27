// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { EVENTO_RICALCOLA_AVVISI } from '../core/avvisi';
import type { Festa } from '../core/festa';
import { creaPassaggio, fileSuono, type MomentoSuono } from '../core/suoni';
import { inApp } from '../native/app';
import { telefonoSilenzioso } from '../native/nfc';
import { festaAccesa } from './tema';

/**
 * Interruttore dei suoni: preferenza del dispositivo come il tema (fuori dal backup, non toccata
 * da "Ripristina valori predefiniti"). Spenti finché non vale '1'.
 */
const CHIAVE = 'timbrature-suoni';

export function suoniAccesi(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === '1';
  } catch {
    return false;
  }
}

/** Con i suoni accesi certe notifiche lasciano il posto al suono: gli avvisi vanno ricalcolati. */
export function impostaSuoni(accesi: boolean): void {
  try {
    if (accesi) localStorage.setItem(CHIAVE, '1');
    else localStorage.removeItem(CHIAVE);
  } catch {
    /* resta com'è */
  }
  if (accesi) precarica();
  document.dispatchEvent(new Event(EVENTO_RICALCOLA_AVVISI));
}

const MOMENTI: readonly MomentoSuono[] = ['timbratura', 'finePausa', 'passaggio'];
const FESTE: readonly (Festa | null)[] = [null, 'halloween', 'natale'];
/** Tutti i file in public/suoni/, senza doppioni. */
const FILE = [...new Set(FESTE.flatMap((f) => MOMENTI.map((m) => fileSuono(m, f))))].filter((f): f is string => f !== null);

const indirizzo = (file: string) => `${import.meta.env.BASE_URL}suoni/${file}`;

/** Un lettore per file, riusato: ripartire da capo costa meno che ricaricarlo. */
const lettori = new Map<string, HTMLAudioElement>();
/** URL `blob:` dei file già scaricati; quelli in corso o pronti non si riscaricano. */
const blob = new Map<string, string>();
const inScarico = new Set<string>();

/**
 * Scarica i file in memoria e li dà ai lettori come blob. Safari chiede i file audio a pezzi
 * (Range) e il service worker, che li serve dal precache, risponde col file intero: dal blob
 * invece suona sempre. Se non riesce resta l'URL del file.
 */
function precarica(): void {
  for (const file of FILE) {
    if (inScarico.has(file) || blob.has(file)) continue;
    inScarico.add(file);
    fetch(indirizzo(file))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((b) => {
        const url = URL.createObjectURL(b);
        blob.set(file, url);
        const audio = lettori.get(file);
        if (audio) audio.src = url;
      })
      .catch(() => {
        /* si suonerà dall'URL del file */
      })
      .finally(() => inScarico.delete(file));
  }
}

function riproduci(file: string): Promise<boolean> {
  try {
    let audio = lettori.get(file);
    if (!audio) {
      audio = new Audio(blob.get(file) ?? indirizzo(file));
      lettori.set(file, audio);
    }
    audio.currentTime = 0;
    return Promise.resolve(audio.play()).then(
      () => true,
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Suona il momento col set della festa accesa. `false` se non è partito (spenti, telefono in
 * silenzioso, niente file, audio bloccato dal browser): non rifiuta mai, e chi timbra non lo aspetta.
 * Nel sito `play()` parte subito, dentro la chiamata: con un'attesa prima, Safari non lo
 * collegherebbe più al tocco e lo bloccherebbe. La suoneria si legge solo nell'app, che non vuole tocchi.
 */
export function suona(momento: MomentoSuono): Promise<boolean> {
  try {
    if (!suoniAccesi()) return Promise.resolve(false);
    const file = fileSuono(momento, festaAccesa());
    if (!file) return Promise.resolve(false);
    if (!inApp()) return riproduci(file);
    return telefonoSilenzioso().then(
      (silenzioso) => (silenzioso ? false : riproduci(file)),
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Suono del passaggio di strega e slitta (`.festa-volo`): parte quando la figura entra in scena,
 * cioè all'inizio di ogni giro della sua animazione, ma solo al primo dopo l'apertura dell'app.
 * Con "riduci movimento" l'animazione non c'è, e quindi neanche il suono.
 */
export function avviaSuoni(): void {
  if (suoniAccesi()) precarica();
  const passaggio = creaPassaggio(() => suona('passaggio'));
  const alGiro = (ev: Event) => {
    if (ev.target instanceof Element && ev.target.classList.contains('festa-volo')) passaggio.alPassaggio();
  };
  document.addEventListener('animationstart', alGiro);
  document.addEventListener('animationiteration', alGiro);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') passaggio.allaRiapertura();
  });
}
