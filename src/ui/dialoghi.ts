// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { el } from './dom';

export interface PulsanteFoglio {
  etichetta: string;
  stile?: 'primario' | 'pericolo' | 'neutro';
  /** Restituisce false per lasciare aperto il foglio (es. validazione fallita). */
  azione?: () => boolean | void;
}

/**
 * Foglio modale dal basso (bottom sheet) basato su <dialog>.
 * Si chiude toccando lo sfondo o un pulsante.
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
    dlg.append(el('div', { class: 'foglio-corpo' }, el('h2', {}, titolo), contenuto, barra));
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
