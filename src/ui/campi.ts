// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { formattaDurata } from '../core/tempo';
import { el } from './dom';

export interface Campo<T> {
  elemento: HTMLElement;
  leggi(): T;
}

/**
 * Selettore ore:minuti sempre in formato 24h (due <select>: su iPhone aprono la ruota).
 * Non dipende dalle impostazioni regionali del telefono come <input type=time>.
 */
export function selettoreOra(
  minuti: number,
  opz: { maxOre?: number; aria?: string; onChange?: (v: number) => void } = {},
): { elemento: HTMLElement; leggi(): number; imposta(v: number): void; abilita(si: boolean): void } {
  const maxOre = opz.maxOre ?? 23;
  const due = (n: number) => String(n).padStart(2, '0');
  const ore = el('select', { 'aria-label': `${opz.aria ?? 'Orario'}: ore` },
    Array.from({ length: maxOre + 1 }, (_, i) => el('option', { value: String(i) }, due(i))));
  const min = el('select', { 'aria-label': `${opz.aria ?? 'Orario'}: minuti` },
    Array.from({ length: 60 }, (_, i) => el('option', { value: String(i) }, due(i))));
  const imposta = (v: number) => {
    const c = Math.max(0, Math.min(maxOre * 60 + 59, Math.round(v)));
    ore.value = String(Math.floor(c / 60));
    min.value = String(c % 60);
  };
  const leggi = () => Number(ore.value) * 60 + Number(min.value);
  for (const s of [ore, min]) s.addEventListener('change', () => opz.onChange?.(leggi()));
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
