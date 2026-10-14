// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { ETICHETTE_AZIONE, type Azione } from '../src/core/statoGiornata';
import { URL_APK } from '../src/ui/aggiornamento';
import { aiutoPerAzione, filtraAiuto, pezziRiga, SEZIONI_AIUTO, vociAiuto } from '../src/ui/aiutoTesti';
import { impostazioni } from './helpers';

const voci = vociAiuto(impostazioni());

describe('aiuto', () => {
  it('ogni azione dell\'app ha una spiegazione', () => {
    const azioni = Object.keys(ETICHETTE_AZIONE) as Azione[];
    for (const a of azioni) {
      expect(aiutoPerAzione(voci, a), `manca l'aiuto per ${a}`).toBeDefined();
    }
  });

  it('id univoci e sezioni valide', () => {
    expect(new Set(voci.map((v) => v.id)).size).toBe(voci.length);
    for (const v of voci) expect(SEZIONI_AIUTO).toContain(v.sezione);
    for (const s of SEZIONI_AIUTO) expect(voci.some((v) => v.sezione === s)).toBe(true);
  });

  it('spiega come scaricare le timbrature sul computer, e che i dati partono solo così', () => {
    const computer = voci.find((x) => x.id === 'computer')!;
    expect(computer.sezione).toBe('Dati e backup');
    const testo = computer.testo.join(' ');
    expect(testo).toContain('web.sbeggio.app');
    expect(testo).toContain('Collega al computer');
    expect(testo).toContain('cifrat');
    const dove = voci.find((x) => x.id === 'dove-dati')!.testo.join(' ');
    expect(dove).toContain('Collega al computer');
  });

  it('gli avvisi spiegano anche la PWA', () => {
    const avvisi = voci.find((x) => x.id === 'avvisi')!.testo.join(' ');
    expect(avvisi).toContain('PWA');
    expect(avvisi).toContain('schermata Home');
    expect(avvisi).not.toContain('non sono disponibili');
    // L'id dell'avviso rivela al server di che avviso si tratta: il testo sulla privacy deve dirlo.
    expect(avvisi).toContain('l\'orario e il tipo di ogni avviso');
    const problemi = voci.find((x) => x.id === 'avvisi-non-arrivano')!.testo.join(' ');
    expect(problemi).toContain('internet');
    expect(problemi).toContain('Sveglie e promemoria');
    // Sul computer il browser deve essere aperto; il percorso dei permessi vale anche nell'app installata.
    expect(avvisi).toMatch(/sul computer/i);
    expect(problemi).toContain('Impostazioni sito');
    expect(problemi).toContain('Impostazioni → Notifiche → Sbeggio');
    expect(problemi).not.toContain('a sinistra dell\'indirizzo');
  });

  it('gli aggiornamenti distinguono la PWA dall\'app Android', () => {
    const testo = voci.find((x) => x.id === 'aggiornamenti')!.testo.join(' ');
    // La PWA si aggiorna da sola; l'APK no: va scaricato e installato sopra.
    expect(testo).toContain('Nella PWA');
    expect(testo).toContain('Nell\'app per Android');
    expect(testo).toContain('"Scarica"');
    const installazione = voci.find((x) => x.id === 'installazione-app')!.testo.join(' ');
    expect(installazione).toContain('riquadro in basso');
  });

  it('il download dell\'APK è un link con un testo breve, non un indirizzo da copiare', () => {
    const pezzi = (id: string) => voci.find((x) => x.id === id)!.testo.flatMap(pezziRiga);
    expect(pezzi('installazione-app')).toContainEqual({ testo: 'clicca qui', url: URL_APK });
    for (const id of ['installazione-app', 'aggiornamenti']) {
      expect(pezzi(id), id).toContainEqual(expect.objectContaining({ url: URL_APK }));
      const visibile = pezzi(id).map((p) => (typeof p === 'string' ? p : p.testo)).join(' ');
      expect(visibile, id).not.toContain('https://');
    }
  });

  it('pezziRiga separa i link [testo](url) dal testo', () => {
    expect(pezziRiga('Niente link.')).toEqual(['Niente link.']);
    expect(pezziRiga('Dal telefono [clicca qui](https://x.it/a.apk): scarica.')).toEqual([
      'Dal telefono ',
      { testo: 'clicca qui', url: 'https://x.it/a.apk' },
      ': scarica.',
    ]);
    expect(pezziRiga('[a](https://x.it) e [b](https://y.it)')).toEqual([
      { testo: 'a', url: 'https://x.it' },
      ' e ',
      { testo: 'b', url: 'https://y.it' },
    ]);
  });

  it('la ricerca trova il testo dei link ma non l\'indirizzo nascosto', () => {
    expect(filtraAiuto(voci, 'clicca qui').map((v) => v.id)).toContain('installazione-app');
    expect(filtraAiuto(voci, 'releases')).toEqual([]);
  });

  it('i testi seguono le impostazioni correnti', () => {
    const v = vociAiuto(impostazioni({ pranzo: { inizio: 750, fine: 840 }, pausaDaScalare: 45 }));
    const rientro = v.find((x) => x.id === 'rientro')!;
    expect(rientro.testo.join(' ')).toContain('12:30–14:00');
    expect(rientro.testo.join(' ')).toContain('45 min');
  });

  it('la pausa sigaretta usa la tolleranza impostata', () => {
    const v = vociAiuto(impostazioni({ tolleranzaSigaretta: 7 }));
    const voce = v.find((x) => x.id === 'pausa-sigaretta')!;
    expect(voce.azione).toBe('PAUSA_SIGARETTA');
    expect(voce.testo.join(' ')).toContain('7 min');
  });

  it('la pausa sigaretta descrive il disegno scelto', () => {
    const testo = (tipoSigaretta: 'normale' | 'elettronica') =>
      vociAiuto(impostazioni({ tipoSigaretta })).find((x) => x.id === 'pausa-sigaretta')!.testo.join(' ');
    expect(testo('normale')).toContain('posacenere');
    expect(testo('elettronica')).toContain('LED');
    expect(testo('elettronica')).not.toContain('posacenere');
    expect(testo('normale')).toContain('ultimi 30 secondi');
    expect(testo('normale')).toContain('normale o elettronica');
  });

  it('spiega permessi a blocchi, permesso in uscita e pausa dimenticata', () => {
    const testo = (id: string) => voci.find((v) => v.id === id)!.testo.join(' ');
    expect(voci.find((v) => v.id === 'permesso-uscita')).toBeDefined();
    expect(testo('ore-coperte')).toContain('multiplo di 30 min');
    expect(testo('pausa')).toContain('12:15');
    expect(testo('uscita-prevista')).toContain('permesso in uscita');
  });

  it('la ricerca ignora maiuscole e accenti e richiede tutte le parole', () => {
    expect(filtraAiuto(voci, 'USCITA anticipata').map((v) => v.id)).toContain('permesso-vs-anticipata');
    expect(filtraAiuto(voci, 'perche entrata').map((v) => v.id)).toContain('orario-minimo');
    expect(filtraAiuto(voci, 'zzzz')).toEqual([]);
    expect(filtraAiuto(voci, '  ')).toHaveLength(voci.length);
  });

  it('mette prima le domande che contengono le parole cercate, poi le altre nell\'ordine della pagina', () => {
    const trovate = filtraAiuto(voci, 'permesso');
    const nelTitolo = (d: string) => d.toLowerCase().includes('permesso');
    const primaAltra = trovate.findIndex((v) => !nelTitolo(v.domanda));
    expect(primaAltra).toBeGreaterThan(0);
    expect(trovate.slice(primaAltra).every((v) => !nelTitolo(v.domanda))).toBe(true);
    // A parità, resta l'ordine della pagina.
    const ordine = (v: { id: string }) => voci.findIndex((x) => x.id === v.id);
    const titoli = trovate.slice(0, primaAltra);
    expect(titoli.map(ordine)).toEqual([...titoli.map(ordine)].sort((a, b) => a - b));
  });

  it('il tag NFC spiega uso e preparazione', () => {
    const uso = voci.find((x) => x.id === 'tag-nfc')!.testo.join(' ');
    expect(uso).toContain('Annulla');
    expect(uso).toContain('14:30'); // fine della fascia pranzo con le impostazioni dei test
    expect(uso).toContain('Impostazioni → Tag NFC');
    const preparare = voci.find((x) => x.id === 'tag-nfc-preparare')!.testo.join(' ');
    expect(preparare).toContain('sbeggio://timbra');
    expect(preparare).toContain('Blocca');
    expect(preparare).toContain('definitivo');
  });
});
