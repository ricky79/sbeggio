// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { inApp } from './app';

/**
 * Tag NFC dell'app Android. Il plugin `Nfc` è nel progetto Android
 * (`android/app/src/main/java/app/sbeggio/NfcPlugin.java`): un tag con l'URI
 * sbeggio://timbra apre l'app e arriva qui come evento "tag".
 */
interface PluginNfc {
  stato(): Promise<{ disponibile: boolean; attivo: boolean }>;
  apriImpostazioniNfc(): Promise<void>;
  vibra(): Promise<void>;
  suoneria(): Promise<{ silenzioso: boolean }>;
  addListener(evento: 'tag', gestore: () => void): Promise<PluginListenerHandle>;
}

const Nfc = registerPlugin<PluginNfc>('Nfc');

export type StatoNfc = 'attivo' | 'spento' | 'assente';

export async function statoNfc(): Promise<StatoNfc> {
  if (!inApp()) return 'assente';
  try {
    const { disponibile, attivo } = await Nfc.stato();
    if (!disponibile) return 'assente';
    return attivo ? 'attivo' : 'spento';
  } catch {
    return 'assente';
  }
}

export async function apriImpostazioniNfc(): Promise<void> {
  if (!inApp()) return;
  try {
    await Nfc.apriImpostazioniNfc();
  } catch {
    /* impostazioni non raggiungibili: l'utente le apre a mano */
  }
}

export async function vibra(): Promise<void> {
  if (!inApp()) return;
  try {
    await Nfc.vibra();
  } catch {
    /* nessuna vibrazione: resta il messaggio */
  }
}

/** True se la suoneria del telefono è in silenzioso o vibrazione: allora l'app non deve fare suoni. */
export async function telefonoSilenzioso(): Promise<boolean> {
  if (!inApp()) return false;
  try {
    const { silenzioso } = await Nfc.suoneria();
    return silenzioso;
  } catch {
    /* plugin assente (build vecchia): si suona come sempre */
    return false;
  }
}

/**
 * Chiama `gestore` a ogni lettura di un tag di Sbeggio. All'avvio a freddo l'evento è trattenuto dal
 * plugin finché non c'è un listener, quindi arriva anche se questa funzione è chiamata dopo l'apertura.
 */
export function ascoltaTag(gestore: () => void): void {
  if (!inApp()) return;
  void Nfc.addListener('tag', gestore).catch(() => {
    /* plugin assente (build vecchia): il tag non fa nulla */
  });
}
