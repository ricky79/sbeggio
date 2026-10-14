// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Elementi finti (i test girano senza DOM): si verifica che il toast vada nel top layer.
const finto = vi.hoisted(() => ({ creati: [] as Record<string, unknown>[], ordine: [] as string[], popover: true }));
vi.mock('../src/ui/dom', () => ({
  el: (tag: string) => {
    const e: Record<string, unknown> = { tag, classList: { add: () => {}, remove: () => {} }, append: () => {}, remove: () => {} };
    if (finto.popover) e.showPopover = vi.fn(() => void finto.ordine.push('showPopover'));
    finto.creati.push(e);
    return e;
  },
}));

beforeEach(() => {
  finto.creati = [];
  finto.ordine = [];
  finto.popover = true;
  vi.useFakeTimers();
  vi.stubGlobal('document', { querySelectorAll: () => [], body: { append: () => void finto.ordine.push('append') } });
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => f());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('toast', () => {
  it('va nel top layer, così resta visibile sopra una finestra aperta', async () => {
    const { toast } = await import('../src/ui/dialoghi');
    toast('Chiudi la finestra aperta e riavvicina il tag');
    const t = finto.creati.find((e) => e.tag === 'div')!;
    expect(t.popover).toBe('manual');
    expect(finto.ordine).toEqual(['append', 'showPopover']);
  });

  it('senza Popover API (WebView vecchia) si mostra comunque', async () => {
    finto.popover = false;
    const { toast } = await import('../src/ui/dialoghi');
    expect(() => toast('Entrata alle 9:02', () => {})).not.toThrow();
    expect(finto.ordine).toEqual(['append']);
  });
});
