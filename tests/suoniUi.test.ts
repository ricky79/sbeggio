// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_RICALCOLA_AVVISI } from '../src/core/avvisi';
import type { Festa } from '../src/core/festa';

// Niente jsdom: modulo nativo, tema e globali (memoria, Audio, fetch, document) sono finti.
const finto = vi.hoisted(() => ({
  app: false,
  silenzioso: false,
  festa: null as Festa | null,
  visibilita: 'visible',
  memoria: new Map<string, string>(),
  audio: [] as AudioFinto[],
  play: (): Promise<void> => Promise.resolve(),
  eventi: [] as string[],
  ascoltatori: new Map<string, Set<(e: Event) => void>>(),
}));

const nfc = vi.hoisted(() => ({ telefonoSilenzioso: vi.fn(async () => finto.silenzioso) }));
vi.mock('../src/native/nfc', () => nfc);
vi.mock('../src/native/app', () => ({ inApp: () => finto.app }));
vi.mock('../src/ui/tema', () => ({ festaAccesa: () => finto.festa }));

class AudioFinto {
  currentTime = 5;
  suonato = 0;
  /** Quante volte `play` è partito col lettore muto (lo sblocco). */
  suonatoMuto = 0;
  pausato = 0;
  muted = false;
  paused = true;
  constructor(public src: string) {
    finto.audio.push(this);
  }
  play() {
    this.suonato++;
    if (this.muted) this.suonatoMuto++;
    this.paused = false;
    return finto.play();
  }
  pause() {
    this.pausato++;
    this.paused = true;
  }
}

/** document finto: tiene gli ascoltatori per poter simulare gli eventi. */
function documentFinto() {
  return {
    get visibilityState() {
      return finto.visibilita;
    },
    dispatchEvent: (e: Event) => finto.eventi.push(e.type),
    addEventListener: (tipo: string, fn: (e: Event) => void) => {
      if (!finto.ascoltatori.has(tipo)) finto.ascoltatori.set(tipo, new Set());
      finto.ascoltatori.get(tipo)!.add(fn);
    },
    removeEventListener: (tipo: string, fn: (e: Event) => void) => void finto.ascoltatori.get(tipo)?.delete(fn),
  };
}

const evento = (tipo: string) => {
  for (const fn of [...(finto.ascoltatori.get(tipo) ?? [])]) fn({ type: tipo } as Event);
};

/** Lascia risolvere le promesse di `play` già partite. */
const promesse = () => new Promise((r) => setTimeout(r, 0));

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
  finto.festa = null;
  finto.visibilita = 'visible';
  finto.memoria = new Map();
  finto.audio = [];
  finto.play = () => Promise.resolve();
  finto.eventi = [];
  finto.ascoltatori = new Map();
  nfc.telefonoSilenzioso.mockClear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => finto.memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void finto.memoria.set(k, v),
    removeItem: (k: string) => void finto.memoria.delete(k),
  });
  vi.stubGlobal('Audio', AudioFinto);
  vi.stubGlobal('document', documentFinto());
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

  it('con l\'app in secondo piano fine pausa e passaggio non suonano', async () => {
    finto.festa = 'natale';
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    finto.visibilita = 'hidden';
    await expect(suona('finePausa')).resolves.toBe(false);
    await expect(suona('passaggio')).resolves.toBe(false);
    expect(finto.audio).toEqual([]);
  });

  it('la timbratura suona anche con l\'app in secondo piano (tag NFC all\'avvio)', async () => {
    const { impostaSuoni, suona } = await carica();
    impostaSuoni(true);
    finto.visibilita = 'hidden';
    await expect(suona('timbratura')).resolves.toBe(true);
    expect(finto.audio[0]!.suonato).toBe(1);
  });
});

describe('sblocco dei lettori al primo tocco', () => {
  it('a suoni accesi il primo tocco fa partire muti tutti i lettori, poi li ferma e li riaccende', async () => {
    finto.memoria.set('timbrature-suoni', '1');
    const { avviaSuoni } = await carica();
    avviaSuoni();
    evento('pointerdown');
    expect(finto.audio).toHaveLength(8);
    for (const a of finto.audio) {
      expect(a.suonatoMuto).toBe(1);
      expect(a.muted).toBe(true);
    }
    await promesse();
    for (const a of finto.audio) {
      expect(a.pausato).toBe(1);
      expect(a.muted).toBe(false);
      expect(a.currentTime).toBe(0);
    }
    evento('pointerdown'); // una volta basta
    expect(finto.audio.every((a) => a.suonato === 1)).toBe(true);
  });

  it('a suoni spenti il tocco non sblocca nulla; dopo averli accesi lo fa il tocco seguente', async () => {
    const { avviaSuoni, impostaSuoni } = await carica();
    avviaSuoni();
    evento('pointerdown');
    expect(finto.audio).toEqual([]);
    impostaSuoni(true);
    evento('pointerdown');
    expect(finto.audio).toHaveLength(8);
  });

  it('se lo sblocco non riesce il lettore torna a voce piena', async () => {
    finto.memoria.set('timbrature-suoni', '1');
    finto.play = () => Promise.reject(new Error('NotAllowedError'));
    const { avviaSuoni } = await carica();
    avviaSuoni();
    evento('pointerdown');
    await promesse();
    expect(finto.audio).toHaveLength(8);
    expect(finto.audio.every((a) => !a.muted)).toBe(true);
  });

  it('dopo lo sblocco un suono vero suona normalmente, dallo stesso lettore', async () => {
    finto.memoria.set('timbrature-suoni', '1');
    const { avviaSuoni, suona } = await carica();
    avviaSuoni();
    evento('pointerdown');
    await promesse();
    await expect(suona('finePausa')).resolves.toBe(true);
    expect(finto.audio).toHaveLength(8);
    const doppio = finto.audio.find((a) => a.src === '/suoni/ding-doppio.mp3')!;
    expect(doppio.suonato).toBe(2);
    expect(doppio.suonatoMuto).toBe(1);
    expect(doppio.paused).toBe(false);
  });

  it('il suono del tocco partito durante lo sblocco non viene fermato', async () => {
    finto.memoria.set('timbrature-suoni', '1');
    const inAttesa: (() => void)[] = [];
    finto.play = () => new Promise<void>((r) => inAttesa.push(r));
    const { avviaSuoni, suona } = await carica();
    avviaSuoni();
    evento('pointerdown'); // prima del click
    const timbro = suona('timbratura'); // il click
    for (const r of inAttesa) r();
    await expect(timbro).resolves.toBe(true);
    await promesse();
    const ding = finto.audio.find((a) => a.src === '/suoni/ding.mp3')!;
    expect(ding.muted).toBe(false);
    expect(ding.pausato).toBe(0);
    expect(ding.paused).toBe(false);
    expect(finto.audio.filter((a) => a.pausato === 1)).toHaveLength(7);
  });

  it('un lettore che sta già suonando non viene toccato', async () => {
    finto.memoria.set('timbrature-suoni', '1');
    const { avviaSuoni, suona } = await carica();
    avviaSuoni();
    await suona('timbratura');
    evento('pointerdown');
    await promesse();
    const ding = finto.audio.find((a) => a.src === '/suoni/ding.mp3')!;
    expect(ding.suonato).toBe(1);
    expect(ding.pausato).toBe(0);
  });
});

describe('precaricamento', () => {
  it('se fetch lancia subito, accenderli avvisa lo stesso e l\'avvio registra gli ascoltatori', async () => {
    finto.memoria.set('timbrature-suoni', '1');
    vi.stubGlobal('fetch', () => {
      throw new Error('niente fetch');
    });
    const { avviaSuoni, impostaSuoni } = await carica();
    expect(() => avviaSuoni()).not.toThrow();
    expect(finto.ascoltatori.get('pointerdown')?.size).toBe(1);
    expect(finto.ascoltatori.get('animationstart')?.size).toBe(1);
    expect(() => impostaSuoni(true)).not.toThrow();
    expect(finto.eventi).toEqual([EVENTO_RICALCOLA_AVVISI]);
  });

  it('un lettore sbloccato prima della fine del precaricamento passa al blob', async () => {
    const inAttesa = new Map<string, () => void>();
    vi.mocked(fetch).mockImplementation(((url: string) =>
      new Promise((r) => inAttesa.set(url, () => r(fetchRiuscito(url))))) as unknown as typeof fetch);
    finto.memoria.set('timbrature-suoni', '1');
    const { avviaSuoni } = await carica();
    avviaSuoni();
    evento('pointerdown');
    const ohoh = finto.audio.find((a) => a.src === '/suoni/natale-ohoh.mp3')!;
    inAttesa.get('/suoni/natale-ohoh.mp3')!();
    await dopoIlPrecaricamento();
    expect(ohoh.src).toBe('blob:/suoni/natale-ohoh.mp3');
    expect(finto.audio).toHaveLength(8);
  });

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

describe('schermateDaTacere', () => {
  const visibilita = (v: string) => vi.stubGlobal('document', { dispatchEvent: (e: Event) => finto.eventi.push(e.type), addEventListener: vi.fn(), visibilityState: v });

  async function conSchermataAperta(suoni: boolean) {
    visibilita('visible');
    const suoniUi = await carica();
    const pausa = await import('../src/ui/schermatePausa');
    if (suoni) suoniUi.impostaSuoni(true);
    pausa.impostaSchermataSigaretta(true);
    return suoniUi;
  }

  it('suoni spenti: niente da tacere', async () => {
    finto.app = true;
    expect((await conSchermataAperta(false)).schermateDaTacere()).toEqual({});
  });
  it('suoni accesi ma fuori dall\'app: niente da tacere', async () => {
    finto.app = false;
    expect((await conSchermataAperta(true)).schermateDaTacere()).toEqual({});
  });
  it('nell\'app con l\'app in secondo piano: niente da tacere', async () => {
    finto.app = true;
    const { schermateDaTacere } = await conSchermataAperta(true);
    visibilita('hidden');
    expect(schermateDaTacere()).toEqual({});
  });
  it('nell\'app in primo piano con la schermata sigaretta aperta: si tace la sigaretta', async () => {
    finto.app = true;
    expect((await conSchermataAperta(true)).schermateDaTacere()).toEqual({ sigaretta: true, pranzo: false });
  });
});
