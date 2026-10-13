import { describe, expect, it } from 'vitest';
import { IMPOSTAZIONI_PREDEFINITE } from '../src/core/tipi';
import { ErroreMigrazione, migra, VERSIONE_CORRENTE } from '../src/storage/migrazioni';

describe('migrazioni', () => {
  it('dati senza version (v0) vengono portati alla versione corrente', () => {
    const d = migra({
      giornate: { '2026-10-01': { permessoInizioMinuti: 60, eventi: [{ tipo: 'ENTRATA', minuti: 600 }] } },
    });
    expect(d.version).toBe(VERSIONE_CORRENTE);
    expect(d.impostazioni).toEqual(IMPOSTAZIONI_PREDEFINITE);
    expect(d.giornate['2026-10-01']!.data).toBe('2026-10-01');
    expect(d.giornate['2026-10-01']!.eventi[0]!.id).toBeTruthy();
  });

  it('scarta valori non validi senza perdere il resto', () => {
    const d = migra({
      version: 1,
      impostazioni: { pausaDaScalare: -5, pranzo: { inizio: 800, fine: 700 }, pausaMinima: 20 },
      giornate: {
        '2026-10-01': { data: '2026-10-01', permessoInizioMinuti: 0, eventi: [{ id: 'a', tipo: 'BOH', minuti: 1 }, { id: 'b', tipo: 'USCITA', minuti: 1050 }] },
        'non-una-data': { eventi: [] },
      },
    });
    // Valore non valido → predefinito (30 min).
    expect(d.impostazioni.pausaDaScalare).toBe(30);
    expect(d.impostazioni.pranzo).toEqual({ inizio: 735, fine: 870 }); // fascia non valida → predefinita (12:15–14:30)
    expect(d.impostazioni.pausaMinima).toBe(20);
    expect(d.giornate['2026-10-01']!.eventi).toEqual([{ id: 'b', tipo: 'USCITA', minuti: 1050 }]);
    expect(Object.keys(d.giornate)).toEqual(['2026-10-01']);
  });

  it('rifiuta dati di una versione futura o non oggetti', () => {
    expect(() => migra({ version: 99 })).toThrow(ErroreMigrazione);
    expect(() => migra('ciao')).toThrow(ErroreMigrazione);
  });

  it('le impostazioni predefinite non vengono mutate', () => {
    const d = migra({});
    d.impostazioni.minutiDovuti.perGiorno[1] = 100;
    expect(IMPOSTAZIONI_PREDEFINITE.minutiDovuti.perGiorno[1]).toBeNull();
  });

  it('conserva la pausa sigaretta solo sulle uscite in permesso', () => {
    const d = migra({
      version: 1,
      giornate: {
        '2026-10-01': {
          data: '2026-10-01',
          permessoInizioMinuti: 0,
          eventi: [
            { id: 'a', tipo: 'ENTRATA', minuti: 510, sigaretta: true },
            { id: 'b', tipo: 'USCITA_PERMESSO', minuti: 600, sigaretta: true },
            { id: 'c', tipo: 'RIENTRO_PERMESSO', minuti: 620, sigaretta: 'si' },
          ],
        },
      },
    });
    expect(d.giornate['2026-10-01']!.eventi).toEqual([
      { id: 'a', tipo: 'ENTRATA', minuti: 510 },
      { id: 'b', tipo: 'USCITA_PERMESSO', minuti: 600, sigaretta: true },
      { id: 'c', tipo: 'RIENTRO_PERMESSO', minuti: 620 },
    ]);
  });

  it('tolleranza della pausa sigaretta: predefinita 11, valori non validi scartati', () => {
    const tolleranza = (v: unknown) => migra({ version: 1, impostazioni: { tolleranzaSigaretta: v } }).impostazioni.tolleranzaSigaretta;
    expect(migra({}).impostazioni.tolleranzaSigaretta).toBe(11);
    expect(tolleranza(5)).toBe(5);
    expect(tolleranza(0)).toBe(0);
    expect(tolleranza(60)).toBe(60);
    expect(tolleranza(61)).toBe(11);
    expect(tolleranza(7.5)).toBe(11);
    expect(tolleranza('11')).toBe(11);
  });

  it('permesso in uscita pianificato: predefinito 0, valori non validi scartati', () => {
    const permesso = (v: unknown) =>
      migra({ version: 1, giornate: { '2026-10-01': { data: '2026-10-01', permessoInizioMinuti: 0, permessoUscitaMinuti: v, eventi: [] } } })
        .giornate['2026-10-01']!.permessoUscitaMinuti;
    expect(permesso(undefined)).toBe(0);
    expect(permesso(60)).toBe(60);
    expect(permesso(-30)).toBe(0);
    expect(permesso(7.5)).toBe(0);
    expect(permesso('30')).toBe(0);
  });

  it('luogo della giornata: smart o sede, altri valori scartati', () => {
    const luogo = (v: unknown) =>
      migra({ version: 1, giornate: { '2026-10-01': { data: '2026-10-01', permessoInizioMinuti: 0, luogo: v, eventi: [] } } })
        .giornate['2026-10-01']!.luogo;
    expect(luogo('smart')).toBe('smart');
    expect(luogo('sede')).toBe('sede');
    expect(luogo(undefined)).toBeUndefined();
    expect(luogo('casa')).toBeUndefined();
    expect(luogo(true)).toBeUndefined();
  });

  it('luogo automatico: conservato solo con un luogo', () => {
    const g = (v: Record<string, unknown>) =>
      migra({ version: 1, giornate: { '2026-10-01': { data: '2026-10-01', permessoInizioMinuti: 0, eventi: [], ...v } } })
        .giornate['2026-10-01'];
    expect(g({ luogo: 'smart', luogoAutomatico: true })?.luogoAutomatico).toBe(true);
    expect(g({ luogo: 'smart', luogoAutomatico: 'si' })?.luogoAutomatico).toBeUndefined();
    expect(g({ luogoAutomatico: true })?.luogoAutomatico).toBeUndefined();
  });

  it('sigarette non conteggiate: conservate quelle valide, campo assente se non ce ne sono', () => {
    const sigarette = (v: unknown) =>
      migra({ version: 1, giornate: { '2026-10-01': { data: '2026-10-01', permessoInizioMinuti: 0, sigaretteNonConteggiate: v, eventi: [{ tipo: 'ENTRATA', minuti: 510 }] } } })
        .giornate['2026-10-01']!.sigaretteNonConteggiate;
    expect(sigarette([{ minuti: 605, durata: 6 }])).toEqual([{ minuti: 605, durata: 6 }]);
    expect(sigarette([{ minuti: 605, durata: 6 }, { minuti: 2000, durata: 3 }, { minuti: 700, durata: 0 }, 'x'])).toEqual([
      { minuti: 605, durata: 6 },
    ]);
    expect(sigarette(undefined)).toBeUndefined();
    expect(sigarette([])).toBeUndefined();
    expect(sigarette('tante')).toBeUndefined();
  });

  it('ferie della giornata: conservate solo se valgono true', () => {
    const ferie = (v: unknown) =>
      migra({ version: 1, giornate: { '2026-10-01': { data: '2026-10-01', permessoInizioMinuti: 0, ferie: v, eventi: [] } } })
        .giornate['2026-10-01']!.ferie;
    expect(ferie(true)).toBe(true);
    expect(ferie(undefined)).toBeUndefined();
    expect(ferie('si')).toBeUndefined();
  });

  it('posizione dell\'ufficio: predefinita assente, coordinate non valide scartate', () => {
    const ufficio = (v: unknown) => migra({ version: 1, impostazioni: { ufficio: v } }).impostazioni.ufficio;
    expect(migra({}).impostazioni.ufficio).toBeNull();
    expect(ufficio({ lat: 45.07, lon: 7.68 })).toEqual({ lat: 45.07, lon: 7.68 });
    expect(ufficio({ lat: 91, lon: 7 })).toBeNull();
    expect(ufficio({ lat: '45', lon: 7 })).toBeNull();
    expect(ufficio('Torino')).toBeNull();
  });

  it('tipo di sigaretta: predefinito normale, valori sconosciuti scartati', () => {
    const tipo = (v: unknown) => migra({ version: 1, impostazioni: { tipoSigaretta: v } }).impostazioni.tipoSigaretta;
    expect(migra({}).impostazioni.tipoSigaretta).toBe('normale');
    expect(tipo('elettronica')).toBe('elettronica');
    expect(tipo('normale')).toBe('normale');
    expect(tipo('svapo')).toBe('normale');
    expect(tipo(1)).toBe('normale');
    expect(tipo(undefined)).toBe('normale');
  });
});

describe('avvisi nelle impostazioni', () => {
  const avvisi = (v: unknown) => migra({ version: 1, impostazioni: { avvisi: v } }).impostazioni.avvisi;

  it('predefiniti: attivi, pranzo 30 minuti, sigaretta 2 minuti prima', () => {
    expect(migra({}).impostazioni.avvisi).toEqual({ uscita: true, sigaretta: true, sigarettaAnticipo: 2, pranzo: true, pranzoMinuti: 30 });
  });

  it('conserva i valori validi', () => {
    expect(avvisi({ uscita: false, sigaretta: true, sigarettaAnticipo: 3, pranzo: false, pranzoMinuti: 45 })).toEqual({
      uscita: false,
      sigaretta: true,
      sigarettaAnticipo: 3,
      pranzo: false,
      pranzoMinuti: 45,
    });
  });

  it('scarta i valori non validi campo per campo', () => {
    expect(avvisi({ uscita: 'no', pranzoMinuti: 0 })).toMatchObject({ uscita: true, pranzoMinuti: 30 });
    expect(avvisi({ pranzoMinuti: 241 }).pranzoMinuti).toBe(30);
    expect(avvisi({ pranzoMinuti: 7.5 }).pranzoMinuti).toBe(30);
    expect(avvisi({ pranzoMinuti: 1 }).pranzoMinuti).toBe(1);
    expect(avvisi({ sigarettaAnticipo: 0 }).sigarettaAnticipo).toBe(0);
    expect(avvisi({ sigarettaAnticipo: 31 }).sigarettaAnticipo).toBe(2);
    expect(avvisi({ sigarettaAnticipo: -1 }).sigarettaAnticipo).toBe(2);
    expect(avvisi('boh')).toEqual({ uscita: true, sigaretta: true, sigarettaAnticipo: 2, pranzo: true, pranzoMinuti: 30 });
  });

  it('le impostazioni predefinite non vengono mutate', () => {
    const d = migra({});
    d.impostazioni.avvisi.pranzoMinuti = 99;
    expect(IMPOSTAZIONI_PREDEFINITE.avvisi.pranzoMinuti).toBe(30);
  });
});
