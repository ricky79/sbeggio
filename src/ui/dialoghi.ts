// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { el } from './dom';

export interface PulsanteFoglio {
  etichetta: string;
  stile?: 'primario' | 'pericolo' | 'neutro';
  /** Restituisce false per lasciare aperto il foglio (es. validazione fallita). */
  azione?: () => boolean | void;
}

/** Trascinamento oltre il quale (px) il foglio si chiude; con uno scatto rapido basta meno. */
const SOGLIA_CHIUSURA = 120;
const SOGLIA_SCATTO = 40;
/** Velocità (px/ms) di uno scatto verso il basso, misurata sugli ultimi movimenti del dito. */
const VELOCITA_SCATTO = 0.5;
/** Sotto questo movimento (px) è ancora un tocco, non un trascinamento. */
const SOGLIA_TRASCINAMENTO = 8;

/**
 * Swipe verso il basso per chiudere, come i fogli di iOS: il foglio segue il dito solo se il
 * contenuto è già in cima (altrimenti il gesto scorre il contenuto); lasciato oltre la soglia, o con
 * uno scatto, scende e si chiude, altrimenti torna al suo posto.
 */
export function trascinaPerChiudere(dlg: HTMLDialogElement, chiudi: () => void): void {
  let inizio: { y: number; t: number } | null = null;
  // Ultimi due punti del dito: la velocità di uno scatto è quella finale, non la media dall'inizio.
  let prima = { y: 0, t: 0 };
  let ora = { y: 0, t: 0 };
  let spostamento = 0;
  let trascinando = false;
  const torna = () => {
    dlg.style.transition = 'transform 0.25s ease-out';
    dlg.style.transform = '';
  };
  dlg.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1 || dlg.scrollTop > 0) return;
      inizio = { y: e.touches[0]!.clientY, t: e.timeStamp };
      prima = ora = inizio;
      spostamento = 0;
      trascinando = false;
    },
    { passive: true },
  );
  dlg.addEventListener(
    'touchmove',
    (e) => {
      if (!inizio) return;
      spostamento = e.touches[0]!.clientY - inizio.y;
      prima = ora;
      ora = { y: e.touches[0]!.clientY, t: e.timeStamp };
      if (!trascinando) {
        // Verso l'alto, o il contenuto si è mosso: è uno scorrimento, non una chiusura.
        if (spostamento < 0 || dlg.scrollTop > 0) {
          inizio = null;
          return;
        }
        if (spostamento < SOGLIA_TRASCINAMENTO) return;
        trascinando = true;
        dlg.style.transition = 'none';
      }
      e.preventDefault();
      dlg.style.transform = `translateY(${Math.max(0, spostamento)}px)`;
    },
    { passive: false },
  );
  const fine = (e: TouchEvent) => {
    if (!inizio) return;
    // Se il dito si è fermato prima di staccarsi, non è uno scatto.
    const fermo = e.timeStamp - ora.t > 100;
    const velocita = fermo ? 0 : (ora.y - prima.y) / Math.max(1, ora.t - prima.t);
    const eraTrascinamento = trascinando;
    inizio = null;
    trascinando = false;
    if (!eraTrascinamento) return;
    if (spostamento > SOGLIA_CHIUSURA || (spostamento > SOGLIA_SCATTO && velocita > VELOCITA_SCATTO)) {
      dlg.style.transition = 'transform 0.2s ease-in';
      dlg.style.transform = 'translateY(100%)';
      setTimeout(chiudi, 200);
    } else torna();
  };
  dlg.addEventListener('touchend', fine);
  dlg.addEventListener('touchcancel', () => {
    if (trascinando) torna();
    inizio = null;
    trascinando = false;
  });
}

/**
 * Foglio modale dal basso (bottom sheet) basato su <dialog>.
 * Si chiude con un pulsante, con la ✕ in alto, toccando lo sfondo o trascinandolo verso il basso.
 */
export function apriFoglio(titolo: string, contenuto: Node | null, pulsanti: PulsanteFoglio[]): Promise<void> {
  return new Promise((risolvi) => {
    // Il foglio stesso prende il focus iniziale: altrimenti showModal() lo darebbe
    // al primo campo (es. il menu "Tipo"), che su telefono si aprirebbe da solo.
    const dlg = el('dialog', { class: 'foglio', 'aria-label': titolo, tabindex: -1, autofocus: true });
    const chiudi = () => {
      dlg.close();
    };
    dlg.addEventListener('close', () => {
      dlg.remove();
      risolvi();
    });
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg) chiudi();
    });
    const barra = el(
      'div',
      { class: 'foglio-azioni' },
      pulsanti.map((p) =>
        el(
          'button',
          {
            type: 'button',
            class: `btn btn-${p.stile ?? 'neutro'}`,
            onclick: () => {
              if (p.azione?.() === false) return;
              chiudi();
            },
          },
          p.etichetta,
        ),
      ),
    );
    // Intestazione fissa: maniglia (si può trascinare), titolo e ✕ sempre raggiungibili anche scorrendo.
    const testa = el(
      'div',
      { class: 'foglio-testa' },
      el('span', { class: 'foglio-maniglia', 'aria-hidden': 'true' }),
      el('h2', {}, titolo),
      el('button', { type: 'button', class: 'foglio-chiudi', 'aria-label': 'Chiudi', onclick: chiudi }, '✕'),
    );
    dlg.append(testa, el('div', { class: 'foglio-corpo' }, contenuto, barra));
    trascinaPerChiudere(dlg, chiudi);
    document.body.append(dlg);
    dlg.showModal();
    if (document.activeElement !== dlg) {
      (document.activeElement as HTMLElement | null)?.blur();
      dlg.focus({ preventScroll: true });
    }
  });
}

export async function conferma(
  titolo: string,
  messaggio: string,
  etichettaOk = 'Conferma',
  pericolo = false,
): Promise<boolean> {
  let ok = false;
  await apriFoglio(titolo, el('p', { class: 'testo-foglio' }, messaggio), [
    { etichetta: etichettaOk, stile: pericolo ? 'pericolo' : 'primario', azione: () => void (ok = true) },
    { etichetta: 'Annulla' },
  ]);
  return ok;
}

export function avviso(titolo: string, messaggio: string): Promise<void> {
  return apriFoglio(titolo, el('p', { class: 'testo-foglio' }, messaggio), [{ etichetta: 'OK', stile: 'primario' }]);
}

/**
 * Notifica breve in basso. Con `annulla` ha il tasto Annulla e resta di più: toccandolo il
 * messaggio sparisce e si chiama `annulla`.
 */
export function toast(messaggio: string, annulla?: () => void): void {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', { class: annulla ? 'toast con-annulla' : 'toast', role: 'status' }, el('span', {}, messaggio));
  if (annulla) {
    t.append(
      el('button', {
        type: 'button',
        class: 'toast-annulla',
        onclick: () => {
          t.remove();
          annulla();
        },
      }, 'Annulla'),
    );
  }
  document.body.append(t);
  // Nel top layer, sopra i dialoghi modali aperti: altrimenti un messaggio mostrato con un foglio
  // aperto (es. "Chiudi la finestra aperta…" letto dal tag) resterebbe nascosto. Senza Popover API
  // (WebView vecchie) il toast si vede come prima, sotto i dialoghi.
  if (typeof t.showPopover === 'function') {
    t.popover = 'manual';
    t.showPopover();
  }
  requestAnimationFrame(() => t.classList.add('visibile'));
  setTimeout(() => {
    t.classList.remove('visibile');
    setTimeout(() => t.remove(), 300);
  }, annulla ? 5000 : 2200);
}
