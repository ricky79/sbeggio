// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Istante preciso (epoch ms) in cui è iniziata la pausa sigaretta in corso. È uno stato del
 * dispositivo, non dei dati (come tema e banner): serve alla schermata col conto alla rovescia e
 * all'avviso di fine pausa, che lavorano al secondo mentre le timbrature sono al minuto.
 */
const CHIAVE = 'timbrature-sigaretta';

interface InizioSalvato {
  data: string;
  eventoId: string;
  inizio: number;
}

export function salvaInizioSigaretta(v: InizioSalvato): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(v));
  } catch {
    /* si userà l'orario della timbratura */
  }
}

/** L'istante salvato per quella pausa (data ed evento di uscita), o null se non c'è. */
export function inizioSigarettaSalvato(data: string, eventoId: string): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) ?? 'null') as Partial<InizioSalvato> | null;
    if (v && v.data === data && v.eventoId === eventoId && typeof v.inizio === 'number') return v.inizio;
  } catch {
    /* chiave illeggibile o memoria non disponibile */
  }
  return null;
}

export function cancellaInizioSigaretta(): void {
  try {
    localStorage.removeItem(CHIAVE);
  } catch {
    /* ignora */
  }
}
