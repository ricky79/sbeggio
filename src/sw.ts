// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  avvisiDaRiprogrammare,
  CACHE_AVVISI,
  CHIAVE_VAPID,
  chiaveCache,
  chiaveDaBase64url,
  notificaDaPush,
  opzioniNotifica,
  URL_NOTIFICHE,
} from './core/avvisiPush';

/** Service worker della PWA: app offline (precache) e notifiche degli avvisi (web push dal backend). */

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] };

// Aggiornamento automatico (registerType 'autoUpdate'): la nuova versione prende subito il controllo.
void self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// App a pagina singola: ogni navigazione riceve index.html dalla precache, anche offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

/** Il payload del push, o null se manca o non è JSON. */
function leggiPayload(evento: PushEvent): unknown {
  try {
    return evento.data?.json() ?? null;
  } catch {
    return null;
  }
}

/** Il testo lasciato dalla pagina per questo avviso, o null. */
async function testoSalvato(id: string): Promise<unknown> {
  try {
    const voce = await (await caches.open(CACHE_AVVISI)).match(chiaveCache(self.registration.scope, id));
    return voce ? await voce.json() : null;
  } catch {
    return null;
  }
}

self.addEventListener('push', (evento) => {
  const payload = leggiPayload(evento);
  const id = typeof payload === 'object' && payload !== null && 'id' in payload && typeof payload.id === 'string' ? payload.id : null;
  evento.waitUntil(
    (async () => {
      const n = notificaDaPush(payload, id ? await testoSalvato(id) : null);
      await self.registration.showNotification(n.titolo, opzioniNotifica(n));
      if (id) {
        await caches
          .open(CACHE_AVVISI)
          .then((c) => c.delete(chiaveCache(self.registration.scope, id)))
          .catch(() => undefined);
      }
    })(),
  );
});

/** Evento `pushsubscriptionchange`: manca nei tipi di TypeScript. */
interface CambioIscrizione extends ExtendableEvent {
  readonly newSubscription: PushSubscription | null;
}

/** Le voci della Cache degli avvisi come coppie [indirizzo, contenuto JSON o null]. */
async function vociAvvisi(): Promise<[string, unknown][]> {
  const cache = await caches.open(CACHE_AVVISI);
  return Promise.all(
    (await cache.keys()).map(async (richiesta): Promise<[string, unknown]> => {
      const voce = await cache.match(richiesta);
      return [richiesta.url, voce ? await voce.json().catch(() => null) : null];
    }),
  );
}

// Il browser ha rinnovato l'iscrizione push (succede di rado, anche ad app chiusa): gli avvisi già
// programmati puntano al vecchio indirizzo e andrebbero persi. Si riprogrammano con il nuovo,
// prendendo id e orario dai testi lasciati nella Cache; alla prossima apertura la pagina rifà tutto.
self.addEventListener('pushsubscriptionchange', (e) => {
  const evento = e as CambioIscrizione;
  evento.waitUntil(
    (async () => {
      const iscrizione =
        evento.newSubscription ??
        (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveDaBase64url(CHIAVE_VAPID) }));
      for (const { id, orario } of avvisiDaRiprogrammare(await vociAvvisi(), self.registration.scope, Date.now())) {
        await fetch(`${URL_NOTIFICHE}/avvisi/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contatto: iscrizione.toJSON(), orario }),
          signal: AbortSignal.timeout(10_000),
        }).catch(() => undefined);
      }
    })().catch(() => undefined),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const app = finestre.find((c) => c.url.startsWith(self.registration.scope));
      if (app) await app.focus();
      else await self.clients.openWindow(self.registration.scope);
    })(),
  );
});
