// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { Festa } from '../core/festa';

/** Strega su scopa del tema di Halloween: vola verso sinistra (le animazioni sono in src/style.css). */
export const SVG_STREGA = `
<svg class="festa-strega festa-volo" viewBox="0 -18 124 80" aria-hidden="true">
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

/** Renna della slitta in (x, y), rivolta a destra; `naso` rosso solo per quella davanti. */
const renna = (x: number, y: number, naso = false) => `
  <g transform="translate(${x} ${y})">
    <path d="M-14 0 Q-16 -3 -19 -5" stroke="#6b3f1d" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="0" rx="15" ry="7" fill="#8b5a2b"/>
    <path d="M-11 4 L-20 10 M-7 5 L-14 13 M9 4 L18 9 M12 3 L22 5" stroke="#6b3f1d" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M10 -3 Q14 -9 17 -14" stroke="#8b5a2b" stroke-width="6" stroke-linecap="round" fill="none"/>
    <ellipse cx="20" cy="-15" rx="6.5" ry="4.2" fill="#8b5a2b"/>
    <path d="M17 -18 L14 -27 M15 -22 L10 -25 M20 -18 L22 -28 M21 -23 L26 -26" stroke="#5b3417" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="21" cy="-16.5" r="1" fill="#1f1f1f"/>
    ${naso ? '<circle cx="26" cy="-14.5" r="2.2" fill="#ef4444"/>' : ''}
  </g>`;

/** Babbo Natale col sacco sulla slitta, tirata da due renne: vola verso destra (animazioni in src/style.css). */
export const SVG_SLITTA = `
<svg class="festa-slitta festa-volo" viewBox="0 -10 210 74" aria-hidden="true">
  <path d="M80 36 Q104 30 124 36 M80 37 Q130 28 171 36" stroke="#facc15" stroke-width="1.1" fill="none"/>${renna(130, 40)}${renna(176, 36, true)}
  <circle cx="27" cy="25" r="10" fill="#92400e"/>
  <path d="M22 18 L27 26 L32 18" stroke="#78350f" stroke-width="1.4" fill="none"/>
  <path d="M38 32 Q38 14 50 12 Q61 14 63 32 Z" fill="#dc2626"/>
  <circle cx="51" cy="8" r="6.2" fill="#fcd5b5"/>
  <path d="M44.5 9 Q51 24 57.5 9 Q51 13 44.5 9 Z" fill="#ffffff"/>
  <circle cx="53.5" cy="6.5" r="0.9" fill="#1f1f1f"/>
  <path d="M45 4 Q49 -9 61 -2 L57 4 Z" fill="#dc2626"/>
  <circle cx="61.5" cy="-2" r="2.3" fill="#ffffff"/>
  <rect x="44" y="2.5" width="14" height="3" rx="1.4" fill="#ffffff"/>
  <path d="M58 22 L72 30" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>
  <path d="M18 30 L76 30 Q85 30 82 40 Q78 49 63 49 L28 49 Q18 49 18 40 Z" fill="#b91c1c"/>
  <path d="M18 34 L80 34" stroke="#facc15" stroke-width="2"/>
  <path d="M30 49 L30 57 M64 49 L64 57" stroke="#a16207" stroke-width="2"/>
  <path d="M10 57 L78 57 Q90 57 89 47" stroke="#facc15" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</svg>`;

/** Fiocchi di neve nella fascia alta: posizione, durata e ritardo diversi, così non cadono insieme. */
const FIOCCHI = [
  'left:7%;animation-duration:7s',
  'left:28%;animation-duration:9s;animation-delay:2s',
  'left:50%;animation-duration:8s;animation-delay:4s;width:4px;height:4px',
  'left:71%;animation-duration:10s;animation-delay:1s',
  'left:90%;animation-duration:8.5s;animation-delay:5s;width:4px;height:4px',
];

/**
 * Decorazioni della festa sopra l'app (fisse, non toccabili): la strega a Halloween, la slitta e i
 * fiocchi a Natale. `data-festa` dice di quale festa sono (tema.ts le sostituisce se cambia).
 */
export function creaDecorazioni(festa: Festa): HTMLElement {
  const d = document.createElement('div');
  d.className = 'festa-decorazioni';
  d.dataset.festa = festa;
  d.setAttribute('aria-hidden', 'true');
  // Markup statico, nessun dato dell'utente.
  d.innerHTML =
    festa === 'natale'
      ? SVG_SLITTA + FIOCCHI.map((stile) => `<span class="festa-fiocco" style="${stile}"></span>`).join('')
      : SVG_STREGA;
  return d;
}
