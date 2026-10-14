// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { registerPlugin } from '@capacitor/core';

/**
 * Salvataggio di file nell'app Android. Il plugin `File` è nel progetto Android
 * (`android/app/src/main/java/app/sbeggio/FilePlugin.java`) e apre la schermata "Salva con nome":
 * nella WebView il download di un blob non fa nulla.
 */
interface PluginFile {
  salva(opzioni: { nome: string; tipo: string; contenuto: string; codifica?: 'base64' }): Promise<{ salvato: boolean }>;
}

const FileNativo = registerPlugin<PluginFile>('File');

/** Byte → base64, a pezzi: String.fromCharCode con troppi argomenti sfora lo stack. */
export function inBase64(dati: Uint8Array): string {
  let s = '';
  for (let i = 0; i < dati.length; i += 0x8000) s += String.fromCharCode(...dati.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * True se l'utente ha salvato il file, false se ha annullato. Lancia un errore se la scrittura fallisce.
 * Il testo passa com'è; i file binari (Excel) passano in base64 e il plugin li decodifica.
 */
export async function salvaFile(nome: string, contenuto: string | Uint8Array, tipo: string): Promise<boolean> {
  const opzioni =
    typeof contenuto === 'string'
      ? { nome, tipo, contenuto }
      : { nome, tipo, contenuto: inBase64(contenuto), codifica: 'base64' as const };
  const { salvato } = await FileNativo.salva(opzioni);
  return salvato;
}
