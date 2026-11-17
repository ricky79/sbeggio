// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { chiudi, normalizza } from '../src/core/inputOra';

describe('normalizza: ore (massimo 23)', () => {
  it.each([
    ['', { testo: '', completa: false, resto: '' }],
    ['1', { testo: '1', completa: false, resto: '' }],
    ['2', { testo: '2', completa: false, resto: '' }],
    ['8', { testo: '08', completa: true, resto: '' }],
    ['23', { testo: '23', completa: true, resto: '' }],
    ['24', { testo: '2', completa: false, resto: '' }],
    ['0847', { testo: '08', completa: true, resto: '47' }],
    ['08:47', { testo: '08', completa: true, resto: '47' }],
    ['847', { testo: '08', completa: true, resto: '47' }],
  ])('%s', (scritto, atteso) => expect(normalizza(scritto, 23)).toEqual(atteso));
});

describe('normalizza: minuti (massimo 59)', () => {
  it.each([
    ['5', { testo: '5', completa: false, resto: '' }],
    ['7', { testo: '07', completa: true, resto: '' }],
    ['59', { testo: '59', completa: true, resto: '' }],
    ['a4', { testo: '4', completa: false, resto: '' }],
  ])('%s', (scritto, atteso) => expect(normalizza(scritto, 59)).toEqual(atteso));
});

describe('casi limite', () => {
  it('il limite delle ore segue il massimo', () => {
    expect(normalizza('2', 12)).toEqual({ testo: '02', completa: true, resto: '' });
    expect(normalizza('13', 12)).toEqual({ testo: '1', completa: false, resto: '' });
  });

  it('con un massimo sotto 10 una cifra troppo alta è scartata', () => {
    expect(normalizza('8', 5)).toEqual({ testo: '', completa: false, resto: '' });
    expect(normalizza('84', 5)).toEqual({ testo: '04', completa: true, resto: '' });
  });

  it('chiudi: vuota torna al valore di prima, una cifra vale da sola', () => {
    expect(chiudi('', 8)).toBe(8);
    expect(chiudi('5', 8)).toBe(5);
    expect(chiudi('47', 8)).toBe(47);
  });
});
