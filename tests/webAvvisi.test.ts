// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHIAVE_VAPID } from '../src/core/avvisiPush';
import { giornata, impostazioni } from './helpers';

// Browser, backend e store sono finti: si verifica cosa viene chiesto al backend e cosa resta salvato.
const dati = vi.hoisted(() => ({ giornata: null as unknown, impostazioni: null as unknown }));
const inizi = vi.hoisted(() => ({ sigaretta: null as number | null }));
vi.mock('../src/ui/inizioSigaretta', () => ({ inizioSigarettaSalvato: () => inizi.sigaretta }));
vi.mock('../src/storage/store', () => ({
  store: {
    giornata: () => dati.giornata,
    get impostazioni() {
      return dati.impostazioni;
    },
    ascolta: vi.fn(),
  },
}));

const BASE = 'https://notifiche.sbeggio.app';
const SCOPE = 'https://sbeggio.app/';
const CHIAVE = 'timbrature-avvisi-push';
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

const contatto = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'P256DH', auth: 'AUTH' },
};
let iscrizione: { endpoint: string; toJSON: () => typeof contatto };
const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };
const registrazione = { active: {}, scope: SCOPE, pushManager };
const sw = { getRegistration: vi.fn(), ready: Promise.resolve(registrazione) };
const notifica = { permission: 'granted' as 'granted' | 'denied' | 'default', requestPermission: vi.fn() };
const fetchFinta = vi.fn();
let memoria: Map<string, string>;
let cache: Map<string, string>;
let ascoltatori: Map<string, () => void>;
let nav: { userAgent: string; maxTouchPoints: number; serviceWorker: typeof sw };

const ok = () => new Response(null, { status: 204 });
const stato = () => JSON.parse(memoria.get(CHIAVE) ?? 'null') as {
  dispositivo: string;
  endpoint: string | null;
  inviati: Record<string, { orario: number; titolo: string; testo: string }>;
};
const chiamate = () =>
  fetchFinta.mock.calls.map(([url, init]) => ({
    url: url as string,
    method: (init as RequestInit).method,
    corpo: (init as RequestInit).body ? JSON.parse((init as RequestInit).body as string) : undefined,
  }));

async function carica() {
  vi.resetModules();
  return import('../src/web/avvisi');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T08:00:00Z')); // 10:00 a Roma (UTC+2)
  memoria = new Map();
  cache = new Map();
  ascoltatori = new Map();
  iscrizione = { endpoint: contatto.endpoint, toJSON: () => contatto };
  for (const f of [pushManager.getSubscription, pushManager.subscribe, sw.getRegistration, notifica.requestPermission, fetchFinta]) {
    f.mockReset();
  }
  pushManager.getSubscription.mockImplementation(async () => iscrizione);
  sw.getRegistration.mockResolvedValue(registrazione);
  notifica.permission = 'granted';
  fetchFinta.mockImplementation(async () => ok());
  nav = { userAgent: UA_ANDROID, maxTouchPoints: 5, serviceWorker: sw };

  vi.stubGlobal('fetch', fetchFinta);
  vi.stubGlobal('Notification', notifica);
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('window', {
    PushManager: class {},
    Notification: notifica,
    matchMedia: () => ({ matches: false }),
    addEventListener: (tipo: string, f: () => void) => ascoltatori.set(tipo, f),
  });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn() });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, String(v)),
    removeItem: (k: string) => void memoria.delete(k),
  });
  vi.stubGlobal('caches', {
    open: async () => ({
      put: async (k: string, r: Response) => void cache.set(String(k), await r.text()),
      delete: async (k: string) => cache.delete(String(k)),
      match: async (k: string) => (cache.has(String(k)) ? new Response(cache.get(String(k))) : undefined),
    }),
  });

  dati.impostazioni = impostazioni();
  dati.giornata = giornata([['ENTRATA', '08:30']]);
  inizi.sigaretta = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('sincronizzazione con il backend', () => {
  it('programma l\'uscita prevista con un PUT e salva testo e stato', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();

    const s = stato();
    const id = `${s.dispositivo}-uscita`;
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(fetchFinta).toHaveBeenCalledOnce();
    const [url, init] = fetchFinta.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`${BASE}/avvisi/${id}`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ contatto, orario: '2026-10-01T15:00:00.000Z' }); // 17:00 a Roma (pausa minima inclusa)

    expect(s.endpoint).toBe(contatto.endpoint);
    expect(s.inviati.uscita).toMatchObject({ orario: Date.parse('2026-10-01T15:00:00Z'), titolo: 'Puoi andare via' });
    expect(JSON.parse(cache.get(`${SCOPE}avvisi/${id}`)!)).toEqual({
      titolo: 'Puoi andare via',
      testo: 'Le ore sono completate: uscita prevista alle 17:00.',
      orario: '2026-10-01T15:00:00.000Z',
    });
  });

  it('non richiama il server se nulla è cambiato', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    await sincronizzaAvvisi();
    expect(fetchFinta).toHaveBeenCalledOnce();
  });

  it('all\'inizio della pausa programma il rientro e annulla l\'uscita', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    const id = (tipo: string) => `${BASE}/avvisi/${stato().dispositivo}-${tipo}`;
    fetchFinta.mockClear();

    dati.giornata = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '09:50']]);
    dati.impostazioni = impostazioni({ avvisi: { uscita: true, sigaretta: true, sigarettaAnticipo: 1, pranzo: true, pranzoMinuti: 45 } });
    await sincronizzaAvvisi();

    expect(chiamate()).toEqual([
      { url: id('pausa'), method: 'PUT', corpo: { contatto, orario: '2026-10-01T08:35:00.000Z' } }, // 09:50 + 45 = 10:35
      { url: id('uscita'), method: 'DELETE', corpo: undefined },
    ]);
    expect(Object.keys(stato().inviati)).toEqual(['pausa']);
    expect(cache.has(`${SCOPE}avvisi/${stato().dispositivo}-uscita`)).toBe(false);
  });

  it('pausa sigaretta: orario al secondo', async () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '09:59']]);
    g.eventi[1]!.sigaretta = true;
    dati.giornata = g;
    inizi.sigaretta = Date.parse('2026-10-01T07:59:20Z'); // 09:59:20 a Roma
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(chiamate()).toEqual([
      { url: `${BASE}/avvisi/${stato().dispositivo}-sigaretta`, method: 'PUT', corpo: { contatto, orario: '2026-10-01T08:09:20.000Z' } },
    ]);
  });

  it('avviso scaduto: lo dimentica senza DELETE', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    const voce = `${SCOPE}avvisi/${stato().dispositivo}-uscita`;
    fetchFinta.mockClear();

    vi.setSystemTime(new Date('2026-10-01T15:31:00Z')); // 17:31: l'uscita prevista delle 17:30 è passata
    await sincronizzaAvvisi();

    expect(fetchFinta).not.toHaveBeenCalled();
    expect(stato().inviati).toEqual({});
    // Il push potrebbe non essere ancora partito: il testo resta, lo cancella il service worker dopo averlo mostrato.
    expect(cache.has(voce)).toBe(true);
  });

  it('ogni chiamata al server ha un timeout', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    const init = fetchFinta.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('DELETE fallito: l\'avviso resta e la sincronizzazione dopo riprova', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    fetchFinta.mockClear();

    dati.giornata = giornata([['ENTRATA', '08:30'], ['USCITA', '09:00']]); // giornata chiusa: niente più uscita prevista
    fetchFinta.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await sincronizzaAvvisi();
    expect(stato().inviati.uscita).toBeDefined();

    await sincronizzaAvvisi();
    expect(chiamate().map((c) => c.method)).toEqual(['DELETE', 'DELETE']);
    expect(stato().inviati).toEqual({});
  });

  it('rientro prima della fine della pausa: annulla il rientro e programma l\'uscita', async () => {
    dati.giornata = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '09:50']]);
    dati.impostazioni = impostazioni({ avvisi: { uscita: true, sigaretta: true, sigarettaAnticipo: 1, pranzo: true, pranzoMinuti: 45 } });
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    const id = (tipo: string) => `${BASE}/avvisi/${stato().dispositivo}-${tipo}`;
    fetchFinta.mockClear();

    dati.giornata = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '09:50'], ['FINE_PAUSA', '10:00']]);
    await sincronizzaAvvisi();

    expect(chiamate().map((c) => [c.method, c.url])).toEqual([
      ['PUT', id('uscita')],
      ['DELETE', id('pausa')],
    ]);
    expect(Object.keys(stato().inviati)).toEqual(['uscita']);
  });

  it('errore di rete: lo stato non cambia e la sincronizzazione dopo riprova', async () => {
    fetchFinta.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { sincronizzaAvvisi } = await carica();
    await expect(sincronizzaAvvisi()).resolves.toBeUndefined();
    expect(stato().inviati).toEqual({});
    expect(stato().endpoint).toBeNull();

    await sincronizzaAvvisi();
    expect(fetchFinta).toHaveBeenCalledTimes(2);
    expect(stato().inviati.uscita).toBeDefined();
  });

  it('risposta di errore del server: riprova alla sincronizzazione dopo', async () => {
    fetchFinta.mockResolvedValueOnce(new Response('{"errore":"x"}', { status: 422 }));
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(stato().inviati).toEqual({});
    await sincronizzaAvvisi();
    expect(fetchFinta).toHaveBeenCalledTimes(2);
    expect(stato().inviati.uscita).toBeDefined();
  });

  it('iscrizione push cambiata: rifà il PUT', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    iscrizione = { endpoint: 'https://fcm.googleapis.com/fcm/send/nuovo', toJSON: () => contatto };
    await sincronizzaAvvisi();
    expect(fetchFinta).toHaveBeenCalledTimes(2);
    expect(stato().endpoint).toBe('https://fcm.googleapis.com/fcm/send/nuovo');
  });

  it('stato salvato illeggibile: riparte con un nuovo dispositivo', async () => {
    memoria.set(CHIAVE, '{rotto');
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(stato().dispositivo).toMatch(/^[A-Za-z0-9_-]{1,54}$/);
    expect(fetchFinta).toHaveBeenCalledOnce();
  });

  it.each([
    ['permesso non concesso', () => void (notifica.permission = 'default')],
    ['service worker non attivo', () => void sw.getRegistration.mockResolvedValue(undefined)],
    ['nessuna iscrizione', () => void pushManager.getSubscription.mockImplementation(async () => null)],
  ])('%s: nessuna chiamata al server', async (_caso, prepara) => {
    prepara();
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it('riprova quando torna la connessione', async () => {
    fetchFinta.mockRejectedValue(new TypeError('Failed to fetch'));
    const { avviaAvvisi } = await carica();
    avviaAvvisi();
    // Lo stato si salva dopo la chiamata fallita: aspettare quello, non solo la chiamata.
    await vi.waitFor(() => expect(stato()?.inviati).toEqual({}));
    expect(fetchFinta).toHaveBeenCalledTimes(1);

    fetchFinta.mockImplementation(async () => ok());
    ascoltatori.get('online')!();
    await vi.waitFor(() => expect(stato().inviati.uscita).toBeDefined());
    expect(fetchFinta).toHaveBeenCalledTimes(2);
  });
});

describe('permessi', () => {
  it('permesso negato: non si iscrive e non chiama il server', async () => {
    notifica.permission = 'default';
    notifica.requestPermission.mockImplementation(async () => {
      notifica.permission = 'denied';
      return 'denied';
    });
    const { richiediPermessi } = await carica();
    expect(await richiediPermessi()).toBe('negati');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it('permesso concesso: si iscrive con la chiave VAPID e programma gli avvisi', async () => {
    notifica.permission = 'default';
    notifica.requestPermission.mockImplementation(async () => {
      notifica.permission = 'granted';
      return 'granted';
    });
    pushManager.getSubscription.mockImplementation(async () => null);
    pushManager.subscribe.mockImplementation(async () => {
      pushManager.getSubscription.mockImplementation(async () => iscrizione);
      return iscrizione;
    });
    const { richiediPermessi } = await carica();
    expect(await richiediPermessi()).toBe('concessi');

    const opzioni = pushManager.subscribe.mock.calls[0]![0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array };
    expect(opzioni.userVisibleOnly).toBe(true);
    expect(opzioni.applicationServerKey).toHaveLength(65);
    expect(opzioni.applicationServerKey[0]).toBe(4);
    expect(chiamate().map((c) => c.method)).toEqual(['PUT']);
  });

  it('iscrizione fallita (es. offline): da attivare, con il permesso già concesso', async () => {
    notifica.permission = 'default';
    notifica.requestPermission.mockImplementation(async () => {
      notifica.permission = 'granted';
      return 'granted';
    });
    pushManager.getSubscription.mockImplementation(async () => null);
    pushManager.subscribe.mockRejectedValue(new DOMException('Registration failed - push service error', 'AbortError'));
    const { richiediPermessi } = await carica();
    expect(await richiediPermessi()).toBe('da-attivare');
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it('iscrizione fatta con un\'altra chiave VAPID: la annulla e chiede di riattivare', async () => {
    const unsubscribe = vi.fn(async () => true);
    iscrizione = { endpoint: contatto.endpoint, toJSON: () => contatto, options: { applicationServerKey: new Uint8Array(65).buffer }, unsubscribe } as typeof iscrizione;
    const { statoPermessi, sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(fetchFinta).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
    pushManager.getSubscription.mockImplementation(async () => null); // dopo unsubscribe il browser non ha più l'iscrizione
    expect(await statoPermessi()).toBe('da-attivare');
  });

  it('iscrizione fatta con la chiave attuale: resta valida', async () => {
    const chiave = Uint8Array.from(atob(CHIAVE_VAPID.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const unsubscribe = vi.fn(async () => true);
    iscrizione = { endpoint: contatto.endpoint, toJSON: () => contatto, options: { applicationServerKey: chiave.buffer }, unsubscribe } as typeof iscrizione;
    const { sincronizzaAvvisi, statoPermessi } = await carica();
    await sincronizzaAvvisi();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(fetchFinta).toHaveBeenCalledOnce();
    expect(await statoPermessi()).toBe('concessi');
  });

  it('iPhone aperto in Safari: da installare', async () => {
    nav.userAgent = UA_IPHONE;
    const { statoPermessi } = await carica();
    expect(await statoPermessi()).toBe('da-installare');
  });

  it('senza service worker attivo: non disponibili', async () => {
    sw.getRegistration.mockResolvedValue(undefined);
    const { statoPermessi } = await carica();
    expect(await statoPermessi()).toBe('non-disponibili');
  });

  it('service worker ancora in installazione (prima apertura): aspetta che sia attivo', async () => {
    sw.getRegistration.mockResolvedValue({ ...registrazione, active: null });
    const { statoPermessi } = await carica();
    expect(await statoPermessi()).toBe('concessi');
  });

  it('permesso concesso e iscrizione presente: concessi', async () => {
    const { statoPermessi } = await carica();
    expect(await statoPermessi()).toBe('concessi');
  });
});
