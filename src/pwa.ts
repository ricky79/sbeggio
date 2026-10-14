// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { registerSW } from 'virtual:pwa-register';
import { toast } from './ui/dialoghi';

/** Registra il service worker; i nuovi aggiornamenti si applicano da soli. */
export function registraServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const aggiorna = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Nessun dato in sospeso da perdere: tutto è già in localStorage.
      void aggiorna(true);
    },
    onOfflineReady() {
      toast('App pronta per l\'uso offline');
    },
  });
}
