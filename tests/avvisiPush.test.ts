// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import {
  avvisiDaRiprogrammare,
  CACHE_AVVISI,
  CHIAVE_VAPID,
  chiaveCache,
  chiaveDaBase64url,
  idAvviso,
  notificaDaPush,
  operazioniPush,
  opzioniNotifica,
  statoPermessiWeb,
  stessaChiave,
  tipoDaId,
  URL_NOTIFICHE,
  type AvvisoPush,
} from '../src/core/avvisiPush';

const DISPOSITIVO = '3f2a9c1e-0b7d-4e57-9a1c-2d4b6e8f0a11';
const ORA = Date.parse('2026-10-01T08:00:00Z'); // 10:00 a Roma
const uscita: AvvisoPush = {
  tipo: 'uscita',
  orario: Date.parse('2026-10-01T15:30:00Z'),
  titolo: 'Puoi andare via',
  testo: 'Le ore sono completate: uscita prevista alle 17:30.',
};
const pausa: AvvisoPush = {
  tipo: 'pausa',
  orario: Date.parse('2026-10-01T08:35:00Z'),
  titolo: 'Fine pausa pranzo',
  testo: 'Sono passati 45 min: è ora di rientrare.',
};
const inviato = ({ orario, titolo, testo }: AvvisoPush) => ({ orario, titolo, testo });
const opz = { ora: ORA, endpointCambiato: false };

describe('id degli avvisi', () => {
  it('unisce dispositivo e tipo in un id valido per il backend', () => {
    const id = idAvviso(DISPOSITIVO, 'sigaretta');
    expect(id).toBe(`${DISPOSITIVO}-sigaretta`);
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it('ricava il tipo dall\'id', () => {
    expect(tipoDaId(idAvviso(DISPOSITIVO, 'uscita'))).toBe('uscita');
    expect(tipoDaId(idAvviso(DISPOSITIVO, 'pausa'))).toBe('pausa');
    expect(tipoDaId(idAvviso(DISPOSITIVO, 'sigaretta'))).toBe('sigaretta');
  });

  it('id non riconoscibili', () => {
    expect(tipoDaId(`${DISPOSITIVO}-caffe`)).toBeNull();
    expect(tipoDaId('pausa')).toBeNull();
    expect(tipoDaId('')).toBeNull();
  });
});

describe('operazioni verso il backend', () => {
  it('avviso nuovo → programma', () => {
    expect(operazioniPush([uscita], {}, opz)).toEqual([{ azione: 'programma', avviso: uscita }]);
  });

  it('avviso identico → nessuna operazione', () => {
    expect(operazioniPush([uscita], { uscita: inviato(uscita) }, opz)).toEqual([]);
  });

  it('orario o testo cambiati → programma di nuovo', () => {
    const prima = { uscita: inviato(uscita) };
    const piuTardi = { ...uscita, orario: uscita.orario + 15 * 60_000 };
    const altroTesto = { ...uscita, testo: 'Le ore sono completate: uscita prevista alle 17:45.' };
    expect(operazioniPush([piuTardi], prima, opz)).toEqual([{ azione: 'programma', avviso: piuTardi }]);
    expect(operazioniPush([altroTesto], prima, opz)).toEqual([{ azione: 'programma', avviso: altroTesto }]);
  });

  it('avviso futuro non più nel piano → annulla', () => {
    expect(operazioniPush([], { uscita: inviato(uscita) }, opz)).toEqual([{ azione: 'annulla', tipo: 'uscita' }]);
  });

  it('avviso già scaduto non più nel piano → dimentica, senza DELETE', () => {
    const inviati = { uscita: inviato(uscita) };
    expect(operazioniPush([], inviati, { ora: uscita.orario + 60_000, endpointCambiato: false })).toEqual([
      { azione: 'dimentica', tipo: 'uscita' },
    ]);
    // Proprio all'orario il server lo sta spedendo: non va annullato.
    expect(operazioniPush([], inviati, { ora: uscita.orario, endpointCambiato: false })).toEqual([
      { azione: 'dimentica', tipo: 'uscita' },
    ]);
  });

  it('in pausa: programma il rientro e annulla l\'uscita', () => {
    expect(operazioniPush([pausa], { uscita: inviato(uscita) }, opz)).toEqual([
      { azione: 'programma', avviso: pausa },
      { azione: 'annulla', tipo: 'uscita' },
    ]);
  });

  it('endpoint cambiato → riprogramma anche gli avvisi identici', () => {
    expect(operazioniPush([uscita], { uscita: inviato(uscita) }, { ora: ORA, endpointCambiato: true })).toEqual([
      { azione: 'programma', avviso: uscita },
    ]);
  });

  it('niente piano e niente inviati → nessuna operazione', () => {
    expect(operazioniPush([], {}, opz)).toEqual([]);
  });
});

describe('stato dei permessi nella PWA', () => {
  const base = { iosNonInstallata: false, supportato: true, permesso: 'granted', iscritto: true } as const;

  it('concessi solo con permesso e iscrizione', () => {
    expect(statoPermessiWeb(base)).toBe('concessi');
    expect(statoPermessiWeb({ ...base, permesso: 'default', iscritto: false })).toBe('da-chiedere');
  });

  it('permesso concesso ma iscrizione assente (fallita o persa): da attivare', () => {
    expect(statoPermessiWeb({ ...base, iscritto: false })).toBe('da-attivare');
  });

  it('permesso negato', () => {
    expect(statoPermessiWeb({ ...base, permesso: 'denied', iscritto: false })).toBe('negati');
  });

  it('iPhone aperto nel browser: da installare, prima di ogni altro controllo', () => {
    expect(statoPermessiWeb({ ...base, iosNonInstallata: true, supportato: false })).toBe('da-installare');
  });

  it('browser senza push o senza service worker attivo', () => {
    expect(statoPermessiWeb({ ...base, supportato: false })).toBe('non-disponibili');
  });
});

describe('testo della notifica', () => {
  const id = idAvviso(DISPOSITIVO, 'pausa');
  const payload = {
    tipo: 'fine-pausa',
    id,
    orario: '2026-10-01T08:35:00.000Z',
    titolo: 'Pausa finita',
    testo: 'È ora di timbrare il rientro',
  };
  const salvato = { titolo: 'Fine pausa pranzo', testo: 'Sono passati 45 min: è ora di rientrare.', orario: '2026-10-01T08:35:00.000Z' };

  it('usa il testo salvato se l\'orario coincide', () => {
    expect(notificaDaPush(payload, salvato)).toEqual({ titolo: salvato.titolo, testo: salvato.testo, tag: id });
  });

  it('testo salvato di un altro orario → testo generico del tipo', () => {
    expect(notificaDaPush(payload, { ...salvato, orario: '2026-10-01T08:20:00.000Z' })).toEqual({
      titolo: 'Fine pausa pranzo',
      testo: 'È ora di rientrare.',
      tag: id,
    });
  });

  it('senza testo salvato → testo generico del tipo', () => {
    const idUscita = idAvviso(DISPOSITIVO, 'uscita');
    expect(notificaDaPush({ ...payload, id: idUscita }, null)).toEqual({
      titolo: 'Puoi andare via',
      testo: 'Le ore di oggi sono completate.',
      tag: idUscita,
    });
    expect(notificaDaPush({ ...payload, id: idAvviso(DISPOSITIVO, 'sigaretta') }, null)).toMatchObject({
      titolo: 'Pausa sigaretta',
      testo: 'Rientra prima che diventi permesso.',
    });
  });

  it('testo salvato malformato → ignorato', () => {
    expect(notificaDaPush(payload, { titolo: 3 })).toMatchObject({ titolo: 'Fine pausa pranzo', testo: 'È ora di rientrare.' });
    expect(notificaDaPush(payload, 'testo')).toMatchObject({ titolo: 'Fine pausa pranzo' });
  });

  it('id non riconoscibile → testo del payload', () => {
    expect(notificaDaPush({ ...payload, id: 'altro' }, null)).toEqual({
      titolo: 'Pausa finita',
      testo: 'È ora di timbrare il rientro',
      tag: 'altro',
    });
    expect(notificaDaPush({ id: 'altro' }, null)).toEqual({ titolo: 'Sbeggio', testo: '', tag: 'altro' });
  });

  it('payload non valido → notifica generica', () => {
    const generica = { titolo: 'Sbeggio', testo: 'Apri l\'app per i dettagli.', tag: 'sbeggio' };
    expect(notificaDaPush(null, null)).toEqual(generica);
    expect(notificaDaPush('ciao', null)).toEqual(generica);
    expect(notificaDaPush({ id: 7 }, null)).toEqual(generica);
  });
});

describe('opzioni della notifica', () => {
  it('una notifica dello stesso tipo ancora visibile viene sostituita e suona di nuovo', () => {
    expect(opzioniNotifica({ titolo: 'Fine pausa pranzo', testo: 'È ora di rientrare.', tag: 'abc-pausa' })).toEqual({
      body: 'È ora di rientrare.',
      tag: 'abc-pausa',
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-96.png',
      renotify: true,
    });
  });
});

describe('cache e chiave VAPID', () => {
  it('la voce della cache è la stessa nella pagina e nel service worker', () => {
    expect(CACHE_AVVISI).toBe('sbeggio-avvisi');
    expect(chiaveCache('https://sbeggio.app/', 'abc-pausa')).toBe(
      'https://sbeggio.app/avvisi/abc-pausa',
    );
  });

  it('riconosce un\'iscrizione fatta con un\'altra chiave VAPID', () => {
    const attuale = chiaveDaBase64url('BDMM0_ITU0dc_OrEyil6M1IliUYEiKma7ANcCiK5CVxVIM8LxBWnycBd0NJG_PQpBTadDsQctWsx2z6dMzZb0iA');
    expect(stessaChiave(attuale.slice().buffer, attuale)).toBe(true);
    const altra = attuale.slice();
    altra[10] = altra[10]! ^ 0xff;
    expect(stessaChiave(altra.buffer, attuale)).toBe(false);
    expect(stessaChiave(new ArrayBuffer(0), attuale)).toBe(false);
    // Se il browser non dice con che chiave è stata fatta l'iscrizione, la si tiene.
    expect(stessaChiave(null, attuale)).toBe(true);
  });

  it('decodifica la chiave VAPID in un punto P-256 non compresso', () => {
    const chiave = chiaveDaBase64url('BDMM0_ITU0dc_OrEyil6M1IliUYEiKma7ANcCiK5CVxVIM8LxBWnycBd0NJG_PQpBTadDsQctWsx2z6dMzZb0iA');
    expect(chiave).toHaveLength(65);
    expect(chiave[0]).toBe(4);
  });

  it('backend e chiave sono quelli del Worker in produzione', () => {
    expect(URL_NOTIFICHE).toBe('https://notifiche.sbeggio.app');
    expect(CHIAVE_VAPID).toBe('BDMM0_ITU0dc_OrEyil6M1IliUYEiKma7ANcCiK5CVxVIM8LxBWnycBd0NJG_PQpBTadDsQctWsx2z6dMzZb0iA');
  });
});

describe('riprogrammazione dopo un cambio di iscrizione push', () => {
  const SCOPE = 'https://sbeggio.app/';
  const voce = (id: string, orario: string): [string, unknown] => [chiaveCache(SCOPE, id), { titolo: 't', testo: 'x', orario }];

  it('riprende dalla Cache gli avvisi ancora futuri, con id e orario', () => {
    const voci = [
      voce(idAvviso(DISPOSITIVO, 'uscita'), '2026-10-01T15:30:00.000Z'),
      voce(idAvviso(DISPOSITIVO, 'pausa'), '2026-10-01T07:59:00.000Z'), // già passato
    ];
    expect(avvisiDaRiprogrammare(voci, SCOPE, ORA)).toEqual([
      { id: idAvviso(DISPOSITIVO, 'uscita'), orario: '2026-10-01T15:30:00.000Z' },
    ]);
  });

  it('salta voci malformate, di un altro scope o con un id non valido', () => {
    const voci: [string, unknown][] = [
      [chiaveCache(SCOPE, idAvviso(DISPOSITIVO, 'pausa')), 'non json'],
      [chiaveCache(SCOPE, idAvviso(DISPOSITIVO, 'pausa')), { titolo: 't', testo: 'x', orario: 'domani' }],
      voce('id con spazi', '2026-10-01T15:30:00.000Z'),
      [chiaveCache('https://altro.example/', idAvviso(DISPOSITIVO, 'uscita')), { titolo: 't', testo: 'x', orario: '2026-10-01T15:30:00.000Z' }],
    ];
    expect(avvisiDaRiprogrammare(voci, SCOPE, ORA)).toEqual([]);
  });
});
