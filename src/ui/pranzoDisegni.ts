// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { Cibo } from '../core/pranzo';

/*
 * Disegni della schermata della pausa pranzo (viewBox 300 × 180): il cibo al centro, che si consuma con
 * `mangiato` da 0 a 1. I resti del piatto sono nascosti dal CSS finché la pausa minima non è fatta (classe
 * .finito sulla schermata), le animazioni sono in src/style.css.
 */

const tra0e1 = (n: number) => Math.min(1, Math.max(0, n));

/** Centro del cibo nel disegno. */
const CX = 118;

/** Pezzi di sushi sul tagliere (servono già al disegno, più in basso). */
export const PEZZI_SUSHI = 6;

const PIATTO = `
  <ellipse cx="${CX}" cy="130" rx="92" ry="34" fill="#d6d3d1"/>
  <ellipse cx="${CX}" cy="126" rx="92" ry="34" fill="#fafaf9"/>
  <ellipse cx="${CX}" cy="126" rx="64" ry="22" fill="#efedea"/>`;

/** Il cibo è disegnato attorno a x = 118: lo spostamento lo porta al centro del disegno (150). */
const svg = (contenuto: string) =>
  `<svg class="pranzo-disegno" viewBox="0 0 300 180" aria-hidden="true"><g transform="translate(32 0)">${contenuto}</g></svg>`;

/*
 * Ramen nella ciotola: il brodo cala (e si restringe, la ciotola si stringe verso il fondo), gli
 * ingredienti spariscono uno alla volta; alla fine resta un fondo di brodo con il cipollotto.
 */
const RAMEN = svg(`
  <defs>
    <clipPath id="ramen-bocca"><ellipse cx="${CX}" cy="80" rx="74" ry="22"/></clipPath>
  </defs>
  <g class="ramen-vapore" fill="none" stroke="#e7e5e4" stroke-width="3" stroke-linecap="round">
    <path d="M100 50 c-6 -6 6 -11 0 -17 c-5 -5 5 -9 0 -14"/>
    <path d="M120 46 c6 -7 -6 -12 0 -18 c5 -5 -4 -9 0 -13"/>
    <path d="M140 50 c-5 -6 7 -11 1 -17 c-5 -6 6 -9 0 -15"/>
  </g>
  <ellipse cx="${CX}" cy="156" rx="56" ry="7" fill="#000" opacity="0.3"/>
  <rect x="94" y="140" width="48" height="13" rx="4" fill="#7f1d1d"/>
  <path d="M40 80 Q42 144 ${CX} 150 Q194 144 196 80 Z" fill="#b91c1c"/>
  <path d="M46 104 Q${CX} 124 190 104" fill="none" stroke="#fde68a" stroke-width="3"/>
  <path d="M52 118 Q${CX} 136 184 118" fill="none" stroke="#fde68a" stroke-width="1.5" opacity="0.7"/>
  <ellipse cx="${CX}" cy="80" rx="78" ry="25" fill="#7f1d1d"/>
  <ellipse cx="${CX}" cy="80" rx="74" ry="22" fill="#f5ede4"/>
  <g clip-path="url(#ramen-bocca)">
    <g class="cibo-resti">
      <ellipse cx="${CX}" cy="96" rx="34" ry="7" fill="#e9a23b" opacity="0.8"/>
      <g fill="#4ade80"><circle cx="106" cy="96" r="2"/><circle cx="124" cy="95" r="1.8"/><circle cx="116" cy="99" r="1.6"/></g>
    </g>
  </g>
  <rect class="ramen-alga" x="56" y="40" width="22" height="44" rx="2" fill="#1f3d2b" transform="rotate(-10 66 84)"/>
  <g clip-path="url(#ramen-bocca)">
    <g class="cibo-porzione ramen-brodo">
      <ellipse cx="${CX}" cy="82" rx="74" ry="22" fill="#e9a23b"/>
      <g fill="none" stroke="#fbe3a1" stroke-width="3" stroke-linecap="round">
        <path d="M58 82 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/>
        <path d="M66 92 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0"/>
        <path d="M70 72 q9 -6 18 0 t18 0 t18 0 t18 0 t18 0"/>
        <path d="M84 100 q9 -6 18 0 t18 0 t18 0"/>
      </g>
      <g class="ramen-carne">
        <ellipse cx="128" cy="94" rx="18" ry="9" fill="#b9775c"/>
        <ellipse cx="128" cy="93" rx="12" ry="5.5" fill="#e8b4a0"/>
      </g>
      <g class="ramen-naruto">
        <ellipse cx="154" cy="76" rx="13" ry="8" fill="#fafaf9" stroke="#f9a8d4" stroke-width="1.5"/>
        <path d="M154 76 m-1 0 a2 1.4 0 1 1 3 0.6 a4 2.8 0 1 1 -7 -1 a6.5 4.2 0 1 1 10.5 1.4" fill="none" stroke="#ec4899" stroke-width="1.5"/>
      </g>
      <g class="ramen-uovo">
        <ellipse cx="94" cy="84" rx="16" ry="10" fill="#fafaf9"/>
        <ellipse cx="94" cy="84" rx="9" ry="6" fill="#f59e0b"/>
      </g>
      <g class="ramen-cipollotto" fill="#4ade80">
        <circle cx="112" cy="74" r="2.2"/><circle cx="118" cy="80" r="2"/><circle cx="142" cy="92" r="2.2"/>
        <circle cx="108" cy="96" r="1.8"/><circle cx="148" cy="86" r="1.8"/><circle cx="80" cy="74" r="1.8"/>
      </g>
    </g>
  </g>
  <g class="bacchette" stroke="#a16207" stroke-width="4" stroke-linecap="round">
    <path d="M178 6 L132 76"/><path d="M188 10 L138 80"/>
  </g>`);

/* Pizza margherita sul tagliere: gli spicchi (creati da creaDisegnoPranzo) spariscono uno alla volta, in senso orario. */
const PIZZA = svg(`
  <circle cx="${CX}" cy="92" r="76" fill="#b7793d" stroke="#8a5a2b" stroke-width="4"/>
  <g fill="none" stroke="#a96d33" stroke-width="2" stroke-linecap="round" opacity="0.7">
    <path d="M62 60 q20 -6 40 2"/><path d="M130 140 q22 -4 40 -16"/><path d="M60 118 q14 6 28 4"/>
  </g>
  <g class="cibo-resti" fill="#e2a359">
    <circle cx="96" cy="84" r="2.5"/><circle cx="132" cy="104" r="2"/><circle cx="112" cy="116" r="3"/>
    <circle cx="140" cy="76" r="1.8"/><circle cx="104" cy="100" r="1.5"/>
  </g>
  <g class="pizza-spicchi"></g>`);

/* Panino: i morsi lo accorciano da destra fino alle briciole. */
const PANINO = svg(`
  ${PIATTO}
  <defs>
    <mask id="panino-morsi" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="180">
      <rect class="morso-resto" x="0" y="0" width="204" height="180" fill="#fff"/>
      <g class="morso-denti" fill="#000">
        <circle cx="204" cy="60" r="11"/><circle cx="204" cy="80" r="11"/>
        <circle cx="204" cy="100" r="11"/><circle cx="204" cy="118" r="11"/>
      </g>
    </mask>
  </defs>
  <g class="cibo-resti" fill="#d99a4e">
    <circle cx="96" cy="124" r="2.5"/><circle cx="128" cy="128" r="2"/><circle cx="140" cy="120" r="3"/>
    <circle cx="110" cy="130" r="1.6"/>
  </g>
  <g class="cibo-porzione" mask="url(#panino-morsi)">
    <rect x="48" y="102" width="140" height="18" rx="8" fill="#d99a4e"/>
    <path d="M44 100 q6 -8 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 v6 h-144 z" fill="#65a30d"/>
    <rect x="50" y="92" width="136" height="9" rx="4" fill="#f4a3b4"/>
    <path d="M50 86 h136 v6 h-136 z M66 92 l7 9 l7 -9 z M116 92 l6 8 l6 -8 z M158 92 l7 10 l7 -10 z" fill="#facc15"/>
    <rect x="54" y="80" width="128" height="7" rx="3" fill="#dc2626"/>
    <path d="M48 84 Q48 52 118 50 Q188 52 188 84 Z" fill="#e0a458"/>
    <g fill="#fef3c7">
      <ellipse cx="92" cy="64" rx="3" ry="1.6"/><ellipse cx="118" cy="58" rx="3" ry="1.6"/>
      <ellipse cx="146" cy="64" rx="3" ry="1.6"/><ellipse cx="104" cy="74" rx="3" ry="1.6"/>
      <ellipse cx="134" cy="73" rx="3" ry="1.6"/><ellipse cx="166" cy="74" rx="3" ry="1.6"/>
    </g>
  </g>`);

/* Mela: morsi dai due lati fino al torsolo (alla fine resta la polpa con i semi), polpa chiara sul bordo dei morsi. */
const MELA_FORMA = 'M118 62 C95 50 70 62 72 96 C74 128 100 142 118 134 C136 142 162 128 164 96 C166 62 141 50 118 62 Z';
const morsiMela = (classe: string) => `
  <g class="${classe}" fill="#000">
    <rect class="morso-sx" x="0" y="0" width="46" height="180"/><rect class="morso-dx" x="190" y="0" width="110" height="180"/>
    ${[64, 82, 100, 118, 136].map((y) => `<circle class="morso-sx" cx="59" cy="${y}" r="13"/><circle class="morso-dx" cx="177" cy="${y}" r="13"/>`).join('')}
  </g>`;
const MELA = svg(`
  ${PIATTO}
  <defs>
    <mask id="mela-buccia" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="180">
      <rect x="0" y="0" width="300" height="180" fill="#fff"/>${morsiMela('morsi-buccia')}
    </mask>
    <mask id="mela-polpa" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="180">
      <rect x="0" y="0" width="300" height="180" fill="#fff"/>${morsiMela('morsi-polpa')}
    </mask>
  </defs>
  <path d="${MELA_FORMA}" fill="#fdf0c4" mask="url(#mela-polpa)"/>
  <g class="mela-buccia" mask="url(#mela-buccia)">
    <path d="${MELA_FORMA}" fill="#dc2626"/>
    <ellipse cx="96" cy="82" rx="9" ry="14" fill="#fca5a5" opacity="0.55" transform="rotate(20 96 82)"/>
  </g>
  <g class="cibo-resti">
    <ellipse cx="118" cy="60" rx="9" ry="4" fill="#dc2626"/>
    <ellipse cx="118" cy="134" rx="8" ry="3.5" fill="#dc2626"/>
    <g fill="#451a03"><ellipse cx="114" cy="94" rx="2.5" ry="4"/><ellipse cx="122" cy="104" rx="2.5" ry="4"/></g>
  </g>
  <path d="M118 62 Q118 50 123 42" fill="none" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="133" cy="48" rx="10" ry="5" fill="#16a34a" transform="rotate(-25 133 48)"/>`);

/* Spaghetti al pomodoro: il nido si rimpicciolisce (creaDisegnoPranzo), la forchetta arrotola. */
const SPAGHETTI = svg(`
  ${PIATTO}
  <g class="cibo-resti">
    <ellipse cx="${CX}" cy="124" rx="30" ry="9" fill="#c2410c" opacity="0.75"/>
    <g fill="none" stroke="#f4d27a" stroke-width="3" stroke-linecap="round">
      <path d="M92 128 q12 -8 26 -2 t24 0"/><path d="M108 120 q10 6 22 2"/>
    </g>
  </g>
  <g class="cibo-porzione spaghetti-nido">
    <ellipse cx="${CX}" cy="106" rx="60" ry="24" fill="#e9bd55"/>
    <g fill="none" stroke-width="3" stroke-linecap="round">
      <g stroke="#fbe08f">
        <path d="M62 104 q28 -22 56 -6 t56 -2"/><path d="M66 114 q30 14 56 0 t52 2"/><path d="M76 96 q20 26 46 12 t42 -14"/>
      </g>
      <g stroke="#d9a53c">
        <path d="M70 108 q24 -16 50 0 t50 0"/><path d="M84 120 q18 -12 36 0 t34 -2"/><path d="M80 92 q22 8 40 -2 t38 4"/>
      </g>
    </g>
    <ellipse cx="${CX}" cy="96" rx="30" ry="13" fill="#dc2626"/>
    <g fill="#b91c1c"><circle cx="106" cy="94" r="4"/><circle cx="128" cy="99" r="3.5"/><circle cx="120" cy="90" r="2.5"/></g>
    <ellipse cx="112" cy="86" rx="9" ry="4.5" fill="#16a34a" transform="rotate(-20 112 86)"/>
    <ellipse cx="124" cy="85" rx="8" ry="4" fill="#22c55e" transform="rotate(25 124 85)"/>
  </g>
  <g class="forchetta">
    <g transform="translate(150 84) rotate(32)">
      <rect x="-3" y="-86" width="6" height="58" rx="3" fill="#9ca3af"/>
      <path d="M-10 -28 h20 l-3 8 h-14 z" fill="#9ca3af"/>
      <g fill="#9ca3af"><rect x="-10" y="-22" width="3" height="22" rx="1"/><rect x="-4.5" y="-22" width="3" height="22" rx="1"/>
        <rect x="1.5" y="-22" width="3" height="22" rx="1"/><rect x="7" y="-22" width="3" height="22" rx="1"/></g>
      <g fill="none" stroke="#fbe08f" stroke-width="3"><ellipse cx="0" cy="-8" rx="13" ry="5"/><ellipse cx="0" cy="-2" rx="12" ry="4.5"/></g>
    </g>
  </g>`);

/*
 * Gelato in coppetta: una cucchiata alla volta. Ogni pallina ha la sua maschera con tre cerchi neri sul
 * bordo: ogni cucchiata ne mostra uno e toglie un arco; alla quarta la pallina sparisce (statoGelato).
 */
const PALLINE = [
  // Dal basso: cioccolato, pistacchio, fragola in cima (si mangia per prima).
  { cx: 92, cy: 98, colore: '#7c4a2d', luce: '#a16a4a', puntini: '#3f2a1d', angoli: [-140, 170, -100] },
  { cx: 144, cy: 98, colore: '#a3c76d', luce: '#d9f99d', puntini: '#65a30d', angoli: [-40, 10, -80] },
  { cx: 118, cy: 64, colore: '#f9a8d4', luce: '#fce7f3', puntini: '#be185d', angoli: [-30, -150, -90] },
];
const R_PALLINA = 28;
const gelatoPallina = (p: (typeof PALLINE)[number], i: number) => {
  const cucchiate = p.angoli
    .map((a) => {
      const r = ((a * Math.PI) / 180);
      return `<circle class="gelato-cucchiata" cx="${(p.cx + (R_PALLINA + 4) * Math.cos(r)).toFixed(1)}" cy="${(p.cy + (R_PALLINA + 4) * Math.sin(r)).toFixed(1)}" r="12"/>`;
    })
    .join('');
  return `
    <mask id="gelato-mask-${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="180">
      <rect x="0" y="0" width="300" height="180" fill="#fff"/><g fill="#000">${cucchiate}</g>
    </mask>
    <g class="gelato-pallina" mask="url(#gelato-mask-${i})">
      <circle cx="${p.cx}" cy="${p.cy}" r="${R_PALLINA}" fill="${p.colore}"/>
      <ellipse cx="${p.cx - 9}" cy="${p.cy - 10}" rx="9" ry="6" fill="${p.luce}" opacity="0.7" transform="rotate(-25 ${p.cx - 9} ${p.cy - 10})"/>
      <g fill="${p.puntini}"><circle cx="${p.cx + 8}" cy="${p.cy + 4}" r="2"/><circle cx="${p.cx - 4}" cy="${p.cy + 12}" r="1.8"/><circle cx="${p.cx + 14}" cy="${p.cy - 8}" r="1.6"/></g>
    </g>`;
};
const GELATO = svg(`
  <ellipse cx="${CX}" cy="164" rx="44" ry="6" fill="#000" opacity="0.3"/>
  <g class="cibo-resti">
    <path d="M70 112 Q72 96 ${CX} 98 Q164 96 166 112 Z" fill="#f5c6d8"/>
    <path d="M84 106 q14 -6 28 0 t28 0" fill="none" stroke="#a3c76d" stroke-width="3" stroke-linecap="round"/>
    <path d="M100 103 q10 -4 20 0" fill="none" stroke="#7c4a2d" stroke-width="3" stroke-linecap="round"/>
    <path d="M150 110 q4 8 0 14" fill="none" stroke="#f5c6d8" stroke-width="4" stroke-linecap="round"/>
  </g>
  ${PALLINE.map(gelatoPallina).join('')}
  <path d="M72 116 L94 160 H142 L164 116 Z" fill="#d9a35b"/>
  <g stroke="#b7792f" stroke-width="2" opacity="0.8">
    <path d="M86 116 L112 160 M104 116 L128 160 M122 116 L142 156 M140 116 L154 140"/>
    <path d="M150 116 L124 160 M132 116 L108 160 M114 116 L96 152 M96 116 L84 140"/>
  </g>
  <rect x="64" y="110" width="108" height="12" rx="6" fill="#e5b26b"/>
  <g class="cucchiaino">
    <path d="M196 34 L162 80" stroke="#d1d5db" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="158" cy="86" rx="9" ry="6" fill="#e5e7eb" transform="rotate(-54 158 86)"/>
  </g>`);

/* Insalata nella ciotola: gli ingredienti spariscono uno alla volta (creaDisegnoPranzo), le foglie per ultime. */
const INSALATA = svg(`
  <ellipse cx="${CX}" cy="156" rx="56" ry="7" fill="#000" opacity="0.3"/>
  <ellipse cx="${CX}" cy="84" rx="78" ry="25" fill="#e7e5e4"/>
  <ellipse cx="${CX}" cy="84" rx="74" ry="22" fill="#f5f5f4"/>
  <g class="cibo-resti">
    <g fill="#facc15" opacity="0.75"><ellipse cx="100" cy="90" rx="6" ry="2.5"/><ellipse cx="134" cy="94" rx="5" ry="2"/><ellipse cx="118" cy="86" rx="4" ry="1.8"/></g>
    <ellipse cx="128" cy="86" rx="10" ry="4" fill="#4ade80" transform="rotate(-15 128 86)"/>
  </g>
  <g class="cibo-porzione">
    <g class="insalata-foglie">
      <ellipse cx="72" cy="78" rx="22" ry="11" fill="#22c55e" transform="rotate(-25 72 78)"/>
      <ellipse cx="164" cy="78" rx="22" ry="11" fill="#22c55e" transform="rotate(25 164 78)"/>
      <ellipse cx="96" cy="66" rx="24" ry="12" fill="#4ade80" transform="rotate(-12 96 66)"/>
      <ellipse cx="142" cy="66" rx="24" ry="12" fill="#4ade80" transform="rotate(14 142 66)"/>
      <ellipse cx="118" cy="58" rx="22" ry="12" fill="#86efac"/>
      <ellipse cx="118" cy="82" rx="40" ry="12" fill="#16a34a"/>
      <g fill="none" stroke="#15803d" stroke-width="1.5" opacity="0.6"><path d="M80 64 L112 68"/><path d="M126 68 L158 62"/><path d="M106 56 L130 60"/></g>
    </g>
    <g class="insalata-carote" fill="#f97316">
      <rect x="86" y="72" width="20" height="4" rx="2" transform="rotate(-20 96 74)"/>
      <rect x="132" y="80" width="20" height="4" rx="2" transform="rotate(15 142 82)"/>
      <rect x="110" y="66" width="18" height="4" rx="2" transform="rotate(30 119 68)"/>
    </g>
    <g class="insalata-mais" fill="#facc15">
      <circle cx="102" cy="82" r="3"/><circle cx="108" cy="86" r="3"/><circle cx="140" cy="70" r="3"/>
      <circle cx="146" cy="74" r="3"/><circle cx="80" cy="74" r="3"/><circle cx="126" cy="88" r="3"/>
    </g>
    <g class="insalata-pomodorini">
      <g fill="#ef4444"><circle cx="92" cy="60" r="9"/><circle cx="150" cy="84" r="9"/><circle cx="130" cy="54" r="8"/></g>
      <g fill="#15803d"><circle cx="92" cy="52" r="2.2"/><circle cx="150" cy="76" r="2.2"/><circle cx="130" cy="47" r="2"/></g>
    </g>
  </g>
  <path d="M40 84 A78 25 0 0 0 196 84 Q194 144 ${CX} 150 Q42 144 40 84 Z" fill="#fafaf9"/>
  <path d="M46 108 Q${CX} 130 190 108" fill="none" stroke="#0f766e" stroke-width="3"/>`);

/* Sushi sul tagliere: i pezzi (maki e nigiri alternati) spariscono uno alla volta da sinistra. */
const pezzoSushi = (i: number) => {
  const x = 46 + i * 28;
  return i % 2 === 0
    ? `<g class="sushi-pezzo">
        <ellipse cx="${x}" cy="120" rx="11" ry="6" fill="#1f2937"/>
        <rect x="${x - 11}" y="102" width="22" height="18" fill="#1f2937"/>
        <ellipse cx="${x}" cy="102" rx="11" ry="6" fill="#fafaf9"/>
        <ellipse cx="${x}" cy="102" rx="5" ry="3" fill="#fb923c"/>
        <circle cx="${x + 2}" cy="101" r="1.2" fill="#4ade80"/>
      </g>`
    : `<g class="sushi-pezzo">
        <ellipse cx="${x}" cy="116" rx="12" ry="7" fill="#fafaf9"/>
        <ellipse cx="${x}" cy="107" rx="13" ry="7" fill="#fb923c"/>
        <g fill="none" stroke="#fed7aa" stroke-width="1.5"><path d="M${x - 8} 104 l5 6"/><path d="M${x - 2} 102 l5 7"/><path d="M${x + 4} 102 l4 6"/></g>
      </g>`;
};
const SUSHI = svg(`
  <rect x="26" y="98" width="184" height="44" rx="8" fill="#1c1917"/>
  <rect x="26" y="92" width="184" height="42" rx="8" fill="#44403c"/>
  <g class="cibo-resti" fill="#fafaf9">
    <ellipse cx="72" cy="114" rx="2" ry="1.2"/><ellipse cx="118" cy="120" rx="2" ry="1.2"/><ellipse cx="160" cy="110" rx="2" ry="1.2"/>
    <ellipse cx="96" cy="108" rx="1.6" ry="1"/>
  </g>
  <g class="cibo-porzione">${Array.from({ length: PEZZI_SUSHI }, (_, i) => pezzoSushi(i)).join('')}</g>
  <ellipse cx="196" cy="156" rx="20" ry="8" fill="#e7e5e4"/>
  <ellipse cx="196" cy="155" rx="15" ry="5.5" fill="#451a03"/>
  <ellipse cx="174" cy="152" rx="7" ry="4" fill="#84cc16"/>
  <g class="sushi-bacchette" stroke="#a16207" stroke-width="4" stroke-linecap="round">
    <path d="M52 74 L196 62"/><path d="M54 82 L198 70"/>
  </g>`);

const SVG: Record<Cibo, string> = {
  ramen: RAMEN,
  pizza: PIZZA,
  panino: PANINO,
  mela: MELA,
  spaghetti: SPAGHETTI,
  gelato: GELATO,
  insalata: INSALATA,
  sushi: SUSHI,
};

export interface DisegnoPranzo {
  elemento: Element;
  /** Aggiorna il cibo (`mangiato` da 0 a 1). */
  aggiorna(mangiato: number): void;
}

const NS = 'http://www.w3.org/2000/svg';
const SPICCHI = 8;

/** Spicchio di pizza `i` (di 8) con raggio `r` attorno al centro del tagliere. */
function spicchio(i: number, r: number): string {
  const a0 = (i * 2 * Math.PI) / SPICCHI - Math.PI / 2;
  const a1 = a0 + (2 * Math.PI) / SPICCHI;
  const p = (a: number) => `${(CX + r * Math.cos(a)).toFixed(1)} ${(92 + r * Math.sin(a)).toFixed(1)}`;
  return `M${CX} 92 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`;
}

function creaSpicchi(gruppo: Element): Element[] {
  return Array.from({ length: SPICCHI }, (_, i) => {
    const g = document.createElementNS(NS, 'g');
    const mezzo = ((i + 0.5) * 2 * Math.PI) / SPICCHI - Math.PI / 2;
    const punto = (r: number) => [CX + r * Math.cos(mezzo), 92 + r * Math.sin(mezzo)] as const;
    const [mx, my] = punto(32);
    const [bx, by] = punto(46);
    // Markup statico, nessun dato dell'utente.
    g.innerHTML = `
      <path d="${spicchio(i, 64)}" fill="#e2a359" stroke="#b9772f" stroke-width="1"/>
      <path d="${spicchio(i, 54)}" fill="#d23a26"/>
      <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="8" fill="#fff7ed"/>
      ${i % 2 === 0 ? `<ellipse cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" rx="5" ry="2.5" fill="#15803d" transform="rotate(${((mezzo * 180) / Math.PI).toFixed(0)} ${bx.toFixed(1)} ${by.toFixed(1)})"/>` : ''}`;
    gruppo.append(g);
    return g;
  });
}

/** Spicchi di pizza ancora nel tagliere: si parte da 8, a fine pausa minima non ne resta nessuno. */
export function spicchiRimasti(mangiato: number): number {
  return Math.ceil(SPICCHI * (1 - tra0e1(mangiato)));
}

/** Bordo destro del panino (unità SVG): dal fondo a destra (204) fino a sparire (44). */
export function bordoPanino(mangiato: number): number {
  return 204 - 160 * tra0e1(mangiato);
}

/** Bordi dei morsi della mela (unità SVG): dai fianchi (72, 164) fino al torsolo (110, 126). */
export function bordiMela(mangiato: number): { sinistro: number; destro: number } {
  const m = tra0e1(mangiato);
  return { sinistro: 72 + 38 * m, destro: 164 - 38 * m };
}

/** Brodo del ramen: quanto scende (unità SVG) e quanto si restringe la superficie. */
export function livelloRamen(mangiato: number): { abbassamento: number; scala: number } {
  const m = tra0e1(mangiato);
  return { abbassamento: 14 * m, scala: 1 - 0.4 * m };
}

/** Ingredienti del ramen e quanto si è mangiato quando spariscono, uno alla volta. */
export const INGREDIENTI_RAMEN = { alga: 0.2, uovo: 0.4, naruto: 0.6, carne: 0.8 } as const;

/** Gli ingredienti ancora nella ciotola. */
export function ingredientiRamen(mangiato: number): (keyof typeof INGREDIENTI_RAMEN)[] {
  return (Object.keys(INGREDIENTI_RAMEN) as (keyof typeof INGREDIENTI_RAMEN)[]).filter((k) => mangiato < INGREDIENTI_RAMEN[k]);
}

/** Nido di spaghetti: la scala va da 1 (piatto pieno) a 0,35 (ultime forchettate). */
export function scalaSpaghetti(mangiato: number): number {
  return 1 - 0.65 * tra0e1(mangiato);
}

export const PALLINE_GELATO = 3;
export const CUCCHIATE_PER_PALLINA = 4;

/**
 * Gelato: palline ancora nella coppetta e archi già tolti alla pallina in cima. Le cucchiate sono 4 per
 * pallina: le prime 3 tolgono un arco dal bordo, la quarta finisce la pallina.
 */
export function statoGelato(mangiato: number): { palline: number; cucchiate: number } {
  const totali = PALLINE_GELATO * CUCCHIATE_PER_PALLINA;
  // Il piccolo margine evita che 4/12 · 12 diventi 3,9999… per l'aritmetica in virgola mobile.
  const prese = Math.min(totali, Math.floor(totali * tra0e1(mangiato) + 1e-9));
  return { palline: PALLINE_GELATO - Math.floor(prese / CUCCHIATE_PER_PALLINA), cucchiate: prese % CUCCHIATE_PER_PALLINA };
}

/** Ingredienti dell'insalata e quanto si è mangiato quando spariscono: le foglie per ultime. */
export const INGREDIENTI_INSALATA = { mais: 0.25, carote: 0.5, pomodorini: 0.75, foglie: 1 } as const;

/** Gli ingredienti ancora nella ciotola. */
export function ingredientiInsalata(mangiato: number): (keyof typeof INGREDIENTI_INSALATA)[] {
  const m = tra0e1(mangiato);
  return (Object.keys(INGREDIENTI_INSALATA) as (keyof typeof INGREDIENTI_INSALATA)[]).filter((k) => m < INGREDIENTI_INSALATA[k]);
}

/** Pezzi di sushi ancora sul tagliere: si parte da 6, a fine pausa minima non ne resta nessuno. */
export function pezziSushi(mangiato: number): number {
  return Math.ceil(PEZZI_SUSHI * (1 - tra0e1(mangiato)));
}

let disegniCreati = 0;

/**
 * Id di maschere e ritagli unici per ogni disegno: con due disegni nella stessa pagina `url(#…)` userebbe
 * quello del primo (per il gelato, le cucchiate di un altro).
 */
function idUnici(elemento: Element): void {
  const suffisso = `-${++disegniCreati}`;
  for (const nodo of elemento.querySelectorAll('[id]')) nodo.id += suffisso;
  for (const nodo of elemento.querySelectorAll('[mask], [clip-path]')) {
    for (const attributo of ['mask', 'clip-path']) {
      const valore = nodo.getAttribute(attributo);
      if (valore) nodo.setAttribute(attributo, valore.replace(/url\(#([^)]+)\)/, `url(#$1${suffisso})`));
    }
  }
}

/** Crea il disegno del cibo `cibo`. */
export function creaDisegnoPranzo(cibo: Cibo): DisegnoPranzo {
  const contenitore = document.createElement('div');
  contenitore.innerHTML = SVG[cibo]; // markup statico, nessun dato dell'utente
  const elemento = contenitore.firstElementChild!;
  // Prima di idUnici: le cucchiate del gelato si trovano dall'id della maschera di ogni pallina.
  const cucchiateGelato = [...elemento.querySelectorAll('mask[id^="gelato-mask-"]')].map((m) => [...m.querySelectorAll('.gelato-cucchiata')]);
  idUnici(elemento);
  elemento.classList.add(`pranzo-${cibo}`);

  if (cibo === 'pizza') {
    const spicchi = creaSpicchi(elemento.querySelector('.pizza-spicchi')!);
    return {
      elemento,
      aggiorna: (m) => {
        const n = spicchiRimasti(m);
        // Gli spicchi sono numerati in senso orario da ore 12: si mangiano i primi, così il vuoto gira in senso orario.
        spicchi.forEach((s, i) => s.setAttribute('visibility', i >= SPICCHI - n ? 'visible' : 'hidden'));
      },
    };
  }
  if (cibo === 'panino') {
    const resto = elemento.querySelector('.morso-resto')!;
    const denti = [...elemento.querySelectorAll('.morso-denti circle')];
    return {
      elemento,
      aggiorna: (m) => {
        const x = bordoPanino(m);
        resto.setAttribute('width', String(x));
        denti.forEach((d) => d.setAttribute('cx', String(x)));
      },
    };
  }
  if (cibo === 'mela') {
    // Ogni lato: i cerchi fanno il bordo del morso, il rettangolo toglie tutto quello che sta oltre.
    const morsi = (classe: string, rientro: number) =>
      [...elemento.querySelectorAll(`.${classe} > *`)].map((f) => ({ f, sx: f.classList.contains('morso-sx'), rientro }));
    // La polpa resta 4 unità oltre la buccia: è il bordo chiaro del morso.
    const tutti = [...morsi('morsi-buccia', 0), ...morsi('morsi-polpa', 4)];
    return {
      elemento,
      aggiorna: (m) => {
        const b = bordiMela(m);
        for (const { f, sx, rientro } of tutti) {
          const centro = sx ? b.sinistro - 13 - rientro : b.destro + 13 + rientro;
          if (f.tagName === 'circle') f.setAttribute('cx', String(centro));
          else if (sx) f.setAttribute('width', String(Math.max(0, centro)));
          else f.setAttribute('x', String(centro));
        }
      },
    };
  }
  if (cibo === 'spaghetti') {
    const nido = elemento.querySelector('.spaghetti-nido')!;
    return {
      elemento,
      aggiorna: (m) => nido.setAttribute('transform', `translate(${CX} 104) scale(${scalaSpaghetti(m)}) translate(${-CX} -104)`),
    };
  }
  if (cibo === 'gelato') {
    const palline = [...elemento.querySelectorAll('.gelato-pallina')];
    const cucchiate = cucchiateGelato;
    return {
      elemento,
      aggiorna: (m) => {
        const s = statoGelato(m);
        palline.forEach((p, i) => {
          p.setAttribute('visibility', i < s.palline ? 'visible' : 'hidden');
          // Solo la pallina in cima ha gli archi tolti dalle cucchiate.
          const presi = i === s.palline - 1 ? s.cucchiate : 0;
          // Raggio 0 invece di visibility: dentro una maschera è sicuro su tutti i browser (anche Safari).
          cucchiate[i]!.forEach((c, j) => c.setAttribute('r', j < presi ? '12' : '0'));
        });
      },
    };
  }
  if (cibo === 'insalata') {
    const ingredienti = (Object.keys(INGREDIENTI_INSALATA) as (keyof typeof INGREDIENTI_INSALATA)[]).map(
      (k) => [k, elemento.querySelector(`.insalata-${k}`)!] as const,
    );
    return {
      elemento,
      aggiorna: (m) => {
        const restano = ingredientiInsalata(m);
        for (const [k, nodo] of ingredienti) nodo.setAttribute('visibility', restano.includes(k) ? 'visible' : 'hidden');
      },
    };
  }
  if (cibo === 'sushi') {
    const pezzi = [...elemento.querySelectorAll('.sushi-pezzo')];
    return {
      elemento,
      aggiorna: (m) => {
        const n = pezziSushi(m);
        // Si mangia da sinistra: restano visibili gli ultimi n.
        pezzi.forEach((p, i) => p.setAttribute('visibility', i >= PEZZI_SUSHI - n ? 'visible' : 'hidden'));
      },
    };
  }
  const brodo = elemento.querySelector('.ramen-brodo')!;
  const ingredienti = (Object.keys(INGREDIENTI_RAMEN) as (keyof typeof INGREDIENTI_RAMEN)[]).map(
    (k) => [k, elemento.querySelector(`.ramen-${k}`)!] as const,
  );
  return {
    elemento,
    aggiorna: (m) => {
      const l = livelloRamen(m);
      brodo.setAttribute('transform', `translate(${CX} ${82 + l.abbassamento}) scale(${l.scala}) translate(${-CX} -82)`);
      const restano = ingredientiRamen(m);
      for (const [k, nodo] of ingredienti) nodo.setAttribute('visibility', restano.includes(k) ? 'visible' : 'hidden');
    },
  };
}
