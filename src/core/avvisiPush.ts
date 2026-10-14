// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { StatoPermessi, TipoAvviso } from './avvisi';

/**
 * Avvisi della PWA (web push): la pagina invia al backend l'orario di ogni avviso, il backend allo
 * scadere manda una notifica push e il service worker la mostra. Logica pura, condivisa dalla pagina
 * (`src/web/avvisi.ts`) e dal service worker (`src/sw.ts`).
 */

const TIPI: readonly TipoAvviso[] = ['uscita', 'pausa', 'sigaretta'];

/** Backend degli avvisi (Cloudflare Worker, repository `sbeggio-notifiche`). */
export const URL_NOTIFICHE = 'https://notifiche.sbeggio.app';
/** Chiave pubblica VAPID del backend (`VAPID_PUBLIC_KEY` in wrangler.jsonc): cambia solo con la coppia di chiavi. */
export const CHIAVE_VAPID = 'BDMM0_ITU0dc_OrEyil6M1IliUYEiKma7ANcCiK5CVxVIM8LxBWnycBd0NJG_PQpBTadDsQctWsx2z6dMzZb0iA';
/** Formato degli id accettato dal backend. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/** Cache del browser in cui la pagina lascia il testo di ogni avviso per il service worker. */
export const CACHE_AVVISI = 'sbeggio-avvisi';

/** Id dell'avviso sul backend: uno per dispositivo e tipo, così riprogrammare lo sostituisce. */
export function idAvviso(dispositivo: string, tipo: TipoAvviso): string {
  return `${dispositivo}-${tipo}`;
}

/** Il tipo dopo l'ultimo '-' dell'id, o null se l'id non è di un avviso riconoscibile. */
export function tipoDaId(id: string): TipoAvviso | null {
  const i = id.lastIndexOf('-');
  if (i < 0) return null;
  const tipo = id.slice(i + 1);
  return TIPI.find((t) => t === tipo) ?? null;
}

/** Indirizzo della voce nella Cache, risolto sullo scope del service worker: uguale nella pagina e nel worker. */
export function chiaveCache(scope: string, id: string): string {
  return new URL(`avvisi/${id}`, scope).href;
}

/** La chiave VAPID (base64url) come byte: il formato che `pushManager.subscribe` accetta ovunque, Safari compreso. */
export function chiaveDaBase64url(s: string): Uint8Array<ArrayBuffer> {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Avviso del piano di oggi con l'istante esatto già calcolato (epoch ms). */
export interface AvvisoPush {
  tipo: TipoAvviso;
  orario: number;
  titolo: string;
  testo: string;
}

/** Ciò che il backend ha già ricevuto per un tipo di avviso. */
export interface Inviato {
  orario: number;
  titolo: string;
  testo: string;
}

export type Inviati = Partial<Record<TipoAvviso, Inviato>>;

export type OperazionePush =
  | { azione: 'programma'; avviso: AvvisoPush }
  | { azione: 'annulla'; tipo: TipoAvviso }
  | { azione: 'dimentica'; tipo: TipoAvviso };

/**
 * Cosa chiedere al backend perché abbia esattamente gli avvisi del piano:
 * - avviso nuovo, cambiato (orario o testo) o con l'iscrizione push cambiata → programma (PUT);
 * - avviso inviato che non è più nel piano: se è ancora futuro → annulla (DELETE); se l'orario è
 *   passato → dimentica, senza DELETE: il server l'ha spedito o lo spedisce al prossimo giro e lo
 *   cancella da solo, e un DELETE in quel momento farebbe perdere un avviso appena scaduto.
 */
export function operazioniPush(
  piano: AvvisoPush[],
  inviati: Inviati,
  opz: { ora: number; endpointCambiato: boolean },
): OperazionePush[] {
  const operazioni: OperazionePush[] = [];
  for (const a of piano) {
    const prima = inviati[a.tipo];
    const uguale = prima !== undefined && prima.orario === a.orario && prima.titolo === a.titolo && prima.testo === a.testo;
    if (!uguale || opz.endpointCambiato) operazioni.push({ azione: 'programma', avviso: a });
  }
  for (const tipo of TIPI) {
    const prima = inviati[tipo];
    if (prima === undefined || piano.some((a) => a.tipo === tipo)) continue;
    operazioni.push(prima.orario > opz.ora ? { azione: 'annulla', tipo } : { azione: 'dimentica', tipo });
  }
  return operazioni;
}

/** Cosa si sa del browser per decidere lo stato dei permessi della PWA. */
export interface AmbientePush {
  /** iPhone o iPad con l'app aperta nel browser e non dalla schermata Home. */
  iosNonInstallata: boolean;
  /** Push API presente e service worker attivo. */
  supportato: boolean;
  permesso: 'granted' | 'denied' | 'default';
  /** C'è un'iscrizione push attiva. */
  iscritto: boolean;
}

export function statoPermessiWeb(a: AmbientePush): StatoPermessi {
  if (a.iosNonInstallata) return 'da-installare';
  if (!a.supportato) return 'non-disponibili';
  if (a.permesso === 'denied') return 'negati';
  if (a.permesso === 'granted') return a.iscritto ? 'concessi' : 'da-attivare';
  return 'da-chiedere';
}

/**
 * True se l'iscrizione è stata fatta con la chiave VAPID attuale del backend. Con una chiave vecchia
 * il push service rifiuterebbe ogni invio. Se il browser non la dice (null) la si dà per buona.
 */
export function stessaChiave(chiaveIscrizione: ArrayBuffer | null, attuale: Uint8Array): boolean {
  if (chiaveIscrizione === null) return true;
  const byte = new Uint8Array(chiaveIscrizione);
  return byte.length === attuale.length && byte.every((v, i) => v === attuale[i]);
}

/** Testo che la pagina salva nella Cache per un avviso: `orario` in ISO UTC, come nel payload del backend. */
export interface TestoSalvato {
  titolo: string;
  testo: string;
  orario: string;
}

export interface Notifica {
  titolo: string;
  testo: string;
  tag: string;
}

/**
 * Opzioni di `showNotification`. Il tag è l'id dell'avviso, uguale ogni giorno per lo stesso tipo:
 * con `renotify` una notifica che ne sostituisce una ancora visibile (es. la sigaretta del pomeriggio
 * su quella del mattino) suona e vibra comunque, invece di arrivare in silenzio.
 */
export function opzioniNotifica(n: Notifica): NotificationOptions & { renotify: boolean } {
  return { body: n.testo, tag: n.tag, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', renotify: true };
}

/** Testi usati quando manca quello salvato (es. Cache svuotata dal browser). */
const TESTI_GENERICI: Record<TipoAvviso, { titolo: string; testo: string }> = {
  uscita: { titolo: 'Puoi andare via', testo: 'Le ore di oggi sono completate.' },
  pausa: { titolo: 'Fine pausa pranzo', testo: 'È ora di rientrare.' },
  sigaretta: { titolo: 'Pausa sigaretta', testo: 'Rientra prima che diventi permesso.' },
};

function isOggetto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function testoSalvato(v: unknown): TestoSalvato | null {
  if (!isOggetto(v) || typeof v.titolo !== 'string' || typeof v.testo !== 'string' || typeof v.orario !== 'string') return null;
  return { titolo: v.titolo, testo: v.testo, orario: v.orario };
}

/**
 * Avvisi da riprogrammare quando il browser rinnova l'iscrizione push: le voci della Cache ancora
 * future, con id (ultima parte dell'indirizzo della voce) e orario. Serve al service worker, che non
 * ha accesso alle timbrature. `voci`: coppie [indirizzo della voce, contenuto JSON].
 */
export function avvisiDaRiprogrammare(voci: [string, unknown][], scope: string, ora: number): { id: string; orario: string }[] {
  const prefisso = chiaveCache(scope, '');
  const avvisi: { id: string; orario: string }[] = [];
  for (const [indirizzo, contenuto] of voci) {
    const id = indirizzo.startsWith(prefisso) ? indirizzo.slice(prefisso.length) : '';
    const t = testoSalvato(contenuto);
    if (!ID_VALIDO.test(id) || !t || !(Date.parse(t.orario) > ora)) continue;
    avvisi.push({ id, orario: t.orario });
  }
  return avvisi;
}

/**
 * Cosa mostrare per un push del backend. Restituisce sempre una notifica: con `userVisibleOnly` il
 * browser pretende che ogni push ne mostri una. Il testo salvato vale solo se è dello stesso orario
 * del push, così un testo rimasto da una vecchia programmazione non finisce su un avviso nuovo.
 */
export function notificaDaPush(payload: unknown, salvato: unknown): Notifica {
  if (!isOggetto(payload) || typeof payload.id !== 'string') {
    return { titolo: 'Sbeggio', testo: 'Apri l\'app per i dettagli.', tag: 'sbeggio' };
  }
  const id = payload.id;
  const t = testoSalvato(salvato);
  if (t && t.orario === payload.orario) return { titolo: t.titolo, testo: t.testo, tag: id };
  const tipo = tipoDaId(id);
  if (tipo) return { ...TESTI_GENERICI[tipo], tag: id };
  return {
    titolo: typeof payload.titolo === 'string' && payload.titolo !== '' ? payload.titolo : 'Sbeggio',
    testo: typeof payload.testo === 'string' ? payload.testo : '',
    tag: id,
  };
}
