// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { Coordinate, Luogo } from './tipi';

/** Entro questa distanza dall'ufficio (metri) si propone la sede. */
export const RAGGIO_UFFICIO = 300;

/** Oltre questa incertezza (metri) la posizione non basta per decidere. */
export const PRECISIONE_MASSIMA = 1000;

export interface Posizione extends Coordinate {
  /** Incertezza della posizione in metri (raggio). */
  precisione: number;
}

/** Distanza in metri tra due punti (formula dell'emisenoverso). */
export function distanzaMetri(a: Coordinate, b: Coordinate): number {
  const r = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Casa o sede in base alla posizione: sede entro {@link RAGGIO_UFFICIO} dall'ufficio, casa se si è
 * sicuramente più lontani (anche tenendo conto dell'incertezza); null se la posizione è troppo
 * imprecisa per dirlo.
 */
export function luogoDaPosizione(p: Posizione, ufficio: Coordinate): Luogo | null {
  if (!(p.precisione >= 0) || p.precisione > PRECISIONE_MASSIMA) return null;
  const d = distanzaMetri(p, ufficio);
  if (d <= RAGGIO_UFFICIO) return 'sede';
  if (d - p.precisione > RAGGIO_UFFICIO) return 'smart';
  return null;
}
