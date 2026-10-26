// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { Azione } from '../core/statoGiornata';
import { festaAccesa } from './tema';

/**
 * Suoni brevi di riscontro: quando timbri, quando chiudi la giornata e quando la pausa pranzo arriva
 * alla minima. Spenti di serie (Impostazioni → Aspetto). Sono sintetizzati con la Web Audio API, niente
 * file: con il tema di Halloween acceso hanno la loro versione a tema.
 *
 * I browser fanno partire l'audio solo dopo un tocco: chi gestisce un tocco chiama `sbloccaAudio()`
 * subito, prima di qualunque attesa; un suono senza tocco (tag NFC ad app chiusa) semplicemente tace.
 */

export type Suono = 'timbra' | 'uscita' | 'minima';
export type Variante = 'normale' | 'halloween';

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
export function suona(s: Suono, variante: Variante = festaAccesa() === 'halloween' ? 'halloween' : 'normale'): void {
  if (!suoniAttivi() || !contesto || contesto.state !== 'running') return;
  try {
    disegnaSuono(contesto, contesto.destination, s, variante, contesto.currentTime + 0.01);
  } catch {
    /* un suono mancato non deve fermare la timbratura */
  }
}

/** Secondi che bastano a contenere qualunque suono (per registrarli in un file). */
export const DURATA_MASSIMA = 2;

/** Disegna il suono a partire dall'istante `t` del contesto (anche un OfflineAudioContext). */
export function disegnaSuono(ctx: BaseAudioContext, uscita: AudioNode, s: Suono, variante: Variante, t: number): void {
  const volume = ctx.createGain();
  volume.gain.value = 0.5;
  volume.connect(uscita);
  const suoni: Record<Variante, Record<Suono, (ctx: BaseAudioContext, out: AudioNode, t: number) => void>> = {
    normale: { timbra: pop, uscita: rintocco, minima: arpeggio },
    halloween: { timbra: porta, uscita: risata, minima: organo },
  };
  suoni[variante][s](ctx, volume, t);
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

// --- Normali

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

// --- Halloween

/** Timbratura: il cigolio di una porta (dente di sega filtrato con la frequenza che tentenna). */
function porta(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const o = ctx.createOscillator();
  const filtro = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueCurveAtTime(new Float32Array([70, 110, 85, 140, 95, 160, 120, 75]), t, 0.75);
  filtro.type = 'bandpass';
  filtro.Q.value = 9;
  filtro.frequency.setValueCurveAtTime(new Float32Array([900, 1300, 1000, 1500, 1100, 1200]), t, 0.75);
  g.gain.setValueCurveAtTime(new Float32Array([0.0001, 0.9, 0.5, 1, 0.6, 0.9, 0.4, 0.0001].map((v) => v * 3.6)), t, 0.8);
  o.connect(filtro).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.85);
}

/** Fine giornata: "muahaha" (un "mua" che sale e tre "ha" che scendono, con le formanti della a). */
function risata(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const sillaba = (inizio: number, da: number, a: number, durata: number) => {
    const o = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const profondita = ctx.createGain();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(da, inizio);
    o.frequency.linearRampToValueAtTime(a, inizio + durata);
    vibrato.frequency.value = 7;
    profondita.gain.value = 6;
    vibrato.connect(profondita).connect(o.frequency);
    inviluppo(g, inizio, 2, 0.02, durata);
    for (const [f, q, livello] of [
      [750, 6, 1],
      [1150, 8, 0.5],
    ] as const) {
      const formante = ctx.createBiquadFilter();
      const lg = ctx.createGain();
      formante.type = 'bandpass';
      formante.frequency.value = f;
      formante.Q.value = q;
      lg.gain.value = livello;
      o.connect(formante).connect(lg).connect(g);
    }
    g.connect(out);
    o.start(inizio);
    vibrato.start(inizio);
    o.stop(inizio + durata + 0.05);
    vibrato.stop(inizio + durata + 0.05);
  };
  sillaba(t, 150, 230, 0.32);
  [230, 205, 180].forEach((f, i) => sillaba(t + 0.42 + i * 0.19, f, f - 25, 0.15));
}

/** Pausa minima fatta: accordo di organo in la minore che trema, con un fantasma che ulula sopra. */
function organo(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const tremolo = ctx.createOscillator();
  const profondita = ctx.createGain();
  const g = ctx.createGain();
  tremolo.frequency.value = 6;
  profondita.gain.value = 0.09;
  tremolo.connect(profondita).connect(g.gain);
  inviluppo(g, t, 0.22, 0.15, 1.5);
  for (const f of [220, 262, 330]) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 1.55);
  }
  g.connect(out);
  tremolo.start(t);
  tremolo.stop(t + 1.55);

  const fantasma = ctx.createOscillator();
  const vibrato = ctx.createOscillator();
  const vp = ctx.createGain();
  const fg = ctx.createGain();
  fantasma.type = 'sine';
  fantasma.frequency.setValueCurveAtTime(new Float32Array([600, 880, 760, 940, 700]), t + 0.2, 1.2);
  vibrato.frequency.value = 5;
  vp.gain.value = 12;
  vibrato.connect(vp).connect(fantasma.frequency);
  inviluppo(fg, t + 0.2, 0.12, 0.3, 1.45);
  fantasma.connect(fg).connect(out);
  fantasma.start(t + 0.2);
  vibrato.start(t + 0.2);
  fantasma.stop(t + 1.7);
  vibrato.stop(t + 1.7);
}
