// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/** Strega su scopa del tema di Halloween: vola verso sinistra (le animazioni sono in src/style.css). */
export const SVG_STREGA = `
<svg class="festa-strega" viewBox="0 -18 124 80" aria-hidden="true">
  <path d="M30 26 Q44 4 64 12 L92 30 Q70 26 56 34 Z" fill="#4c1d95"/>
  <line x1="6" y1="40" x2="96" y2="33" stroke="#78350f" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M92 29 L120 18 L118 32 L122 44 L92 38 Z" fill="#d97706"/>
  <path d="M96 31 L118 24 M96 34 L120 34 M96 37 L118 41" stroke="#92400e" stroke-width="1.2"/>
  <path d="M40 38 Q42 20 52 16 Q62 18 66 36 Z" fill="#2e1065"/>
  <path d="M60 34 L70 46 L76 46" fill="none" stroke="#1e1b4b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 22 L36 37" stroke="#2e1065" stroke-width="4" stroke-linecap="round"/>
  <circle cx="35" cy="38" r="2.6" fill="#86efac"/>
  <circle cx="51" cy="10" r="7" fill="#86efac"/>
  <path d="M51 13 Q53 15 55 13" fill="none" stroke="#14532d" stroke-width="1.2"/>
  <circle cx="48.5" cy="9" r="1.1" fill="#14532d"/>
  <path d="M55 2 Q66 6 62 22 Q58 12 55 8 Z" fill="#7c2d12"/>
  <g fill="#1e1b4b" stroke="#a78bfa" stroke-width="0.8">
    <ellipse cx="51" cy="4" rx="14" ry="2.8"/>
    <path d="M43 4 L59 4 Q60 -6 72 -14 Q56 -10 50 -2 Z"/>
  </g>
  <rect x="44" y="1" width="14" height="2.4" fill="#f97316"/>
</svg>`;

/** Decorazioni della festa sopra l'app (fisse, non toccabili): oggi solo la strega di Halloween. */
export function creaDecorazioni(): HTMLElement {
  const d = document.createElement('div');
  d.className = 'festa-decorazioni';
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = SVG_STREGA; // markup statico, nessun dato dell'utente
  return d;
}
