// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { StilePausaBreve, TipoSigaretta } from '../core/tipi';

/** Lunghezza della cartina nel disegno (unità SVG): si accorcia fino a 0. */
const CARTINA = 200;
/** Liquido nel serbatoio della sigaretta elettronica: il livello scende verso il fondo. */
const LIQUIDO_Y = 58;
const LIQUIDO_ALTEZZA = 20;

const tra0e1 = (n: number) => Math.min(1, Math.max(0, n));

/** Sigaretta normale con `consumata` da 0 (intera) a 1 (resta il filtro). */
export function misureNormale(consumata: number): { larghezzaCartina: number; spostamentoPunta: number } {
  const c = tra0e1(consumata);
  return { larghezzaCartina: CARTINA * (1 - c), spostamentoPunta: -CARTINA * c };
}

/** Sigaretta elettronica con `consumata` da 0 (serbatoio pieno) a 1 (vuoto). */
export function misureElettronica(consumata: number): { yLiquido: number; altezzaLiquido: number } {
  const c = tra0e1(consumata);
  return { yLiquido: LIQUIDO_Y + LIQUIDO_ALTEZZA * c, altezzaLiquido: LIQUIDO_ALTEZZA * (1 - c) };
}

/** Raggio dell'anello dello stile base (viewBox 200 × 200) e la sua circonferenza. */
const R_ANELLO = 88;
const GIRO_ANELLO = 2 * Math.PI * R_ANELLO;

/** Stile base: `stroke-dashoffset` dell'arco, dal giro intero (anello aperto) a 0 (chiuso a fine tolleranza). */
export function arcoAnello(consumata: number): number {
  return GIRO_ANELLO * (1 - tra0e1(consumata));
}

/** Pinta dello stile birretta: la birra va dal sotto la schiuma (BIRRA_Y) al fondo del bicchiere (FONDO_BIRRA). */
const BIRRA_Y = 46;
const FONDO_BIRRA = 176;

/** Stile birretta con `consumata` da 0 (pinta piena) a 1 (vuota): il livello cala, il fondo resta fermo. */
export function misureBirretta(consumata: number): { yBirra: number; altezzaBirra: number } {
  const c = tra0e1(consumata);
  const piena = FONDO_BIRRA - BIRRA_Y;
  return { yBirra: BIRRA_Y + piena * c, altezzaBirra: piena * (1 - c) };
}

/** Colori del liquido della sigaretta elettronica. */
export const COLORI_LIQUIDO = {
  rosso: '#ef4444',
  blu: '#3b82f6',
  arancione: '#f97316',
  giallo: '#facc15',
  viola: '#a855f7',
  verde: '#22c55e',
  bianco: '#fafaf9',
} as const;

/**
 * Colore del liquido per la pausa iniziata a `inizio` (ms): a caso da una pausa all'altra, ma sempre
 * lo stesso per la stessa pausa, anche se l'app viene chiusa e riaperta.
 */
export function coloreLiquido(inizio: number): string {
  const colori = Object.values(COLORI_LIQUIDO);
  return colori[Math.abs(Math.floor(inizio)) % colori.length]!;
}

/*
 * Sigaretta normale: in alto la sigaretta (filtro a sinistra, brace a destra), sotto il posacenere.
 * Il posacenere, il mozzicone schiacciato e il residuo di brace sono nascosti dal CSS finché la pausa
 * non scade; la sequenza di spegnimento è in src/style.css (classi .scaduta e .spegnimento).
 */
const SVG_NORMALE = `
<svg class="sigaretta-disegno" viewBox="0 0 300 160" aria-hidden="true">
  <defs>
    <linearGradient id="sig-brace" x1="0" x2="1">
      <stop offset="0" stop-color="#ffd27a"/>
      <stop offset="0.5" stop-color="#ff5a1f"/>
      <stop offset="1" stop-color="#7a1600"/>
    </linearGradient>
    <filter id="sig-bagliore" x="-1" y="-1" width="3" height="3">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>
  <g class="posacenere">
    <path d="M86 122 L100 148 Q150 156 200 148 L214 122 Z" fill="#57534e"/>
    <ellipse cx="150" cy="122" rx="64" ry="12" fill="#78716c"/>
    <ellipse cx="150" cy="122" rx="54" ry="8" fill="#292524"/>
    <g fill="#a8a29e">
      <circle cx="128" cy="123" r="1.6"/><circle cx="170" cy="121" r="1.3"/><circle cx="152" cy="125" r="1.2"/>
    </g>
    <g class="posacenere-mozzicone">
      <rect x="120" y="112" width="30" height="12" rx="2" fill="#d9822b" transform="rotate(-10 135 118)"/>
      <path d="M149 112 l9 -4 l7 5 l-3 8 l-12 1 z" fill="#e7e2d8"/>
      <ellipse cx="166" cy="119" rx="6" ry="3" fill="#57534e"/>
    </g>
    <g class="posacenere-fumo" fill="none" stroke="#d8d4cf" stroke-width="3" stroke-linecap="round">
      <path d="M160 110 c-6 -6 6 -11 0 -17 c-5 -5 5 -9 0 -14"/>
    </g>
  </g>
  <g class="sigaretta-mozzicone">
    <rect x="10" y="58" width="60" height="20" rx="3" fill="#d9822b"/>
    <g fill="#b8641c">
      <circle cx="22" cy="64" r="1.4"/><circle cx="35" cy="72" r="1.2"/>
      <circle cx="48" cy="63" r="1.3"/><circle cx="60" cy="71" r="1.1"/>
    </g>
    <rect x="68" y="58" width="4" height="20" fill="#c9a227"/>
    <rect class="sigaretta-residuo" x="72" y="59" width="5" height="18" rx="2"/>
  </g>
  <rect class="sigaretta-cartina" x="72" y="58" width="${CARTINA}" height="20" fill="#f4f1ea"/>
  <g class="sigaretta-punta">
    <ellipse class="sigaretta-bagliore" cx="272" cy="68" rx="10" ry="13" fill="#ff5a1f" filter="url(#sig-bagliore)"/>
    <rect x="268" y="58" width="6" height="20" rx="2" fill="url(#sig-brace)"/>
    <rect x="273" y="59" width="11" height="18" rx="5" fill="#8a8580"/>
    <g class="sigaretta-fumo" fill="none" stroke="#d8d4cf" stroke-width="3" stroke-linecap="round">
      <path d="M279 54 c-8 -8 8 -14 0 -22 c-7 -7 6 -12 0 -20"/>
      <path d="M279 54 c7 -9 -7 -15 1 -24 c6 -7 -5 -12 1 -18"/>
      <path d="M279 54 c-5 -7 9 -13 2 -21 c-6 -8 7 -12 0 -19"/>
    </g>
  </g>
</svg>`;

/* Sigaretta elettronica: bocchino, serbatoio con il liquido, corpo metallico, LED rosso in punta. */
const SVG_ELETTRONICA = `
<svg class="sigaretta-disegno" viewBox="0 0 300 100" aria-hidden="true">
  <defs>
    <linearGradient id="svapo-metallo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e7e5e4"/>
      <stop offset="0.5" stop-color="#78716c"/>
      <stop offset="1" stop-color="#a8a29e"/>
    </linearGradient>
    <filter id="svapo-sfocatura" x="-1" y="-1" width="3" height="3">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
    <filter id="svapo-nebbia" x="-1" y="-1" width="3" height="3">
      <feGaussianBlur stdDeviation="1.5"/>
    </filter>
  </defs>
  <g class="svapo-vapore" fill="#e7e5e4" filter="url(#svapo-nebbia)">
    <circle cx="30" cy="50" r="6"/>
    <circle cx="24" cy="44" r="8"/>
    <circle cx="34" cy="46" r="7"/>
  </g>
  <rect x="12" y="61" width="36" height="14" rx="6" fill="#3f3a36" stroke="#78716c" stroke-width="1"/>
  <rect x="46" y="56" width="80" height="24" rx="4" fill="rgba(255,255,255,0.06)"/>
  <rect class="svapo-liquido" x="48" y="${LIQUIDO_Y}" width="76" height="${LIQUIDO_ALTEZZA}" rx="2" opacity="0.85"/>
  <rect x="46" y="56" width="80" height="24" rx="4" fill="none" stroke="#a8a29e" stroke-width="1.5"/>
  <rect x="126" y="56" width="140" height="24" rx="3" fill="url(#svapo-metallo)"/>
  <rect x="150" y="56" width="3" height="24" fill="#57534e"/>
  <g class="svapo-led">
    <ellipse class="svapo-alone" cx="270" cy="68" rx="12" ry="14" fill="#ff1f1f" filter="url(#svapo-sfocatura)"/>
    <rect class="svapo-luce" x="264" y="57" width="10" height="22" rx="4" fill="#ff2d2d"/>
  </g>
</svg>`;

/*
 * Stile base: un anello che si chiude alla fine della tolleranza (il tempo sta al centro, in
 * src/ui/sigaretta.ts). Ruotato di -90° dal CSS per partire da ore 12; i colori di "ultimi" e "scaduta"
 * sono in src/style.css.
 */
const SVG_ANELLO = `
<svg class="anello-disegno" viewBox="0 0 200 200" aria-hidden="true">
  <circle cx="100" cy="100" r="${R_ANELLO}" fill="none" stroke="#3a3a3c" stroke-width="10"/>
  <circle class="anello-arco" cx="100" cy="100" r="${R_ANELLO}" fill="none" stroke-width="10" stroke-linecap="round"
    stroke-dasharray="${GIRO_ANELLO.toFixed(1)}" stroke-dashoffset="${GIRO_ANELLO.toFixed(1)}"/>
</svg>`;

/*
 * Stile birretta: una pinta. La birra e la schiuma sono ritagliate dall'interno del bicchiere; il livello
 * cala con `consumata` e le bollicine restano sotto il livello. A pinta finita (classe .consumata) restano
 * i segni della schiuma sul vetro.
 */
const SVG_BIRRETTA = `
<svg class="sigaretta-disegno birra-disegno" viewBox="60 0 180 200" aria-hidden="true">
  <defs>
    <clipPath id="birra-vetro"><path d="M101 18 H199 L185 ${FONDO_BIRRA} H115 Z"/></clipPath>
    <clipPath id="birra-livello"><rect class="birra-livello" x="90" y="${BIRRA_Y}" width="120" height="${FONDO_BIRRA - BIRRA_Y}"/></clipPath>
    <linearGradient id="birra-colore" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <ellipse cx="150" cy="190" rx="52" ry="6" fill="#000" opacity="0.35"/>
  <path d="M96 14 H204 L190 184 H110 Z" fill="#ffffff" opacity="0.07"/>
  <g clip-path="url(#birra-vetro)">
    <rect class="birra-liquido" x="90" y="${BIRRA_Y}" width="120" height="${FONDO_BIRRA - BIRRA_Y}" fill="url(#birra-colore)"/>
    <g class="birra-bolle" clip-path="url(#birra-livello)" fill="#fef3c7" opacity="0.7">
      <circle cx="128" cy="168" r="2"/><circle cx="150" cy="160" r="1.6"/><circle cx="170" cy="170" r="2.2"/>
      <circle cx="140" cy="120" r="1.5"/><circle cx="162" cy="100" r="1.8"/><circle cx="122" cy="84" r="1.4"/>
    </g>
    <g class="birra-schiuma" fill="#fffbeb">
      <rect x="90" y="${BIRRA_Y - 14}" width="120" height="16"/>
      <circle cx="108" cy="${BIRRA_Y - 14}" r="8"/><circle cx="126" cy="${BIRRA_Y - 16}" r="9"/><circle cx="146" cy="${BIRRA_Y - 14}" r="8"/>
      <circle cx="166" cy="${BIRRA_Y - 17}" r="9"/><circle cx="186" cy="${BIRRA_Y - 14}" r="8"/>
    </g>
    <g class="birra-segni" fill="none" stroke="#fffbeb" stroke-width="2.5" stroke-linecap="round">
      <path d="M104 64 q12 6 24 0 t24 2 t24 -2 t20 2"/><path d="M108 104 q10 5 20 0 t22 2 t20 -2"/>
      <path d="M112 142 q9 4 18 0 t20 2 t18 -2"/>
    </g>
  </g>
  <path d="M96 14 H204 L190 184 H110 Z" fill="none" stroke="#e7e5e4" stroke-width="3" stroke-linejoin="round" opacity="0.75"/>
  <path d="M104 26 L114 168" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.25"/>
  <rect x="108" y="176" width="84" height="8" rx="3" fill="#e7e5e4" opacity="0.5"/>
</svg>`;

export interface Disegno {
  elemento: Element;
  /** Aggiorna le parti che si consumano (`consumata` da 0 a 1). */
  aggiorna(consumata: number): void;
}

/**
 * Crea il disegno della schermata della pausa breve per lo stile scelto (e, con lo stile sigaretta, il
 * tipo di sigaretta). `inizio` (ms) è l'inizio della pausa.
 */
export function creaDisegno(stile: StilePausaBreve, tipo: TipoSigaretta, inizio: number): Disegno {
  const contenitore = document.createElement('div');
  if (stile === 'base') {
    contenitore.innerHTML = SVG_ANELLO; // markup statico, nessun dato dell'utente
    const elemento = contenitore.firstElementChild!;
    const arco = elemento.querySelector('.anello-arco')!;
    return { elemento, aggiorna: (consumata) => arco.setAttribute('stroke-dashoffset', arcoAnello(consumata).toFixed(1)) };
  }
  if (stile === 'birretta') {
    contenitore.innerHTML = SVG_BIRRETTA; // markup statico, nessun dato dell'utente
    const elemento = contenitore.firstElementChild!;
    const liquido = elemento.querySelector('.birra-liquido')!;
    const livello = elemento.querySelector('.birra-livello')!;
    const schiuma = elemento.querySelector('.birra-schiuma')!;
    return {
      elemento,
      aggiorna: (consumata) => {
        const m = misureBirretta(consumata);
        for (const r of [liquido, livello]) {
          r.setAttribute('y', m.yBirra.toFixed(1));
          r.setAttribute('height', m.altezzaBirra.toFixed(1));
        }
        schiuma.setAttribute('transform', `translate(0 ${(m.yBirra - BIRRA_Y).toFixed(1)})`);
      },
    };
  }
  contenitore.innerHTML = tipo === 'elettronica' ? SVG_ELETTRONICA : SVG_NORMALE; // markup statico, nessun dato dell'utente
  const elemento = contenitore.firstElementChild!;
  if (tipo === 'elettronica') {
    const liquido = elemento.querySelector('.svapo-liquido')!;
    liquido.setAttribute('fill', coloreLiquido(inizio));
    return {
      elemento,
      aggiorna: (consumata) => {
        const m = misureElettronica(consumata);
        liquido.setAttribute('y', String(m.yLiquido));
        liquido.setAttribute('height', String(m.altezzaLiquido));
      },
    };
  }
  const cartina = elemento.querySelector('.sigaretta-cartina')!;
  const punta = elemento.querySelector('.sigaretta-punta')!;
  return {
    elemento,
    aggiorna: (consumata) => {
      const m = misureNormale(consumata);
      cartina.setAttribute('width', String(m.larghezzaCartina));
      punta.setAttribute('transform', `translate(${m.spostamentoPunta} 0)`);
    },
  };
}
