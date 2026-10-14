// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { impostazioni, giornata } from './helpers';

// Il plugin e lo store sono finti: si verifica solo cosa viene chiesto ad Android.
const ln = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  checkExactNotificationSetting: vi.fn(),
  changeExactNotificationSetting: vi.fn(),
  createChannel: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
}));
const dati = vi.hoisted(() => ({ giornata: null as unknown, impostazioni: null as unknown }));

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('../src/native/app', () => ({ inApp: () => true }));
const inizi = vi.hoisted(() => ({ sigaretta: null as number | null }));
vi.mock('../src/ui/inizioSigaretta', () => ({ inizioSigarettaSalvato: () => inizi.sigaretta }));
vi.mock('../src/storage/store', () => ({
  store: {
    giornata: () => dati.giornata,
    get impostazioni() {
      return dati.impostazioni;
    },
    ascolta: vi.fn(),
  },
}));

async function carica() {
  vi.resetModules();
  return import('../src/native/avvisi');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T08:00:00Z')); // 10:00 a Roma (UTC+2)
  for (const f of Object.values(ln)) f.mockReset();
  ln.checkPermissions.mockResolvedValue({ display: 'granted' });
  ln.requestPermissions.mockResolvedValue({ display: 'granted' });
  ln.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
  ln.changeExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
  ln.schedule.mockResolvedValue({ notifications: [] });
  dati.impostazioni = impostazioni();
  dati.giornata = giornata([['ENTRATA', '08:30']]);
});
afterEach(() => vi.useRealTimers());

describe('programmazione delle notifiche', () => {
  it('programma l\'uscita prevista all\'ora giusta, con canale e allarme esatto', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(ln.createChannel).toHaveBeenCalledOnce();
    expect(ln.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    const { notifications } = ln.schedule.mock.calls[0]![0] as { notifications: Record<string, unknown>[] };
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: 1,
      channelId: 'avvisi',
      isExactNotification: true,
      schedule: { at: new Date('2026-10-01T15:00:00Z'), allowWhileIdle: true }, // 17:00 a Roma (pausa minima inclusa)
    });
  });

  it('senza permesso per gli allarmi esatti programma comunque, ma non esatto', async () => {
    ln.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'denied' });
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    const { notifications } = ln.schedule.mock.calls[0]![0] as { notifications: Record<string, unknown>[] };
    expect(notifications[0]).toMatchObject({ isExactNotification: false });
  });

  it('senza permesso per le notifiche non fa nulla e riprova dopo la concessione', async () => {
    ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(ln.schedule).not.toHaveBeenCalled();
    ln.checkPermissions.mockResolvedValue({ display: 'granted' });
    await sincronizzaAvvisi();
    expect(ln.schedule).toHaveBeenCalledOnce();
  });

  it('non riprogramma se il piano non è cambiato', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    await sincronizzaAvvisi();
    expect(ln.schedule).toHaveBeenCalledOnce();
    expect(ln.createChannel).toHaveBeenCalledOnce();
  });

  it('in pausa pranzo cancella l\'uscita e programma il rientro dopo la durata impostata', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    ln.schedule.mockClear();
    ln.cancel.mockClear();
    dati.giornata = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '09:50']]);
    dati.impostazioni = impostazioni({ avvisi: { uscita: true, sigaretta: true, sigarettaAnticipo: 1, pranzo: true, pranzoMinuti: 45 } });
    await sincronizzaAvvisi();
    expect(ln.cancel).toHaveBeenCalledOnce();
    const { notifications } = ln.schedule.mock.calls[0]![0] as { notifications: Record<string, unknown>[] };
    expect(notifications.map((n) => n.id)).toEqual([2]);
    expect(notifications[0]).toMatchObject({ schedule: { at: new Date('2026-10-01T08:35:00Z') } }); // 09:50 + 45 = 10:35 a Roma
  });

  it('se non c\'è più nulla da avvisare cancella tutto e non programma', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    ln.schedule.mockClear();
    dati.giornata = giornata([['ENTRATA', '08:30'], ['USCITA', '09:00']]);
    await sincronizzaAvvisi();
    expect(ln.cancel).toHaveBeenCalledTimes(2);
    expect(ln.schedule).not.toHaveBeenCalled();
  });

  it('pausa sigaretta: usa l\'istante preciso salvato, 1 minuto prima della fine', async () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '09:59']]);
    g.eventi[1]!.sigaretta = true;
    dati.giornata = g;
    inizi.sigaretta = Date.parse('2026-10-01T07:59:20Z'); // 09:59:20 a Roma
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    const { notifications } = ln.schedule.mock.calls[0]![0] as { notifications: Record<string, unknown>[] };
    expect(notifications[0]).toMatchObject({ id: 3, schedule: { at: new Date('2026-10-01T08:09:20Z') } }); // 10:09:20
    inizi.sigaretta = null;
  });

  it('un errore del plugin non blocca le sincronizzazioni successive', async () => {
    ln.createChannel.mockRejectedValueOnce(new Error('boom'));
    const { sincronizzaAvvisi } = await carica();
    await expect(sincronizzaAvvisi()).resolves.toBeUndefined();
    await sincronizzaAvvisi();
    expect(ln.schedule).toHaveBeenCalledOnce();
  });
});

describe('permessi', () => {
  it('richiede le notifiche, poi gli allarmi esatti se mancano', async () => {
    ln.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'prompt' });
    const { richiediPermessi } = await carica();
    expect(await richiediPermessi()).toBe('concessi');
    expect(ln.requestPermissions).toHaveBeenCalledOnce();
    expect(ln.changeExactNotificationSetting).toHaveBeenCalledOnce();
  });

  it('se le notifiche sono rifiutate non apre le impostazioni degli allarmi', async () => {
    ln.requestPermissions.mockResolvedValue({ display: 'denied' });
    ln.checkPermissions.mockResolvedValue({ display: 'denied' });
    const { richiediPermessi } = await carica();
    expect(await richiediPermessi()).toBe('negati');
    expect(ln.changeExactNotificationSetting).not.toHaveBeenCalled();
  });
});
