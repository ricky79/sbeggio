# Scaricare le timbrature dal computer (web.sbeggio.app) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `https://web.sbeggio.app` mostra un QR; l'app Sbeggio (APK o PWA) lo inquadra e manda le
timbrature cifrate al browser, da cui si scaricano CSV o JSON di un mese a scelta o di tutto.

**Architecture:** il QR porta id del collegamento e chiave AES-256 nel fragment. Il browser attende su
un WebSocket verso un Durable Object (`Collegamento`) del Worker `sbeggio`; l'app cifra il backup
(gzip + AES-GCM) e lo manda con una `POST`, il Durable Object lo inoltra e chiude senza salvarlo. La
pagina del sito (`web.html`, secondo entry Vite) decifra e genera i file nel browser con le stesse
funzioni dell'app (`esportaCsv`, `migra`, `calcolaGiornata`).

**Tech Stack:** TypeScript, Vite 8 (multi-pagina), Vitest (ambiente node, niente DOM), Cloudflare
Workers + Durable Objects (WebSocket Hibernation, SQLite-backed), WebCrypto, `CompressionStream`,
`qrcode-generator` 2.0.4, `jsqr` 1.4.0, Capacitor 8 (Android).

**Spec:** `docs/superpowers/specs/2026-10-13-web-sbeggio-design.md`

## Global Constraints

- Origine del sito e del relay: `https://web.sbeggio.app`; QR: `https://web.sbeggio.app/#1.<id>.<chiave>`
  (id = 16 byte, chiave = 32 byte, entrambi base64url senza padding: 22 e 43 caratteri).
- Messaggio: `1 byte versione (1) | 12 byte IV | AES-GCM(gzip(JSON del backup))`, dati autenticati = id in UTF-8.
- Il QR vale **5 minuti**; ogni id si usa **una volta**; messaggio massimo **5 MB**; chiusura per scadenza con codice **4000**.
- Il relay non salva mai il messaggio: nello storage del Durable Object solo il flag `usato`.
- L'app accetta solo QR con origine `https://web.sbeggio.app` (in sviluppo anche `localhost`/`127.0.0.1`).
- CORS su `/collega/*`: `https://sbeggio.app`, `https://localhost` (app Capacitor), `http://localhost:5173`.
- `sbeggio.app` deve continuare a servire la PWA esattamente come oggi, anche per `/collega/...`.
- Dipendenze nuove solo `qrcode-generator@2.0.4` (MIT) e `jsqr@1.4.0` (Apache-2.0), in `dependencies`.
- Nessun tipo `@cloudflare/workers-types`: come in `src/worker.ts`, interfacce minime locali.
- I dati ricevuti dal sito stanno solo in memoria (mai localStorage).
- Testi dell'interfaccia, esattamente:
  - app: pulsante "Collega al computer…"; conferma "Collega al computer" / "Inviare tutte le timbrature al computer?" / "Invia";
  - scanner: "Inquadra il codice QR mostrato da web.sbeggio.app", "Questo non è un codice di Sbeggio", "Annulla";
  - esiti: "Timbrature inviate al computer", "Codice scaduto: aggiorna la pagina sul computer e riprova",
    "Codice già usato: aggiorna la pagina sul computer e riprova", "Troppi dati da inviare",
    "Serve la connessione a internet", "Invio non riuscito (errore N)";
  - fotocamera: "Sbeggio non può usare la fotocamera: abilitala in Impostazioni di Android → App → Sbeggio → Autorizzazioni.",
    "Consenti l'uso della fotocamera a Sbeggio nelle impostazioni del browser.",
    "Non trovo una fotocamera su questo dispositivo.", "Non riesco ad aprire la fotocamera. Riprova.";
  - sito: "Nuovo codice tra M:SS", "Ricevute N giornate alle HH:MM", "Connessione persa",
    "Dati ricevuti non leggibili", "Ricarica la pagina: l'app è più aggiornata del sito",
    "Questo codice va inquadrato dall'app Sbeggio: Impostazioni → Collega al computer.".
- Nomi dei file: `sbeggio-YYYY-MM.csv|json`, `sbeggio-tutto-YYYY-MM-DD.csv|json`.
- Commit in italiano, come la storia del repo, chiusi da `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Proxy aziendale che chiude i WebSocket inattivi** durante i 5 minuti di attesa: il sito manda
   `ping` ogni 25 s e il Durable Object risponde `pong` senza svegliarsi → test in Task 5 (ping) e Task 6 (e2e `pong`).
2. **Ferie inserite in anticipo** (mesi futuri nei dati) con il mese corrente vuoto: il selettore deve
   partire dal mese passato più recente, non da dicembre → test di `meseIniziale` in Task 2.
3. **Doppio invio** (stesso QR inquadrato due volte, o rete che ritenta): la seconda `POST` riceve `409`
   e l'app dice "Codice già usato" → test in Task 3 e Task 1 (mappa degli esiti).
4. **`sbeggio.app/collega/<id>`** non deve arrivare al relay ma alla PWA, e i percorsi della PWA restano
   invariati → test in Task 4.
5. **Telefono senza giornate**: il sito non deve mostrare un selettore vuoto ma "Non ci sono ancora
   giornate registrate." → `mesiPresenti({})` vuoto e `meseIniziale([])` null testati in Task 2; ramo UI in Task 6.

---

## Mappa dei file

| File | Responsabilità |
|---|---|
| `src/core/collega.ts` (nuovo) | QR, cifratura, invio dall'app, esiti e testi; costanti condivise da app, sito e relay |
| `src/core/esportazioni.ts` (nuovo) | mesi presenti, filtro per mese, mese iniziale, JSON leggibile, nomi dei file |
| `src/collegamento.ts` (nuovo) | Durable Object `Collegamento` + decisione pura `decidi` |
| `src/worker.ts` | instradamento per dominio, CORS, esporta `Collegamento` |
| `wrangler.jsonc` | route `web.sbeggio.app`, binding e migrazione del Durable Object |
| `src/sito/sessione.ts` (nuovo) | ciclo di vita del collegamento nel browser (WebSocket, scadenza, ping, decifratura) |
| `src/sito/main.ts`, `src/sito/sito.css`, `web.html` (nuovi) | la pagina `web.sbeggio.app` |
| `src/ui/scarica.ts` (nuovo) | download di un file con Blob URL (usato da sito e app) |
| `src/ui/dati.ts` | usa `scaricaFile` |
| `vite.config.ts` | multi-pagina, precache senza il sito, niente manifest in `web.html` |
| `src/ui/scanner.ts` (nuovo) | dialogo fotocamera + decodifica QR (`BarcodeDetector` o jsQR) |
| `src/ui/collega.ts` (nuovo) | flusso "Collega al computer" nell'app |
| `src/ui/impostazioni.ts`, `src/style.css` | pulsante e stili dello scanner |
| `android/app/src/main/AndroidManifest.xml` | permesso `CAMERA` |
| `src/ui/aiutoTesti.ts`, `README.md`, `package.json` | aiuto, documentazione, versione 2.7.0 |

---

### Task 1: QR, cifratura e invio (`src/core/collega.ts`)

**Files:**
- Create: `src/core/collega.ts`
- Test: `tests/collega.test.ts`

**Interfaces:**
- Consumes: `chiaveDaBase64url(s: string): Uint8Array<ArrayBuffer>` da `src/core/avvisiPush.ts`.
- Produces (usati nei task 3–7):
  - costanti `ORIGINE_SITO`, `VERSIONE_COLLEGAMENTO = 1`, `DURATA_COLLEGAMENTO_MS = 300_000`,
    `MESSAGGIO_MASSIMO = 5 * 1024 * 1024`, `ID_VALIDO: RegExp`, `CHIUSURA_SCADUTO = 4000`,
    `PING = 'ping'`, `PONG = 'pong'`, `INTERVALLO_PING_MS = 25_000`;
  - `interface Collegamento { origine: string; id: string; chiave: string }`;
  - `class ErroreCollegamento extends Error`;
  - `creaCollegamento(origine?: string): Collegamento`, `urlQr(c: Collegamento): string`;
  - `leggiFragment(hash: string): { id: string; chiave: string } | null`;
  - `leggiQr(testo: string, opz: { sviluppo: boolean }): Collegamento | null`;
  - `cifra(dati: unknown, c: Pick<Collegamento, 'id' | 'chiave'>): Promise<Uint8Array<ArrayBuffer>>`;
  - `decifra(messaggio: ArrayBuffer | Uint8Array, c: Pick<Collegamento, 'id' | 'chiave'>): Promise<unknown>`;
  - `type EsitoInvio = 'inviato' | 'scaduto' | 'usato' | 'troppo-grande' | 'rete' | { stato: number }`;
  - `inviaCollegamento(c: Collegamento, dati: unknown, invia?: (url: string, init: RequestInit) => Promise<Response>): Promise<EsitoInvio>`;
  - `messaggioEsito(e: EsitoInvio): string`;
  - `type MotivoFotocamera = 'negata' | 'assente' | 'altro'`, `motivoFotocamera(e: unknown): MotivoFotocamera`,
    `messaggioFotocamera(m: MotivoFotocamera, app: boolean): string`.

- [ ] **Step 1: Write the failing test**

Crea `tests/collega.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  cifra,
  creaCollegamento,
  decifra,
  ErroreCollegamento,
  ID_VALIDO,
  inviaCollegamento,
  leggiFragment,
  leggiQr,
  messaggioEsito,
  messaggioFotocamera,
  motivoFotocamera,
  ORIGINE_SITO,
  urlQr,
} from '../src/core/collega';

const dati = { version: 1, impostazioni: { a: 1 }, giornate: { '2026-10-01': { data: '2026-10-01', eventi: [] } } };

describe('QR del collegamento', () => {
  it('crea id e chiave casuali in base64url', () => {
    const a = creaCollegamento();
    const b = creaCollegamento();
    expect(a.origine).toBe(ORIGINE_SITO);
    expect(a.id).toMatch(ID_VALIDO);
    expect(a.chiave).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.id).not.toBe(b.id);
    expect(a.chiave).not.toBe(b.chiave);
  });

  it('il QR porta versione, id e chiave nel fragment e si rilegge', () => {
    const c = creaCollegamento();
    const url = urlQr(c);
    expect(url).toBe(`https://web.sbeggio.app/#1.${c.id}.${c.chiave}`);
    expect(leggiQr(url, { sviluppo: false })).toEqual(c);
    expect(leggiFragment(`#1.${c.id}.${c.chiave}`)).toEqual({ id: c.id, chiave: c.chiave });
    expect(leggiFragment('')).toBeNull();
  });

  it('rifiuta QR di altri siti, di altre versioni o malformati', () => {
    const c = creaCollegamento();
    const f = `#1.${c.id}.${c.chiave}`;
    const sbagliati = [
      `https://evil.example/${f}`,
      `http://web.sbeggio.app/${f}`,
      `https://web.sbeggio.app/altro${f}`,
      `https://web.sbeggio.app/?x=1${f}`,
      `https://web.sbeggio.app/#2.${c.id}.${c.chiave}`,
      `https://web.sbeggio.app/#1.${c.id.slice(1)}.${c.chiave}`,
      `https://web.sbeggio.app/#1.${c.id}`,
      'ciao',
      '',
    ];
    for (const t of sbagliati) expect(leggiQr(t, { sviluppo: false }), t).toBeNull();
  });

  it('accetta localhost solo in sviluppo', () => {
    const c = creaCollegamento('http://localhost:8787');
    expect(leggiQr(urlQr(c), { sviluppo: false })).toBeNull();
    expect(leggiQr(urlQr(c), { sviluppo: true })).toEqual(c);
  });
});

describe('cifratura', () => {
  it('andata e ritorno, da Uint8Array e da ArrayBuffer', async () => {
    const c = creaCollegamento();
    const m = await cifra(dati, c);
    expect(m[0]).toBe(1);
    expect(await decifra(m, c)).toEqual(dati);
    expect(await decifra(m.buffer, c)).toEqual(dati);
  });

  it('comprime e non lascia nulla in chiaro', async () => {
    const molti = {
      giornate: Array.from({ length: 300 }, (_, i) => ({ data: `2026-01-${i}`, eventi: [{ tipo: 'ENTRATA', minuti: 510 }] })),
    };
    const m = await cifra(molti, creaCollegamento());
    expect(m.byteLength).toBeLessThan(JSON.stringify(molti).length / 4);
    expect(new TextDecoder().decode(m)).not.toContain('ENTRATA');
  });

  it('fallisce con chiave, id, versione o dati sbagliati', async () => {
    const c = creaCollegamento();
    const m = await cifra(dati, c);
    await expect(decifra(m, { ...c, chiave: creaCollegamento().chiave })).rejects.toBeInstanceOf(ErroreCollegamento);
    await expect(decifra(m, { ...c, id: creaCollegamento().id })).rejects.toBeInstanceOf(ErroreCollegamento);
    const versione = m.slice();
    versione[0] = 2;
    await expect(decifra(versione, c)).rejects.toBeInstanceOf(ErroreCollegamento);
    const alterato = m.slice();
    const ultimo = alterato.length - 1;
    alterato[ultimo] = alterato[ultimo]! ^ 1;
    await expect(decifra(alterato, c)).rejects.toBeInstanceOf(ErroreCollegamento);
    await expect(decifra(m.slice(0, 13), c)).rejects.toBeInstanceOf(ErroreCollegamento);
  });
});

describe('invio dall\'app', () => {
  const risposta = (status: number) => vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status }));

  it('manda il messaggio cifrato al relay del QR', async () => {
    const c = creaCollegamento();
    const invia = risposta(200);
    expect(await inviaCollegamento(c, dati, invia)).toBe('inviato');
    const [url, init] = invia.mock.calls[0]!;
    expect(url).toBe(`https://web.sbeggio.app/collega/${c.id}`);
    expect(init.method).toBe('POST');
    expect(await decifra(init.body as Uint8Array, c)).toEqual(dati);
  });

  it.each([
    [404, 'scaduto'],
    [409, 'usato'],
    [413, 'troppo-grande'],
  ] as const)('stato %i → %s', async (stato, esito) => {
    expect(await inviaCollegamento(creaCollegamento(), dati, risposta(stato))).toBe(esito);
  });

  it('altri stati ed errori di rete', async () => {
    expect(await inviaCollegamento(creaCollegamento(), dati, risposta(500))).toEqual({ stato: 500 });
    const giu = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await inviaCollegamento(creaCollegamento(), dati, giu)).toBe('rete');
  });

  it('messaggi degli esiti', () => {
    expect(messaggioEsito('inviato')).toBe('Timbrature inviate al computer');
    expect(messaggioEsito('scaduto')).toBe('Codice scaduto: aggiorna la pagina sul computer e riprova');
    expect(messaggioEsito('usato')).toBe('Codice già usato: aggiorna la pagina sul computer e riprova');
    expect(messaggioEsito('troppo-grande')).toBe('Troppi dati da inviare');
    expect(messaggioEsito('rete')).toBe('Serve la connessione a internet');
    expect(messaggioEsito({ stato: 502 })).toBe('Invio non riuscito (errore 502)');
  });
});

describe('fotocamera', () => {
  it('riconosce il motivo dell\'errore', () => {
    expect(motivoFotocamera(new DOMException('x', 'NotAllowedError'))).toBe('negata');
    expect(motivoFotocamera(new DOMException('x', 'SecurityError'))).toBe('negata');
    expect(motivoFotocamera(new DOMException('x', 'NotFoundError'))).toBe('assente');
    expect(motivoFotocamera(new DOMException('x', 'OverconstrainedError'))).toBe('assente');
    expect(motivoFotocamera(new TypeError('x'))).toBe('altro');
    expect(motivoFotocamera('x')).toBe('altro');
  });

  it('spiega come abilitarla nell\'app e nel browser', () => {
    expect(messaggioFotocamera('negata', true)).toBe(
      'Sbeggio non può usare la fotocamera: abilitala in Impostazioni di Android → App → Sbeggio → Autorizzazioni.',
    );
    expect(messaggioFotocamera('negata', false)).toBe('Consenti l\'uso della fotocamera a Sbeggio nelle impostazioni del browser.');
    expect(messaggioFotocamera('assente', false)).toBe('Non trovo una fotocamera su questo dispositivo.');
    expect(messaggioFotocamera('altro', true)).toBe('Non riesco ad aprire la fotocamera. Riprova.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collega.test.ts`
Expected: FAIL, "Failed to resolve import ../src/core/collega" (o simile).

- [ ] **Step 3: Write the implementation**

Crea `src/core/collega.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/collega.test.ts && npm run typecheck`
Expected: PASS, typecheck senza errori. Se `tsc` segnala `BufferSource` in `trasforma` per `Uint8Array<ArrayBufferLike>`,
cambia il tipo del parametro in `ArrayBuffer | Uint8Array<ArrayBuffer> | string` (non usare cast a `any`).

- [ ] **Step 5: Commit**

```bash
git add src/core/collega.ts tests/collega.test.ts
git commit -m "Collega al computer: QR, cifratura e invio al relay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Esportazioni per il sito (`src/core/esportazioni.ts`)

**Files:**
- Create: `src/core/esportazioni.ts`
- Test: `tests/esportazioni.test.ts`

**Interfaces:**
- Consumes: `calcolaGiornata(g, imp, adesso: number | null)` (`src/core/calcolo.ts`), `haContenuto` (`src/core/giornata.ts`),
  `statoLeggibile` (`src/core/testi.ts`), `formattaOra`, `giornoSettimana`, `NOMI_GIORNI` (`src/core/tempo.ts`), `ETICHETTE_EVENTO` (`src/core/tipi.ts`).
- Produces (Task 6):
  - `TUTTO = 'tutto'`;
  - `mesiPresenti(giornate: Record<string, Giornata>): string[]` (`YYYY-MM`, dal più recente);
  - `giornateDelMese(giornate: Record<string, Giornata>, mese: string): Record<string, Giornata>`;
  - `meseIniziale(mesi: readonly string[], oggi: string): string | null`;
  - `esportaJson(giornate, imp: Impostazioni, oggi: { data: string; minuti: number }, periodo: string, versioneApp: string): string`;
  - `nomeFile(periodo: string, oggi: string, estensione: 'csv' | 'json'): string`;
  - tipi `EsportazioneJson`, `GiornataJson`.

- [ ] **Step 1: Write the failing test**

Crea `tests/esportazioni.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calcolaGiornata } from '../src/core/calcolo';
import { esportaCsv } from '../src/core/csv';
import {
  esportaJson,
  giornateDelMese,
  meseIniziale,
  mesiPresenti,
  nomeFile,
  TUTTO,
  type EsportazioneJson,
} from '../src/core/esportazioni';
import type { Giornata } from '../src/core/tipi';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const oggi = { data: '2026-10-13', minuti: h('09:42') };

function archivio(): Record<string, Giornata> {
  const elenco: Giornata[] = [
    giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '17:30']], { data: '2026-09-30' }),
    { ...giornata([['ENTRATA', '08:30'], ['USCITA', '17:30']], { data: '2026-10-01' }), sigaretteNonConteggiate: [{ minuti: h('10:15'), durata: 9 }] },
    { ...giornata([], { data: '2026-10-02' }), luogo: 'smart' },
    giornata([], { data: '2026-10-05' }),
    { ...giornata([], { data: '2026-12-24' }), ferie: true },
  ];
  return Object.fromEntries(elenco.map((g) => [g.data, g]));
}

const righe = (csv: string) => csv.replace('\uFEFF', '').trim().split('\r\n');

describe('mesi', () => {
  it('elenca i mesi con giornate, dal più recente', () => {
    expect(mesiPresenti(archivio())).toEqual(['2026-12', '2026-10', '2026-09']);
    expect(mesiPresenti({})).toEqual([]);
  });

  it('filtra le giornate di un mese', () => {
    expect(Object.keys(giornateDelMese(archivio(), '2026-10')).sort()).toEqual(['2026-10-01', '2026-10-02', '2026-10-05']);
    expect(giornateDelMese(archivio(), '2026-11')).toEqual({});
  });

  it('parte dal mese corrente, altrimenti dal più recente non futuro', () => {
    expect(meseIniziale(['2026-12', '2026-10', '2026-09'], '2026-10-13')).toBe('2026-10');
    // Ferie inserite in anticipo: dicembre non deve vincere su settembre.
    expect(meseIniziale(['2026-12', '2026-09'], '2026-10-13')).toBe('2026-09');
    expect(meseIniziale(['2026-12'], '2026-10-13')).toBe('2026-12');
    expect(meseIniziale([], '2026-10-13')).toBeNull();
  });

  it('nomi dei file', () => {
    expect(nomeFile('2026-10', '2026-10-13', 'csv')).toBe('sbeggio-2026-10.csv');
    expect(nomeFile(TUTTO, '2026-10-13', 'json')).toBe('sbeggio-tutto-2026-10-13.json');
  });
});

describe('CSV del mese', () => {
  it('ha le stesse righe del CSV completo per quel mese', () => {
    const tutte = righe(esportaCsv(archivio(), imp, oggi));
    const mese = righe(esportaCsv(giornateDelMese(archivio(), '2026-10'), imp, oggi));
    expect(mese).toEqual([tutte[0], ...tutte.slice(1).filter((r) => r.replace(/^"/, '').startsWith('2026-10-'))]);
  });
});

describe('JSON leggibile', () => {
  const leggi = (periodo: string, giornate = archivio(), adesso = oggi) =>
    JSON.parse(esportaJson(giornate, imp, adesso, periodo, '2.7.0')) as EsportazioneJson;

  it('intestazione e giornate con contenuto in ordine', () => {
    const j = leggi('2026-10', giornateDelMese(archivio(), '2026-10'));
    expect(j.app).toBe('Sbeggio');
    expect(j.versioneApp).toBe('2.7.0');
    expect(j.generato).toBe('2026-10-13T09:42');
    expect(j.periodo).toBe('2026-10');
    expect(j.giornate.map((g) => g.data)).toEqual(['2026-10-01', '2026-10-02']);
    expect(leggi(TUTTO).giornate.map((g) => g.data)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-12-24']);
  });

  it('valori dal calcolo dell\'app e stato uguale al CSV', () => {
    const a = archivio();
    const j = leggi(TUTTO, a).giornate.find((g) => g.data === '2026-10-01')!;
    const r = calcolaGiornata(a['2026-10-01']!, imp, null);
    expect(j).toMatchObject({
      giorno: 'Giovedì',
      dovutiMinuti: r.dovuti,
      lavoratiMinuti: r.lavorati,
      permessoMinuti: r.permesso,
      saldoMinuti: r.saldo,
      permessoInizioMinuti: 0,
      permessoUscitaMinuti: 0,
      luogo: 'sede',
      ferie: false,
    });
    const rigaCsv = righe(esportaCsv(a, imp, oggi)).find((x) => x.startsWith('2026-10-01'))!;
    expect(j.stato).toBe(rigaCsv.split(';')[6]);
    expect(j.eventi).toEqual([
      { ora: '08:30', tipo: 'ENTRATA', etichetta: 'Entrata' },
      { ora: '17:30', tipo: 'USCITA', etichetta: 'Uscita' },
    ]);
    expect(j.sigaretteNonConteggiate).toEqual([{ ora: '10:15', durataMinuti: 9 }]);
  });

  it('smart, ferie e sigarette assenti', () => {
    const tutte = leggi(TUTTO).giornate;
    expect(tutte.find((g) => g.data === '2026-10-02')).toMatchObject({ luogo: 'smart', ferie: false, eventi: [], sigaretteNonConteggiate: [] });
    expect(tutte.find((g) => g.data === '2026-12-24')).toMatchObject({ ferie: true });
  });

  it('la giornata in corso si calcola con l\'ora attuale', () => {
    const g = giornata([['ENTRATA', '08:30']], { data: '2026-10-13' });
    const j = leggi(TUTTO, { [g.data]: g }).giornate[0]!;
    expect(j.lavoratiMinuti).toBe(calcolaGiornata(g, imp, oggi.minuti).lavorati);
    expect(j.lavoratiMinuti).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/esportazioni.test.ts`
Expected: FAIL, modulo `../src/core/esportazioni` non trovato.

- [ ] **Step 3: Write the implementation**

Crea `src/core/esportazioni.ts`:

```ts
import { calcolaGiornata } from './calcolo';
import { haContenuto } from './giornata';
import { statoLeggibile } from './testi';
import { formattaOra, giornoSettimana, NOMI_GIORNI } from './tempo';
import { ETICHETTE_EVENTO, type Giornata, type Impostazioni, type TipoEvento } from './tipi';

/** Esportazioni del sito web.sbeggio.app: un mese a scelta o tutto, in CSV (csv.ts) o JSON leggibile. */
export const TUTTO = 'tutto';

export interface GiornataJson {
  data: string;
  giorno: string;
  dovutiMinuti: number;
  lavoratiMinuti: number;
  permessoMinuti: number;
  saldoMinuti: number;
  stato: string;
  permessoInizioMinuti: number;
  permessoUscitaMinuti: number;
  luogo: 'sede' | 'smart';
  ferie: boolean;
  eventi: { ora: string; tipo: TipoEvento; etichetta: string }[];
  sigaretteNonConteggiate: { ora: string; durataMinuti: number }[];
}

export interface EsportazioneJson {
  app: 'Sbeggio';
  versioneApp: string;
  /** Data e ora (Europe/Rome) in cui il file è stato generato: 'YYYY-MM-DDTHH:MM'. */
  generato: string;
  /** 'YYYY-MM' oppure 'tutto'. */
  periodo: string;
  giornate: GiornataJson[];
}

/** Mesi ('YYYY-MM') con almeno una giornata con contenuto, dal più recente. */
export function mesiPresenti(giornate: Record<string, Giornata>): string[] {
  const mesi = new Set<string>();
  for (const g of Object.values(giornate)) if (haContenuto(g)) mesi.add(g.data.slice(0, 7));
  return [...mesi].sort().reverse();
}

export function giornateDelMese(giornate: Record<string, Giornata>, mese: string): Record<string, Giornata> {
  return Object.fromEntries(Object.entries(giornate).filter(([, g]) => g.data.startsWith(`${mese}-`)));
}

/**
 * Il mese proposto dal selettore: il corrente se ha giornate, altrimenti il più recente non futuro
 * (le ferie si possono inserire in anticipo), altrimenti il primo.
 */
export function meseIniziale(mesi: readonly string[], oggi: string): string | null {
  const corrente = oggi.slice(0, 7);
  if (mesi.includes(corrente)) return corrente;
  return mesi.find((m) => m < corrente) ?? mesi[0] ?? null;
}

/** JSON con le stesse informazioni del CSV, tipizzate. Non è un backup: non si reimporta nell'app. */
export function esportaJson(
  giornate: Record<string, Giornata>,
  imp: Impostazioni,
  oggi: { data: string; minuti: number },
  periodo: string,
  versioneApp: string,
): string {
  const ordinate = Object.values(giornate)
    .filter(haContenuto)
    .sort((a, b) => a.data.localeCompare(b.data));
  const esportazione: EsportazioneJson = {
    app: 'Sbeggio',
    versioneApp,
    generato: `${oggi.data}T${formattaOra(oggi.minuti)}`,
    periodo,
    giornate: ordinate.map((g): GiornataJson => {
      const r = calcolaGiornata(g, imp, g.data === oggi.data ? oggi.minuti : null);
      return {
        data: g.data,
        giorno: NOMI_GIORNI[giornoSettimana(g.data)]!,
        dovutiMinuti: r.dovuti,
        lavoratiMinuti: r.lavorati,
        permessoMinuti: r.permesso,
        saldoMinuti: r.saldo,
        stato: statoLeggibile(r),
        permessoInizioMinuti: g.permessoInizioMinuti,
        permessoUscitaMinuti: g.permessoUscitaMinuti,
        luogo: g.luogo === 'smart' ? 'smart' : 'sede',
        ferie: g.ferie === true,
        eventi: [...g.eventi]
          .sort((a, b) => a.minuti - b.minuti)
          .map((e) => ({ ora: formattaOra(e.minuti), tipo: e.tipo, etichetta: ETICHETTE_EVENTO[e.tipo] })),
        sigaretteNonConteggiate: (g.sigaretteNonConteggiate ?? []).map((s) => ({ ora: formattaOra(s.minuti), durataMinuti: s.durata })),
      };
    }),
  };
  return JSON.stringify(esportazione, null, 2);
}

export function nomeFile(periodo: string, oggi: string, estensione: 'csv' | 'json'): string {
  return periodo === TUTTO ? `sbeggio-tutto-${oggi}.${estensione}` : `sbeggio-${periodo}.${estensione}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/esportazioni.test.ts && npm run typecheck`
Expected: PASS. Se il test "stato uguale al CSV" fallisce perché lo stato contiene `;` (quindi la cella CSV è
tra virgolette), confronta con `parseCsv` di `src/core/csv.ts` invece di `split(';')`: `parseCsv(csv)` restituisce le righe già divise.

- [ ] **Step 5: Commit**

```bash
git add src/core/esportazioni.ts tests/esportazioni.test.ts
git commit -m "Esportazioni del sito: mesi, filtro per mese e JSON leggibile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Relay, il Durable Object `Collegamento` (`src/collegamento.ts`)

**Files:**
- Create: `src/collegamento.ts`
- Test: `tests/collegamento.test.ts`

**Interfaces:**
- Consumes: `MESSAGGIO_MASSIMO`, `DURATA_COLLEGAMENTO_MS`, `CHIUSURA_SCADUTO`, `PING`, `PONG` da `src/core/collega.ts` (Task 1).
- Produces (Task 4): `export class Collegamento { constructor(stato: StatoDurable); fetch(r: Request): Promise<Response>; alarm(): Promise<void>; webSocketMessage(): void; webSocketClose(ws: WebSocket, codice: number, motivo: string): void }`;
  `export interface StatoDurable`; `export function decidi(r: RichiestaCollegamento, s: StatoCollegamento): Decisione`.

- [ ] **Step 1: Write the failing test**

Crea `tests/collegamento.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { Collegamento, decidi, type StatoDurable } from '../src/collegamento';
import { CHIUSURA_SCADUTO, MESSAGGIO_MASSIMO } from '../src/core/collega';

const get = (websocket = true) => ({ metodo: 'GET', websocket, dimensione: 0 });
const post = (dimensione = 100) => ({ metodo: 'POST', websocket: false, dimensione });
const libero = { browser: false, usato: false };
const rifiuta = (stato: number) => ({ tipo: 'rifiuta', stato });

describe('decidi', () => {
  it('apre il WebSocket del browser solo la prima volta', () => {
    expect(decidi(get(), libero)).toEqual({ tipo: 'apri' });
    expect(decidi(get(), { browser: true, usato: false })).toEqual(rifiuta(409));
    expect(decidi(get(), { browser: false, usato: true })).toEqual(rifiuta(409));
    expect(decidi(get(false), libero)).toEqual(rifiuta(426));
  });

  it('consegna al browser collegato, entro la dimensione massima', () => {
    const collegato = { browser: true, usato: false };
    expect(decidi(post(), collegato)).toEqual({ tipo: 'consegna' });
    expect(decidi(post(MESSAGGIO_MASSIMO), collegato)).toEqual({ tipo: 'consegna' });
    expect(decidi(post(MESSAGGIO_MASSIMO + 1), collegato)).toEqual(rifiuta(413));
  });

  it('rifiuta invii ripetuti o senza browser', () => {
    expect(decidi(post(), { browser: true, usato: true })).toEqual(rifiuta(409));
    expect(decidi(post(), { browser: false, usato: true })).toEqual(rifiuta(409));
    expect(decidi(post(), libero)).toEqual(rifiuta(404));
  });

  it('altri metodi non sono ammessi', () => {
    expect(decidi({ metodo: 'PUT', websocket: false, dimensione: 0 }, libero)).toEqual(rifiuta(405));
  });
});

function statoFinto(conBrowser: boolean) {
  const memoria = new Map<string, unknown>();
  const ws = { send: vi.fn(), close: vi.fn() };
  const prese = conBrowser ? [ws] : [];
  const stato: StatoDurable = {
    storage: {
      get: async <T>(k: string) => memoria.get(k) as T | undefined,
      put: async (k: string, v: unknown) => void memoria.set(k, v),
      setAlarm: vi.fn(async () => {}),
      deleteAll: vi.fn(async () => memoria.clear()),
    },
    acceptWebSocket: vi.fn(),
    getWebSockets: () => prese as unknown as WebSocket[],
    setWebSocketAutoResponse: vi.fn(),
  };
  return { stato, ws, memoria };
}

const invio = (corpo: Uint8Array<ArrayBuffer>) =>
  new Request('https://web.sbeggio.app/collega/x', { method: 'POST', body: corpo });

describe('Durable Object Collegamento', () => {
  it('inoltra il messaggio al browser, chiude e rifiuta altri invii', async () => {
    const f = statoFinto(true);
    const relay = new Collegamento(f.stato);
    const corpo = new Uint8Array([1, 2, 3]);
    const r = await relay.fetch(invio(corpo));
    expect(r.status).toBe(200);
    expect(f.ws.send).toHaveBeenCalledWith(corpo);
    expect(f.ws.close).toHaveBeenCalledWith(1000, 'consegnato');
    expect((await relay.fetch(invio(corpo))).status).toBe(409);
    expect(f.ws.send).toHaveBeenCalledTimes(1);
  });

  it('senza browser risponde 404 e non salva nulla', async () => {
    const f = statoFinto(false);
    const r = await new Collegamento(f.stato).fetch(invio(new Uint8Array([1])));
    expect(r.status).toBe(404);
    expect(f.memoria.size).toBe(0);
  });

  it('allo scadere chiude il browser con 4000 e dimentica tutto', async () => {
    const f = statoFinto(true);
    f.memoria.set('usato', true);
    await new Collegamento(f.stato).alarm();
    expect(f.ws.close).toHaveBeenCalledWith(CHIUSURA_SCADUTO, 'scaduto');
    expect(f.memoria.size).toBe(0);
  });

  it('la chiusura dal browser non lancia anche con codici riservati', () => {
    const f = statoFinto(false);
    const ws = {
      close: vi.fn(() => {
        throw new Error('codice non valido');
      }),
    };
    expect(() => new Collegamento(f.stato).webSocketClose(ws as unknown as WebSocket, 1006, '')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collegamento.test.ts`
Expected: FAIL, modulo `../src/collegamento` non trovato.

- [ ] **Step 3: Write the implementation**

Crea `src/collegamento.ts`:

```ts
import { CHIUSURA_SCADUTO, DURATA_COLLEGAMENTO_MS, MESSAGGIO_MASSIMO, PING, PONG } from './core/collega';

/**
 * Relay di web.sbeggio.app: un Durable Object per collegamento (id del QR). Tiene il WebSocket del
 * browser (Hibernation API) e gli inoltra una sola volta il messaggio cifrato mandato dall'app.
 * Non salva mai il messaggio: nello storage c'è solo il flag "usato", cancellato allo scadere.
 */

export interface StatoCollegamento {
  /** C'è un browser in attesa sul WebSocket. */
  browser: boolean;
  /** Un messaggio è già stato consegnato. */
  usato: boolean;
}

export interface RichiestaCollegamento {
  metodo: string;
  websocket: boolean;
  /** Byte del corpo (POST). */
  dimensione: number;
}

export type Decisione = { tipo: 'apri' } | { tipo: 'consegna' } | { tipo: 'rifiuta'; stato: number };

export function decidi(r: RichiestaCollegamento, s: StatoCollegamento): Decisione {
  if (r.metodo === 'GET') {
    if (!r.websocket) return { tipo: 'rifiuta', stato: 426 };
    return s.browser || s.usato ? { tipo: 'rifiuta', stato: 409 } : { tipo: 'apri' };
  }
  if (r.metodo === 'POST') {
    if (s.usato) return { tipo: 'rifiuta', stato: 409 };
    if (!s.browser) return { tipo: 'rifiuta', stato: 404 };
    if (r.dimensione > MESSAGGIO_MASSIMO) return { tipo: 'rifiuta', stato: 413 };
    return { tipo: 'consegna' };
  }
  return { tipo: 'rifiuta', stato: 405 };
}

/** Le parti dello stato di un Durable Object che usiamo (niente @cloudflare/workers-types). */
export interface StatoDurable {
  storage: {
    get<T>(chiave: string): Promise<T | undefined>;
    put(chiave: string, valore: unknown): Promise<void>;
    setAlarm(istante: number): Promise<void>;
    deleteAll(): Promise<void>;
  };
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(): WebSocket[];
  setWebSocketAutoResponse(coppia: unknown): void;
}

declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };
declare const WebSocketRequestResponsePair: { new (richiesta: string, risposta: string): unknown };

const USATO = 'usato';

export class Collegamento {
  constructor(private readonly stato: StatoDurable) {}

  async fetch(richiesta: Request): Promise<Response> {
    const corpo = richiesta.method === 'POST' ? new Uint8Array(await richiesta.arrayBuffer()) : null;
    const browser = this.stato.getWebSockets()[0];
    const decisione = decidi(
      {
        metodo: richiesta.method,
        websocket: richiesta.headers.get('Upgrade')?.toLowerCase() === 'websocket',
        dimensione: corpo?.byteLength ?? 0,
      },
      { browser: browser !== undefined, usato: (await this.stato.storage.get<boolean>(USATO)) === true },
    );
    switch (decisione.tipo) {
      case 'rifiuta':
        return new Response(null, { status: decisione.stato });
      case 'apri': {
        const coppia = new WebSocketPair();
        this.stato.acceptWebSocket(coppia[1]);
        // Il ping del sito riceve "pong" senza svegliare l'oggetto.
        this.stato.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
        await this.stato.storage.setAlarm(Date.now() + DURATA_COLLEGAMENTO_MS);
        return new Response(null, { status: 101, webSocket: coppia[0] } as ResponseInit);
      }
      case 'consegna':
        browser!.send(corpo!);
        await this.stato.storage.put(USATO, true);
        browser!.close(1000, 'consegnato');
        return new Response(null, { status: 200 });
    }
  }

  async alarm(): Promise<void> {
    for (const ws of this.stato.getWebSockets()) ws.close(CHIUSURA_SCADUTO, 'scaduto');
    await this.stato.storage.deleteAll();
  }

  /** Dal browser arrivano solo i ping, a cui risponde la risposta automatica. */
  webSocketMessage(): void {}

  webSocketClose(ws: WebSocket, codice: number, motivo: string): void {
    try {
      ws.close(codice, motivo);
    } catch {
      // già chiuso, o codice riservato (1005/1006) che non si può rimandare
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/collegamento.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collegamento.ts tests/collegamento.test.ts
git commit -m "Relay di web.sbeggio.app: Durable Object Collegamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Worker e `wrangler.jsonc`

**Files:**
- Modify: `src/worker.ts` (riscrittura completa, 21 righe oggi)
- Modify: `wrangler.jsonc`
- Test: `tests/worker.test.ts` (riscrittura completa; i due test esistenti restano, adattati a `envFinto`)

**Interfaces:**
- Consumes: `ID_VALIDO` (Task 1), `Collegamento` (Task 3).
- Produces: `default.fetch(richiesta: Request, env: Env): Promise<Response>`; export `Collegamento` (richiesto da wrangler per `class_name`).

- [ ] **Step 1: Write the failing test**

Sostituisci `tests/worker.test.ts` con:

```ts
import { describe, expect, it, vi } from 'vitest';
import worker from '../src/worker';

const ID = 'AAAAAAAAAAAAAAAAAAAAAA';

function envFinto() {
  const fetch = vi.fn(async (_r: Request) => new Response('asset'));
  const relay = vi.fn(async (_r: Request) => new Response('relay', { status: 404 }));
  const idFromName = vi.fn((nome: string) => `id:${nome}`);
  const get = vi.fn((_id: unknown) => ({ fetch: relay }));
  return { env: { ASSETS: { fetch }, COLLEGAMENTI: { idFromName, get } }, fetch, relay, idFromName, get };
}

describe('worker di sbeggio.app', () => {
  it('www.sbeggio.app rimanda a sbeggio.app con 301, tenendo percorso e query', async () => {
    const { env, fetch } = envFinto();
    const r = await worker.fetch(new Request('http://www.sbeggio.app/prova?x=1'), env);
    expect(r.status).toBe(301);
    expect(r.headers.get('Location')).toBe('https://sbeggio.app/prova?x=1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['/', '/assets/index-abc.js', '/qualunque/percorso', `/collega/${ID}`])(
    'sbeggio.app%s serve i file statici della PWA, come prima',
    async (percorso) => {
      const { env, fetch, relay } = envFinto();
      const richiesta = new Request(`https://sbeggio.app${percorso}`);
      const r = await worker.fetch(richiesta, env);
      expect(await r.text()).toBe('asset');
      expect(fetch).toHaveBeenCalledWith(richiesta);
      expect(relay).not.toHaveBeenCalled();
    },
  );
});

describe('worker di web.sbeggio.app', () => {
  it.each(['/', '/index.html', '/altro'])('%s serve la pagina del sito', async (percorso) => {
    const { env, fetch } = envFinto();
    await worker.fetch(new Request(`https://web.sbeggio.app${percorso}`), env);
    // Workers Assets serve web.html all'indirizzo /web (/web.html farebbe un redirect).
    expect(fetch.mock.calls[0]![0].url).toBe('https://web.sbeggio.app/web');
  });

  it.each(['/assets/web-abc.js', '/favicon.svg'])('%s resta quello richiesto', async (percorso) => {
    const { env, fetch } = envFinto();
    const richiesta = new Request(`https://web.sbeggio.app${percorso}`);
    await worker.fetch(richiesta, env);
    expect(fetch).toHaveBeenCalledWith(richiesta);
  });

  it('un id non valido risponde 400 senza svegliare il relay', async () => {
    const { env, relay } = envFinto();
    const r = await worker.fetch(new Request('https://web.sbeggio.app/collega/corto', { method: 'POST' }), env);
    expect(r.status).toBe(400);
    expect(relay).not.toHaveBeenCalled();
  });

  it('preflight CORS solo per le origini dell\'app', async () => {
    const { env, relay } = envFinto();
    const preflight = (origine: string) =>
      worker.fetch(new Request(`https://web.sbeggio.app/collega/${ID}`, { method: 'OPTIONS', headers: { Origin: origine } }), env);
    const ok = await preflight('https://sbeggio.app');
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://sbeggio.app');
    expect(ok.headers.get('Access-Control-Allow-Methods')).toBe('POST');
    expect((await preflight('https://localhost')).headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
    expect((await preflight('https://evil.example')).headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(relay).not.toHaveBeenCalled();
  });

  it('passa la richiesta al Durable Object dell\'id e aggiunge il CORS', async () => {
    const { env, relay, idFromName, get } = envFinto();
    const r = await worker.fetch(
      new Request(`https://web.sbeggio.app/collega/${ID}`, { method: 'POST', headers: { Origin: 'https://localhost' }, body: 'x' }),
      env,
    );
    expect(idFromName).toHaveBeenCalledWith(ID);
    expect(get).toHaveBeenCalledWith(`id:${ID}`);
    expect(relay).toHaveBeenCalledOnce();
    expect(r.status).toBe(404);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
  });

  it('in locale (wrangler dev) il relay risponde anche su localhost', async () => {
    const { env, relay } = envFinto();
    await worker.fetch(new Request(`http://localhost:8787/collega/${ID}`, { method: 'POST', body: 'x' }), env);
    expect(relay).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worker.test.ts`
Expected: FAIL (i test di `web.sbeggio.app` e `/collega/` ricevono `asset`); i test di `sbeggio.app` passano già.

- [ ] **Step 3: Write the implementation**

Sostituisci `src/worker.ts` con:

```ts
import { ID_VALIDO } from './core/collega';

export { Collegamento } from './collegamento';

/**
 * Worker Cloudflare davanti ai file statici (wrangler.jsonc):
 * - www.sbeggio.app rimanda alla radice di sbeggio.app, tenendo percorso e query;
 * - sbeggio.app serve la PWA;
 * - web.sbeggio.app serve il sito per scaricare le timbrature (web.html) e il relay /collega/<id>,
 *   un Durable Object per collegamento (src/collegamento.ts). In locale il relay risponde anche su localhost.
 */
interface Env {
  ASSETS: { fetch(richiesta: Request): Promise<Response> };
  COLLEGAMENTI: {
    idFromName(nome: string): unknown;
    get(id: unknown): { fetch(richiesta: Request): Promise<Response> };
  };
}

const DOMINIO = 'sbeggio.app';
const SITO = `web.${DOMINIO}`;
/** PWA, app Android (Capacitor) e server di sviluppo di Vite. */
const ORIGINI_CORS = ['https://sbeggio.app', 'https://localhost', 'http://localhost:5173'];
const PREFISSO_COLLEGA = '/collega/';

function intestazioniCors(origine: string | null): Headers {
  const h = new Headers({ Vary: 'Origin' });
  if (origine && ORIGINI_CORS.includes(origine)) h.set('Access-Control-Allow-Origin', origine);
  return h;
}

async function collega(richiesta: Request, env: Env, url: URL): Promise<Response> {
  const id = url.pathname.slice(PREFISSO_COLLEGA.length);
  const cors = intestazioniCors(richiesta.headers.get('Origin'));
  if (!ID_VALIDO.test(id)) return new Response('Collegamento non valido', { status: 400, headers: cors });
  if (richiesta.method === 'OPTIONS') {
    cors.set('Access-Control-Allow-Methods', 'POST');
    cors.set('Access-Control-Allow-Headers', 'Content-Type');
    cors.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers: cors });
  }
  const risposta = await env.COLLEGAMENTI.get(env.COLLEGAMENTI.idFromName(id)).fetch(richiesta);
  // Il 101 del WebSocket va restituito così com'è (porta con sé il socket).
  if (risposta.status === 101) return risposta;
  const intestazioni = new Headers(risposta.headers);
  cors.forEach((valore, nome) => intestazioni.set(nome, valore));
  return new Response(risposta.body, { status: risposta.status, headers: intestazioni });
}

/** I chunk in /assets/ e l'icona restano quelli richiesti; ogni altro percorso è la pagina del sito. */
function richiestaSito(richiesta: Request, url: URL): Request {
  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.svg') return richiesta;
  // Workers Assets (html_handling predefinito) serve web.html all'indirizzo /web.
  return new Request(new URL('/web', url), richiesta);
}

export default {
  async fetch(richiesta: Request, env: Env): Promise<Response> {
    const url = new URL(richiesta.url);
    if (url.hostname === `www.${DOMINIO}`) {
      url.protocol = 'https:';
      url.hostname = DOMINIO;
      return Response.redirect(url.toString(), 301);
    }
    const locale = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if ((url.hostname === SITO || locale) && url.pathname.startsWith(PREFISSO_COLLEGA)) return collega(richiesta, env, url);
    if (url.hostname === SITO) return env.ASSETS.fetch(richiestaSito(richiesta, url));
    return env.ASSETS.fetch(richiesta);
  },
};
```

In `wrangler.jsonc`: aggiorna il commento iniziale e aggiungi route, binding e migrazione. Il file diventa:

```jsonc
{
  "$schema": "https://unpkg.com/wrangler@4/config-schema.json",
  // La PWA (la build in dist/) servita su https://sbeggio.app e il sito per scaricare le timbrature su
  // https://web.sbeggio.app (web.html). Il Worker (src/worker.ts) passa prima di ogni richiesta: rimanda
  // www.sbeggio.app alla radice, sceglie la pagina in base al dominio e su web.sbeggio.app/collega/<id>
  // fa da relay con il Durable Object Collegamento (src/collegamento.ts).
  // Deploy: .github/workflows/deploy.yml a ogni push su main, o `npm run build && npx wrangler deploy`.
  "name": "sbeggio",
  "account_id": "f6a7b31800dc221db5b5ee4b88e967f8",
  "main": "src/worker.ts",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": true
  },
  "durable_objects": {
    "bindings": [{ "name": "COLLEGAMENTI", "class_name": "Collegamento" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Collegamento"] }],
  "routes": [
    { "pattern": "sbeggio.app", "custom_domain": true },
    { "pattern": "www.sbeggio.app", "custom_domain": true },
    { "pattern": "web.sbeggio.app", "custom_domain": true }
  ],
  "workers_dev": false,
  "preview_urls": false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worker.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Controlla che wrangler accetti la configurazione e il bundle**

Run: `npm run build && npx wrangler@4.147.0 deploy --dry-run --outdir C:/Users/Utente/AppData/Local/Temp/claude/C--Progetti-sbeggio/0a2de863-cd3d-4db5-b202-3544f0d9ebf9/scratchpad/wrangler-dry`
Expected: "--dry-run: exiting now." senza errori; nell'elenco dei binding compare `env.COLLEGAMENTI (Collegamento)` (Durable Object).
(Il `--dry-run` non pubblica nulla.)

- [ ] **Step 6: Commit**

```bash
git add src/worker.ts wrangler.jsonc tests/worker.test.ts
git commit -m "Worker: web.sbeggio.app con il sito e il relay /collega

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sessione del sito (`src/sito/sessione.ts`)

**Files:**
- Create: `src/sito/sessione.ts`
- Test: `tests/sitoSessione.test.ts`

**Interfaces:**
- Consumes: `creaCollegamento`, `decifra`, `DURATA_COLLEGAMENTO_MS`, `CHIUSURA_SCADUTO`, `PING`, `INTERVALLO_PING_MS`, `type Collegamento` (Task 1);
  `migra`, `VERSIONE_CORRENTE`, `type DatiSalvati` (`src/storage/migrazioni.ts`).
- Produces (Task 6):
  - `type StatoSito = { tipo: 'attesa'; collegamento: Collegamento; scadenza: number } | { tipo: 'collegato'; dati: DatiSalvati; ricevuti: number } | { tipo: 'errore'; motivo: 'connessione' | 'illeggibili' | 'versione' }`;
  - `interface Presa { binaryType: BinaryType; onmessage: ((ev: MessageEvent) => void) | null; onclose: ((ev: CloseEvent) => void) | null; send(dati: string): void; close(): void }`;
  - `avviaSessione(origine: string, apri: (url: string) => Presa, alCambio: (s: StatoSito) => void): { nuovo(): void }`.

- [ ] **Step 1: Write the failing test**

Crea `tests/sitoSessione.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cifra, creaCollegamento, DURATA_COLLEGAMENTO_MS, INTERVALLO_PING_MS, type Collegamento } from '../src/core/collega';
import { datiVuoti } from '../src/storage/migrazioni';
import { avviaSessione, type Presa, type StatoSito } from '../src/sito/sessione';

interface PresaFinta extends Presa {
  url: string;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function prova(origine = 'https://web.sbeggio.app') {
  const prese: PresaFinta[] = [];
  const stati: StatoSito[] = [];
  const sessione = avviaSessione(
    origine,
    (url) => {
      const p: PresaFinta = { url, binaryType: 'blob', onmessage: null, onclose: null, send: vi.fn(), close: vi.fn() };
      prese.push(p);
      return p;
    },
    (s) => stati.push(s),
  );
  const ultima = () => prese[prese.length - 1]!;
  const stato = () => stati[stati.length - 1]!;
  const collegamento = () => (stato() as Extract<StatoSito, { tipo: 'attesa' }>).collegamento;
  const ricevi = async (dati: unknown, c: Collegamento = collegamento()) => {
    const p = ultima();
    p.onmessage?.({ data: (await cifra(dati, c)).buffer } as MessageEvent);
  };
  /** Attende la decifratura (asincrona) del messaggio ricevuto. */
  const finché = (tipo: StatoSito['tipo']) => vi.waitFor(() => expect(stato().tipo).toBe(tipo));
  return { sessione, prese, stati, ultima, stato, collegamento, ricevi, finché };
}

beforeEach(() => {
  // Solo i timer della sessione: i flussi di compressione di Node devono restare veri.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date('2026-10-13T07:42:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('sessione del sito', () => {
  it('apre il WebSocket del collegamento e mostra il QR con la scadenza', () => {
    const t = prova();
    expect(t.prese).toHaveLength(1);
    expect(t.ultima().binaryType).toBe('arraybuffer');
    const s = t.stato();
    expect(s.tipo).toBe('attesa');
    if (s.tipo !== 'attesa') return;
    expect(t.ultima().url).toBe(`wss://web.sbeggio.app/collega/${s.collegamento.id}`);
    expect(s.scadenza).toBe(Date.now() + DURATA_COLLEGAMENTO_MS);
  });

  it('in locale usa ws://', () => {
    const t = prova('http://localhost:8787');
    expect(t.ultima().url).toMatch(/^ws:\/\/localhost:8787\/collega\//);
  });

  it('riceve, decifra e migra i dati, poi chiude il WebSocket', async () => {
    const t = prova();
    const dati = datiVuoti();
    await t.ricevi(dati);
    await t.finché('collegato');
    const s = t.stato();
    expect(s.tipo === 'collegato' && s.dati).toEqual(dati);
    expect(t.ultima().close).toHaveBeenCalled();
    // Dopo la ricezione la scadenza non genera un nuovo QR.
    vi.advanceTimersByTime(DURATA_COLLEGAMENTO_MS * 2);
    expect(t.prese).toHaveLength(1);
  });

  it('dati cifrati con un\'altra chiave o non validi: errore "illeggibili"', async () => {
    const a = prova();
    await a.ricevi(datiVuoti(), creaCollegamento());
    await a.finché('errore');
    expect(a.stato()).toEqual({ tipo: 'errore', motivo: 'illeggibili' });

    const b = prova();
    await b.ricevi('ciao');
    await b.finché('errore');
    expect(b.stato()).toEqual({ tipo: 'errore', motivo: 'illeggibili' });
  });

  it('dati di un\'app più nuova: errore "versione"', async () => {
    const t = prova();
    await t.ricevi({ ...datiVuoti(), version: 99 });
    await t.finché('errore');
    expect(t.stato()).toEqual({ tipo: 'errore', motivo: 'versione' });
  });

  it('chiusura 4000 dal relay (scaduto): nuovo QR', () => {
    const t = prova();
    const primo = t.collegamento();
    t.ultima().onclose?.({ code: 4000 } as CloseEvent);
    expect(t.prese).toHaveLength(2);
    expect(t.collegamento().id).not.toBe(primo.id);
  });

  it('connessione persa: errore e niente più timer', () => {
    const t = prova();
    t.ultima().onclose?.({ code: 1006 } as CloseEvent);
    expect(t.stato()).toEqual({ tipo: 'errore', motivo: 'connessione' });
    vi.advanceTimersByTime(DURATA_COLLEGAMENTO_MS * 2);
    expect(t.prese).toHaveLength(1);
    expect(t.ultima().send).not.toHaveBeenCalled();
  });

  it('allo scadere genera da sola un nuovo QR e chiude il vecchio WebSocket', () => {
    const t = prova();
    const vecchia = t.ultima();
    vi.advanceTimersByTime(DURATA_COLLEGAMENTO_MS);
    expect(t.prese).toHaveLength(2);
    expect(vecchia.close).toHaveBeenCalled();
    // La chiusura del vecchio WebSocket non deve arrivare alla sessione come "connessione persa".
    expect(vecchia.onclose).toBeNull();
  });

  it('manda un ping ogni 25 secondi, contro i proxy che chiudono le connessioni ferme', () => {
    const t = prova();
    vi.advanceTimersByTime(INTERVALLO_PING_MS * 3);
    expect(t.ultima().send).toHaveBeenCalledTimes(3);
    expect(t.ultima().send).toHaveBeenCalledWith('ping');
  });

  it('un ping su un WebSocket non ancora aperto non rompe la sessione', () => {
    const t = prova();
    t.ultima().send.mockImplementation(() => {
      throw new DOMException('x', 'InvalidStateError');
    });
    expect(() => vi.advanceTimersByTime(INTERVALLO_PING_MS)).not.toThrow();
  });

  it('nuovo() (Scollega, Riprova) torna in attesa con un altro QR', async () => {
    const t = prova();
    await t.ricevi(datiVuoti());
    await t.finché('collegato');
    t.sessione.nuovo();
    expect(t.stato().tipo).toBe('attesa');
    expect(t.prese).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sitoSessione.test.ts`
Expected: FAIL, modulo `../src/sito/sessione` non trovato.

- [ ] **Step 3: Write the implementation**

Crea `src/sito/sessione.ts`:

```ts
import {
  CHIUSURA_SCADUTO,
  creaCollegamento,
  decifra,
  DURATA_COLLEGAMENTO_MS,
  INTERVALLO_PING_MS,
  PING,
  type Collegamento,
} from '../core/collega';
import { migra, VERSIONE_CORRENTE, type DatiSalvati } from '../storage/migrazioni';

/**
 * Ciclo di vita del collegamento nella pagina web.sbeggio.app: un QR (id + chiave) per volta, il
 * WebSocket verso il relay, la scadenza dopo 5 minuti, il ping contro i proxy e la ricezione dei dati.
 */
export type StatoSito =
  | { tipo: 'attesa'; collegamento: Collegamento; scadenza: number }
  | { tipo: 'collegato'; dati: DatiSalvati; ricevuti: number }
  | { tipo: 'errore'; motivo: 'connessione' | 'illeggibili' | 'versione' };

/** La parte di WebSocket che usiamo (nei test una presa finta). */
export interface Presa {
  binaryType: BinaryType;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  send(dati: string): void;
  close(): void;
}

export function avviaSessione(
  origine: string,
  apri: (url: string) => Presa,
  alCambio: (s: StatoSito) => void,
): { nuovo(): void } {
  let presa: Presa | null = null;
  let scadenza: ReturnType<typeof setTimeout> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  /** Ferma timer e WebSocket correnti, senza che la loro chiusura arrivi alla sessione. */
  const ferma = () => {
    clearTimeout(scadenza);
    clearInterval(ping);
    if (presa) {
      presa.onmessage = null;
      presa.onclose = null;
      presa.close();
      presa = null;
    }
  };

  const ricevi = async (c: Collegamento, messaggio: ArrayBuffer) => {
    let grezzo: unknown;
    try {
      grezzo = await decifra(messaggio, c);
    } catch {
      return alCambio({ tipo: 'errore', motivo: 'illeggibili' });
    }
    const versione = (grezzo as { version?: unknown } | null)?.version;
    if (typeof versione === 'number' && versione > VERSIONE_CORRENTE) {
      return alCambio({ tipo: 'errore', motivo: 'versione' });
    }
    try {
      alCambio({ tipo: 'collegato', dati: migra(grezzo), ricevuti: Date.now() });
    } catch {
      alCambio({ tipo: 'errore', motivo: 'illeggibili' });
    }
  };

  const nuovo = () => {
    ferma();
    const c = creaCollegamento(origine);
    const p = apri(`${origine.replace(/^http/, 'ws')}/collega/${c.id}`);
    presa = p;
    p.binaryType = 'arraybuffer';
    p.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return; // "pong"
      ferma();
      void ricevi(c, ev.data);
    };
    p.onclose = (ev) => {
      if (ev.code === CHIUSURA_SCADUTO) return nuovo();
      ferma();
      alCambio({ tipo: 'errore', motivo: 'connessione' });
    };
    scadenza = setTimeout(nuovo, DURATA_COLLEGAMENTO_MS);
    ping = setInterval(() => {
      try {
        p.send(PING);
      } catch {
        // WebSocket non ancora aperto: il prossimo ping riprova
      }
    }, INTERVALLO_PING_MS);
    alCambio({ tipo: 'attesa', collegamento: c, scadenza: Date.now() + DURATA_COLLEGAMENTO_MS });
  };

  nuovo();
  return { nuovo };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sitoSessione.test.ts && npm run typecheck`
Expected: PASS. Nota: nel test "riceve…" `cifra(...).buffer` è un `ArrayBuffer` di Node; se `instanceof ArrayBuffer`
fallisse per un realm diverso, usa nel test `new Uint8Array(m).buffer` (non cambiare il controllo nel codice).

- [ ] **Step 5: Commit**

```bash
git add src/sito/sessione.ts tests/sitoSessione.test.ts
git commit -m "Sito: sessione del collegamento con scadenza, ping e ricezione

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: La pagina `web.sbeggio.app` e la build multi-pagina

**Files:**
- Create: `web.html`, `src/sito/main.ts`, `src/sito/sito.css`, `src/ui/scarica.ts`
- Create: `tests/collegamento.e2e.test.ts` (saltato senza variabili d'ambiente)
- Modify: `src/ui/dati.ts:14-42` (il download passa da `scaricaFile`)
- Modify: `vite.config.ts`
- Modify: `package.json`, `package-lock.json` (dipendenza `qrcode-generator`)

**Interfaces:**
- Consumes: Task 1 (`leggiFragment`, `urlQr`, `leggiQr`, `inviaCollegamento`, `creaCollegamento`, `decifra`, `PONG`, `PING`),
  Task 2 (`esportaJson`, `giornateDelMese`, `meseIniziale`, `mesiPresenti`, `nomeFile`, `TUTTO`), Task 5 (`avviaSessione`, `StatoSito`);
  `esportaCsv` (`src/core/csv.ts`), `adessoRoma`, `formattaOra`, `nomeMese` (`src/core/tempo.ts`), `haContenuto`, `el`/`monta` (`src/ui/dom.ts`).
- Produces: `scaricaFile(nome: string, contenuto: string, tipo: string): void` in `src/ui/scarica.ts`.

- [ ] **Step 1: Installa il generatore di QR**

Run: `npm install qrcode-generator@2.0.4`
Expected: `package.json` → `"dependencies"` contiene `"qrcode-generator": "^2.0.4"`.

- [ ] **Step 2: Estrai il download in `src/ui/scarica.ts`**

Crea `src/ui/scarica.ts`:

```ts
/** Scarica un file con un link temporaneo (browser e PWA; nell'app Android serve il plugin nativo). */
export function scaricaFile(nome: string, contenuto: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```

In `src/ui/dati.ts` aggiungi `import { scaricaFile } from './scarica';` e sostituisci le ultime righe di
`condividiFile` (da `const url = URL.createObjectURL(blob);` a `setTimeout(() => URL.revokeObjectURL(url), 10_000);`) con:

```ts
  scaricaFile(nome, contenuto, tipo);
```

Run: `npx vitest run && npm run typecheck`
Expected: PASS (nessun comportamento cambiato).

- [ ] **Step 3: Crea `web.html`** (nella radice, accanto a `index.html`)

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sbeggio sul computer</title>
    <meta name="description" content="Scarica sul computer le timbrature registrate con Sbeggio." />
    <meta name="color-scheme" content="light dark" />
    <script>
      // Stesso tema dell'app (variabili in src/style.css), qui solo dal sistema: il sito non ha impostazioni.
      document.documentElement.setAttribute('data-tema', matchMedia('(prefers-color-scheme: dark)').matches ? 'scuro' : 'chiaro');
    </script>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <main id="sito" class="sito"></main>
    <noscript>Per usare Sbeggio sul computer attiva JavaScript.</noscript>
    <script type="module" src="/src/sito/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Crea `src/sito/sito.css`**

```css
/* Pagina web.sbeggio.app: si appoggia alle variabili e ai componenti di src/style.css. */
.sito {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}
.sito h1 {
  margin: 8px 4px 4px;
  font-size: 28px;
  letter-spacing: -0.02em;
}
.sito > .nota {
  margin: 0 4px 12px;
}
.sito-attesa {
  text-align: center;
}
/* Sempre bianco, anche col tema scuro: il contrasto serve alla fotocamera. */
.sito-qr {
  width: min(320px, 100%);
  margin: 8px auto 16px;
  padding: 12px;
  border-radius: 12px;
  background: #ffffff;
}
.sito-qr svg {
  display: block;
  width: 100%;
  height: auto;
}
.sito-passi {
  max-width: 320px;
  margin: 0 auto 8px;
  padding-left: 20px;
  text-align: left;
}
.sito-mese {
  width: 100%;
  min-height: 48px;
  margin-top: 4px;
  padding: 0 12px;
  border: 1px solid var(--bordo);
  border-radius: 12px;
  background: var(--superficie);
}
```

- [ ] **Step 5: Crea `src/sito/main.ts`**

```ts
import '../style.css';
import './sito.css';
import qrcode from 'qrcode-generator';
import { leggiFragment, urlQr, type Collegamento } from '../core/collega';
import { esportaCsv } from '../core/csv';
import { esportaJson, giornateDelMese, meseIniziale, mesiPresenti, nomeFile, TUTTO } from '../core/esportazioni';
import { haContenuto } from '../core/giornata';
import { adessoRoma, formattaOra, nomeMese } from '../core/tempo';
import type { DatiSalvati } from '../storage/migrazioni';
import { el, monta } from '../ui/dom';
import { scaricaFile } from '../ui/scarica';
import { avviaSessione, type StatoSito } from './sessione';

/** Pagina web.sbeggio.app: QR da inquadrare con l'app, poi i download. I dati stanno solo in memoria. */
const radice = document.getElementById('sito')!;
let orologio: ReturnType<typeof setInterval> | undefined;
let sessione: { nuovo(): void } | undefined;

const titolo = () => el('h1', {}, 'Sbeggio sul computer');

function qr(testo: string): HTMLElement {
  const codice = qrcode(0, 'M');
  codice.addData(testo);
  codice.make();
  // data-url: lo legge la prova end-to-end (tests/collegamento.e2e.test.ts); la chiave è già nel QR.
  const box = el('div', { class: 'sito-qr', role: 'img', 'aria-label': 'Codice QR da inquadrare con l\'app Sbeggio', 'data-url': testo });
  box.innerHTML = codice.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  return box;
}

function vistaAttesa(c: Collegamento, scadenza: number): Node[] {
  const conto = el('p', { class: 'nota' });
  const aggiorna = () => {
    const s = Math.max(0, Math.ceil((scadenza - Date.now()) / 1000));
    conto.textContent = `Nuovo codice tra ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  aggiorna();
  orologio = setInterval(aggiorna, 1000);
  return [
    titolo(),
    el('p', { class: 'nota' }, 'Scarica le timbrature in CSV o JSON, del mese o tutte.'),
    el(
      'div',
      { class: 'scheda sito-attesa' },
      qr(urlQr(c)),
      el(
        'ol',
        { class: 'sito-passi' },
        el('li', {}, 'Apri Sbeggio sul telefono'),
        el('li', {}, 'Vai in Impostazioni → Collega al computer'),
        el('li', {}, 'Inquadra questo codice'),
      ),
      conto,
    ),
    el('p', { class: 'nota' }, 'Le timbrature arrivano cifrate e restano solo in questa scheda: chiudendola spariscono.'),
  ];
}

function scarica(dati: DatiSalvati, periodo: string, formato: 'csv' | 'json'): void {
  const ora = adessoRoma();
  const giornate = periodo === TUTTO ? dati.giornate : giornateDelMese(dati.giornate, periodo);
  const nome = nomeFile(periodo, ora.data, formato);
  if (formato === 'csv') scaricaFile(nome, esportaCsv(giornate, dati.impostazioni, ora), 'text/csv');
  else scaricaFile(nome, esportaJson(giornate, dati.impostazioni, ora, periodo, __VERSIONE_APP__), 'application/json');
}

function pulsanti(azione: (formato: 'csv' | 'json') => void): HTMLElement {
  return el(
    'div',
    { class: 'riga-pulsanti' },
    el('button', { type: 'button', class: 'btn btn-primario', onclick: () => azione('csv') }, 'CSV (Excel)'),
    el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => azione('json') }, 'JSON'),
  );
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function vistaCollegato(dati: DatiSalvati, ricevuti: number): Node[] {
  const n = Object.values(dati.giornate).filter(haContenuto).length;
  const quando = formattaOra(adessoRoma(new Date(ricevuti)).minuti);
  const scollega = el('button', { type: 'button', class: 'btn btn-neutro', onclick: () => sessione?.nuovo() }, 'Scollega');
  const intestazione = [
    titolo(),
    el('p', { class: 'nota' }, `Ricevute ${n} ${n === 1 ? 'giornata' : 'giornate'} alle ${quando}`),
  ];
  const mesi = mesiPresenti(dati.giornate);
  const iniziale = meseIniziale(mesi, adessoRoma().data);
  if (iniziale === null) {
    return [...intestazione, el('div', { class: 'scheda' }, el('p', {}, 'Non ci sono ancora giornate registrate.'), el('div', { class: 'pila-pulsanti' }, scollega))];
  }
  const selettore = el(
    'select',
    { class: 'sito-mese', 'aria-label': 'Mese' },
    mesi.map((m) => el('option', { value: m }, maiuscola(nomeMese(m)))),
  );
  selettore.value = iniziale;
  return [
    ...intestazione,
    el('div', { class: 'scheda' }, el('h2', { class: 'titolo-sezione' }, 'Mese'), selettore, pulsanti((f) => scarica(dati, selettore.value, f))),
    el('div', { class: 'scheda' }, el('h2', { class: 'titolo-sezione' }, 'Tutto'), pulsanti((f) => scarica(dati, TUTTO, f))),
    el('div', { class: 'pila-pulsanti' }, scollega),
  ];
}

function vistaErrore(motivo: 'connessione' | 'illeggibili' | 'versione'): Node[] {
  const testo = {
    connessione: 'Connessione persa',
    illeggibili: 'Dati ricevuti non leggibili',
    versione: 'Ricarica la pagina: l\'app è più aggiornata del sito',
  }[motivo];
  const azione =
    motivo === 'versione'
      ? el('button', { type: 'button', class: 'btn btn-primario', onclick: () => location.reload() }, 'Ricarica la pagina')
      : el('button', { type: 'button', class: 'btn btn-primario', onclick: () => sessione?.nuovo() }, 'Riprova');
  return [titolo(), el('div', { class: 'scheda' }, el('p', {}, testo), el('div', { class: 'pila-pulsanti' }, azione))];
}

function mostra(s: StatoSito): void {
  clearInterval(orologio);
  const viste = {
    attesa: () => (s.tipo === 'attesa' ? vistaAttesa(s.collegamento, s.scadenza) : []),
    collegato: () => (s.tipo === 'collegato' ? vistaCollegato(s.dati, s.ricevuti) : []),
    errore: () => (s.tipo === 'errore' ? vistaErrore(s.motivo) : []),
  };
  monta(radice, ...viste[s.tipo]());
}

if (leggiFragment(location.hash)) {
  // Il QR inquadrato con la fotocamera del telefono apre questa pagina: va usata l'app.
  monta(
    radice,
    titolo(),
    el('div', { class: 'scheda' }, el('p', {}, 'Questo codice va inquadrato dall\'app Sbeggio: Impostazioni → Collega al computer.')),
  );
} else {
  sessione = avviaSessione(location.origin, (url) => new WebSocket(url), mostra);
}
```

- [ ] **Step 6: Vite multi-pagina, precache senza il sito, niente manifest in `web.html`**

In `vite.config.ts`:

1. Aggiungi `import type { Plugin } from 'vite';` in cima.
2. Prima di `export default`, aggiungi:

```ts
/**
 * vite-plugin-pwa inserisce il link al manifest in ogni pagina: web.sbeggio.app non è un'app
 * installabile, quindi da web.html lo togliamo (gira dopo il plugin, che è anch'esso "post").
 */
function sitoSenzaManifest(): Plugin {
  return {
    name: 'sito-senza-manifest',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => (ctx.path === '/web.html' ? html.replace(/<link rel="manifest"[^>]*>\s*/, '') : html),
    },
  };
}
```

3. Nell'oggetto restituito aggiungi, accanto a `define`:

```ts
    build: {
      rollupOptions: {
        // web.html è il sito web.sbeggio.app; l'app Android non lo include.
        input: android ? { index: 'index.html' } : { index: 'index.html', web: 'web.html' },
      },
    },
```

4. In `injectManifest` aggiungi `globIgnores`:

```ts
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          // Il sito web.sbeggio.app non serve alla PWA.
          globIgnores: ['web.html', 'assets/web-*.js', 'assets/web-*.css'],
        },
```

5. In `plugins`, dopo `VitePWA({...})`, aggiungi `sitoSenzaManifest(),`.

- [ ] **Step 7: Verifica la build**

Run:
```bash
npm run build
ls dist/web.html dist/index.html
grep -c 'rel="manifest"' dist/index.html dist/web.html
grep -o 'web[^"]*\.\(html\|js\|css\)' dist/sw.js || echo "nessun file del sito nel precache"
grep -o 'assets/web-[^"]*' dist/web.html
```
Expected: entrambi i file esistono; `dist/index.html:1`, `dist/web.html:0`; "nessun file del sito nel precache";
`web.html` carica `assets/web-<hash>.js` (se il nome del chunk è diverso, adegua `globIgnores` al nome reale).
Poi `npx vite build --mode android && ls dist/web.html` → "No such file"; infine di nuovo `npm run build`.

- [ ] **Step 8: Scrivi la prova end-to-end (saltata in CI)**

Crea `tests/collegamento.e2e.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { creaCollegamento, decifra, inviaCollegamento, leggiQr, PING, PONG } from '../src/core/collega';
import { datiVuoti } from '../src/storage/migrazioni';
import { giornata } from './helpers';

/**
 * Prove con il relay vero. Dopo `npm run build`, avvia `npx wrangler@4.147.0 dev --port 8787`, poi:
 *   RELAY=http://localhost:8787 npx vitest run tests/collegamento.e2e.test.ts
 * Con QR=<data-url del QR della pagina> fa il telefono: manda un backup di prova a quella pagina.
 * Senza variabili i test sono saltati (anche in CI).
 */
const RELAY = process.env.RELAY;
const QR = process.env.QR;

function backup() {
  const d = datiVuoti();
  const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '17:30']]);
  d.giornate[g.data] = g;
  return d;
}

function apriBrowser(url: string): Promise<{ ws: WebSocket; prossimo: () => Promise<unknown> }> {
  return new Promise((ok, ko) => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    const coda: unknown[] = [];
    const attese: ((d: unknown) => void)[] = [];
    ws.addEventListener('message', (e) => {
      const a = attese.shift();
      if (a) a(e.data);
      else coda.push(e.data);
    });
    const prossimo = () => (coda.length ? Promise.resolve(coda.shift()) : new Promise((r) => attese.push(r)));
    ws.addEventListener('open', () => ok({ ws, prossimo }));
    ws.addEventListener('error', () => ko(new Error('WebSocket rifiutato')));
  });
}

const wsUrl = (id: string) => `${RELAY!.replace(/^http/, 'ws')}/collega/${id}`;

describe.skipIf(!RELAY)('relay vero (wrangler dev)', () => {
  it('consegna una volta sola il messaggio cifrato al browser', async () => {
    const c = creaCollegamento(RELAY!);
    const { prossimo } = await apriBrowser(wsUrl(c.id));
    const dati = backup();
    expect(await inviaCollegamento(c, dati)).toBe('inviato');
    expect(await decifra((await prossimo()) as ArrayBuffer, c)).toEqual(dati);
    expect(await inviaCollegamento(c, dati)).toBe('usato');
  });

  it('senza browser il codice è scaduto', async () => {
    expect(await inviaCollegamento(creaCollegamento(RELAY!), backup())).toBe('scaduto');
  });

  it('un secondo browser sullo stesso codice è rifiutato', async () => {
    const c = creaCollegamento(RELAY!);
    await apriBrowser(wsUrl(c.id));
    await expect(apriBrowser(wsUrl(c.id))).rejects.toThrow();
  });

  it('risponde pong al ping', async () => {
    const { ws, prossimo } = await apriBrowser(wsUrl(creaCollegamento(RELAY!).id));
    ws.send(PING);
    expect(await prossimo()).toBe(PONG);
  });
});

describe.skipIf(!QR)('telefono finto', () => {
  it('manda un backup di prova al QR della pagina', async () => {
    const c = leggiQr(QR!, { sviluppo: true });
    expect(c).not.toBeNull();
    expect(await inviaCollegamento(c!, backup())).toBe('inviato');
  });
});
```

Run: `npx vitest run tests/collegamento.e2e.test.ts`
Expected: tutti "skipped".

- [ ] **Step 9: Prova con il relay vero**

1. In background: `npx wrangler@4.147.0 dev --port 8787` (dopo `npm run build`; il primo avvio scarica wrangler).
2. Run: `RELAY=http://localhost:8787 npx vitest run tests/collegamento.e2e.test.ts`
   Expected: 4 test PASS, 1 skipped.
3. Controllo della pagina con Chrome (skill claude-in-chrome): apri `http://localhost:8787/web`, fai uno screenshot
   (QR, tre passi, conto alla rovescia), leggi `document.querySelector('.sito-qr').dataset.url` con lo strumento JavaScript, poi
   Run: `QR='<url letto>' npx vitest run tests/collegamento.e2e.test.ts -t "telefono finto"` → PASS.
   Screenshot: "Ricevute 1 giornata alle …", selettore su *Ottobre 2026*, pulsanti CSV/JSON, *Scollega*.
   Prova anche con `prefers-color-scheme: dark` (il QR resta su fondo bianco) e a 360 px di larghezza.
   Se Chrome non è disponibile, ripiega su `chrome.exe --headless=new --screenshot` per lo stato di attesa (vedi memoria del progetto).
4. Ferma wrangler.

- [ ] **Step 10: Commit**

```bash
npx vitest run && npm run typecheck
git add web.html src/sito/main.ts src/sito/sito.css src/ui/scarica.ts src/ui/dati.ts vite.config.ts package.json package-lock.json tests/collegamento.e2e.test.ts
git commit -m "Sito web.sbeggio.app: QR, download del mese o di tutto in CSV e JSON

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: L'app, cioè scanner e "Collega al computer"

**Files:**
- Create: `src/ui/scanner.ts`, `src/ui/collega.ts`
- Modify: `src/ui/impostazioni.ts` (import + pulsante nella sezione "Dati e backup", intorno alla riga 395)
- Modify: `src/style.css` (in fondo: stili dello scanner)
- Modify: `android/app/src/main/AndroidManifest.xml` (permesso fotocamera)
- Modify: `package.json`, `package-lock.json` (dipendenza `jsqr`)

**Interfaces:**
- Consumes: Task 1 (`leggiQr`, `inviaCollegamento`, `messaggioEsito`, `motivoFotocamera`, `messaggioFotocamera`, `type MotivoFotocamera`, `type Collegamento`);
  `store.tutto` (`src/storage/store.ts`), `avviso`, `conferma`, `toast` (`src/ui/dialoghi.ts`), `inApp` (`src/native/app.ts`), `el` (`src/ui/dom.ts`).
- Produces: `scansionaQr<T>(valida: (testo: string) => T | null): Promise<T | null>`, `class ErroreFotocamera`; `collegaComputer(): Promise<void>`.

Il codice di questo task usa fotocamera e DOM: i test automatici restano quelli puri del Task 1 (lettura del QR,
esiti, testi della fotocamera); la verifica è manuale (Step 6).

- [ ] **Step 1: Installa jsQR**

Run: `npm install jsqr@1.4.0`
Expected: `"jsqr": "^1.4.0"` in `dependencies`.

- [ ] **Step 2: Crea `src/ui/scanner.ts`**

```ts
import { motivoFotocamera, type MotivoFotocamera } from '../core/collega';
import { el } from './dom';

/** BarcodeDetector (Chrome Android, WebView) non è nei tipi DOM di TypeScript. */
interface RilevatoreCodici {
  detect(sorgente: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface CostruttoreRilevatore {
  new (opzioni: { formats: string[] }): RilevatoreCodici;
  getSupportedFormats(): Promise<string[]>;
}

type Decodifica = (video: HTMLVideoElement) => Promise<string | null>;

export class ErroreFotocamera extends Error {
  constructor(readonly motivo: MotivoFotocamera) {
    super(motivo);
  }
}

/** BarcodeDetector dove c'è; altrimenti (iPhone) jsQR, caricato solo ora per non pesare sull'avvio. */
async function creaDecodifica(): Promise<Decodifica> {
  const Rilevatore = (globalThis as { BarcodeDetector?: CostruttoreRilevatore }).BarcodeDetector;
  if (Rilevatore && (await Rilevatore.getSupportedFormats()).includes('qr_code')) {
    const rilevatore = new Rilevatore({ formats: ['qr_code'] });
    return async (video) => (await rilevatore.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (video) => {
    const scala = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scala);
    canvas.height = Math.round(video.videoHeight * scala);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const immagine = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(immagine.data, immagine.width, immagine.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

/**
 * Fotocamera posteriore a tutto schermo finché non inquadra un QR che `valida` accetta.
 * Restituisce null se l'utente annulla; lancia ErroreFotocamera se la fotocamera non si apre.
 * Alla chiusura, per qualunque motivo, la fotocamera si spegne.
 */
export async function scansionaQr<T>(valida: (testo: string) => T | null): Promise<T | null> {
  let flusso: MediaStream;
  try {
    flusso = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (e) {
    throw new ErroreFotocamera(motivoFotocamera(e));
  }
  let decodifica: Decodifica;
  try {
    decodifica = await creaDecodifica();
  } catch {
    flusso.getTracks().forEach((t) => t.stop());
    throw new ErroreFotocamera('altro');
  }

  return new Promise((risolvi) => {
    const video = el('video', { class: 'scanner-video', playsinline: true, muted: true, autoplay: true });
    const nota = el('p', { class: 'scanner-nota' }, 'Inquadra il codice QR mostrato da web.sbeggio.app');
    const dlg = el(
      'dialog',
      { class: 'scanner', 'aria-label': 'Collega al computer' },
      video,
      el('div', { class: 'scanner-mirino', 'aria-hidden': 'true' }),
      el(
        'div',
        { class: 'scanner-barra' },
        nota,
        el('button', { type: 'button', class: 'btn btn-neutro', onclick: () => dlg.close() }, 'Annulla'),
      ),
    );
    let finito = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fine = (valore: T | null) => {
      if (finito) return;
      finito = true;
      clearTimeout(timer);
      flusso.getTracks().forEach((t) => t.stop());
      if (dlg.open) dlg.close();
      dlg.remove();
      risolvi(valore);
    };
    // Annulla, Esc o "indietro" di Android.
    dlg.addEventListener('close', () => fine(null));

    const ciclo = async () => {
      if (finito) return;
      try {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const testo = await decodifica(video);
          if (testo !== null) {
            const valore = valida(testo);
            if (valore !== null) return fine(valore);
            nota.textContent = 'Questo non è un codice di Sbeggio';
          }
        }
      } catch {
        // fotogramma non leggibile: si riprova
      }
      timer = setTimeout(() => void ciclo(), 100);
    };

    document.body.append(dlg);
    dlg.showModal();
    video.srcObject = flusso;
    void video.play().catch(() => {});
    void ciclo();
  });
}
```

- [ ] **Step 3: Crea `src/ui/collega.ts`**

```ts
import { inviaCollegamento, leggiQr, messaggioEsito, messaggioFotocamera, type Collegamento } from '../core/collega';
import { inApp } from '../native/app';
import { store } from '../storage/store';
import { avviso, conferma, toast } from './dialoghi';
import { ErroreFotocamera, scansionaQr } from './scanner';

/** Impostazioni → Collega al computer: inquadra il QR di web.sbeggio.app e manda le timbrature cifrate. */
export async function collegaComputer(): Promise<void> {
  let collegamento: Collegamento | null;
  try {
    collegamento = await scansionaQr((testo) => leggiQr(testo, { sviluppo: import.meta.env.DEV }));
  } catch (e) {
    if (!(e instanceof ErroreFotocamera)) throw e;
    await avviso('Fotocamera non disponibile', messaggioFotocamera(e.motivo, inApp()));
    return;
  }
  if (!collegamento) return;
  if (!(await conferma('Collega al computer', 'Inviare tutte le timbrature al computer?', 'Invia'))) return;
  // Sola lettura: l'invio non modifica i dati.
  const esito = await inviaCollegamento(collegamento, store.tutto);
  if (esito === 'inviato') toast(messaggioEsito(esito));
  else await avviso('Invio non riuscito', messaggioEsito(esito));
}
```

- [ ] **Step 4: Pulsante in Impostazioni**

In `src/ui/impostazioni.ts` aggiungi l'import `import { collegaComputer } from './collega';` e, nella
`pila-pulsanti` di "Dati e backup", subito dopo il pulsante `'Esporta backup completo (JSON)'`:

```ts
        el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void collegaComputer() }, 'Collega al computer…'),
```

- [ ] **Step 5: Stili e manifest**

In fondo a `src/style.css`:

```css
/* Scanner QR di "Collega al computer" (src/ui/scanner.ts): a tutto schermo, su fondo nero. */
.scanner {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: #000;
  color: #fff;
}
.scanner::backdrop {
  background: #000;
}
.scanner-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.scanner-mirino {
  position: absolute;
  top: 45%;
  left: 50%;
  width: min(70vw, 280px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border: 3px solid rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
}
.scanner-barra {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  gap: 12px;
  padding: 16px calc(var(--sicuro-dx) + 16px) calc(var(--sicuro-basso) + 16px) calc(var(--sicuro-sx) + 16px);
  text-align: center;
}
.scanner-nota {
  margin: 0;
  font-size: 16px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
```

In `android/app/src/main/AndroidManifest.xml`, dopo i permessi di posizione:

```xml
    <!-- Collega al computer: lo scanner QR usa la fotocamera nella WebView (la richiesta la fa Capacitor). -->
    <uses-permission android:name="android.permission.CAMERA" />
```

e dopo `<uses-feature android:name="android.hardware.nfc" android:required="false" />`:

```xml
    <uses-feature android:name="android.hardware.camera" android:required="false" />
```

- [ ] **Step 6: Verifica**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS; in `dist/assets/` c'è un chunk separato di jsQR (`ls dist/assets | grep -i jsqr`) e compare nel precache
(`grep -c -i jsqr dist/sw.js` ≥ 1).

Controllo visivo con Chrome (skill claude-in-chrome) su `npm run dev`: *Impostazioni → Collega al computer…* apre lo scanner a
tutto schermo con mirino, testo e *Annulla*; *Annulla* chiude e spegne la fotocamera (l'indicatore della fotocamera del browser
si spegne). Se il browser chiede il permesso, negalo una volta: deve comparire "Fotocamera non disponibile" con
"Consenti l'uso della fotocamera a Sbeggio nelle impostazioni del browser.".
La prova con il telefono vero (APK e iPhone) è nella checklist manuale della spec, dopo il deploy.

- [ ] **Step 7: Commit**

```bash
git add src/ui/scanner.ts src/ui/collega.ts src/ui/impostazioni.ts src/style.css android/app/src/main/AndroidManifest.xml package.json package-lock.json
git commit -m "App: Collega al computer con lo scanner QR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Aiuto, README e versione 2.7.0

**Files:**
- Modify: `src/ui/aiutoTesti.ts` (voce `dove-dati` e nuova voce `computer`, sezione "Dati e backup", intorno alle righe 343–365)
- Modify: `tests/aiuto.test.ts` (nuovo test)
- Modify: `README.md` (righe 3–5, nuova sezione prima di `## Export CSV`, sezione `### Deploy su Cloudflare`)
- Modify: `package.json`, `package-lock.json` (versione)

**Interfaces:**
- Consumes: niente di nuovo.
- Produces: voce di aiuto con `id: 'computer'`.

- [ ] **Step 1: Write the failing test**

In `tests/aiuto.test.ts`, dentro `describe('aiuto', ...)`, aggiungi:

```ts
  it('spiega come scaricare le timbrature sul computer, e che i dati partono solo così', () => {
    const computer = voci.find((x) => x.id === 'computer')!;
    expect(computer.sezione).toBe('Dati e backup');
    const testo = computer.testo.join(' ');
    expect(testo).toContain('web.sbeggio.app');
    expect(testo).toContain('Collega al computer');
    expect(testo).toContain('cifrat');
    const dove = voci.find((x) => x.id === 'dove-dati')!.testo.join(' ');
    expect(dove).toContain('Collega al computer');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/aiuto.test.ts`
Expected: FAIL (`computer` non esiste).

- [ ] **Step 3: Aggiorna l'aiuto**

In `src/ui/aiutoTesti.ts`, nella voce `dove-dati` sostituisci il primo paragrafo con:

```ts
        'Solo su questo telefono, nella memoria dell\'app: non vengono inviati a nessun server, salvo quando li mandi tu al computer con "Collega al computer" (cifrati da un capo all\'altro).',
```

e dopo la voce `backup` aggiungi:

```ts
    {
      id: 'computer',
      sezione: 'Dati e backup',
      domanda: 'Come scarico le timbrature sul computer?',
      testo: [
        'Sul computer apri web.sbeggio.app: compare un codice QR.',
        'Sul telefono vai in Impostazioni → Collega al computer, inquadra il codice e conferma con Invia.',
        'Dal computer scarichi il CSV (Excel) o il JSON di un mese a scelta o di tutte le timbrature.',
        '• Le timbrature viaggiano cifrate: il server che le passa al computer non può leggerle e non le conserva.',
        '• Il codice vale 5 minuti e una sola volta; chiudendo la pagina i dati spariscono dal computer.',
        '• Servono la connessione a internet e il permesso di usare la fotocamera.',
      ],
    },
```

Run: `npx vitest run tests/aiuto.test.ts`
Expected: PASS.

- [ ] **Step 4: README**

1. Righe 3–5, sostituisci con:

```markdown
Web app installabile (PWA) per registrare le timbrature di lavoro da iPhone o Android e sapere
a che ora si può uscire. Funziona offline, non ha backend: **i dati restano sul telefono**
(localStorage del browser), salvo quando li mandi tu al computer con *Collega al computer*, cifrati da un capo all'altro.
```

2. Prima di `## Export CSV`, aggiungi:

```markdown
## Scaricare le timbrature dal computer

1. Sul computer apri **https://web.sbeggio.app**: compare un codice QR (vale 5 minuti, poi se ne genera uno nuovo).
2. Sul telefono: *Impostazioni → Collega al computer…*, inquadra il codice e conferma con **Invia**.
3. Sul computer scegli il mese e scarica **CSV** (lo stesso dell'app) o **JSON**, oppure scarica tutto.

Le timbrature viaggiano cifrate (AES-GCM) con una chiave che sta solo nel QR: il relay su Cloudflare che le
passa al browser non può leggerle e non le salva. Ogni codice si usa una volta; chiudendo la pagina i dati
spariscono dal computer. Il JSON del sito è "leggibile" (ore in minuti, timbrature con orario e tipo) e non si
reimporta nell'app: per il backup completo usa *Esporta backup completo (JSON)* nell'app.
```

3. In `### Deploy su Cloudflare`, dopo la frase che termina con "pubblica `dist/` con `wrangler deploy`." e prima di
   "Va configurato una volta sola:", aggiungi (nuovo paragrafo):

```markdown
Lo stesso Worker serve anche `https://web.sbeggio.app` (custom domain): la pagina `web.html` (sorgenti in
`src/sito/`) e il relay `/collega/<id>`, un Durable Object `Collegamento` (`src/collegamento.ts`, migrazione `v1`
in `wrangler.jsonc`) che tiene il WebSocket del browser e gli inoltra una volta il messaggio cifrato dall'app.
Per provarlo in locale: `npm run build && npx wrangler@4.147.0 dev --port 8787`, pagina su
`http://localhost:8787/web`, prove automatiche in `tests/collegamento.e2e.test.ts` (vedi il commento in testa).
```

- [ ] **Step 5: Versione 2.7.0**

Run: `npm version 2.7.0 --no-git-tag-version`
Expected: `package.json` e `package-lock.json` passano da 2.6.0 a 2.7.0.

- [ ] **Step 6: Verifica finale**

Run: `npx vitest run && npm run build && npm run versione:codice`
Expected: tutti i test PASS (gli e2e "skipped"), build riuscita, versionCode stampato senza errori.
Controlla con `git diff develop --stat` che non ci siano file inattesi.

- [ ] **Step 7: Commit**

```bash
git add src/ui/aiutoTesti.ts tests/aiuto.test.ts README.md package.json package-lock.json
git commit -m "Collega al computer: aiuto, README e versione 2.7.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Dopo il merge (non fa parte dell'esecuzione)

Il deploy parte al push su `main` (`deploy.yml`): crea il custom domain `web.sbeggio.app` e la classe del
Durable Object. Poi va fatta la **prova manuale** della spec (APK, PWA iPhone, PWA Android, rete aziendale).
