// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Giornata } from '../src/core/tipi';
import { giornata, impostazioni } from './helpers';

// Store, azioni, dialoghi e plugin sono finti: si verifica cosa fa una lettura del tag.
const finto = vi.hoisted(() => ({
  giornate: {} as Record<string, Giornata>,
  impostazioni: null as unknown,
  registro: [] as string[],
  finestraAperta: false,
  sceltaFoglio: null as string | null,
  inizioSigaretta: null as number | null,
}));

vi.mock('../src/storage/store', () => ({
  store: {
    giornata: (data: string) => finto.giornate[data] ?? { data, permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [] },
    modificaGiornata: (data: string, f: (g: Giornata) => void) => {
      finto.registro.push('modificaGiornata');
      const g = structuredClone(finto.giornate[data] ?? { data, permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [] });
      f(g);
      finto.giornate[data] = g;
    },
    get impostazioni() {
      return finto.impostazioni;
    },
  },
}));
const azioni = vi.hoisted(() => ({ eseguiAzione: vi.fn(), rientroSigarettaDaTag: vi.fn() }));
vi.mock('../src/ui/giorno', () => ({ eseguiAzione: azioni.eseguiAzione }));
vi.mock('../src/ui/sigaretta', () => ({ rientroSigarettaDaTag: azioni.rientroSigarettaDaTag }));
const dialoghi = vi.hoisted(() => ({ toast: vi.fn(), apriFoglio: vi.fn() }));
vi.mock('../src/ui/dialoghi', () => dialoghi);
vi.mock('../src/ui/dom', () => ({ el: () => ({}) }));
const nfc = vi.hoisted(() => ({ vibra: vi.fn(), ascoltaTag: vi.fn() }));
vi.mock('../src/native/nfc', () => nfc);
vi.mock('../src/ui/inizioSigaretta', () => ({
  inizioSigarettaSalvato: () => finto.inizioSigaretta,
  salvaInizioSigaretta: vi.fn(() => void finto.registro.push('salvaInizioSigaretta')),
}));

const OGGI = '2026-10-01';

async function carica() {
  vi.resetModules();
  return import('../src/ui/tagNfc');
}

/** eseguiAzione finta: aggiunge l'evento come farebbe il tocco. */
function aggiungeEvento() {
  azioni.eseguiAzione.mockImplementation(async (tipo: string, data: string) => {
    const g = finto.giornate[data] ?? { data, permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [] };
    finto.giornate[data] = { ...g, eventi: [...g.eventi, { id: `t${g.eventi.length}`, tipo, minuti: 600 }] } as Giornata;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T08:00:00Z')); // 10:00 a Roma
  finto.giornate = {};
  finto.impostazioni = impostazioni();
  finto.registro = [];
  finto.finestraAperta = false;
  finto.sceltaFoglio = null;
  finto.inizioSigaretta = null;
  for (const f of [...Object.values(azioni), ...Object.values(dialoghi), ...Object.values(nfc)]) f.mockReset();
  dialoghi.apriFoglio.mockImplementation(async (_t: string, _c: unknown, pulsanti: { etichetta: string; azione?: () => void }[]) => {
    pulsanti.find((p) => p.etichetta === finto.sceltaFoglio)?.azione?.();
  });
  vi.stubGlobal('document', { querySelector: () => (finto.finestraAperta ? {} : null) });
  aggiungeEvento();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lettura del tag', () => {
  it('timbra l\'azione del pulsante principale, porta su Oggi e vibra', async () => {
    const { gestisciTag } = await carica();
    const mostraOggi = vi.fn();
    await gestisciTag(mostraOggi);
    expect(azioni.eseguiAzione).toHaveBeenCalledWith('ENTRATA', OGGI, expect.any(Function));
    expect(mostraOggi).toHaveBeenCalled();
    expect(nfc.vibra).toHaveBeenCalledOnce();
  });

  it('una seconda lettura entro un minuto è ignorata', async () => {
    vi.setSystemTime(new Date('2026-10-01T10:30:00Z')); // 12:30 a Roma: dopo l'entrata il tag timbra la pausa
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    vi.advanceTimersByTime(59_000);
    await gestisciTag(vi.fn());
    expect(dialoghi.toast).toHaveBeenCalledWith('Tag già letto: riavvicinalo tra un minuto');
    expect(azioni.eseguiAzione).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1_000);
    await gestisciTag(vi.fn());
    expect(azioni.eseguiAzione).toHaveBeenCalledTimes(2);
  });

  it('una lettura che non cambia la giornata non fa partire l\'attesa', async () => {
    azioni.eseguiAzione.mockResolvedValue(undefined); // es. conferma rifiutata
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    await gestisciTag(vi.fn());
    expect(azioni.eseguiAzione).toHaveBeenCalledTimes(2);
  });

  it('Annulla rimette gli eventi e permette subito una nuova lettura', async () => {
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    expect(finto.giornate[OGGI]!.eventi).toHaveLength(1);
    const annulla = azioni.eseguiAzione.mock.calls[0]![2] as () => void;
    annulla();
    expect(finto.giornate[OGGI]!.eventi).toEqual([]);
    expect(dialoghi.toast).toHaveBeenCalledWith('Timbratura annullata');
    await gestisciTag(vi.fn());
    expect(azioni.eseguiAzione).toHaveBeenCalledTimes(2);
  });

  it('Annulla del rientro dalla sigaretta risalva l\'inizio prima di toccare la giornata', async () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '09:55']], { data: OGGI });
    g.eventi[1]!.sigaretta = true;
    finto.giornate[OGGI] = g;
    finto.inizioSigaretta = 1_234;
    azioni.rientroSigarettaDaTag.mockImplementation((data: string) => {
      finto.giornate[data] = { ...finto.giornate[data]!, eventi: finto.giornate[data]!.eventi.slice(0, 1) };
    });
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    expect(azioni.rientroSigarettaDaTag).toHaveBeenCalledWith(OGGI, expect.any(Function));
    const annulla = azioni.rientroSigarettaDaTag.mock.calls[0]![1] as () => void;
    finto.registro = [];
    annulla();
    expect(finto.registro).toEqual(['salvaInizioSigaretta', 'modificaGiornata']);
    const { salvaInizioSigaretta } = await import('../src/ui/inizioSigaretta');
    expect(salvaInizioSigaretta).toHaveBeenCalledWith({ data: OGGI, eventoId: g.eventi[1]!.id, inizio: 1_234 });
    expect(finto.giornate[OGGI]!.eventi).toHaveLength(2);
  });

  it('Annulla di un rientro breve dalla sigaretta la toglie dalle non conteggiate', async () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '09:55']], { data: OGGI });
    g.eventi[1]!.sigaretta = true;
    finto.giornate[OGGI] = g;
    azioni.rientroSigarettaDaTag.mockImplementation((data: string) => {
      finto.giornate[data] = {
        ...finto.giornate[data]!,
        eventi: finto.giornate[data]!.eventi.slice(0, 1),
        sigaretteNonConteggiate: [{ minuti: 595, durata: 4 }],
      };
    });
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    const annulla = azioni.rientroSigarettaDaTag.mock.calls[0]![1] as () => void;
    annulla();
    expect(finto.giornate[OGGI]!.eventi).toHaveLength(2);
    expect(finto.giornate[OGGI]!.sigaretteNonConteggiate).toBeUndefined();
  });

  it('a fascia pranzo finita senza pausa chiede: Uscita timbra l\'uscita', async () => {
    vi.setSystemTime(new Date('2026-10-01T15:30:00Z')); // 17:30 a Roma
    finto.giornate[OGGI] = giornata([['ENTRATA', '08:30']], { data: OGGI });
    finto.sceltaFoglio = 'Uscita';
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    expect(dialoghi.apriFoglio).toHaveBeenCalledWith('Cosa timbri?', expect.anything(), expect.any(Array));
    expect(azioni.eseguiAzione).toHaveBeenCalledWith('USCITA', OGGI, expect.any(Function));
  });

  it('prima della fascia pranzo chiede: Esco in permesso timbra l\'uscita in permesso', async () => {
    finto.giornate[OGGI] = giornata([['ENTRATA', '08:30']], { data: OGGI }); // sono le 10:00
    finto.sceltaFoglio = 'Esco in permesso';
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    expect(dialoghi.apriFoglio).toHaveBeenCalledWith('Cosa timbri?', expect.anything(), expect.any(Array));
    expect(azioni.eseguiAzione).toHaveBeenCalledWith('USCITA_PERMESSO', OGGI, expect.any(Function));
  });

  it('prima della fascia pranzo chiede: Pausa sigaretta la fa partire', async () => {
    finto.giornate[OGGI] = giornata([['ENTRATA', '08:30']], { data: OGGI });
    finto.sceltaFoglio = '🚬 Pausa sigaretta';
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    expect(azioni.eseguiAzione).toHaveBeenCalledWith('PAUSA_SIGARETTA', OGGI, expect.any(Function));
  });

  it('se la scelta viene annullata non timbra e non fa partire l\'attesa', async () => {
    vi.setSystemTime(new Date('2026-10-01T15:30:00Z'));
    finto.giornate[OGGI] = giornata([['ENTRATA', '08:30']], { data: OGGI });
    finto.sceltaFoglio = 'Annulla';
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    expect(azioni.eseguiAzione).not.toHaveBeenCalled();
    finto.sceltaFoglio = 'Inizio pausa pranzo';
    await gestisciTag(vi.fn());
    expect(azioni.eseguiAzione).toHaveBeenCalledWith('INIZIO_PAUSA', OGGI, expect.any(Function));
  });

  it('vibra solo dopo aver timbrato: con la scelta annullata non vibra', async () => {
    vi.setSystemTime(new Date('2026-10-01T15:30:00Z')); // 17:30 a Roma
    finto.giornate[OGGI] = giornata([['ENTRATA', '08:30']], { data: OGGI });
    finto.sceltaFoglio = 'Annulla';
    const { gestisciTag } = await carica();
    await gestisciTag(vi.fn());
    expect(nfc.vibra).not.toHaveBeenCalled();
    finto.sceltaFoglio = 'Uscita';
    await gestisciTag(vi.fn());
    expect(nfc.vibra).toHaveBeenCalledOnce();
  });

  it('con una finestra aperta o la giornata chiusa mostra un messaggio e non vibra', async () => {
    const { gestisciTag } = await carica();
    finto.finestraAperta = true;
    await gestisciTag(vi.fn());
    expect(dialoghi.toast).toHaveBeenCalledWith('Chiudi la finestra aperta e riavvicina il tag');
    finto.finestraAperta = false;
    finto.giornate[OGGI] = giornata([['ENTRATA', '08:30'], ['USCITA', '09:30']], { data: OGGI });
    const mostraOggi = vi.fn();
    await gestisciTag(mostraOggi);
    expect(dialoghi.toast).toHaveBeenCalledWith('Giornata già chiusa');
    expect(mostraOggi).toHaveBeenCalled();
    expect(azioni.eseguiAzione).not.toHaveBeenCalled();
    expect(nfc.vibra).not.toHaveBeenCalled();
  });
});
