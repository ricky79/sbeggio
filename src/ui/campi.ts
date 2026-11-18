// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { chiudi, normalizza } from '../core/inputOra';
import { formattaDurata } from '../core/tempo';
import { el } from './dom';

export interface Campo<T> {
  elemento: HTMLElement;
  leggi(): T;
}

/**
 * Selettore ore:minuti sempre in formato 24h: due caselle che si scrivono col tastierino numerico, il
 * cursore passa da solo dalle ore ai minuti (regole delle cifre in src/core/inputOra.ts).
 * Non è un <input type=time>: quello dipende dalle impostazioni regionali del telefono (AM/PM).
 */
export function selettoreOra(
  minuti: number,
  opz: { maxOre?: number; aria?: string; onChange?: (v: number) => void } = {},
): { elemento: HTMLElement; leggi(): number; imposta(v: number): void; abilita(si: boolean): void } {
  const maxOre = opz.maxOre ?? 23;
  const due = (n: number) => String(n).padStart(2, '0');
  // Niente maxlength: troncherebbe "08:47" incollato nelle ore, prima che i minuti ricevano il resto.
  const casella = (parte: string) =>
    el('input', {
      type: 'text',
      inputmode: 'numeric',
      pattern: '[0-9]*',
      autocomplete: 'off',
      'aria-label': `${opz.aria ?? 'Orario'}: ${parte}`,
    });
  const ore = casella('ore');
  const min = casella('minuti');
  /** Ultimi valori confermati: ci si torna se una casella resta vuota. */
  const stato = { ore: 0, min: 0 };
  let notificato = -1;

  const leggi = () => chiudi(ore.value, stato.ore) * 60 + chiudi(min.value, stato.min);
  const notifica = () => {
    const v = leggi();
    if (v === notificato) return;
    notificato = v;
    opz.onChange?.(v);
  };
  const imposta = (v: number) => {
    const c = Math.max(0, Math.min(maxOre * 60 + 59, Math.round(v)));
    stato.ore = Math.floor(c / 60);
    stato.min = c % 60;
    ore.value = due(stato.ore);
    min.value = due(stato.min);
    notificato = c;
  };

  const scriviMinuti = (scritto: string) => {
    const c = normalizza(scritto, 59);
    min.value = c.testo;
    if (!c.completa) return;
    stato.min = Number(c.testo);
    notifica();
    min.blur(); // orario completo: si chiude il tastierino
  };
  const scriviOre = (scritto: string) => {
    const c = normalizza(scritto, maxOre);
    ore.value = c.testo;
    if (!c.completa) return;
    stato.ore = Number(c.testo);
    notifica();
    min.focus();
    if (c.resto) scriviMinuti(c.resto); // "0847" scritto di fila o "08:47" incollato
  };
  ore.addEventListener('input', () => scriviOre(ore.value));
  min.addEventListener('input', () => scriviMinuti(min.value));

  for (const [c, parte] of [[ore, 'ore'], [min, 'min']] as const) {
    // Tutto selezionato al tocco: la prima cifra sostituisce il valore (setTimeout: su iPhone select()
    // durante il focus non sempre tiene).
    c.addEventListener('focus', () => setTimeout(() => c.select(), 0));
    c.addEventListener('blur', () => {
      stato[parte] = chiudi(c.value, stato[parte]);
      c.value = due(stato[parte]);
      notifica();
    });
  }
  // Cancella sui minuti vuoti: si torna alle ore.
  min.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && min.value === '') ore.focus();
  });
  imposta(minuti);
  return {
    elemento: el('span', { class: 'selettore-ora' }, ore, el('span', { 'aria-hidden': 'true' }, ':'), min),
    leggi,
    imposta,
    abilita: (si: boolean) => {
      ore.disabled = !si;
      min.disabled = !si;
    },
  };
}

/** Campo orario 24h con etichetta. */
export function campoOra(etichetta: string, minuti: number): Campo<number | null> {
  const s = selettoreOra(minuti, { aria: etichetta });
  return {
    elemento: el('div', { class: 'campo' }, el('span', {}, etichetta), s.elemento),
    leggi: () => s.leggi(),
  };
}

/** Selettore di durata con − / + a passi (default 15 min) e valore modificabile. */
export function campoDurata(
  etichetta: string,
  minuti: number,
  opz: { passo?: number; min?: number; max?: number; onChange?: (v: number) => void; formato?: (v: number) => string } = {},
): Campo<number> & { imposta(v: number): void } {
  const passo = opz.passo ?? 15;
  const min = opz.min ?? 0;
  const max = opz.max ?? 24 * 60;
  const formato = opz.formato ?? formattaDurata;
  let valore = minuti;
  const vista = el('output', { class: 'durata-valore' });
  const imposta = (v: number) => {
    valore = Math.max(min, Math.min(max, Math.round(v)));
    vista.textContent = formato(valore);
    opz.onChange?.(valore);
  };
  const minuto = el('input', {
    type: 'number',
    inputmode: 'numeric',
    class: 'durata-minuti',
    'aria-label': `${etichetta} in minuti`,
  });
  const sync = () => {
    minuto.value = String(valore);
  };
  minuto.addEventListener('change', () => {
    const v = Number(minuto.value);
    if (Number.isFinite(v)) imposta(v);
    sync();
  });
  const btn = (testo: string, delta: number) =>
    el('button', { type: 'button', class: 'btn-tondo', 'aria-label': `${delta > 0 ? 'Aumenta' : 'Diminuisci'} di ${passo} minuti`, onclick: () => { imposta(valore + delta); sync(); } }, testo);
  imposta(minuti);
  sync();
  return {
    elemento: el(
      'div',
      { class: 'campo' },
      el('span', {}, etichetta),
      el('div', { class: 'durata' }, btn('−', -passo), vista, btn('+', passo)),
      el('label', { class: 'durata-manuale' }, 'minuti: ', minuto),
    ),
    leggi: () => valore,
    imposta: (v: number) => {
      imposta(v);
      sync();
    },
  };
}
