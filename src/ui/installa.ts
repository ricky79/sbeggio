// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { el } from './dom';
import { creaBanner, mostraBanner } from './banner';

export type Piattaforma = 'ios' | 'android' | 'altro';
/** 'pulsante' apre la finestra di installazione del browser (Android), 'istruzioni' spiega i passaggi (iPhone). */
export type Proposta = 'nessuna' | 'pulsante' | 'istruzioni';

export function piattaforma(userAgent: string, puntiTocco: number): Piattaforma {
  // iPadOS si presenta come un Mac: lo distingue solo lo schermo touch.
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && puntiTocco > 1)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'altro';
}

export function propostaInstallazione(s: {
  piattaforma: Piattaforma;
  installata: boolean;
  chiuso: boolean;
  promptPronto: boolean;
}): Proposta {
  if (s.installata || s.chiuso) return 'nessuna';
  if (s.piattaforma === 'ios') return 'istruzioni';
  if (s.piattaforma === 'android' && s.promptPronto) return 'pulsante';
  return 'nessuna';
}

/** Chiave separata dai dati, come per il tema: è una preferenza del dispositivo. */
const CHIAVE = 'timbrature-banner-installa-chiuso';

/** Evento di Chrome, Edge e Samsung Internet: non è standard e manca nei tipi di TypeScript. */
interface EventoInstallazione extends Event {
  prompt(): Promise<unknown>;
}

let dispositivo: Piattaforma = 'altro';
let promptRinviato: EventoInstallazione | null = null;
let chiuso = false;
let installata = false;
let comeFare: () => void = () => {};

/** True se l'app è aperta dall'icona sulla schermata Home (PWA installata). */
export const inModalitaApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function installa(): void {
  const evento = promptRinviato;
  promptRinviato = null; // il browser permette di usarlo una volta sola
  aggiorna();
  evento?.prompt().catch(() => {
    /* rifiutato dal browser: resta l'installazione dal menu */
  });
}

function chiudi(): void {
  chiuso = true;
  try {
    localStorage.setItem(CHIAVE, '1');
  } catch {
    /* resta chiuso solo per questa sessione */
  }
  aggiorna();
}

function bannerInstallazione(proposta: Exclude<Proposta, 'nessuna'>): HTMLElement {
  const android = proposta === 'pulsante';
  return creaBanner({
    etichetta: 'Installa l\'app',
    titolo: 'Installa l\'app',
    testo: android ? 'Si apre dall\'icona e funziona anche offline.' : 'Tocca Condividi, poi «Aggiungi alla schermata Home».',
    azione: android
      ? el('button', { type: 'button', class: 'btn btn-primario', onclick: installa }, 'Installa')
      : el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => comeFare() }, 'Come fare'),
    chiudi: 'Chiudi e non mostrare più',
    onChiudi: chiudi,
  });
}

function aggiorna(): void {
  const proposta = propostaInstallazione({
    piattaforma: dispositivo,
    installata: installata || inModalitaApp(),
    chiuso,
    promptPronto: promptRinviato !== null,
  });
  mostraBanner(proposta === 'nessuna' ? null : bannerInstallazione(proposta));
}

/**
 * Banner in basso che invita a installare l'app, finché non è installata o
 * l'utente lo chiude. Su Android il pulsante apre direttamente la finestra di
 * installazione del browser; su iPhone non è possibile, quindi spiega i passaggi.
 */
export function avviaBannerInstallazione(apriIstruzioni: () => void): void {
  comeFare = apriIstruzioni;
  dispositivo = piattaforma(navigator.userAgent, navigator.maxTouchPoints);
  try {
    chiuso = localStorage.getItem(CHIAVE) === '1';
  } catch {
    /* memoria non accessibile: il banner resta proponibile */
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // niente barra automatica di Chrome: si installa dal banner
    promptRinviato = e as EventoInstallazione;
    aggiorna();
  });
  window.addEventListener('appinstalled', () => {
    installata = true;
    aggiorna();
  });
  aggiorna();
}
