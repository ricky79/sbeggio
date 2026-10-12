import { describe, expect, it } from 'vitest';
import { esportaCsv } from '../src/core/csv';
import { riepilogoMese } from '../src/core/riepilogo';
import { uscitaPrevistaGiornata } from '../src/core/uscitaPrevista';
import { migra } from '../src/storage/migrazioni';
import { GIOVEDI, giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const chiusa = (uscita: string, tipo: 'USCITA' | 'USCITA_ANTICIPATA' = 'USCITA') =>
  giornata([
    ['ENTRATA', '08:30'],
    ['INIZIO_PAUSA', '12:30'],
    ['FINE_PAUSA', '13:30'],
    [tipo, uscita],
  ]);

describe('uscita prevista di una giornata chiusa', () => {
  it('è l\'orario a cui si completavano le ore dovute, a prescindere da quando si è usciti', () => {
    // 8h dovute dalle 08:30 con un'ora di pausa: 17:30.
    expect(uscitaPrevistaGiornata(chiusa('17:45'), imp)).toBe(h('17:30'));
    expect(uscitaPrevistaGiornata(chiusa('18:10'), imp)).toBe(h('17:30'));
  });

  it('vale anche con un\'uscita anticipata', () => {
    expect(uscitaPrevistaGiornata(chiusa('16:00', 'USCITA_ANTICIPATA'), imp)).toBe(h('17:30'));
  });

  it('coincide con quella che Oggi mostrava prima di uscire', async () => {
    const { calcolaGiornata } = await import('../src/core/calcolo');
    const aperta = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30']]);
    expect(uscitaPrevistaGiornata(chiusa('17:45'), imp)).toBe(calcolaGiornata(aperta, imp, h('17:44')).uscitaPrevista);
  });

  it('nessuna uscita prevista per giornate aperte, da correggere o di ferie', () => {
    expect(uscitaPrevistaGiornata(giornata([['ENTRATA', '08:30']]), imp)).toBeNull();
    expect(uscitaPrevistaGiornata(giornata([['USCITA', '17:30']]), imp)).toBeNull();
    expect(uscitaPrevistaGiornata({ ...giornata([]), ferie: true }, imp)).toBeNull();
  });
});

describe('uscita prevista salvata', () => {
  it('all\'import (o al caricamento) si calcola se manca, con le impostazioni del file', () => {
    const g = chiusa('17:45');
    const d = migra({ version: 1, impostazioni: { minutiDovuti: { predefinito: 420, perGiorno: [0, null, null, null, null, null, 0] } }, giornate: { [GIOVEDI]: g } });
    // 7h dovute: 16:30.
    expect(d.giornate[GIOVEDI]!.uscitaPrevista).toBe(h('16:30'));
  });

  it('se c\'è già nel file resta quella salvata', () => {
    const g = { ...chiusa('17:45'), uscitaPrevista: h('17:00') };
    expect(migra({ version: 1, giornate: { [GIOVEDI]: g } }).giornate[GIOVEDI]!.uscitaPrevista).toBe(h('17:00'));
  });

  it('nello storico: salvata per le chiuse, calcolata adesso per quella in corso', () => {
    const passata = { ...chiusa('17:45'), uscitaPrevista: h('17:10') };
    const oggi = giornata([['ENTRATA', '09:00']], { data: '2026-10-02' });
    const r = riepilogoMese({ [passata.data]: passata, [oggi.data]: oggi }, imp, '2026-10', { data: '2026-10-02', minuti: h('10:00') });
    const g = (d: string) => r.giorni.find((x) => x.data === d)!;
    expect(g(GIOVEDI).uscitaPrevista).toBe(h('17:10'));
    expect(g(GIOVEDI).uscita).toBe(h('17:45'));
    expect(g('2026-10-02').uscitaPrevista).not.toBeNull();
    expect(g('2026-10-02').uscita).toBeNull();
  });

  it('nel CSV c\'è la colonna Uscita prevista', () => {
    const g = { ...chiusa('17:45'), uscitaPrevista: h('17:30') };
    const csv = esportaCsv({ [g.data]: g }, imp, { data: '2026-10-05', minuti: 0 });
    expect(csv).toContain(';Sede;;17:30;08:30 Entrata');
  });
});
