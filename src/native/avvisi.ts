// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { EVENTO_RICALCOLA_AVVISI, ID_AVVISO, pianificaAvvisi, type Avviso, type StatoPermessi } from '../core/avvisi';
import { istanteDaMinuti } from '../core/sigaretta';
import { adessoRoma } from '../core/tempo';
import { store } from '../storage/store';
import { inizioSigarettaSalvato } from '../ui/inizioSigaretta';
import { schermateDaTacere } from '../ui/suoni';
import { inApp } from './app';

/** Notifiche locali dell'app Android: programmate sul telefono, suonano anche ad app chiusa. */

const CANALE = 'avvisi';

/**
 * Il plugin si carica solo nell'app. Si restituisce dentro un oggetto: un plugin Capacitor è un
 * proxy, e uscire da una funzione async con il proxy stesso fa chiamare `.then()`, che non esiste.
 */
async function notifiche() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return { LN: LocalNotifications };
}

export async function statoPermessi(): Promise<StatoPermessi> {
  if (!inApp()) return 'non-disponibili';
  try {
    const { LN } = await notifiche();
    const { display } = await LN.checkPermissions();
    if (display === 'granted') return 'concessi';
    return display === 'denied' ? 'negati' : 'da-chiedere';
  } catch {
    return 'non-disponibili';
  }
}

/**
 * Chiede il permesso di mostrare notifiche e, su Android 12+, quello per gli allarmi esatti
 * (apre la schermata "Sveglie e promemoria" del sistema). Poi riprogramma gli avvisi.
 */
export async function richiediPermessi(): Promise<StatoPermessi> {
  if (!inApp()) return 'non-disponibili';
  try {
    const { LN } = await notifiche();
    const { display } = await LN.requestPermissions();
    if (display === 'granted') {
      const esatti = await LN.checkExactNotificationSetting();
      if (esatti.exact_alarm !== 'granted') await LN.changeExactNotificationSetting();
    }
  } catch {
    /* il sistema ha rifiutato o l'utente ha annullato */
  }
  ultimaFirma = null;
  void sincronizzaAvvisi();
  return statoPermessi();
}

let canaleCreato = false;
let ultimaFirma: string | null = null;
let coda: Promise<void> = Promise.resolve();

async function esegui(): Promise<void> {
  const ora = new Date();
  const { data, minuti } = adessoRoma(ora);
  const piano: Avviso[] = pianificaAvvisi(store.giornata(data), store.impostazioni, { data, minuti }, {
    ora: ora.getTime(),
    inizioSigaretta: (eventoId) => inizioSigarettaSalvato(data, eventoId),
    schermateAperte: schermateDaTacere(),
  });
  const firma = JSON.stringify(piano);
  if (firma === ultimaFirma) return;

  const { LN } = await notifiche();
  if ((await LN.checkPermissions()).display !== 'granted') return; // si riprova dopo la concessione

  if (!canaleCreato) {
    await LN.createChannel({
      id: CANALE,
      name: 'Avvisi timbrature',
      description: 'Uscita prevista e rientro dalle pause',
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    canaleCreato = true;
  }
  // Si riparte sempre da zero: gli avvisi di prima potrebbero non essere più validi.
  await LN.cancel({ notifications: Object.values(ID_AVVISO).map((id) => ({ id })) });
  if (piano.length > 0) {
    // Senza il permesso per gli allarmi esatti (Android 12+) gli avvisi possono ritardare di
    // qualche minuto: lo si chiede con il pulsante nelle Impostazioni, non aprendo da soli
    // la schermata del sistema alla prima timbratura.
    const esatti = (await LN.checkExactNotificationSetting()).exact_alarm === 'granted';
    await LN.schedule({
      notifications: piano.map((a) => ({
        id: ID_AVVISO[a.tipo],
        title: a.titolo,
        body: a.testo,
        channelId: CANALE,
        schedule: { at: new Date(a.istante ?? istanteDaMinuti(a.minuti, ora)), allowWhileIdle: true },
        isExactNotification: esatti,
      })),
    });
  }
  ultimaFirma = firma;
}

/** Allinea gli avvisi programmati alle timbrature e alle impostazioni di oggi. Mai in parallelo. */
export function sincronizzaAvvisi(): Promise<void> {
  if (!inApp()) return Promise.resolve();
  coda = coda.then(esegui).catch(() => {
    /* il plugin non risponde: si riprova alla prossima modifica */
  });
  return coda;
}

/** Programma gli avvisi all'avvio e a ogni modifica dei dati; ripete al ritorno in primo piano. */
export function avviaAvvisi(): void {
  if (!inApp()) return;
  void sincronizzaAvvisi();
  store.ascolta(() => void sincronizzaAvvisi());
  document.addEventListener(EVENTO_RICALCOLA_AVVISI, () => void sincronizzaAvvisi());
  // Anche andando in secondo piano: la notifica tolta per il suono dell'app va rimessa.
  document.addEventListener('visibilitychange', () => void sincronizzaAvvisi());
}
