// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { EVENTO_RICALCOLA_AVVISI, type OpzioniAvvisi } from '../core/avvisi';
import type { Festa } from '../core/festa';
import { creaPassaggio, fileSuono, type MomentoSuono } from '../core/suoni';
import { inApp } from '../native/app';
import { telefonoSilenzioso } from '../native/nfc';
import { schermataPranzoAperta, schermataSigarettaAperta } from './schermatePausa';
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

/**
 * Le schermate di pausa a cui togliere la notifica perché l'app suona già nello stesso momento:
 * nessuna se i suoni sono spenti, fuori dall'app Android (nella PWA la notifica resta sempre: il
 * push è già sul server e al passaggio in background non si può contare su un riallineamento) o
 * con l'app in secondo piano, dove il suono non può partire e la notifica serve.
 */
export function schermateDaTacere(): OpzioniAvvisi['schermateAperte'] {
  if (!suoniAccesi() || !inApp() || document.visibilityState !== 'visible') return {};
  return { sigaretta: schermataSigarettaAperta(), pranzo: schermataPranzoAperta() };
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
    try {
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
    } catch {
      inScarico.delete(file); // fetch che lancia subito: si suonerà dall'URL del file
    }
  }
}

function lettore(file: string): HTMLAudioElement {
  let audio = lettori.get(file);
  if (!audio) {
    audio = new Audio(blob.get(file) ?? indirizzo(file));
    lettori.set(file, audio);
  }
  return audio;
}

/** Lettori fatti partire muti dallo sblocco e non ancora fermati. */
const inSblocco = new Set<HTMLAudioElement>();

/**
 * Sull'iPhone un lettore può suonare senza un tocco solo se ha già suonato dentro un tocco, e
 * fine pausa e passaggio partono da timer e animazioni: al primo tocco si fanno partire muti tutti
 * i lettori e si fermano subito. Uno che sta già suonando (o che il tocco fa suonare davvero nel
 * frattempo, vedi `riproduci`) non si ferma.
 */
function sblocca(): void {
  for (const file of FILE) {
    try {
      const audio = lettore(file);
      if (!audio.paused) continue;
      audio.muted = true;
      inSblocco.add(audio);
      Promise.resolve(audio.play()).then(
        () => {
          if (!inSblocco.delete(audio)) return;
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        },
        () => {
          if (inSblocco.delete(audio)) audio.muted = false;
        },
      );
    } catch {
      /* resta da sbloccare: suonerà se il browser lo permette */
    }
  }
}

function riproduci(file: string): Promise<boolean> {
  try {
    const audio = lettore(file);
    // Un suono vero mentre lo sblocco è in corso (anche nello stesso click): toglierlo da `inSblocco`
    // annulla il fermo che lo sblocco farebbe alla fine, e il suono vero è sempre a voce piena.
    inSblocco.delete(audio);
    audio.muted = false;
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
 * Fine pausa e passaggio suonano solo con l'app in primo piano: in secondo piano i timer dell'app
 * Android continuano e la WebView suonerebbe sopra la notifica. La timbratura no: il tag NFC può
 * arrivare prima che la WebView si dica visibile.
 */
export function suona(momento: MomentoSuono): Promise<boolean> {
  try {
    if (!suoniAccesi()) return Promise.resolve(false);
    if (momento !== 'timbratura' && document.visibilityState !== 'visible') return Promise.resolve(false);
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
  // Lo sblocco dei lettori: al primo click con i suoni accesi. Il click, non pointerdown, perché col
  // dito solo pointerup/touchend/click valgono come gesto. In capture parte prima del gestore del
  // pulsante, che può suonare la timbratura sullo stesso lettore: ci pensa `riproduci`.
  // A suoni spenti si aspetta il click dopo averli accesi.
  const alTocco = () => {
    if (!suoniAccesi()) return;
    document.removeEventListener('click', alTocco, true);
    sblocca();
  };
  document.addEventListener('click', alTocco, true);
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
