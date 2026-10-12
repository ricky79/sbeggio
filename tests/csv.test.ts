import { describe, expect, it } from 'vitest';
import { esportaCsv, importaCsv, parseCsv, ErroreImportazione } from '../src/core/csv';
import { haContenuto, riepilogoMese } from '../src/core/riepilogo';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const oggi = { data: '2026-10-05', minuti: h('10:00') };

function dati() {
  const a = giornata(
    [
      ['ENTRATA', '10:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA', '17:45'],
    ],
    { permessoInizio: 120, data: '2026-10-01' },
  );
  const b = giornata(
    [
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '14:30', 45],
      ['USCITA', '17:30'],
    ],
    { data: '2026-10-02' },
  );
  return { [a.data]: a, [b.data]: b };
}

describe('CSV', () => {
  it('esporta con separatore ; e decimali con virgola', () => {
    const csv = esportaCsv(dati(), imp, oggi);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const righe = csv.slice(1).trimEnd().split('\r\n');
    expect(righe[0]).toBe(
      'Data;Giorno;Ore dovute;Ore lavorate;Ore permesso;Saldo;Stato;Permesso inizio giornata (min);Permesso in uscita (min);Luogo;Ferie;Uscita prevista;Eventi',
    );
    expect(righe[1]).toBe(
      '2026-10-01;Giovedì;8,00;6,25;2,00;0,25;Giornata chiusa;120;0;Sede;;;10:30 Entrata, 12:30 Inizio pausa pranzo, 13:30 Fine pausa pranzo, 17:45 Uscita',
    );
    expect(righe[2]).toContain('14:30 Rientro da permesso (pausa 45)');
  });

  it('round trip esporta → importa', () => {
    const originali = dati();
    const importati = importaCsv(esportaCsv(originali, imp, oggi));
    expect(Object.keys(importati).sort()).toEqual(Object.keys(originali).sort());
    for (const [data, g] of Object.entries(originali)) {
      const i = importati[data]!;
      expect(i.permessoInizioMinuti).toBe(g.permessoInizioMinuti);
      expect(i.permessoUscitaMinuti).toBe(g.permessoUscitaMinuti);
      expect(i.eventi.map(({ tipo, minuti, pausaConfermata }) => ({ tipo, minuti, pausaConfermata }))).toEqual(
        g.eventi.map(({ tipo, minuti, pausaConfermata }) => ({ tipo, minuti, pausaConfermata })),
      );
    }
  });

  it('il luogo (smart o sede) si esporta e si reimporta', () => {
    const d = dati();
    d['2026-10-02']!.luogo = 'smart';
    const csv = esportaCsv(d, imp, oggi);
    expect(csv).toContain(';Smart;;;08:30 Entrata');
    const i = importaCsv(csv);
    expect(i['2026-10-02']!.luogo).toBe('smart');
    expect(i['2026-10-01']!.luogo).toBe('sede');
    // CSV di versioni precedenti, senza la colonna: tutto in sede.
    expect(importaCsv('Data;Eventi\r\n2026-10-02;08:30 Entrata\r\n')['2026-10-02']!.luogo).toBeUndefined();
  });

  it('le ferie si esportano e si reimportano', () => {
    const d = dati();
    d['2026-10-07'] = { ...giornata([], { data: '2026-10-07' }), ferie: true };
    const csv = esportaCsv(d, imp, oggi);
    expect(csv).toContain('2026-10-07;Mercoledì;8,00;0,00;0,00;0,00;Ferie;0;0;Sede;Sì;;');
    const i = importaCsv(csv);
    expect(i['2026-10-07']!.ferie).toBe(true);
    expect(i['2026-10-01']!.ferie).toBeUndefined();
  });

  it('giornata con solo il permesso in uscita: esportata e reimportata', () => {
    const g = giornata([], { permessoUscita: 60, data: '2026-10-06' });
    const csv = esportaCsv({ [g.data]: g }, imp, oggi);
    expect(csv).toContain(';0;60;');
    const i = importaCsv(csv)['2026-10-06']!;
    expect(i.permessoUscitaMinuti).toBe(60);
    expect(i.eventi).toEqual([]);
  });

  it('CSV senza la colonna del permesso in uscita: vale 0; valore non valido: errore', () => {
    expect(importaCsv('Data;Eventi\r\n2026-10-02;08:30 Entrata\r\n')['2026-10-02']!.permessoUscitaMinuti).toBe(0);
    expect(() => importaCsv('Data;Permesso in uscita (min);Eventi\r\n2026-10-02;-30;08:30 Entrata\r\n')).toThrow(/permesso in uscita/);
  });

  it('pausa sigaretta: suffisso nel CSV, permesso a blocchi e ritorno', () => {
    const g = giornata(
      [
        ['ENTRATA', '08:30'],
        ['USCITA_PERMESSO', '10:05'],
        ['RIENTRO_PERMESSO', '10:20'],
        ['USCITA', '17:30'],
      ],
      { data: '2026-10-02' },
    );
    g.eventi[1]!.sigaretta = true;
    const csv = esportaCsv({ [g.data]: g }, imp, oggi);
    expect(csv).toContain('10:05 Uscita in permesso (sigaretta)');
    // dovute 8h, lavorate 8h30, permesso 30 min (blocco), saldo +1h
    expect(csv).toContain('2026-10-02;Venerdì;8,00;8,50;0,50;1,00;');
    const i = importaCsv(csv)[g.data]!;
    expect(i.eventi.map((e) => e.sigaretta)).toEqual([undefined, true, undefined, undefined]);
  });

  it('il suffisso (sigaretta) vale solo sulle uscite in permesso', () => {
    const csv = 'Data;Eventi\r\n2026-10-02;08:30 Entrata (sigaretta), 10:05 Uscita in permesso (sigaretta)\r\n';
    const i = importaCsv(csv)['2026-10-02']!;
    expect(i.eventi.map((e) => e.sigaretta)).toEqual([undefined, true]);
  });

  it('importa anche le etichette di prima ("Inizio pausa", "Fine pausa")', () => {
    const csv = 'Data;Eventi\r\n2026-10-02;08:30 Entrata, 12:30 Inizio pausa, 13:30 Fine pausa, 17:30 Uscita\r\n';
    const i = importaCsv(csv)['2026-10-02']!;
    expect(i.eventi.map((e) => e.tipo)).toEqual(['ENTRATA', 'INIZIO_PAUSA', 'FINE_PAUSA', 'USCITA']);
  });

  it('parser con campi tra virgolette', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\r\n1;2;3\n')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('errori di import chiari', () => {
    expect(() => importaCsv('foo;bar\n1;2')).toThrow(ErroreImportazione);
    expect(() => importaCsv('Data;Eventi\n2026-13-01;08:30 Entrata')).toThrow(/data/);
    expect(() => importaCsv('Data;Eventi\n2026-10-01;08:30 Ballo')).toThrow(/non riconosciuto/);
  });
});

describe('riepilogo mensile', () => {
  it('una giornata con solo il permesso in uscita ha contenuto', () => {
    expect(haContenuto(giornata([], { permessoUscita: 30 }))).toBe(true);
    expect(haContenuto(giornata([]))).toBe(false);
    expect(haContenuto({ ...giornata([]), luogo: 'smart' })).toBe(true);
    // In sede senza timbrature non è una giornata lavorata.
    expect(haContenuto({ ...giornata([]), luogo: 'sede' })).toBe(false);
  });

  it('conta i giorni da casa (smart) del mese', () => {
    const d = dati();
    d['2026-10-01']!.luogo = 'smart';
    const s = giornata([], { data: '2026-09-30' });
    s.luogo = 'smart';
    d[s.data] = s; // altro mese: non conta
    const r = riepilogoMese(d, imp, '2026-10', oggi);
    expect(r.giorniSmart).toBe(1);
    expect(r.giorni.map((g) => [g.data, g.smart])).toEqual([
      ['2026-10-02', false],
      ['2026-10-01', true],
    ]);
    expect(riepilogoMese(dati(), imp, '2026-10', oggi).giorniSmart).toBe(0);
  });

  it('somma lavorate, permessi e saldo del mese', () => {
    const r = riepilogoMese(dati(), imp, '2026-10', oggi);
    expect(r.giorni.map((g) => g.data)).toEqual(['2026-10-02', '2026-10-01']);
    // 2026-10-02: permesso 12:00–14:30 con 45 di pausa → 105 reali → 2h a blocchi.
    expect(r.permesso).toBe(120 + 120);
    expect(r.saldo).toBe(15 + 15);
    expect(r.giorniDaCorreggere).toBe(0);
  });

  it('la giornata in corso non entra nel saldo del mese', () => {
    const d = dati();
    d['2026-10-05'] = giornata([['ENTRATA', '08:30']], { data: '2026-10-05' });
    const r = riepilogoMese(d, imp, '2026-10', oggi);
    expect(r.saldo).toBe(30);
    expect(r.giorni).toHaveLength(3);
  });
});
