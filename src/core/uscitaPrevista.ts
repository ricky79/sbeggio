// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { calcolaGiornata } from './calcolo';
import type { Giornata, Impostazioni } from './tipi';

/**
 * Orario a cui si sarebbe dovuti uscire in una giornata chiusa: l'uscita prevista che Oggi
 * mostrava un attimo prima di timbrare l'uscita (stesse regole: ore dovute, pausa, permessi).
 * Null se la giornata non è chiusa, è da correggere o è di ferie.
 */
export function uscitaPrevistaGiornata(g: Giornata, imp: Impostazioni): number | null {
  if (g.ferie) return null;
  const r = calcolaGiornata(g, imp, null);
  if (r.stato !== 'CHIUSA' || r.daCorreggere) return null;
  const ultima = [...g.eventi].sort((a, b) => a.minuti - b.minuti).at(-1);
  if (!ultima || (ultima.tipo !== 'USCITA' && ultima.tipo !== 'USCITA_ANTICIPATA')) return null;
  const prima = { ...g, eventi: g.eventi.filter((e) => e !== ultima) };
  return calcolaGiornata(prima, imp, ultima.minuti).uscitaPrevista;
}

/** Salva nella giornata l'uscita prevista (se chiusa) o la toglie (se non lo è più). */
export function aggiornaUscitaPrevista(g: Giornata, imp: Impostazioni): void {
  const u = uscitaPrevistaGiornata(g, imp);
  if (u === null) delete g.uscitaPrevista;
  else g.uscitaPrevista = u;
}
