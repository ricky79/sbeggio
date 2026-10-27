// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { EVENTO_RICALCOLA_AVVISI } from '../core/avvisi';
import { creaPassaggio, fileSuono, type MomentoSuono } from '../core/suoni';
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
  document.dispatchEvent(new Event(EVENTO_RICALCOLA_AVVISI));
}

/** Un lettore per file, riusato: ripartire da capo costa meno che ricaricarlo. */
const lettori = new Map<string, HTMLAudioElement>();

/**
 * Suona il momento col set della festa accesa. `false` se non è partito (spenti, telefono in
 * silenzioso, niente file, audio bloccato dal browser): non lancia mai, e chi timbra non lo aspetta.
 */
export async function suona(momento: MomentoSuono): Promise<boolean> {
  try {
    if (!suoniAccesi()) return false;
    const file = fileSuono(momento, festaAccesa());
    if (!file || (await telefonoSilenzioso())) return false;
    let audio = lettori.get(file);
    if (!audio) {
      audio = new Audio(`${import.meta.env.BASE_URL}suoni/${file}`);
      lettori.set(file, audio);
    }
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Suono del passaggio di strega e slitta (`.festa-volo`): parte quando la figura entra in scena,
 * cioè all'inizio di ogni giro della sua animazione, ma solo al primo dopo l'apertura dell'app.
 * Con "riduci movimento" l'animazione non c'è, e quindi neanche il suono.
 */
export function avviaSuoni(): void {
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
