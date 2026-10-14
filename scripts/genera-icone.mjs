// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

// Genera le icone PNG della PWA e dell'app Android dal logo vettoriale in scripts/logo/:
// sfondo.svg (verde a tutta superficie), personaggio.svg (il tesserino, su fondo trasparente)
// e badge.svg (sagoma per le notifiche). La favicon è public/favicon.svg, usata così com'è.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const leggi = (nome) => readFileSync(new URL(`./logo/${nome}`, import.meta.url), 'utf8');
const SFONDO = leggi('sfondo.svg');
const PERSONAGGIO = leggi('personaggio.svg');
const BADGE = leggi('badge.svg');

/** Inserisce un SVG sorgente (viewBox 100×100) nel riquadro (x, y, lato) dell'SVG che lo contiene. */
function annida(svg, x, y, lato, extra = '') {
  return svg.replace(/^<svg\b[^>]*>/, `<svg x="${x}" y="${y}" width="${lato}" height="${lato}" viewBox="0 0 100 100" ${extra}>`);
}

function png(w, h, contenuto) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${contenuto}</svg>`;
  return new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
}

/** Personaggio di lato `scala`·size centrato in un quadrato di lato size. */
const personaggio = (size, scala) => annida(PERSONAGGIO, (size * (1 - scala)) / 2, (size * (1 - scala)) / 2, size * scala);

/**
 * Icona quadrata: sfondo e personaggio. `forma` ritaglia il quadrato: 'piena' (gli angoli li arrotonda
 * il sistema), 'arrotondata' (angoli trasparenti, come la favicon) o 'tonda'.
 */
function icona(size, scala, forma) {
  const r = { piena: 0, arrotondata: size * 0.22, tonda: size / 2 }[forma];
  return png(size, size,
    `<clipPath id="forma"><rect width="${size}" height="${size}" rx="${r}"/></clipPath>` +
    `<g clip-path="url(#forma)">${annida(SFONDO, 0, 0, size)}${personaggio(size, scala)}</g>`);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', icona(192, 1, 'arrotondata'));
writeFileSync('public/icons/icon-512.png', icona(512, 1, 'arrotondata'));
// iOS arrotonda da sé gli angoli e mette il nero al posto della trasparenza: icona piena.
writeFileSync('public/icons/apple-touch-icon.png', icona(180, 0.9, 'piena'));
// Maskable: il personaggio resta nel cerchio sicuro (raggio 40%) qualunque forma usi il sistema.
writeFileSync('public/icons/icon-maskable-512.png', icona(512, 0.8, 'piena'));
// Badge delle notifiche (Android): conta solo la forma, Chrome usa il canale alfa. 96×96 come consiglia Chrome.
writeFileSync('public/icons/badge-96.png', png(96, 96, annida(BADGE, 0, 0, 96)));
console.log('Icone generate in public/icons/');

// App Android: stesse icone della PWA in tutte le densità.
const RES = 'android/app/src/main/res';
const DENSITA = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [nome, k] of Object.entries(DENSITA)) {
  const dir = `${RES}/mipmap-${nome}`;
  mkdirSync(dir, { recursive: true });
  // Icone per Android 7 (minSdk 24), che non ha le icone adattive.
  writeFileSync(`${dir}/ic_launcher.png`, icona(48 * k, 1, 'arrotondata'));
  writeFileSync(`${dir}/ic_launcher_round.png`, icona(48 * k, 0.85, 'tonda'));
  // Icona adattiva (Android 8+): tela di 108dp, il sistema ne mostra i 72dp centrali ritagliati
  // con la sua forma. Il personaggio occupa quei 72dp e resta nel cerchio sicuro di 66dp.
  const tela = 108 * k;
  writeFileSync(`${dir}/ic_launcher_foreground.png`, png(tela, tela, personaggio(tela, 72 / 108)));
  // Lo sfondo copre i 72dp visibili come nelle altre icone e prosegue fino ai bordi della tela.
  writeFileSync(`${dir}/ic_launcher_background.png`, png(tela, tela, annida(SFONDO, 18 * k, 18 * k, 72 * k, 'overflow="visible"')));
}

/** Schermata di avvio (Android < 12): lo sfondo copre tutto, il personaggio è al centro. */
function splash(w, h) {
  const lato = Math.round(Math.min(w, h) * 0.5);
  const sfondo = SFONDO.replace(/^<svg\b[^>]*>/, `<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">`);
  return png(w, h, sfondo + annida(PERSONAGGIO, (w - lato) / 2, (h - lato) / 2, lato));
}
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [nome, [w, h]] of Object.entries(SPLASH)) {
  writeFileSync(`${RES}/drawable-port-${nome}/splash.png`, splash(w, h));
  writeFileSync(`${RES}/drawable-land-${nome}/splash.png`, splash(h, w));
}
writeFileSync(`${RES}/drawable/splash.png`, splash(480, 320));
console.log(`Icone e schermate di avvio generate in ${RES}/`);
