// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

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

/** Legge il corpo fino a `massimo` byte; null appena lo supera, senza leggere il resto. */
async function leggiCorpo(richiesta: Request, massimo: number): Promise<Uint8Array | null> {
  if (!richiesta.body) return new Uint8Array(0);
  const lettore = richiesta.body.getReader();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > massimo) {
      await lettore.cancel();
      return null;
    }
    pezzi.push(value);
  }
  const corpo = new Uint8Array(totale);
  let posizione = 0;
  for (const p of pezzi) {
    corpo.set(p, posizione);
    posizione += p.byteLength;
  }
  return corpo;
}

export class Collegamento {
  constructor(private readonly stato: StatoDurable) {
    // Il ping del sito riceve "pong" senza svegliare l'oggetto. Nel costruttore vale a ogni risveglio.
    this.stato.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(richiesta: Request): Promise<Response> {
    // null: corpo oltre il massimo, non letto tutto (decidi risponde 413).
    const corpo = richiesta.method === 'POST' ? await leggiCorpo(richiesta, MESSAGGIO_MASSIMO) : new Uint8Array(0);
    const browser = this.stato.getWebSockets()[0];
    const decisione = decidi(
      {
        metodo: richiesta.method,
        websocket: richiesta.headers.get('Upgrade')?.toLowerCase() === 'websocket',
        dimensione: corpo === null ? MESSAGGIO_MASSIMO + 1 : corpo.byteLength,
      },
      { browser: browser !== undefined, usato: (await this.stato.storage.get<boolean>(USATO)) === true },
    );
    switch (decisione.tipo) {
      case 'rifiuta':
        return new Response(null, { status: decisione.stato });
      case 'apri': {
        const coppia = new WebSocketPair();
        this.stato.acceptWebSocket(coppia[1]);
        await this.stato.storage.setAlarm(Date.now() + DURATA_COLLEGAMENTO_MS);
        return new Response(null, { status: 101, webSocket: coppia[0] } as ResponseInit);
      }
      case 'consegna':
        try {
          browser!.send(corpo!);
        } catch {
          // Il browser se ne sta andando (scheda chiusa, QR appena scaduto): per l'app è un codice scaduto.
          return new Response(null, { status: 404 });
        }
        await this.stato.storage.put(USATO, true);
        try {
          browser!.close(1000, 'consegnato');
        } catch {
          // già chiuso: il messaggio è comunque arrivato
        }
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
