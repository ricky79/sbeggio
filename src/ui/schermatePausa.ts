// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { EVENTO_RICALCOLA_AVVISI } from '../core/avvisi';

/**
 * Quali schermate di pausa sono aperte. Stanno in un modulo a parte perché le leggono i suoni
 * (per non far sovrapporre la notifica al suono dell'app) e le scrivono le schermate, che a loro
 * volta importano i suoni: così non si crea un ciclo di import.
 */
let sigaretta = false;
let pranzo = false;

/** Con la schermata aperta o chiusa certe notifiche cambiano: gli avvisi vanno ricalcolati. */
function cambia(): void {
  document.dispatchEvent(new Event(EVENTO_RICALCOLA_AVVISI));
}

export function schermataSigarettaAperta(): boolean {
  return sigaretta;
}

/** Vera solo col cronometro in vista, non col riepilogo di fine pausa. */
export function schermataPranzoAperta(): boolean {
  return pranzo;
}

export function impostaSchermataSigaretta(aperta: boolean): void {
  if (sigaretta === aperta) return;
  sigaretta = aperta;
  cambia();
}

export function impostaSchermataPranzo(aperta: boolean): void {
  if (pranzo === aperta) return;
  pranzo = aperta;
  cambia();
}
