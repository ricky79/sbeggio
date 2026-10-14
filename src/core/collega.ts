// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { chiaveDaBase64url } from './avvisiPush';

/**
 * Collegamento tra l'app e il sito web.sbeggio.app. Il sito mostra un QR con l'id del collegamento e
 * una chiave AES-256 nel fragment (dopo il #, quindi mai inviata al server); l'app cifra il backup con
 * quella chiave e lo manda al relay (Durable Object, src/collegamento.ts), che lo inoltra al browser
 * senza poterlo leggere.
 */
export const ORIGINE_SITO = 'https://web.sbeggio.app';
export const VERSIONE_COLLEGAMENTO = 1;
/** Validità di un QR: allo scadere il relay chiude e il sito ne genera uno nuovo. */
export const DURATA_COLLEGAMENTO_MS = 5 * 60_000;
/** Messaggio cifrato più grande accettato dal relay. */
export const MESSAGGIO_MASSIMO = 5 * 1024 * 1024;
/** 16 byte in base64url senza padding. */
export const ID_VALIDO = /^[A-Za-z0-9_-]{22}$/;
/** 32 byte in base64url senza padding. */
const CHIAVE_VALIDA = /^[A-Za-z0-9_-]{43}$/;
/** Codice di chiusura del WebSocket quando il QR scade. */
export const CHIUSURA_SCADUTO = 4000;
/** Il sito tiene vivo il WebSocket (i proxy chiudono le connessioni ferme); il relay risponde da solo. */
export const PING = 'ping';
export const PONG = 'pong';
export const INTERVALLO_PING_MS = 25_000;
const LUNGHEZZA_IV = 12;

export interface Collegamento {
  /** Origine del sito e del relay, es. https://web.sbeggio.app. */
  origine: string;
  id: string;
  /** Chiave AES-256 in base64url. */
  chiave: string;
}

export class ErroreCollegamento extends Error {}

function base64url(byte: Uint8Array): string {
  let s = '';
  for (const b of byte) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function casuali(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function creaCollegamento(origine: string = ORIGINE_SITO): Collegamento {
  return { origine, id: base64url(casuali(16)), chiave: base64url(casuali(32)) };
}

export function urlQr(c: Collegamento): string {
  return `${c.origine}/#${VERSIONE_COLLEGAMENTO}.${c.id}.${c.chiave}`;
}

/** Il fragment `#1.<id>.<chiave>`; null se non è un collegamento valido. */
export function leggiFragment(hash: string): { id: string; chiave: string } | null {
  const m = /^#(\d+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m || Number(m[1]) !== VERSIONE_COLLEGAMENTO) return null;
  const [, , id, chiave] = m;
  if (!ID_VALIDO.test(id!) || !CHIAVE_VALIDA.test(chiave!)) return null;
  return { id: id!, chiave: chiave! };
}

/**
 * Il testo di un QR inquadrato dall'app. Solo il sito ufficiale (in sviluppo anche localhost): un QR
 * di altri non può dirottare l'invio verso un altro server.
 */
export function leggiQr(testo: string, opz: { sviluppo: boolean }): Collegamento | null {
  let url: URL;
  try {
    url = new URL(testo.trim());
  } catch {
    return null;
  }
  const ufficiale = url.origin === ORIGINE_SITO;
  const locale = opz.sviluppo && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (!ufficiale && !locale) return null;
  if (url.pathname !== '/' || url.search !== '') return null;
  const f = leggiFragment(url.hash);
  return f ? { origine: url.origin, ...f } : null;
}

async function chiaveAes(chiave: string, uso: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', chiaveDaBase64url(chiave), 'AES-GCM', false, [uso]);
}

function trasforma(byte: BufferSource | string, flusso: CompressionStream | DecompressionStream): Response {
  return new Response(new Blob([byte]).stream().pipeThrough(flusso));
}

/** `versione | IV | AES-GCM(gzip(JSON))`, con l'id come dati autenticati. */
export async function cifra(dati: unknown, c: Pick<Collegamento, 'id' | 'chiave'>): Promise<Uint8Array<ArrayBuffer>> {
  const compresso = await trasforma(JSON.stringify(dati), new CompressionStream('gzip')).arrayBuffer();
  const iv = casuali(LUNGHEZZA_IV);
  const cifrato = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(c.id) },
    await chiaveAes(c.chiave, 'encrypt'),
    compresso,
  );
  const messaggio = new Uint8Array(1 + LUNGHEZZA_IV + cifrato.byteLength);
  messaggio[0] = VERSIONE_COLLEGAMENTO;
  messaggio.set(iv, 1);
  messaggio.set(new Uint8Array(cifrato), 1 + LUNGHEZZA_IV);
  return messaggio;
}

export async function decifra(messaggio: ArrayBuffer | Uint8Array, c: Pick<Collegamento, 'id' | 'chiave'>): Promise<unknown> {
  const byte = messaggio instanceof Uint8Array ? messaggio : new Uint8Array(messaggio);
  if (byte.length <= 1 + LUNGHEZZA_IV || byte[0] !== VERSIONE_COLLEGAMENTO) {
    throw new ErroreCollegamento('Messaggio non riconosciuto.');
  }
  try {
    const chiaro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: byte.slice(1, 1 + LUNGHEZZA_IV), additionalData: new TextEncoder().encode(c.id) },
      await chiaveAes(c.chiave, 'decrypt'),
      byte.slice(1 + LUNGHEZZA_IV),
    );
    return JSON.parse(await trasforma(chiaro, new DecompressionStream('gzip')).text());
  } catch {
    throw new ErroreCollegamento('Messaggio non decifrabile.');
  }
}

export type EsitoInvio = 'inviato' | 'scaduto' | 'usato' | 'troppo-grande' | 'rete' | { stato: number };

/** Cifra i dati e li manda al relay del QR. */
export async function inviaCollegamento(
  c: Collegamento,
  dati: unknown,
  invia: (url: string, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init),
): Promise<EsitoInvio> {
  const corpo = await cifra(dati, c);
  let r: Response;
  try {
    r = await invia(`${c.origine}/collega/${c.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: corpo,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return 'rete';
  }
  switch (r.status) {
    case 200:
      return 'inviato';
    case 404:
      return 'scaduto';
    case 409:
      return 'usato';
    case 413:
      return 'troppo-grande';
    default:
      return { stato: r.status };
  }
}

export function messaggioEsito(e: EsitoInvio): string {
  if (typeof e === 'object') return `Invio non riuscito (errore ${e.stato})`;
  return {
    inviato: 'Timbrature inviate al computer',
    scaduto: 'Codice scaduto: aggiorna la pagina sul computer e riprova',
    usato: 'Codice già usato: aggiorna la pagina sul computer e riprova',
    'troppo-grande': 'Troppi dati da inviare',
    rete: 'Serve la connessione a internet',
  }[e];
}

export type MotivoFotocamera = 'negata' | 'assente' | 'altro';

/** Il motivo di un errore di getUserMedia. */
export function motivoFotocamera(e: unknown): MotivoFotocamera {
  const nome = typeof e === 'object' && e !== null && 'name' in e ? String(e.name) : '';
  if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'negata';
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'assente';
  return 'altro';
}

export function messaggioFotocamera(m: MotivoFotocamera, app: boolean): string {
  if (m === 'negata') {
    return app
      ? 'Sbeggio non può usare la fotocamera: abilitala in Impostazioni di Android → App → Sbeggio → Autorizzazioni.'
      : 'Consenti l\'uso della fotocamera a Sbeggio nelle impostazioni del browser.';
  }
  return m === 'assente' ? 'Non trovo una fotocamera su questo dispositivo.' : 'Non riesco ad aprire la fotocamera. Riprova.';
}
