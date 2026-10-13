import { describe, expect, it, vi } from 'vitest';
import { codificaIntestazione, deveRispondere, gestisciEmail, oggettoRisposta, rispostaAutomatica, TESTO_RISPOSTA, type MailInArrivo } from '../src/email';
import worker from '../src/worker';

const H = (h: Record<string, string> = {}) => new Headers(h);

function mailFinta(da = 'mario.rossi@example.com', h: Record<string, string> = { Subject: 'Non vedo il bottone', 'Message-ID': '<abc@example.com>' }) {
  return {
    from: da,
    to: 'supporto@sbeggio.app',
    headers: H(h),
    forward: vi.fn(async () => {}),
    reply: vi.fn(async () => {}),
    setReject: vi.fn(),
  } satisfies MailInArrivo;
}

const decodifica = (grezzo: string) => {
  const [testa, corpo] = grezzo.split('\r\n\r\n');
  const bin = atob(corpo!.replace(/\r\n/g, ''));
  return { testa: testa!, corpo: new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))) };
};

describe('a chi rispondere', () => {
  it('a una persona sì', () => {
    expect(deveRispondere('mario.rossi@example.com', 'supporto@sbeggio.app', H())).toBe(true);
    expect(deveRispondere('Mario <mario@example.com>', 'supporto@sbeggio.app', H({ 'Auto-Submitted': 'no' }))).toBe(true);
  });

  it('niente risposte a risponditori automatici, liste, bounce o a se stessi', () => {
    const a = 'supporto@sbeggio.app';
    expect(deveRispondere('mario@example.com', a, H({ 'Auto-Submitted': 'auto-replied' }))).toBe(false);
    expect(deveRispondere('news@example.com', a, H({ 'List-Id': '<lista.example.com>' }))).toBe(false);
    expect(deveRispondere('news@example.com', a, H({ 'List-Unsubscribe': '<mailto:x@example.com>' }))).toBe(false);
    expect(deveRispondere('x@example.com', a, H({ Precedence: 'bulk' }))).toBe(false);
    expect(deveRispondere('MAILER-DAEMON@example.com', a, H())).toBe(false);
    expect(deveRispondere('noreply@example.com', a, H())).toBe(false);
    expect(deveRispondere('no-reply@example.com', a, H())).toBe(false);
    expect(deveRispondere('supporto@sbeggio.app', a, H())).toBe(false);
    expect(deveRispondere('', a, H())).toBe(false);
  });
});

describe('messaggio di risposta', () => {
  it('oggetto: "Re:" una volta sola, accenti codificati', () => {
    expect(oggettoRisposta('Problema')).toBe('Re: Problema');
    expect(oggettoRisposta('RE: Problema')).toBe('RE: Problema');
    expect(oggettoRisposta(null)).toBe('Re: la sua segnalazione');
    expect(codificaIntestazione('Re: Problema')).toBe('Re: Problema');
    expect(codificaIntestazione('Re: perché?')).toBe(`=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode('Re: perché?')))}?=`);
    expect(codificaIntestazione('a\r\nBcc: x@example.com')).not.toMatch(/[\r\n]/);
  });

  it('collegato al messaggio originale, segnato come automatico, testo in UTF-8', () => {
    const grezzo = rispostaAutomatica({
      da: 'supporto@sbeggio.app',
      a: 'mario@example.com',
      oggetto: 'Non vedo il bottone',
      messageId: '<abc@example.com>',
      id: 'id-1',
      data: new Date('2026-10-12T08:00:00Z'),
    });
    const { testa, corpo } = decodifica(grezzo);
    expect(testa).toContain('From: Sbeggio <supporto@sbeggio.app>');
    expect(testa).toContain('To: mario@example.com');
    expect(testa).toContain('Subject: Re: Non vedo il bottone');
    expect(testa).toContain('In-Reply-To: <abc@example.com>');
    expect(testa).toContain('References: <abc@example.com>');
    expect(testa).toContain('Message-ID: <id-1@sbeggio.app>');
    expect(testa).toContain('Auto-Submitted: auto-replied');
    expect(testa).toContain('Date: Mon, 12 Oct 2026 08:00:00 GMT');
    expect(corpo).toBe(TESTO_RISPOSTA);
    expect(corpo).toContain('grazie della segnalazione: le risponderemo prima possibile.');
    expect(grezzo.split('\r\n').every((r) => r.length <= 998)).toBe(true);
  });
});

describe('gestione della mail', () => {
  it('inoltra e risponde', async () => {
    const mail = mailFinta();
    const crea = vi.fn(async (da: string, a: string, grezzo: string) => ({ da, a, grezzo }));
    await gestisciEmail(mail, { INOLTRO: 'io@gmail.com' }, crea);
    expect(mail.forward).toHaveBeenCalledWith('io@gmail.com');
    expect(crea).toHaveBeenCalledWith('supporto@sbeggio.app', 'mario.rossi@example.com', expect.stringContaining('In-Reply-To: <abc@example.com>'));
    expect(mail.reply).toHaveBeenCalledOnce();
  });

  it('a un risponditore automatico inoltra soltanto', async () => {
    const mail = mailFinta('mario@example.com', { 'Auto-Submitted': 'auto-replied' });
    await gestisciEmail(mail, { INOLTRO: 'io@gmail.com' }, vi.fn());
    expect(mail.forward).toHaveBeenCalled();
    expect(mail.reply).not.toHaveBeenCalled();
  });

  it('se la risposta non parte, la mail è comunque inoltrata', async () => {
    const mail = mailFinta();
    mail.reply.mockRejectedValueOnce(new Error('DMARC'));
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(gestisciEmail(mail, { INOLTRO: 'io@gmail.com' }, async () => ({}))).resolves.toBeUndefined();
    expect(mail.forward).toHaveBeenCalled();
    avviso.mockRestore();
  });

  it('senza indirizzo di inoltro rifiuta la mail invece di perderla', async () => {
    const mail = mailFinta();
    await gestisciEmail(mail, {}, vi.fn());
    expect(mail.setReject).toHaveBeenCalled();
    expect(mail.forward).not.toHaveBeenCalled();
    expect(mail.reply).not.toHaveBeenCalled();
  });

  it('il Worker ha il gestore email', () => {
    expect(typeof worker.email).toBe('function');
  });
});
