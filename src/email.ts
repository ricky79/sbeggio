// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

/**
 * Posta di supporto@sbeggio.app (Cloudflare Email Routing → Worker "sbeggio"): ogni mail viene inoltrata
 * all'indirizzo nel secret INOLTRO e chi scrive riceve una risposta automatica di cortesia.
 */

/** Messaggio in arrivo, come lo passa Cloudflare (ForwardableEmailMessage, solo ciò che serve qui). */
export interface MailInArrivo {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  forward(a: string): Promise<void>;
  reply(messaggio: unknown): Promise<void>;
  setReject(motivo: string): void;
}

export interface EnvEmail {
  /** Indirizzo (verificato in Email Routing) a cui inoltrare: secret, non nel repository. */
  INOLTRO?: string;
}

/** Crea l'EmailMessage di Cloudflare (iniettato: nei test non c'è il modulo cloudflare:email). */
export type CreaMessaggio = (da: string, a: string, grezzo: string) => Promise<unknown>;

export const TESTO_RISPOSTA = [
  'Gentile utente,',
  '',
  'grazie della segnalazione: le risponderemo prima possibile.',
  '',
  'Questa è una risposta automatica, non serve rispondere.',
  '',
  'Sbeggio',
  'https://sbeggio.app',
].join('\r\n');

/**
 * Si risponde solo a persone: niente risposte a risponditori automatici, mailing list, bounce o a
 * se stessi (eviterebbe risposte a ping-pong).
 */
export function deveRispondere(da: string, a: string, intestazioni: Headers): boolean {
  const mittente = da.trim().toLowerCase();
  if (!mittente || mittente === a.trim().toLowerCase()) return false;
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce[s]?)([+@.-]|$)/.test(mittente)) return false;
  const auto = intestazioni.get('Auto-Submitted');
  if (auto && auto.trim().toLowerCase() !== 'no') return false;
  if (intestazioni.has('List-Id') || intestazioni.has('List-Unsubscribe')) return false;
  if (/^(bulk|list|junk|auto_reply)$/i.test(intestazioni.get('Precedence')?.trim() ?? '')) return false;
  if (intestazioni.has('X-Autoreply') || intestazioni.has('X-Autorespond')) return false;
  return true;
}

const base64 = (testo: string): string => {
  let binario = '';
  for (const b of new TextEncoder().encode(testo)) binario += String.fromCharCode(b);
  return btoa(binario);
};

/** Intestazione con caratteri non ASCII (RFC 2047), es. accenti nell'oggetto. */
export function codificaIntestazione(testo: string): string {
  const pulito = testo.replace(/[\r\n]+/g, ' ');
  return /^[\x20-\x7e]*$/.test(pulito) ? pulito : `=?UTF-8?B?${base64(pulito)}?=`;
}

/** Oggetto della risposta: "Re: …" una volta sola. */
export function oggettoRisposta(oggetto: string | null): string {
  const o = (oggetto ?? '').trim();
  if (!o) return 'Re: la sua segnalazione';
  return /^re:/i.test(o) ? o : `Re: ${o}`;
}

/** Messaggio MIME della risposta automatica (testo semplice, UTF-8, corpo in base64). */
export function rispostaAutomatica(p: { da: string; a: string; oggetto: string | null; messageId: string | null; id: string; data: Date }): string {
  const corpo = base64(TESTO_RISPOSTA).replace(/.{1,76}/g, '$&\r\n');
  const righe = [
    `From: Sbeggio <${p.da}>`,
    `To: ${p.a}`,
    `Subject: ${codificaIntestazione(oggettoRisposta(p.oggetto))}`,
    `Date: ${p.data.toUTCString()}`,
    `Message-ID: <${p.id}@sbeggio.app>`,
    // Cloudflare accetta la risposta solo se collegata al messaggio originale.
    ...(p.messageId ? [`In-Reply-To: ${p.messageId}`, `References: ${p.messageId}`] : []),
    'Auto-Submitted: auto-replied',
    'X-Auto-Response-Suppress: All',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];
  return `${righe.join('\r\n')}\r\n\r\n${corpo}`;
}

/** Inoltra la mail e, se è il caso, risponde. Un errore della risposta non blocca l'inoltro. */
export async function gestisciEmail(mail: MailInArrivo, env: EnvEmail, creaMessaggio: CreaMessaggio, adesso = new Date()): Promise<void> {
  if (!env.INOLTRO) {
    // Senza destinazione la mail andrebbe persa: meglio rifiutarla, così chi scrive lo sa.
    mail.setReject('Indirizzo temporaneamente non disponibile, riprova più tardi.');
    return;
  }
  await mail.forward(env.INOLTRO);
  if (!deveRispondere(mail.from, mail.to, mail.headers)) return;
  try {
    const grezzo = rispostaAutomatica({
      da: mail.to,
      a: mail.from,
      oggetto: mail.headers.get('Subject'),
      messageId: mail.headers.get('Message-ID'),
      id: crypto.randomUUID(),
      data: adesso,
    });
    await mail.reply(await creaMessaggio(mail.to, mail.from, grezzo));
  } catch (e) {
    // Es. mittente che non supera i controlli DMARC: Cloudflare non permette di rispondere.
    console.warn('Risposta automatica non inviata:', e);
  }
}
