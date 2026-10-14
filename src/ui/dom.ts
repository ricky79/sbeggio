// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

type Figlio = Node | string | number | null | undefined | false;
type Attributi = Record<string, string | number | boolean | EventListener | undefined | null>;

/** Crea un elemento: el('button', { class: 'x', onclick: fn }, 'Testo'). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attr: Attributi = {},
  ...figli: (Figlio | Figlio[])[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      e.addEventListener(k.slice(2), v);
    } else if (k in e && typeof v !== 'string' && k !== 'class') {
      (e as unknown as Record<string, unknown>)[k] = v;
    } else if (k === 'value' && 'value' in e) {
      (e as unknown as { value: string }).value = String(v);
    } else {
      e.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const f of figli.flat()) {
    if (f === null || f === undefined || f === false) continue;
    e.append(f instanceof Node ? f : String(f));
  }
  return e;
}

/** Aggiorna il contenuto di un contenitore. */
export function monta(contenitore: Element, ...figli: Figlio[]): void {
  contenitore.replaceChildren(...figli.filter((f): f is Node | string => f !== null && f !== undefined && f !== false).map((f) => (typeof f === 'number' ? String(f) : f)));
}
