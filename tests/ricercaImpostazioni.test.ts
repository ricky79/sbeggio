// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { corrisponde } from '../src/core/testi';
import { cercaImpostazioni, PAGINE_IMPOSTAZIONI, VOCI_IMPOSTAZIONI } from '../src/ui/ricercaImpostazioni';

const ids = (query: string, app = false) => cercaImpostazioni(query, { app }).map((v) => v.id);

describe('corrisponde', () => {
  it('vuole tutte le parole, senza badare ad accenti e maiuscole', () => {
    expect(corrisponde('Lunedì predefinito', 'LUNEDI')).toBe(true);
    expect(corrisponde('Pausa minima', 'minima pausa')).toBe(true);
    expect(corrisponde('Pausa minima', 'pausa sigaretta')).toBe(false);
    expect(corrisponde('qualunque', '   ')).toBe(true);
  });
});

describe('cercaImpostazioni', () => {
  it('con la ricerca vuota non dà risultati', () => {
    expect(ids('')).toEqual([]);
    expect(ids('  ')).toEqual([]);
  });

  it('trova per nome, nell\'ordine della pagina', () => {
    expect(ids('pausa minima')).toEqual(['pausa-minima']);
    expect(ids('tolleranza')).toEqual(['tolleranza-sigaretta']);
    const pausa = ids('pausa');
    expect(pausa.indexOf('inizio-pranzo')).toBeLessThan(pausa.indexOf('tolleranza-sigaretta'));
  });

  it('trova anche per sezione e per sinonimi', () => {
    expect(ids('notifiche')).toContain('permessi-avvisi');
    expect(ids('scuro')).toEqual(['tema']);
    expect(ids('dark')).toEqual(['tema']);
    expect(ids('gps')).toEqual(['posizione-ufficio']);
    expect(ids('sabato')).toEqual(['ore-per-giorno']);
    expect(ids('qr')).toContain('collega-dispositivo');
    expect(ids('excel')).toContain('esporta-excel');
    expect(ids('Avvisi').length).toBeGreaterThan(3);
    expect(ids('suoni')).toEqual(['suoni']);
    expect(ids('campanelle')).toContain('suoni');
  });

  it('ignora gli accenti', () => {
    expect(ids('lunedi')).toEqual(['ore-per-giorno']);
    expect(ids('Lunedì')).toEqual(['ore-per-giorno']);
  });

  it('mostra il tag NFC solo nell\'app', () => {
    expect(ids('nfc', false)).toEqual([]);
    expect(ids('nfc', true)).toEqual(['tag-nfc']);
  });

  it('ogni voce ha la sua riga nella pagina e la sua pagina esiste', () => {
    const pagina = readFileSync(new URL('../src/ui/impostazioni.ts', import.meta.url), 'utf8');
    for (const v of VOCI_IMPOSTAZIONI) {
      expect(pagina.includes(`'imp-${v.id}'`) || pagina.includes(`'${v.id}'),`) || pagina.includes(`'${v.id}',\n`) || pagina.includes(`'${v.id}',\r\n`), v.id).toBe(true);
      const p = PAGINE_IMPOSTAZIONI.find((x) => x.id === v.pagina);
      expect(p, v.pagina).toBeDefined();
      expect(v.sezione).toBe(p!.titolo);
    }
  });

  it('ogni voce ha un id diverso, un nome e una sezione', () => {
    const tutti = VOCI_IMPOSTAZIONI.map((v) => v.id);
    expect(new Set(tutti).size).toBe(tutti.length);
    for (const v of VOCI_IMPOSTAZIONI) {
      expect(v.id).toMatch(/^[a-z0-9-]+$/);
      expect(v.nome.length).toBeGreaterThan(0);
      expect(v.sezione.length).toBeGreaterThan(0);
    }
  });
});

describe('pagine delle impostazioni', () => {
  it('id unici; Tag NFC solo nell\'app; Aiuto e Novità in fondo', () => {
    const ids = PAGINE_IMPOSTAZIONI.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PAGINE_IMPOSTAZIONI.find((p) => p.id === 'nfc')?.soloApp).toBe(true);
    expect(ids.slice(-2)).toEqual(['aiuto', 'novita']);
    expect(ids[0]).toBe('dispositivi');
  });

  it('gruppi in ordine crescente, per i blocchi dell\'elenco', () => {
    const gruppi = PAGINE_IMPOSTAZIONI.map((p) => p.gruppo);
    expect([...gruppi].sort((a, b) => a - b)).toEqual(gruppi);
  });

  it('Orario di lavoro contiene ore dovute e inizio conteggio; Pause il pranzo e la sigaretta', () => {
    const pagina = (id: string) => VOCI_IMPOSTAZIONI.find((v) => v.id === id)!.pagina;
    expect([pagina('ore-predefinite'), pagina('inizio-conteggio')]).toEqual(['orario', 'orario']);
    expect([pagina('pausa-minima'), pagina('tolleranza-sigaretta')]).toEqual(['pause', 'pause']);
    expect(pagina('ripristina')).toBe('dati');
  });
});
