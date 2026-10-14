// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { creaBanner, mostraBanner } from './banner';
import { el } from './dom';

/**
 * Nuove versioni dell'app Android. L'APK non viene dal Play Store e non si aggiorna da solo: l'app chiede
 * a GitHub qual è l'ultima release e, se è più nuova, mostra un banner per scaricarla. Si installa sopra
 * quella attuale e i dati restano, perché ogni APK è firmato con la stessa chiave (android.yml).
 */

export const URL_APK = 'https://github.com/ricky79/sbeggio/releases/latest/download/sbeggio.apk';
const URL_ULTIMA_RELEASE = 'https://api.github.com/repos/ricky79/sbeggio/releases/latest';
/** Le release escono di rado, e senza login l'API di GitHub concede 60 richieste l'ora per indirizzo IP. */
export const INTERVALLO_CONTROLLO = 6 * 60 * 60 * 1000;

/** Stato del dispositivo, come tema e banner di installazione: fuori dai dati e dal backup. */
const CHIAVE = 'timbrature-aggiornamento-app';

export interface StatoAggiornamento {
  /** Ultima risposta di GitHub (ms), 0 se non c'è mai stata. */
  controllato: number;
  /** Versione dell'ultima release con l'APK, se nota. */
  ultima: string | null;
  /** Versione per cui l'utente ha chiuso il banner. */
  chiusa: string | null;
}

type Versione = [number, number, number];

/** x.y.z, con o senza la "v" dei tag (stesso formato di scripts/versione.ts). */
function leggiVersione(testo: string): Versione | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(testo.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function piuNuova(versione: string, rispettoA: string): boolean {
  const a = leggiVersione(versione);
  const b = leggiVersione(rispettoA);
  return a !== null && b !== null && (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) > 0;
}

/**
 * Versione dell'ultima release dalla risposta di GitHub, solo se ha già l'APK: android.yml crea la
 * release e poi ci carica il file, e nel frattempo il link di download non funziona.
 */
export function versioneRilascio(release: unknown): string | null {
  if (typeof release !== 'object' || release === null) return null;
  const { tag_name: tag, assets } = release as { tag_name?: unknown; assets?: unknown };
  if (typeof tag !== 'string' || !Array.isArray(assets)) return null;
  const conApk = assets.some((a: unknown) => typeof a === 'object' && a !== null && 'name' in a && a.name === 'sbeggio.apk');
  const v = leggiVersione(tag);
  return conApk && v ? v.join('.') : null;
}

export function daControllare(s: StatoAggiornamento, adesso: number): boolean {
  // Se l'orologio è tornato indietro l'intervallo non è affidabile: meglio controllare.
  return adesso - s.controllato >= INTERVALLO_CONTROLLO || adesso < s.controllato;
}

/** La versione da proporre nel banner, o null se l'app è aggiornata o il banner è stato chiuso. */
export function versioneDaProporre(installata: string, s: StatoAggiornamento): string | null {
  return s.ultima !== null && s.ultima !== s.chiusa && piuNuova(s.ultima, installata) ? s.ultima : null;
}

export function leggiStato(testo: string | null): StatoAggiornamento {
  let dati: unknown = null;
  try {
    dati = JSON.parse(testo ?? 'null');
  } catch {
    /* illeggibile: si riparte da zero */
  }
  const d = (typeof dati === 'object' && dati !== null ? dati : {}) as Record<string, unknown>;
  return {
    controllato: typeof d.controllato === 'number' ? d.controllato : 0,
    ultima: typeof d.ultima === 'string' ? d.ultima : null,
    chiusa: typeof d.chiusa === 'string' ? d.chiusa : null,
  };
}

let stato = leggiStato(null);
let installata = '';
let inCorso = false;

function salva(): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(stato));
  } catch {
    /* resta valido solo per questa sessione */
  }
}

function scarica(): void {
  // Capacitor apre gli indirizzi esterni nel browser, che scarica l'APK.
  window.location.href = URL_APK;
}

function mostra(): void {
  const versione = versioneDaProporre(installata, stato);
  mostraBanner(
    versione === null
      ? null
      : creaBanner({
          etichetta: 'Nuova versione dell\'app',
          titolo: `Nuova versione ${versione}`,
          testo: 'Scaricala e installala sopra: i dati restano.',
          azione: el('button', { type: 'button', class: 'btn btn-primario', onclick: scarica }, 'Scarica'),
          chiudi: 'Chiudi fino alla prossima versione',
          onChiudi: () => {
            stato.chiusa = versione;
            salva();
            mostra();
          },
        }),
  );
}

async function controlla(): Promise<void> {
  if (inCorso || !daControllare(stato, Date.now())) return;
  inCorso = true;
  try {
    const r = await fetch(URL_ULTIMA_RELEASE, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10_000),
    });
    const ultima = r.ok ? versioneRilascio(await r.json()) : null;
    // Anche un errore di GitHub (limite di richieste, nessuna release) conta: si riprova dopo l'intervallo.
    stato.controllato = Date.now();
    if (ultima) stato.ultima = ultima;
    salva();
    mostra();
  } catch {
    /* offline o GitHub non risponde: si riprova quando l'app torna in primo piano */
  } finally {
    inCorso = false;
  }
}

/** Nell'app Android: banner con la nuova versione appena GitHub ne pubblica una. */
export function avviaControlloAggiornamenti(versioneInstallata: string): void {
  installata = versioneInstallata;
  try {
    stato = leggiStato(localStorage.getItem(CHIAVE));
  } catch {
    /* memoria non accessibile: si controlla comunque */
  }
  mostra(); // l'ultima versione vista resta nota anche senza internet
  void controlla();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void controlla();
  });
}
