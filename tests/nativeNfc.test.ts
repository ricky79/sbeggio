// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Il plugin è finto: si verifica solo come il ponte traduce le risposte di Android.
const plugin = vi.hoisted(() => ({
  stato: vi.fn(),
  apriImpostazioniNfc: vi.fn(),
  vibra: vi.fn(),
  addListener: vi.fn(),
}));
const ambiente = vi.hoisted(() => ({ app: true }));

vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin }));
vi.mock('../src/native/app', () => ({ inApp: () => ambiente.app }));

async function carica() {
  vi.resetModules();
  return import('../src/native/nfc');
}

beforeEach(() => {
  ambiente.app = true;
  for (const f of Object.values(plugin)) f.mockReset();
  plugin.addListener.mockResolvedValue({ remove: vi.fn() });
  plugin.apriImpostazioniNfc.mockResolvedValue(undefined);
  plugin.vibra.mockResolvedValue(undefined);
});

describe('stato dell\'NFC', () => {
  it('distingue attivo, spento e assente', async () => {
    const { statoNfc } = await carica();
    plugin.stato.mockResolvedValue({ disponibile: true, attivo: true });
    expect(await statoNfc()).toBe('attivo');
    plugin.stato.mockResolvedValue({ disponibile: true, attivo: false });
    expect(await statoNfc()).toBe('spento');
    plugin.stato.mockResolvedValue({ disponibile: false, attivo: false });
    expect(await statoNfc()).toBe('assente');
  });

  it('se il plugin non risponde o fuori dall\'app è assente', async () => {
    const { statoNfc } = await carica();
    plugin.stato.mockRejectedValue(new Error('not implemented'));
    expect(await statoNfc()).toBe('assente');
    ambiente.app = false;
    plugin.stato.mockResolvedValue({ disponibile: true, attivo: true });
    expect(await statoNfc()).toBe('assente');
    expect(plugin.stato).toHaveBeenCalledOnce();
  });
});

describe('lettura del tag', () => {
  it('ascolta l\'evento "tag" solo nell\'app', async () => {
    const { ascoltaTag } = await carica();
    const gestore = vi.fn();
    ascoltaTag(gestore);
    expect(plugin.addListener).toHaveBeenCalledWith('tag', gestore);
    ambiente.app = false;
    ascoltaTag(gestore);
    expect(plugin.addListener).toHaveBeenCalledOnce();
  });
});

describe('vibrazione e impostazioni', () => {
  it('gli errori del plugin non escono', async () => {
    const { vibra, apriImpostazioniNfc } = await carica();
    plugin.vibra.mockRejectedValue(new Error('x'));
    plugin.apriImpostazioniNfc.mockRejectedValue(new Error('x'));
    await expect(vibra()).resolves.toBeUndefined();
    await expect(apriImpostazioniNfc()).resolves.toBeUndefined();
  });

  it('fuori dall\'app non chiamano il plugin', async () => {
    const { vibra, apriImpostazioniNfc } = await carica();
    ambiente.app = false;
    await vibra();
    await apriImpostazioniNfc();
    expect(plugin.vibra).not.toHaveBeenCalled();
    expect(plugin.apriImpostazioniNfc).not.toHaveBeenCalled();
  });
});
