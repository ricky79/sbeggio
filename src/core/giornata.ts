// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { Giornata } from './tipi';

/** Timbrature o permessi pianificati: la giornata è iniziata davvero. */
export function haTimbrature(g: Giornata): boolean {
  return g.eventi.length > 0 || g.permessoInizioMinuti > 0 || g.permessoUscitaMinuti > 0;
}

/** Timbrature, ferie o smart: la giornata compare nello storico e nel CSV. */
export function haContenuto(g: Giornata): boolean {
  return haTimbrature(g) || g.ferie === true || g.luogo === 'smart';
}

/** Niente da conservare: né timbrature, né ferie, né un luogo scelto. */
export function giornataVuota(g: Giornata): boolean {
  return !haTimbrature(g) && g.ferie !== true && g.luogo === undefined;
}
