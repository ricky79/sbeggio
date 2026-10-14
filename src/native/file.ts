// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { registerPlugin } from '@capacitor/core';

/**
 * Salvataggio di file nell'app Android. Il plugin `File` è nel progetto Android
 * (`android/app/src/main/java/app/sbeggio/FilePlugin.java`) e apre la schermata "Salva con nome":
 * nella WebView il download di un blob non fa nulla.
 */
interface PluginFile {
  salva(opzioni: { nome: string; tipo: string; contenuto: string }): Promise<{ salvato: boolean }>;
}

const FileNativo = registerPlugin<PluginFile>('File');

/** True se l'utente ha salvato il file, false se ha annullato. Lancia un errore se la scrittura fallisce. */
export async function salvaFile(nome: string, contenuto: string, tipo: string): Promise<boolean> {
  const { salvato } = await FileNativo.salva({ nome, tipo, contenuto });
  return salvato;
}
