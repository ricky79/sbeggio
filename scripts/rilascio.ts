// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Comandi per la CI (Node 22 esegue il TypeScript con --experimental-strip-types):
 *   controlla  la versione di package.json deve essere più alta dell'ultimo tag (PR verso main)
 *   codice     stampa il versionCode Android della versione di package.json
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { controllaVersione, versionCode } from './versione.ts';

const versione = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;

switch (process.argv[2]) {
  case 'controlla': {
    const tag = execSync('git tag -l', { encoding: 'utf8' }).split('\n').filter(Boolean);
    const esito = controllaVersione(versione, tag);
    // ::error:: diventa un'annotazione nella pagina della PR.
    console.log(esito.ok ? esito.messaggio : `::error::${esito.messaggio}`);
    process.exit(esito.ok ? 0 : 1);
    break;
  }
  case 'codice':
    console.log(versionCode(versione));
    break;
  default:
    console.error('Uso: node --experimental-strip-types scripts/rilascio.ts controlla|codice');
    process.exit(2);
}
