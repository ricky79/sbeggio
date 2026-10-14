/**
 * Comandi per la CI (Node 22 esegue il TypeScript con --experimental-strip-types):
 *   controlla  la versione di package.json deve essere più alta dell'ultimo tag (PR verso main)
 *   codice     stampa il versionCode Android della versione di package.json
 *   note       stampa le note del rilascio (Markdown) dalle novità di src/core/novita.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { controllaVersione, versionCode } from './versione.ts';
import { noteRilascio } from '../src/core/novita.ts';

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
  case 'note':
    // Note del rilascio su GitHub dalle novità (src/core/novita.ts); vuote se la voce manca.
    process.stdout.write(noteRilascio(versione) ?? '');
    break;
  case 'codice':
    console.log(versionCode(versione));
    break;
  default:
    console.error('Uso: node --experimental-strip-types scripts/rilascio.ts controlla|codice|note');
    process.exit(2);
}
