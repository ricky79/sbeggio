// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { pianificaAvvisi, type StatoPermessi } from '../core/avvisi';
import {
  CACHE_AVVISI,
  CHIAVE_VAPID,
  chiaveCache,
  chiaveDaBase64url,
  idAvviso,
  operazioniPush,
  statoPermessiWeb,
  stessaChiave,
  URL_NOTIFICHE,
  type AvvisoPush,
  type Inviati,
  type TestoSalvato,
} from '../core/avvisiPush';
import { nuovoId } from '../core/id';
import { istanteDaMinuti } from '../core/sigaretta';
import { adessoRoma } from '../core/tempo';
import { store } from '../storage/store';
import { inizioSigarettaSalvato } from '../ui/inizioSigaretta';
import { inModalitaApp, piattaforma } from '../ui/installa';

/**
 * Avvisi della PWA: il browser non può programmare notifiche locali, quindi l'orario di ogni avviso
 * va al backend (Cloudflare Worker), che allo scadere manda una notifica web push. Il testo resta nel
 * browser (Cache), dove il service worker lo legge.
 */

/** Stato del dispositivo, come tema e banner: fuori dai dati e dal backup. */
const CHIAVE = 'timbrature-avvisi-push';
/** Il dispositivo entra nell'id dell'avviso: con "-sigaretta" deve restare entro i 64 caratteri del backend. */
const DISPOSITIVO_VALIDO = /^[A-Za-z0-9_-]{1,54}$/;

interface StatoPush {
  dispositivo: string;
  /** Endpoint dell'iscrizione con cui sono stati inviati gli avvisi. */
  endpoint: string | null;
  inviati: Inviati;
}

function leggiStato(): StatoPush {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) ?? 'null') as Partial<StatoPush> | null;
    if (v && typeof v.dispositivo === 'string' && DISPOSITIVO_VALIDO.test(v.dispositivo) && typeof v.inviati === 'object' && v.inviati !== null) {
      return { dispositivo: v.dispositivo, endpoint: typeof v.endpoint === 'string' ? v.endpoint : null, inviati: v.inviati };
    }
  } catch {
    /* chiave illeggibile o memoria non disponibile */
  }
  // Gli avvisi rimasti sul server con il vecchio id scadono da soli entro 24 ore.
  return { dispositivo: nuovoId(), endpoint: null, inviati: {} };
}

function salvaStato(s: StatoPush): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(s));
  } catch {
    /* gli avvisi si rimandano alla prossima apertura */
  }
}

function supportato(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

const iosNonInstallata = () => piattaforma(navigator.userAgent, navigator.maxTouchPoints ?? 0) === 'ios' && !inModalitaApp();

/** La registrazione del service worker se è già attivo. Non aspetta: in sviluppo (`npm run dev`) non c'è. */
async function registrazioneAttiva(): Promise<ServiceWorkerRegistration | null> {
  if (!supportato()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg?.active ? reg : null;
}

/** Aspetta il service worker attivo al massimo 10 secondi (alla prima apertura si sta ancora installando). */
async function registrazionePronta(): Promise<ServiceWorkerRegistration | null> {
  if (!supportato()) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 10_000))]);
}

/**
 * L'iscrizione push, se è stata fatta con la chiave attuale del backend. Se il backend ha cambiato la
 * coppia di chiavi i push verrebbero rifiutati: l'iscrizione vecchia si annulla e in Impostazioni
 * ricompare il pulsante per riattivare gli avvisi.
 */
async function iscrizioneValida(reg: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  const iscrizione = await reg.pushManager.getSubscription();
  if (!iscrizione) return null;
  if (stessaChiave(iscrizione.options?.applicationServerKey ?? null, chiaveDaBase64url(CHIAVE_VAPID))) return iscrizione;
  await iscrizione.unsubscribe().catch(() => false);
  return null;
}

/**
 * Per mostrare lo stato: se il service worker si sta ancora installando (prima apertura, anche
 * dell'app appena aggiunta alla Home su iPhone, che ha dati separati da Safari) lo si aspetta;
 * se non c'è proprio (in sviluppo) no.
 */
async function registrazionePerStato(): Promise<ServiceWorkerRegistration | null> {
  if (!supportato()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.active ? reg : registrazionePronta();
}

export async function statoPermessi(): Promise<StatoPermessi> {
  try {
    const reg = await registrazionePerStato();
    return statoPermessiWeb({
      iosNonInstallata: iosNonInstallata(),
      supportato: reg !== null,
      permesso: reg ? Notification.permission : 'default',
      iscritto: reg ? (await iscrizioneValida(reg)) !== null : false,
    });
  } catch {
    return 'non-disponibili';
  }
}

/**
 * Chiede il permesso di mostrare notifiche e iscrive il browser al push con la chiave del backend,
 * poi programma gli avvisi. Va chiamata da un gesto dell'utente (Safari lo pretende).
 */
export async function richiediPermessi(): Promise<StatoPermessi> {
  try {
    if (iosNonInstallata() || !supportato()) return statoPermessi();
    if ((await Notification.requestPermission()) !== 'granted') return statoPermessi();
    const reg = await registrazionePronta();
    if (!reg) return 'non-disponibili';
    if (!(await iscrizioneValida(reg))) {
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveDaBase64url(CHIAVE_VAPID) });
    }
  } catch (e) {
    console.warn('Avvisi: iscrizione alle notifiche non riuscita', e);
  }
  await sincronizzaAvvisi();
  return statoPermessi();
}

/** Chiamata al backend; true se l'ha accettata. Nei log non finiscono endpoint né chiavi. */
async function chiama(metodo: 'PUT' | 'DELETE', id: string, corpo?: unknown): Promise<boolean> {
  try {
    const r = await fetch(`${URL_NOTIFICHE}/avvisi/${id}`, {
      method: metodo,
      // Una rete bloccata non deve fermare la coda per minuti: la prossima sincronizzazione riprova.
      signal: AbortSignal.timeout(10_000),
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
    if (r.ok) return true;
    console.warn(`Avvisi: ${metodo} rifiutato dal server (${r.status})`);
  } catch {
    console.warn(`Avvisi: ${metodo} non riuscito, server non raggiungibile`);
  }
  return false;
}

async function scriviTesto(scope: string, id: string, testo: TestoSalvato): Promise<void> {
  try {
    const cache = await caches.open(CACHE_AVVISI);
    await cache.put(chiaveCache(scope, id), new Response(JSON.stringify(testo), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    /* il service worker userà il testo generico */
  }
}

async function cancellaTesto(scope: string, id: string): Promise<void> {
  try {
    await (await caches.open(CACHE_AVVISI)).delete(chiaveCache(scope, id));
  } catch {
    /* voce già assente o Cache non disponibile */
  }
}

let coda: Promise<void> = Promise.resolve();

async function esegui(): Promise<void> {
  if (!supportato() || Notification.permission !== 'granted') return;
  const reg = await registrazioneAttiva();
  const iscrizione = reg ? await iscrizioneValida(reg) : null;
  if (!reg || !iscrizione) return; // all'avvio non ci si iscrive di nascosto: c'è il pulsante

  const ora = new Date();
  const { data, minuti } = adessoRoma(ora);
  const piano: AvvisoPush[] = pianificaAvvisi(store.giornata(data), store.impostazioni, { data, minuti }, {
    ora: ora.getTime(),
    inizioSigaretta: (eventoId) => inizioSigarettaSalvato(data, eventoId),
  }).map((a) => ({ tipo: a.tipo, orario: a.istante ?? istanteDaMinuti(a.minuti, ora), titolo: a.titolo, testo: a.testo }));

  const stato = leggiStato();
  const contatto = iscrizione.toJSON();
  let programmaFallito = false;
  for (const op of operazioniPush(piano, stato.inviati, { ora: ora.getTime(), endpointCambiato: stato.endpoint !== iscrizione.endpoint })) {
    if (op.azione === 'programma') {
      const { tipo, orario, titolo, testo } = op.avviso;
      const id = idAvviso(stato.dispositivo, tipo);
      const iso = new Date(orario).toISOString();
      if (await chiama('PUT', id, { contatto, orario: iso })) {
        stato.inviati[tipo] = { orario, titolo, testo };
        // Dopo il PUT riuscito: nella Cache non resta un testo che non corrisponde al server.
        await scriviTesto(reg.scope, id, { titolo, testo, orario: iso });
      } else {
        programmaFallito = true;
      }
    } else if (op.azione === 'annulla') {
      const id = idAvviso(stato.dispositivo, op.tipo);
      if (!(await chiama('DELETE', id))) continue;
      delete stato.inviati[op.tipo];
      await cancellaTesto(reg.scope, id);
    } else {
      // Scaduto: il push può essere ancora in viaggio, il testo nella Cache lo cancella il service worker.
      delete stato.inviati[op.tipo];
    }
    salvaStato(stato);
  }
  if (!programmaFallito) stato.endpoint = iscrizione.endpoint;
  salvaStato(stato);
}

/**
 * Allinea gli avvisi sul backend alle timbrature e alle impostazioni di oggi. Mai in parallelo.
 * Una chiamata fallita lascia l'avviso com'era nello stato salvato: la prossima sincronizzazione la ripete.
 */
export function sincronizzaAvvisi(): Promise<void> {
  coda = coda.then(esegui).catch((e: unknown) => {
    console.warn('Avvisi: sincronizzazione non riuscita', e);
  });
  return coda;
}

/** Sincronizza all'avvio, a ogni modifica dei dati, al ritorno in primo piano e quando torna la connessione. */
export function avviaAvvisi(): void {
  if (!supportato()) return;
  void sincronizzaAvvisi();
  store.ascolta(() => void sincronizzaAvvisi());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizzaAvvisi();
  });
  window.addEventListener('online', () => void sincronizzaAvvisi());
}
