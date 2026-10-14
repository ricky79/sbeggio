// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import {
  daControllare,
  INTERVALLO_CONTROLLO,
  leggiStato,
  piuNuova,
  versioneDaProporre,
  versioneRilascio,
  type StatoAggiornamento,
} from '../src/ui/aggiornamento';

const stato = (s: Partial<StatoAggiornamento> = {}): StatoAggiornamento => ({ controllato: 0, ultima: null, chiusa: null, ...s });

describe('versioneRilascio', () => {
  it('legge la versione dal tag dell\'ultima release con l\'APK', () => {
    const release = { tag_name: 'v1.12.0', assets: [{ name: 'sbeggio-1.12.0.apk' }, { name: 'sbeggio.apk' }] };
    expect(versioneRilascio(release)).toBe('1.12.0');
    // I tag storici non hanno la "v".
    expect(versioneRilascio({ tag_name: '1.7.0', assets: [{ name: 'sbeggio.apk' }] })).toBe('1.7.0');
  });

  it('ignora la release finché l\'APK non è allegato', () => {
    // android.yml crea la release e solo dopo ci carica l'APK: nel frattempo il link di download non funziona.
    expect(versioneRilascio({ tag_name: 'v1.12.0', assets: [] })).toBeNull();
    expect(versioneRilascio({ tag_name: 'v1.12.0', assets: [{ name: 'sbeggio-1.12.0.apk' }] })).toBeNull();
  });

  it('risposte inattese non sono una versione', () => {
    expect(versioneRilascio(null)).toBeNull();
    expect(versioneRilascio('v1.12.0')).toBeNull();
    expect(versioneRilascio({ message: 'API rate limit exceeded' })).toBeNull();
    expect(versioneRilascio({ tag_name: 'ultima', assets: [{ name: 'sbeggio.apk' }] })).toBeNull();
  });
});

describe('piuNuova', () => {
  it('confronta i numeri, non il testo', () => {
    expect(piuNuova('1.12.0', '1.11.0')).toBe(true);
    expect(piuNuova('1.10.0', '1.9.5')).toBe(true);
    expect(piuNuova('2.0.0', '1.99.99')).toBe(true);
    expect(piuNuova('1.11.1', '1.11.0')).toBe(true);
  });

  it('la stessa versione o una più vecchia non è nuova', () => {
    expect(piuNuova('1.11.0', '1.11.0')).toBe(false);
    expect(piuNuova('1.9.0', '1.11.0')).toBe(false);
  });

  it('una versione non valida non è mai nuova', () => {
    expect(piuNuova('abc', '1.11.0')).toBe(false);
    expect(piuNuova('1.12.0', '')).toBe(false);
  });
});

describe('versioneDaProporre', () => {
  it('propone l\'ultima versione se è più nuova di quella installata', () => {
    expect(versioneDaProporre('1.11.0', stato({ ultima: '1.12.0' }))).toBe('1.12.0');
  });

  it('niente banner se l\'app è già aggiornata o la versione non è nota', () => {
    expect(versioneDaProporre('1.12.0', stato({ ultima: '1.12.0' }))).toBeNull();
    // Installata una versione più nuova di quella vista all'ultimo controllo.
    expect(versioneDaProporre('1.13.0', stato({ ultima: '1.12.0' }))).toBeNull();
    expect(versioneDaProporre('1.11.0', stato())).toBeNull();
  });

  it('chiuso il banner, ricompare solo con una versione successiva', () => {
    expect(versioneDaProporre('1.11.0', stato({ ultima: '1.12.0', chiusa: '1.12.0' }))).toBeNull();
    expect(versioneDaProporre('1.11.0', stato({ ultima: '1.13.0', chiusa: '1.12.0' }))).toBe('1.13.0');
  });
});

describe('daControllare', () => {
  const ora = Date.UTC(2026, 9, 6, 8, 0);

  it('controlla al primo avvio e poi a intervalli', () => {
    expect(daControllare(stato(), ora)).toBe(true);
    expect(daControllare(stato({ controllato: ora - 60_000 }), ora)).toBe(false);
    expect(daControllare(stato({ controllato: ora - INTERVALLO_CONTROLLO + 1 }), ora)).toBe(false);
    expect(daControllare(stato({ controllato: ora - INTERVALLO_CONTROLLO }), ora)).toBe(true);
  });

  it('se l\'orologio del telefono torna indietro controlla subito', () => {
    expect(daControllare(stato({ controllato: ora + 60_000 }), ora)).toBe(true);
  });
});

describe('leggiStato', () => {
  it('senza dati salvati parte da zero', () => {
    expect(leggiStato(null)).toEqual(stato());
    expect(leggiStato('non è json')).toEqual(stato());
    expect(leggiStato('null')).toEqual(stato());
  });

  it('rilegge quello che ha salvato', () => {
    const s = stato({ controllato: 1234, ultima: '1.12.0', chiusa: '1.11.5' });
    expect(leggiStato(JSON.stringify(s))).toEqual(s);
  });

  it('scarta i campi con il tipo sbagliato', () => {
    expect(leggiStato('{"controllato":"ieri","ultima":12,"chiusa":"1.12.0"}')).toEqual(stato({ chiusa: '1.12.0' }));
  });
});
