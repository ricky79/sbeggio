// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { Azione } from '../core/statoGiornata';

/**
 * Suoni brevi di riscontro: quando timbri, quando chiudi la giornata e quando la pausa pranzo arriva
 * alla minima. Spenti di serie (Impostazioni → Aspetto). Sono sintetizzati con la Web Audio API, niente file.
 *
 * I browser fanno partire l'audio solo dopo un tocco: chi gestisce un tocco chiama `sbloccaAudio()`
 * subito, prima di qualunque attesa; un suono senza tocco (tag NFC ad app chiusa) semplicemente tace.
 */

export type Suono = 'timbra' | 'uscita' | 'minima';

/** Preferenza del dispositivo, come il tema: non va nel backup. */
const CHIAVE = 'timbrature-suoni';

/** Il suono di un'azione di Oggi, o null se non ne ha (Riapri la giornata). */
export function suonoPerAzione(azione: Azione): Suono | null {
  switch (azione) {
    case 'USCITA':
    case 'USCITA_ANTICIPATA':
    case 'NON_RIENTRO':
      return 'uscita';
    case 'RIAPRI':
      return null;
    default:
      return 'timbra';
  }
}

export function suoniAttivi(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === '1';
  } catch {
    return false;
  }
}

export function impostaSuoni(attivi: boolean): void {
  try {
    if (attivi) localStorage.setItem(CHIAVE, '1');
    else localStorage.removeItem(CHIAVE);
  } catch {
    /* restano spenti */
  }
  if (attivi) sbloccaAudio();
}

let contesto: AudioContext | null = null;

/** Da chiamare dentro il gestore di un tocco: crea o riattiva l'audio, se i suoni sono accesi. */
export function sbloccaAudio(): void {
  if (!suoniAttivi() || typeof AudioContext === 'undefined') return;
  try {
    contesto ??= new AudioContext();
    if (contesto.state === 'suspended') void contesto.resume();
  } catch {
    contesto = null;
  }
}

/** Suona `s` se i suoni sono accesi e l'audio è già stato sbloccato da un tocco; altrimenti niente. */
export function suona(s: Suono): void {
  if (!suoniAttivi() || !contesto || contesto.state !== 'running') return;
  try {
    disegnaSuono(contesto, contesto.destination, s, contesto.currentTime + 0.01);
  } catch {
    /* un suono mancato non deve fermare la timbratura */
  }
}

/** Secondi che bastano a contenere qualunque suono (per registrarli in un file). */
export const DURATA_MASSIMA = 2;

/** Disegna il suono a partire dall'istante `t` del contesto (anche un OfflineAudioContext). */
export function disegnaSuono(ctx: BaseAudioContext, uscita: AudioNode, s: Suono, t: number): void {
  const volume = ctx.createGain();
  volume.gain.value = 0.5;
  volume.connect(uscita);
  const suoni: Record<Suono, (ctx: BaseAudioContext, out: AudioNode, t: number) => void> = { timbra: pop, uscita: rintocco, minima: arpeggio };
  suoni[s](ctx, volume, t);
}

/** Inviluppo: sale in `attacco` secondi fino a `picco`, poi scende in modo esponenziale fino a `fine`. */
function inviluppo(g: GainNode, t: number, picco: number, attacco: number, fine: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(picco, t + attacco);
  g.gain.exponentialRampToValueAtTime(0.0001, t + fine);
}

function nota(ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, forma: OscillatorType, picco: number, durata: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = forma;
  o.frequency.setValueAtTime(freq, t);
  inviluppo(g, t, picco, 0.008, durata);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + durata + 0.05);
}

/** Campanella: fondamentale più un parziale inarmonico leggero. */
function campana(ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, durata: number, picco = 0.5): void {
  nota(ctx, out, t, freq, 'sine', picco, durata);
  nota(ctx, out, t, freq * 2.76, 'sine', picco * 0.12, durata * 0.5);
}

/** Timbratura: un "pop" morbido che scende. */
function pop(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(520, t + 0.09);
  inviluppo(g, t, 0.6, 0.005, 0.16);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

/** Fine giornata: due note che salgono (sol, do). */
function rintocco(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  campana(ctx, out, t, 784, 0.6);
  campana(ctx, out, t + 0.13, 1047, 0.8);
}

/** Pausa minima fatta: arpeggio do-mi-sol-do. */
function arpeggio(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  [523, 659, 784, 1047].forEach((f, i) => campana(ctx, out, t + i * 0.1, f, 0.7, 0.4));
}
