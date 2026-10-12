import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { datiVuoti } from '../src/storage/migrazioni';
import { GIOVEDI, giornata } from './helpers';

// localStorage condiviso tra le schede e window finti: si simula un'altra scheda che salva.
let memoria: Map<string, string>;
let ascoltatori: Map<string, (e: { key: string | null }) => void>;

async function carica() {
  vi.resetModules();
  return import('../src/storage/store');
}

/** Ciò che scrive un'altra scheda dopo aver timbrato l'entrata. */
function salvataggioAltraScheda(): string {
  const dati = datiVuoti();
  dati.giornate[GIOVEDI] = giornata([['ENTRATA', '08:30']]);
  return JSON.stringify(dati);
}

beforeEach(() => {
  memoria = new Map();
  ascoltatori = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, String(v)),
    removeItem: (k: string) => void memoria.delete(k),
  });
  vi.stubGlobal('window', { addEventListener: (tipo: string, f: (e: { key: string | null }) => void) => ascoltatori.set(tipo, f) });
});

afterEach(() => vi.unstubAllGlobals());

describe('ferie', () => {
  it('una giornata di ferie si salva senza timbrature e sparisce togliendole', async () => {
    const { store } = await carica();
    store.modificaGiornata(GIOVEDI, (g) => void (g.ferie = true));
    expect(store.giornate[GIOVEDI]?.ferie).toBe(true);
    store.modificaGiornata(GIOVEDI, (g) => void delete g.ferie);
    expect(store.giornate[GIOVEDI]).toBeUndefined();
  });

  it('più giorni in una volta sola, con un solo salvataggio', async () => {
    const { store } = await carica();
    const cambiato = vi.fn();
    store.ascolta(cambiato);
    store.modificaGiornate(['2026-10-12', '2026-10-13', '2026-10-14'], (g) => void (g.ferie = true));
    expect(Object.keys(store.giornate).sort()).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
    expect(cambiato).toHaveBeenCalledOnce();
  });
});

describe('luogo della giornata', () => {
  it('una giornata segnata in smart si salva anche senza timbrature', async () => {
    const { store } = await carica();
    store.modificaGiornata(GIOVEDI, (g) => void (g.luogo = 'smart'));
    expect(store.giornate[GIOVEDI]?.luogo).toBe('smart');
    expect(JSON.parse(memoria.get('timbrature')!).giornate[GIOVEDI].luogo).toBe('smart');
    // Anche la sede scelta a mano resta: la posizione non deve più cambiarla.
    store.modificaGiornata(GIOVEDI, (g) => void (g.luogo = 'sede'));
    expect(store.giornate[GIOVEDI]?.luogo).toBe('sede');
  });

  it('alla prima timbratura il luogo proposto diventa quello della giornata', async () => {
    const { store } = await carica();
    store.proponiLuogo((data) => (data === GIOVEDI ? 'smart' : null));
    store.modificaGiornata(GIOVEDI, (g) => void g.eventi.push({ id: 'x', tipo: 'ENTRATA', minuti: 510 }));
    expect(store.giornate[GIOVEDI]?.luogo).toBe('smart');
  });

  it('tolte tutte le timbrature, il luogo proposto se ne va e la giornata sparisce', async () => {
    const { store } = await carica();
    store.proponiLuogo(() => 'smart');
    store.modificaGiornata(GIOVEDI, (g) => void g.eventi.push({ id: 'x', tipo: 'ENTRATA', minuti: 510 }));
    expect(store.giornate[GIOVEDI]?.luogoAutomatico).toBe(true);
    store.modificaGiornata(GIOVEDI, (g) => void (g.eventi = []));
    expect(store.giornate[GIOVEDI]).toBeUndefined();
  });

  it('un luogo scelto a mano resta anche senza timbrature', async () => {
    const { store } = await carica();
    store.proponiLuogo(() => 'smart');
    store.modificaGiornata(GIOVEDI, (g) => void g.eventi.push({ id: 'x', tipo: 'ENTRATA', minuti: 510 }));
    // Toccare 🏠 a mano rende la scelta definitiva (come fa impostaLuogo).
    store.modificaGiornata(GIOVEDI, (g) => {
      g.luogo = 'smart';
      delete g.luogoAutomatico;
    });
    store.modificaGiornata(GIOVEDI, (g) => void (g.eventi = []));
    expect(store.giornate[GIOVEDI]?.luogo).toBe('smart');
  });

  it('una giornata si elimina del tutto e si può ripristinare', async () => {
    const { store } = await carica();
    store.modificaGiornata(GIOVEDI, (g) => void (g.luogo = 'smart'));
    const copia = store.giornata(GIOVEDI);
    store.eliminaGiornata(GIOVEDI);
    expect(store.giornate[GIOVEDI]).toBeUndefined();
    expect(JSON.parse(memoria.get('timbrature')!).giornate[GIOVEDI]).toBeUndefined();
    store.ripristinaGiornata(copia);
    expect(store.giornate[GIOVEDI]?.luogo).toBe('smart');
  });

  it('la proposta non sostituisce una scelta fatta a mano', async () => {
    const { store } = await carica();
    store.proponiLuogo(() => 'smart');
    store.modificaGiornata(GIOVEDI, (g) => void (g.luogo = 'sede'));
    store.modificaGiornata(GIOVEDI, (g) => void g.eventi.push({ id: 'x', tipo: 'ENTRATA', minuti: 510 }));
    expect(store.giornate[GIOVEDI]?.luogo).toBe('sede');
  });

  it('senza proposta e senza scelta la giornata resta senza luogo (in sede)', async () => {
    const { store } = await carica();
    store.modificaGiornata(GIOVEDI, (g) => void g.eventi.push({ id: 'x', tipo: 'ENTRATA', minuti: 510 }));
    expect(store.giornate[GIOVEDI]?.luogo).toBeUndefined();
  });
});

describe('uscita prevista salvata alla chiusura', () => {
  it('per i giorni salvati prima, si calcola all\'apertura e si scrive subito', async () => {
    const dati = datiVuoti();
    dati.giornate[GIOVEDI] = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '17:45']]);
    memoria.set('timbrature', JSON.stringify(dati));
    const { store } = await carica();
    expect(store.giornate[GIOVEDI]?.uscitaPrevista).toBe(1050);
    expect(JSON.parse(memoria.get('timbrature')!).giornate[GIOVEDI].uscitaPrevista).toBe(1050);
  });

  it('si salva quando la giornata si chiude e si toglie riaprendola', async () => {
    const { store } = await carica();
    const timbra = (tipo: 'ENTRATA' | 'INIZIO_PAUSA' | 'FINE_PAUSA' | 'USCITA', minuti: number) =>
      store.modificaGiornata(GIOVEDI, (g) => void g.eventi.push({ id: tipo, tipo, minuti }));
    timbra('ENTRATA', 510);
    timbra('INIZIO_PAUSA', 750);
    timbra('FINE_PAUSA', 810);
    expect(store.giornate[GIOVEDI]?.uscitaPrevista).toBeUndefined();
    timbra('USCITA', 1065);
    expect(store.giornate[GIOVEDI]?.uscitaPrevista).toBe(1050); // 17:30
    // Le impostazioni cambiate dopo non la toccano.
    store.modificaImpostazioni((i) => void (i.minutiDovuti.predefinito = 420));
    expect(store.giornate[GIOVEDI]?.uscitaPrevista).toBe(1050);
    // Riaperta (uscita eliminata): non c'è più.
    store.modificaGiornata(GIOVEDI, (g) => void (g.eventi = g.eventi.filter((e) => e.tipo !== 'USCITA')));
    expect(store.giornate[GIOVEDI]?.uscitaPrevista).toBeUndefined();
  });
});

describe('più schede aperte', () => {
  it('quando un\'altra scheda salva, rilegge i dati e avvisa chi ascolta', async () => {
    const { store, seguiAltreSchede } = await carica();
    seguiAltreSchede();
    const cambiato = vi.fn();
    store.ascolta(cambiato);
    expect(store.giornata(GIOVEDI).eventi).toEqual([]);

    memoria.set('timbrature', salvataggioAltraScheda());
    ascoltatori.get('storage')!({ key: 'timbrature' });

    expect(store.giornata(GIOVEDI).eventi.map((e) => e.tipo)).toEqual(['ENTRATA']);
    expect(cambiato).toHaveBeenCalledOnce();
  });

  it('ignora le chiavi che non sono i dati (tema, avvisi, banner…)', async () => {
    const { store, seguiAltreSchede } = await carica();
    seguiAltreSchede();
    const cambiato = vi.fn();
    store.ascolta(cambiato);

    memoria.set('timbrature', salvataggioAltraScheda());
    ascoltatori.get('storage')!({ key: 'timbrature-avvisi-push' });

    expect(cambiato).not.toHaveBeenCalled();
    expect(store.giornata(GIOVEDI).eventi).toEqual([]);
  });
});
