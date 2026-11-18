// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Indirizzi di sbeggio.app che il Worker rimanda a web.sbeggio.app (src/worker.ts): Novità e Informazioni.
 * Il service worker della PWA li lascia passare alla rete invece di rispondere con l'app.
 */
export const PAGINE_DEL_SITO = /^\/(novita\/?|informazioni(\.html|\/)?)$/;
