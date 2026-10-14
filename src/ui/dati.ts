// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { esportaCsv, importaCsv } from '../core/csv';
import { haContenuto } from '../core/riepilogo';
import { inApp } from '../native/app';
import { salvaFile } from '../native/file';
import { migra } from '../storage/migrazioni';
import { store } from '../storage/store';
import { avviso, conferma, toast } from './dialoghi';
import { scaricaFile } from './scarica';
import type { Adesso } from './giorno';

/**
 * Condivide un file con la Web Share API (foglio di condivisione iOS) o lo scarica. Nell'app Android
 * nessuno dei due funziona nella WebView: lo salva il plugin nativo con "Salva con nome".
 */
async function condividiFile(nome: string, contenuto: string, tipo: string): Promise<void> {
  if (inApp()) {
    try {
      if (await salvaFile(nome, contenuto, tipo)) toast('File salvato');
    } catch (e) {
      await avviso('Esportazione non riuscita', e instanceof Error ? e.message : String(e));
    }
    return;
  }
  const blob = new Blob([contenuto], { type: tipo });
  const file = new File([blob], nome, { type: tipo });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
      // altrimenti prosegui con il download
    }
  }
  scaricaFile(nome, contenuto, tipo);
}

function contaGiornate(): number {
  return Object.values(store.giornate).filter(haContenuto).length;
}

export async function esportaCsvCondividi(adesso: Adesso): Promise<void> {
  if (contaGiornate() === 0) {
    await avviso('Niente da esportare', 'Non ci sono ancora giornate registrate.');
    return;
  }
  await condividiFile(`sbeggio-${adesso.data}.csv`, esportaCsv(store.giornate, store.impostazioni, adesso), 'text/csv');
}

export async function esportaBackupJson(adesso: Adesso): Promise<void> {
  await condividiFile(`sbeggio-backup-${adesso.data}.json`, JSON.stringify(store.tutto, null, 2), 'application/json');
}

/** Importa un CSV (unisce le giornate) o un backup JSON (sostituisce tutto). */
export async function importaFile(file: File): Promise<void> {
  let testo: string;
  try {
    testo = await file.text();
  } catch {
    await avviso('Importazione non riuscita', 'Impossibile leggere il file.');
    return;
  }
  const json = file.name.toLowerCase().endsWith('.json') || testo.trimStart().startsWith('{');
  try {
    if (json) {
      const dati = migra(JSON.parse(testo));
      const n = Object.keys(dati.giornate).length;
      const ok = await conferma(
        'Ripristinare il backup?',
        `Il backup contiene ${n} giornate e le impostazioni. Tutti i dati attuali verranno sostituiti.`,
        'Ripristina',
        true,
      );
      if (!ok) return;
      store.sostituisci(dati);
      toast('Backup ripristinato');
    } else {
      const giornate = importaCsv(testo);
      const n = Object.keys(giornate).length;
      const sovrascritte = Object.keys(giornate).filter((d) => store.giornate[d]).length;
      const ok = await conferma(
        'Importare il CSV?',
        `${n} giornate trovate${sovrascritte > 0 ? `, di cui ${sovrascritte} già presenti verranno sovrascritte` : ''}. Le impostazioni non cambiano.`,
        'Importa',
      );
      if (!ok) return;
      store.unisciGiornate(giornate);
      toast(`${n} giornate importate`);
    }
  } catch (e) {
    const msg = e instanceof SyntaxError ? 'Il file JSON non è valido.' : e instanceof Error ? e.message : String(e);
    await avviso('Importazione non riuscita', msg);
  }
}
