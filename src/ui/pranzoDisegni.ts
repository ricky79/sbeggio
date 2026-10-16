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

const SVG: Record<Cibo, string> = { ramen: RAMEN, pizza: PIZZA, panino: PANINO, mela: MELA };

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

/** Crea il disegno del cibo `cibo`. */
export function creaDisegnoPranzo(cibo: Cibo): DisegnoPranzo {
  const contenitore = document.createElement('div');
  contenitore.innerHTML = SVG[cibo]; // markup statico, nessun dato dell'utente
  const elemento = contenitore.firstElementChild!;
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
