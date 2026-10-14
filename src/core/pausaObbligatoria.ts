// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Pausa pranzo obbligatoria (D.Lgs. 66/2003, art. 8): con almeno 6 ore la pausa non si può saltare.
 *
 * Decisione del 2026-10-09: la soglia guarda le ore dovute del giorno (Impostazioni), non quelle al
 * netto dei permessi: con 8h dovute e 3h di permesso la pausa resta obbligatoria. Rivedibile.
 */
export const SOGLIA_PAUSA_OBBLIGATORIA = 6 * 60;

/**
 * Prima giornata in cui una pausa obbligatoria non registrata si scala all'uscita: le giornate
 * precedenti restano con i saldi già visti.
 */
export const INIZIO_PAUSA_OBBLIGATORIA = '2026-10-12';

/** True se con questi minuti dovuti la pausa pranzo è obbligatoria. */
export function pausaObbligatoria(dovuti: number): boolean {
  return dovuti >= SOGLIA_PAUSA_OBBLIGATORIA;
}
