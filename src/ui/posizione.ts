// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { luogoDaPosizione, type Posizione } from '../core/posizione';
import type { Luogo } from '../core/tipi';
import { store } from '../storage/store';

/** Ultimo luogo rilevato dalla posizione: { data, luogo }, uno solo (quello di oggi). */
const CHIAVE = 'timbrature-luogo-rilevato';

export function luogoRilevato(data: string): Luogo | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) ?? 'null') as { data?: unknown; luogo?: unknown } | null;
    return v?.data === data && (v.luogo === 'smart' || v.luogo === 'sede') ? v.luogo : null;
  } catch {
    return null;
  }
}

function salvaRilevato(data: string, luogo: Luogo): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify({ data, luogo }));
  } catch {
    /* solo una proposta: senza memoria si rileva di nuovo alla prossima apertura */
  }
}

export class ErrorePosizione extends Error {}

/** Legge la posizione attuale una volta. Chiede il permesso la prima volta. */
export function leggiPosizione(): Promise<Posizione> {
  return new Promise((risolvi, rifiuta) => {
    if (!('geolocation' in navigator)) {
      rifiuta(new ErrorePosizione('Questo dispositivo non fornisce la posizione.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => risolvi({ lat: p.coords.latitude, lon: p.coords.longitude, precisione: p.coords.accuracy }),
      (e) =>
        rifiuta(
          new ErrorePosizione(
            e.code === e.PERMISSION_DENIED
              ? 'Permesso di posizione negato: abilitalo nelle impostazioni del telefono per Sbeggio.'
              : 'Posizione non disponibile: controlla che la localizzazione sia attiva e riprova.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 120_000 },
    );
  });
}

let inCorso = false;

/**
 * All'apertura dell'app (e al ritorno in primo piano): se l'ufficio è impostato e il luogo di oggi
 * non è ancora fissato (né scelto a mano né dalla prima timbratura), legge la posizione e propone
 * casa o sede. La proposta si aggiorna a ogni lettura: aperta a casa e poi in ufficio, propone la
 * sede. `aggiorna` ridisegna la vista.
 */
export async function rilevaLuogo(data: string, aggiorna: () => void): Promise<void> {
  const ufficio = store.impostazioni.ufficio;
  if (!ufficio || inCorso || store.giornata(data).luogo) return;
  // Permesso negato: niente richieste a ogni apertura (dove l'API dei permessi c'è).
  try {
    if ((await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'denied') return;
  } catch {
    /* API dei permessi assente: si prova comunque */
  }
  inCorso = true;
  try {
    const luogo = luogoDaPosizione(await leggiPosizione(), ufficio);
    if (!luogo || store.giornata(data).luogo || luogo === luogoRilevato(data)) return;
    salvaRilevato(data, luogo);
    aggiorna();
  } catch {
    /* posizione non disponibile: resta la sede, si riprova alla prossima apertura */
  } finally {
    inCorso = false;
  }
}

/** Collega la proposta rilevata allo store: alla prima timbratura diventa il luogo della giornata. */
export function avviaProposteLuogo(): void {
  store.proponiLuogo(luogoRilevato);
}
