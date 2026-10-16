// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Istante preciso (epoch ms) in cui è iniziata la pausa pranzo in corso, come per la sigaretta: serve al
 * cronometro, che lavora al secondo mentre le timbrature sono al minuto. È uno stato del dispositivo.
 */
const CHIAVE = 'timbrature-pranzo';

interface InizioSalvato {
  data: string;
  eventoId: string;
  inizio: number;
}

export function salvaInizioPranzo(v: InizioSalvato): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(v));
  } catch {
    /* si userà l'orario della timbratura */
  }
}

/** L'istante salvato per quella pausa (data ed evento di inizio), o null se non c'è. */
export function inizioPranzoSalvato(data: string, eventoId: string): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) ?? 'null') as Partial<InizioSalvato> | null;
    if (v && v.data === data && v.eventoId === eventoId && typeof v.inizio === 'number') return v.inizio;
  } catch {
    /* chiave illeggibile o memoria non disponibile */
  }
  return null;
}

export function cancellaInizioPranzo(): void {
  try {
    localStorage.removeItem(CHIAVE);
  } catch {
    /* ignora */
  }
}
