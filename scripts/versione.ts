// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Versioni dei rilasci (logica pura, con test in tests/versione.test.ts).
 * La versione sta in package.json; ogni rilascio ha il tag v<versione>.
 */

type Versione = [number, number, number];

/** x.y.z, con o senza la "v" dei tag; null se non è una versione. */
export function leggiVersione(testo: string): Versione | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(testo.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function confronta(a: Versione, b: Versione): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** La versione più alta tra i tag (senza "v"), oppure null se nessun tag è una versione. */
export function ultimaVersione(tag: readonly string[]): string | null {
  let ultima: Versione | null = null;
  for (const t of tag) {
    const v = leggiVersione(t);
    if (v && (!ultima || confronta(v, ultima) > 0)) ultima = v;
  }
  return ultima ? ultima.join('.') : null;
}

/**
 * versionCode di Android: major × 10000 + minor × 100 + patch (1.8.0 → 10800). Cresce sempre insieme
 * alla versione, purché minor e patch restino sotto 100.
 */
export function versionCode(versione: string): number {
  const v = leggiVersione(versione);
  if (!v) throw new Error(`Versione non valida: "${versione}" (serve x.y.z).`);
  if (v[1] > 99 || v[2] > 99) throw new Error(`Versione ${versione}: minor e patch devono stare tra 0 e 99.`);
  return v[0] * 10000 + v[1] * 100 + v[2];
}

/** Nelle PR verso main la versione deve essere nuova: ogni approvazione pubblica un rilascio. */
export function controllaVersione(nuova: string, tag: readonly string[]): { ok: boolean; messaggio: string } {
  const v = leggiVersione(nuova);
  if (!v) return { ok: false, messaggio: `La versione "${nuova}" in package.json non è nel formato x.y.z.` };
  try {
    versionCode(nuova);
  } catch (e) {
    return { ok: false, messaggio: (e as Error).message };
  }
  const ultima = ultimaVersione(tag);
  if (ultima && confronta(v, leggiVersione(ultima)!) <= 0) {
    return {
      ok: false,
      messaggio: `La versione ${nuova} non è più alta dell'ultimo rilascio (${ultima}): aggiorna la versione con "npm version patch --no-git-tag-version" (o minor/major) e fai il commit.`,
    };
  }
  return { ok: true, messaggio: `Approvando la PR verrà pubblicato il rilascio v${nuova}${ultima ? ` (ultimo: ${ultima})` : ''}.` };
}
