// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_RICALCOLA_AVVISI } from '../src/core/avvisi';

// Niente jsdom: modulo nativo, tema e globali (memoria, Audio, fetch, document) sono finti.
const finto = vi.hoisted(() => ({
  app: false,
  silenzioso: false,
  memoria: new Map<string, string>(),
  audio: [] as { src: string; currentTime: number; suonato: number }[],
  play: (): Promise<void> => Promise.resolve(),
  eventi: [] as string[],
}));

const nfc = vi.hoisted(() => ({ telefonoSilenzioso: vi.fn(async () => finto.silenzioso) }));
vi.mock('../src/native/nfc', () => nfc);
vi.mock('../src/native/app', () => ({ inApp: () => finto.app }));
vi.mock('../src/ui/tema', () => ({ festaAccesa: () => null }));

class AudioFinto {
  currentTime = 5;
  suonato = 0;
  constructor(public src: string) {
    finto.audio.push(this);
  }
  play() {
    this.suonato++;
    return finto.play();
  }
}

/** fetch che riesce: il blob porta l'URL da cui viene, e l'URL del blob lo riprende. */
const fetchRiuscito = async (url: string) => ({ ok: true, blob: async () => ({ url }) });

async function carica() {
  vi.resetModules();
  return import('../src/ui/suoni');
}

/** Lascia finire il precaricamento (fetch → blob → URL). */
const dopoIlPrecaricamento = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  finto.app = false;
  finto.silenzioso = false;
  finto.memoria = new Map();
  finto.audio = [];
  finto.play = () => Promise.resolve();
  finto.eventi = [];
  nfc.telefonoSilenzioso.mockClear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => finto.memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void finto.memoria.set(k, v),
    removeItem: (k: string) => void finto.memoria.delete(k),
  });
  vi.stubGlobal('Audio', AudioFinto);
  vi.stubGlobal('document', { dispatchEvent: (e: Event) => finto.eventi.push(e.type), addEventListener: vi.fn() });
  // Di base il precaricamento non finisce mai: si suona dall'URL del file.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => `blob:${(b as unknown as { url: string }).url}`);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('suoni', () => {
  it('all\'inizio sono spenti e non suona nulla', async () => {
    const { suoniAccesi, suona } = await carica();
    expect(suoniAccesi()).toBe(false);
    await expect(suona('timbratura')).resolves.toBe(false);
    expect(finto.audio).toEqual([]);
  });

  it('accesi suonano il file del momento, riusando lo stesso lettore da capo', async () => {
    const { impostaSuoni, suoniAccesi, suona } = await carica();
    impostaSuoni(true);
    expect(suoniAccesi()).toBe(true);
    await expect(suona('timbratura')).resolves.toBe(true);
    await expect(suona('timbratura')).resolves.toBe(true);
    expect(finto.audio).toHaveLength(1);
    expect(finto.audio[0]!.src).toBe('/suoni/ding.mp3');
    expect(finto.audio[0]!.currentTime).toBe(0);
  });

  it('nel sito chiama play subito, senza chiedere della suoneria', async () => {
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    const risultato = suona('timbratura');
    expect(finto.audio[0]!.suonato).toBe(1); // prima di aspettare la promessa: il tocco vale ancora
    await expect(risultato).resolves.toBe(true);
    expect(nfc.telefonoSilenzioso).not.toHaveBeenCalled();
  });

  it('fuori festa il passaggio non ha suono', async () => {
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    await expect(suona('passaggio')).resolves.toBe(false);
    expect(finto.audio).toEqual([]);
  });

  it('nell\'app col telefono in silenzioso non suona', async () => {
    finto.app = true;
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    finto.silenzioso = true;
    await expect(suona('timbratura')).resolves.toBe(false);
    expect(nfc.telefonoSilenzioso).toHaveBeenCalled();
    expect(finto.audio).toEqual([]);
  });

  it('se il browser blocca il suono risolve false senza lanciare', async () => {
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    finto.play = () => Promise.reject(new Error('NotAllowedError'));
    await expect(suona('finePausa')).resolves.toBe(false);
  });

  it('cambiare l\'interruttore chiede di ricalcolare gli avvisi', async () => {
    const { impostaSuoni, suoniAccesi } = await carica();
    impostaSuoni(true);
    impostaSuoni(false);
    expect(suoniAccesi()).toBe(false);
    expect(finto.eventi).toEqual([EVENTO_RICALCOLA_AVVISI, EVENTO_RICALCOLA_AVVISI]);
  });
});

describe('precaricamento', () => {
  it('con i suoni spenti all\'avvio non scarica nulla', async () => {
    const { avviaSuoni } = await carica();
    avviaSuoni();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('con i suoni accesi all\'avvio scarica tutti i file, una volta sola', async () => {
    finto.memoria.set('timbrature-suoni', '1');
    const { avviaSuoni, impostaSuoni } = await carica();
    avviaSuoni();
    impostaSuoni(true);
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(fetch).toHaveBeenCalledWith('/suoni/ding.mp3');
    expect(fetch).toHaveBeenCalledWith('/suoni/natale-ohoh.mp3');
    expect(fetch).toHaveBeenCalledWith('/suoni/halloween-risata.mp3');
  });

  it('accendendoli scarica i file e poi suona dal blob', async () => {
    vi.mocked(fetch).mockImplementation(fetchRiuscito as unknown as typeof fetch);
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    expect(fetch).toHaveBeenCalledTimes(8);
    await dopoIlPrecaricamento();
    await expect(suona('timbratura')).resolves.toBe(true);
    expect(finto.audio[0]!.src).toBe('blob:/suoni/ding.mp3');
  });

  it('un lettore creato prima della fine del precaricamento passa al blob', async () => {
    const inAttesa = new Map<string, () => void>();
    vi.mocked(fetch).mockImplementation(((url: string) =>
      new Promise((r) => inAttesa.set(url, () => r(fetchRiuscito(url))))) as unknown as typeof fetch);
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    await suona('finePausa');
    expect(finto.audio[0]!.src).toBe('/suoni/ding-doppio.mp3');
    inAttesa.get('/suoni/ding-doppio.mp3')!();
    await dopoIlPrecaricamento();
    expect(finto.audio[0]!.src).toBe('blob:/suoni/ding-doppio.mp3');
  });

  it('se il precaricamento fallisce suona dall\'URL del file', async () => {
    vi.mocked(fetch).mockImplementation((() => Promise.reject(new Error('offline'))) as unknown as typeof fetch);
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    await dopoIlPrecaricamento();
    await expect(suona('timbratura')).resolves.toBe(true);
    expect(finto.audio[0]!.src).toBe('/suoni/ding.mp3');
  });

  it('un file che risponde con errore non diventa un blob', async () => {
    vi.mocked(fetch).mockImplementation((async () => ({ ok: false, blob: async () => ({ url: 'rotto' }) })) as unknown as typeof fetch);
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    await dopoIlPrecaricamento();
    await suona('timbratura');
    expect(finto.audio[0]!.src).toBe('/suoni/ding.mp3');
  });
});
