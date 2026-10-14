// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/** Ogni permesso usato vale un multiplo di questa durata (minuti). */
export const BLOCCO_PERMESSO = 30;

/** Straordinario conteggiato per un saldo positivo: solo blocchi interi da 30 minuti, il resto non conta. */
export function straordinarioABlocchi(saldo: number): number {
  return saldo > 0 ? Math.floor(saldo / BLOCCO_PERMESSO) * BLOCCO_PERMESSO : 0;
}

/** Permesso conteggiato per `durata` minuti reali: blocchi da 30 per eccesso, 0 se non c'è permesso. */
export function permessoABlocchi(durata: number): number {
  return durata > 0 ? Math.ceil(durata / BLOCCO_PERMESSO) * BLOCCO_PERMESSO : 0;
}
